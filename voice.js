window.ElioVoice = {
  createBrowserProvider({ onExpression, onCaption, onTranscript, isEnabled }) {
    let recognition = null;
    let listening = false;
    let speaking = false;
    let finalTranscript = '';

    function stopSpeech() {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      speaking = false;
    }

    function stopListening() {
      if (recognition && listening) recognition.stop();
    }

    function abortListening() {
      finalTranscript = '';
      if (recognition && listening) recognition.abort();
    }

    function listen() {
      if (listening) {
        stopListening();
        return;
      }

      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Recognition) {
        onCaption('Speech recognition is not supported here. You can still type to me.');
        return;
      }

      stopSpeech();
      recognition = new Recognition();
      finalTranscript = '';
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        let interimTranscript = '';
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (result.isFinal) finalTranscript += result[0].transcript;
          else interimTranscript += result[0].transcript;
        }
        onCaption(interimTranscript ? `I’m hearing: “${interimTranscript}”` : 'I’m listening…');
      };
      recognition.onerror = (event) => {
        if (event.error === 'no-speech') onCaption('I didn’t catch that. Tap the mic and try again.');
        else if (event.error !== 'aborted') onCaption(`The microphone stopped: ${event.error}. You can still type to me.`);
      };
      recognition.onend = () => {
        listening = false;
        if (finalTranscript.trim()) onTranscript(finalTranscript.trim());
        else onExpression('curious');
      };

      try {
        window.ElioPermissions.startMicrophoneRecognition(recognition);
        listening = true;
        onExpression('listening');
        onCaption('I’m all ears. Tap again to interrupt or stop listening.');
      } catch (error) {
        listening = false;
        onCaption(`The microphone couldn’t start: ${error.message}. Check browser permissions.`);
      }
    }

    function speak(text) {
      if (!isEnabled() || !('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return;
      stopSpeech();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.94;
      utterance.pitch = 1.12;
      utterance.onstart = () => {
        speaking = true;
        onExpression('speaking');
      };
      utterance.onend = () => {
        speaking = false;
        onExpression('curious');
      };
      utterance.onerror = (event) => {
        speaking = false;
        if (event.error !== 'canceled' && event.error !== 'interrupted') {
          onCaption(`Voice playback couldn’t start: ${event.error}. You can still read my reply.`);
        }
      };
      window.speechSynthesis.speak(utterance);
    }

    function dispose() {
      if (recognition && listening) recognition.abort();
      stopSpeech();
      listening = false;
    }

    return {
      listen,
      speak,
      stopListening,
      abortListening,
      stopSpeech,
      dispose,
      get listening() { return listening; },
      get speaking() { return speaking; },
    };
  },
};
