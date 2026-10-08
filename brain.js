window.ElioBrain = (() => {
  function createProvider({ memory }) {
    if (!memory || typeof memory.getSettings !== 'function' || typeof memory.getLongTerm !== 'function') {
      throw new Error('Elio brain could not connect to its memory provider.');
    }
    const personality = window.ElioPersonality.create();
    let requestSequence = 0;
    let activeRequestId = null;

    async function think({ message, onChunk = () => {} }) {
      const text = String(message || '').trim().slice(0, 500);
      if (!text) throw new Error('Enter a message before starting a conversation.');
      if (!window.forma || typeof window.forma.invoke !== 'function') {
        throw new Error('The secure AI service is unavailable. Restart The System and try again.');
      }

      const settings = memory.getSettings() || {};
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
      const preferredTitle = Array.isArray(settings.selectedTitles) ? settings.selectedTitles[0] || '' : '';
      activeRequestId = requestId;
      const removeChunkListener = window.forma.onAIChunk((chunk) => {
        if (chunk.requestId === requestId && typeof chunk.text === 'string') onChunk(chunk.text);
      });

      try {
        const result = await window.forma.invoke('ai:generate', {
          requestId,
          message: text,
          history,
          memories,
          preferredTitle,
        });

        if (result?.cancelled) return { cancelled: true };
        if (!result || typeof result.response !== 'string' || !result.response.trim()) {
          throw new Error('The AI provider returned an empty response.');
        }

        const emotion = typeof result.emotion === 'string' && result.emotion.trim()
          ? result.emotion.trim().toLowerCase()
          : 'neutral';

        memory.addTurn('user', text);
        memory.addTurn('elio', result.response);
        if (settings.memoryEnabled) {
          for (const candidate of Array.isArray(result.memoryCandidates) ? result.memoryCandidates : []) {
            memory.remember('notes', candidate);
          }
        }
        personality.finishTurn(emotion);

        return {
          reply: result.response,
          expression: emotion,
          intensity: result.emotionIntensity,
          mood: emotion.toUpperCase(),
          state: personality.getState(),
        };
      } finally {
        removeChunkListener();
        if (activeRequestId === requestId) activeRequestId = null;
      }
    }

    function cancel() {
      if (activeRequestId) return window.forma.invoke('ai:cancel', activeRequestId);
      return Promise.resolve(false);
    }

    function observe() {
      return { expression: 'curious', mood: 'CURIOUS' };
    }

    return { think, cancel, observe, getState: personality.getState };
  }

  return { createProvider };
})();
