window.ElioVision = {
  createBrowserProvider({ video, onEvent, onStatus }) {
    let stream = null;
    let timer = null;
    let previousFrame = null;
    let facePresent = false;
    let lastEventAt = 0;
    let detector = null;
    let detecting = false;
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 24;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    function stopSampling() {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      detecting = false;
      previousFrame = null;
      facePresent = false;
    }

    function stop() {
      stopSampling();
      window.ElioPermissions.stopStream(stream);
      stream = null;
      video.srcObject = null;
      if (window.forma) void window.forma.invoke('permissions:revoke', 'camera');
      onStatus('Camera off. Just us and a little conversation.', false);
    }

    function scheduleSample() {
      if (stream) timer = window.setTimeout(sample, 1500);
    }

    async function sample() {
      if (!stream || !video.videoWidth || detecting) {
        scheduleSample();
        return;
      }
      detecting = true;
      try {
        if (detector) {
          const faces = await detector.detect(video);
          const foundFace = faces.length > 0;
          if (foundFace && !facePresent && Date.now() - lastEventAt > 30000) {
            lastEventAt = Date.now();
            facePresent = true;
            onEvent('face');
          }
          facePresent = foundFace;
        } else {
          if (!context) {
            onStatus('The camera preview is on, but local visual checks are unavailable in this browser.', true);
          } else {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const frame = context.getImageData(0, 0, canvas.width, canvas.height).data;
            if (previousFrame) {
              let changedPixels = 0;
              for (let index = 0; index < frame.length; index += 4) {
                const current = (frame[index] + frame[index + 1] + frame[index + 2]) / 3;
                const previous = (previousFrame[index] + previousFrame[index + 1] + previousFrame[index + 2]) / 3;
                if (Math.abs(current - previous) > 35) changedPixels += 1;
              }
              const changedRatio = changedPixels / (canvas.width * canvas.height);
              if (changedRatio > 0.06 && Date.now() - lastEventAt > 30000) {
                lastEventAt = Date.now();
                onEvent('movement');
              }
            }
            previousFrame = frame;
          }
        }
      } catch (error) {
        detector = null;
        previousFrame = null;
        onStatus(`Vision analysis stopped: ${error.message}. The preview is still on; turn the camera off to end it.`, true);
      } finally {
        detecting = false;
        scheduleSample();
      }
    }

    async function start() {
      try {
        stream = await window.ElioPermissions.requestCamera({
          video: { facingMode: 'user', width: { ideal: 480, max: 640 }, height: { ideal: 360, max: 480 } },
        });
        video.srcObject = stream;
        await video.play();
        const FaceDetectorApi = window.FaceDetector;
        if (FaceDetectorApi) {
          try {
            detector = new FaceDetectorApi({ fastMode: true, maxDetectedFaces: 1 });
          } catch (error) {
            detector = null;
            onStatus(`Face detection isn’t available (${error.message}); I’ll look for movement locally instead.`, true);
          }
        }
        stream.getVideoTracks()[0].addEventListener('ended', () => {
          if (stream) stop();
        }, { once: true });
        onStatus('Camera on. Visual checks stay on this device; no camera feed is displayed or uploaded.', true);
        scheduleSample();
        return true;
      } catch (error) {
        window.ElioPermissions.stopStream(stream);
        stream = null;
        video.srcObject = null;
        if (window.forma) await window.forma.invoke('permissions:revoke', 'camera');
        onStatus(`I couldn’t start the camera: ${error.message}. Check permission and try again.`, false);
        return false;
      }
    }

    return {
      start,
      stop,
      get active() { return stream !== null; },
    };
  },
};
