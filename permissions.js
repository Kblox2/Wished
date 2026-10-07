window.ElioPermissions = {
  requestCamera(constraints) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(new Error('Camera access needs a modern browser on HTTPS or localhost.'));
    }
    return navigator.mediaDevices.getUserMedia({ ...constraints, audio: false });
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
