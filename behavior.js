window.ElioBehavior = {
  create({ onCheckIn, onSleep, onWake }) {
    let enabled = true;
    let lastActivity = Date.now();
    let lastCheckIn = 0;
    let checkInsThisSession = 0;
    let timer = null;
    let sleeping = false;

    function recordActivity() {
      lastActivity = Date.now();
      if (sleeping) {
        sleeping = false;
        onWake();
      }
    }

    function tick() {
      if (!enabled || document.visibilityState !== 'visible' || !document.hasFocus()) return;
      const idleFor = Date.now() - lastActivity;
      const now = Date.now();
      if (idleFor >= 90000 && checkInsThisSession < 3 && now - lastCheckIn >= 210000) {
        lastCheckIn = now;
        checkInsThisSession += 1;
        onCheckIn();
      } else if (idleFor >= 480000 && !sleeping) {
        sleeping = true;
        onSleep();
      }
    }

    function setEnabled(value) {
      enabled = Boolean(value);
      if (!enabled) recordActivity();
    }

    function start() {
      if (timer !== null) return;
      ['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
        window.addEventListener(eventName, recordActivity, { passive: true });
      });
      timer = window.setInterval(tick, 15000);
    }

    function stop() {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      ['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
        window.removeEventListener(eventName, recordActivity);
      });
    }

    return { start, stop, setEnabled, recordActivity };
  },
};
