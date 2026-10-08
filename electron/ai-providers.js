async function providerError(response, provider) {
  const body = await response.text();
  let detail = body;
  try {
    const parsed = JSON.parse(body);
    detail = parsed.error?.message || parsed.message || body;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }
  return new Error(`${provider} request failed (${response.status}): ${detail.slice(0, 500)}`);
}

async function streamSSE(response, provider, onText) {
  if (!response.body) throw new Error(`${provider} returned an empty response stream.`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let outputText = '';

  function processLine(line) {
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') return;
    const event = JSON.parse(data);

    if (provider === 'OpenAI') {
      if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
        outputText += event.delta;
        onText(outputText);
      } else if (event.type === 'response.failed' || event.type === 'error') {
        throw new Error(event.response?.error?.message || event.error?.message || 'OpenAI could not complete the response.');
      }
      return;
    }

    if (event.event_type === 'step.delta' && event.delta?.type === 'text' && typeof event.delta.text === 'string') {
      outputText += event.delta.text;
      onText(outputText);
    } else if (event.event_type === 'interaction.failed' || event.interaction?.status === 'failed') {
      throw new Error(event.error?.message || event.interaction?.error?.message || 'Gemini could not complete the response.');
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    lines.forEach(processLine);
    if (done) break;
  }
  if (buffer) processLine(buffer);
  if (!outputText) throw new Error(`${provider} returned no response text.`);
  return outputText;
}

async function requestOpenAI({ apiKey, model, input, instructions, schema, useWebSearch, signal, fetchImpl, onText }) {
  const response = await fetchImpl('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    signal,
    body: JSON.stringify({
      model,
      store: false,
      stream: true,
      instructions,
      input,
      ...(useWebSearch ? { tools: [{ type: 'web_search' }] } : {}),
      text: {
        format: {
          type: 'json_schema',
          name: 'companion_response',
          strict: true,
          schema,
        },
      },
    }),
  });
  if (!response.ok) throw await providerError(response, 'OpenAI');
  return streamSSE(response, 'OpenAI', onText);
}

async function requestGemini({ apiKey, model, input, instructions, schema, useWebSearch, signal, fetchImpl, onText }) {
  const transcript = input.map((turn) => (
    `${turn.role === 'assistant' ? 'KAIRO' : 'USER'}:\n${turn.content}`
  )).join('\n\n');
  const response = await fetchImpl('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    signal,
    body: JSON.stringify({
      model,
      input: transcript,
      system_instruction: instructions,
      store: false,
      stream: true,
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema,
      },
      ...(useWebSearch ? { tools: [{ type: 'google_search' }] } : {}),
    }),
  });
  if (!response.ok) throw await providerError(response, 'Gemini');
  return streamSSE(response, 'Gemini', onText);
}

export async function generateWithFallback(options) {
  const {
    openAIKey,
    geminiKey,
    openAIModel,
    geminiModel,
    input,
    instructions,
    schema,
    useWebSearch,
    signal,
    fetchImpl = fetch,
    onText = () => {},
  } = options;

  if (!openAIKey && !geminiKey) {
    throw new Error('No AI provider is configured. Add OPENAI_API_KEY or GEMINI_API_KEY to the project .env file, then restart the app.');
  }

  let openAIError = null;
  if (openAIKey) {
    try {
      return {
        provider: 'openai',
        outputText: await requestOpenAI({
          apiKey: openAIKey,
          model: openAIModel,
          input,
          instructions,
          schema,
          useWebSearch,
          signal,
          fetchImpl,
          onText,
        }),
      };
    } catch (error) {
      if (signal.aborted) throw error;
      openAIError = error;
      if (!geminiKey) throw error;
      onText('');
    }
  }

  try {
    return {
      provider: 'gemini',
      outputText: await requestGemini({
        apiKey: geminiKey,
        model: geminiModel,
        input,
        instructions,
        schema,
        useWebSearch,
        signal,
        fetchImpl,
        onText,
      }),
    };
  } catch (error) {
    if (signal.aborted) throw error;
    if (!openAIError) throw error;
    throw new Error(`${openAIError.message} Gemini fallback also failed: ${error.message}`);
  }
}
