window.ElioPermissions = {
  async requestCamera(constraints) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera access needs a modern browser on HTTPS or localhost.');
    }
    if (window.forma) {
      const permitted = await window.forma.invoke('permissions:request', 'camera');
      if (!permitted) throw new Error('Camera access was not approved.');
    }
    try {
      return await navigator.mediaDevices.getUserMedia({ ...constraints, audio: false });
    } catch (error) {
      if (window.forma) await window.forma.invoke('permissions:revoke', 'camera');
      throw error;
    }
  },

  startMicrophoneRecognition(recognition) {
    if (!recognition || typeof recognition.start !== 'function') {
      throw new Error('This browser cannot start speech recognition.');
    }
    recognition.start();
  },

  stopStream(stream) {
    if (stream) stream.getTracks().forEach((track) => track.stop());
  },
};
