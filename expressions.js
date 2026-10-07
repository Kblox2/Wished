window.ElioExpressions = {
  create({ scene, moodLabel }) {
    const labels = {
      curious: 'CURIOUS',
      happy: 'HAPPY',
      excited: 'EXCITED',
      sad: 'SAD',
      concerned: 'CONCERNED',
      worried: 'WORRIED',
      surprised: 'SURPRISED',
      love: 'AFFECTIONATE',
      sleepy: 'SLEEPY',
      thinking: 'THINKING',
      listening: 'LISTENING',
      speaking: 'SPEAKING',
      confused: 'CONFUSED',
      annoyed: 'ANNOYED',
      neutral: 'NEUTRAL',
    };

    function set(expression, label) {
      const selected = Object.hasOwn(labels, expression) ? expression : 'curious';
      scene.dataset.expression = selected;
      moodLabel.textContent = label || labels[selected];
    }

    return { set };
  },
};
