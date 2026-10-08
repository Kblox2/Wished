window.ElioBrain = (() => {
  function createProvider({ memory }) {
    const personality = window.ElioPersonality.create();
    let requestSequence = 0;
    let activeRequestId = null;

    async function think({ message, onChunk = () => {} }) {
      const text = String(message || '').trim();
      if (!text) throw new Error('Enter a message before starting a conversation.');
      if (!window.kairo || typeof window.kairo.invoke !== 'function') {
        throw new Error('The secure AI service is unavailable. Restart The System and try again.');
      }

      const settings = memory.getSettings();
      const saved = settings.memoryEnabled ? memory.getLongTerm() : { name: '', likes: [], notes: [] };
      const memories = [
        ...(saved.name ? [`The user's name is ${saved.name}.`] : []),
        ...saved.likes.map((item) => `The user likes ${item}.`),
        ...saved.notes,
      ];
      const history = memory.getContext().slice(-10).map((turn) => ({
        role: turn.role === 'elio' ? 'assistant' : 'user',
        content: turn.text,
      }));
      const requestId = `turn-${Date.now()}-${++requestSequence}`;
      const preferredTitle = settings.selectedTitles[0] || '';
      activeRequestId = requestId;
      const removeChunkListener = window.kairo.onAIChunk((chunk) => {
        if (chunk.requestId === requestId && typeof chunk.text === 'string') onChunk(chunk.text);
      });

      try {
        const result = await window.kairo.invoke('ai:generate', {
          requestId,
          message: text,
          history,
          memories,
          preferredTitle,
        });

        if (result.cancelled) return { cancelled: true };
        if (typeof result.response !== 'string' || !result.response.trim()) {
          throw new Error('The AI provider returned an empty response.');
        }

        memory.addTurn('user', text);
        memory.addTurn('elio', result.response);
        if (settings.memoryEnabled) {
          for (const candidate of result.memoryCandidates || []) {
            memory.remember('notes', candidate);
          }
        }
        personality.finishTurn(result.emotion);

        return {
          reply: result.response,
          expression: result.emotion,
          intensity: result.emotionIntensity,
          mood: result.emotion.toUpperCase(),
          state: personality.getState(),
        };
      } finally {
        removeChunkListener();
        if (activeRequestId === requestId) activeRequestId = null;
      }
    }

    function cancel() {
      if (activeRequestId) return window.kairo.invoke('ai:cancel', activeRequestId);
      return Promise.resolve(false);
    }

    function observe() {
      return { expression: 'curious', mood: 'CURIOUS' };
    }

    return { think, cancel, observe, getState: personality.getState };
  }

  return { createProvider };
})();
