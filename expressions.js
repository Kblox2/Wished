window.ElioExpressions = {
  create({ scene, moodLabel }) {
    const labels = {
      happy: 'HAPPY',
      sad: 'SAD',
      angry: 'ANGRY',
      confused: 'CONFUSED',
      curious: 'CURIOUS',
      surprised: 'SURPRISED',
      sleepy: 'SLEEPY',
      tired: 'TIRED',
      bored: 'BORED',
      excited: 'EXCITED',
      thinking: 'THINKING',
      focused: 'FOCUSED',
      worried: 'WORRIED',
      nervous: 'NERVOUS',
      proud: 'PROUD',
      playful: 'PLAYFUL',
      laughing: 'LAUGHING',
      listening: 'LISTENING',
      speaking: 'SPEAKING',
      singing: 'SINGING',
      neutral: 'NEUTRAL',
    };

    function set(expression, label) {
      const selected = Object.hasOwn(labels, expression) ? expression : 'neutral';
      scene.dataset.expression = selected;
      moodLabel.textContent = label || labels[selected];
    }

    return { set };
  },
};
