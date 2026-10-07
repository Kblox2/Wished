window.ElioPersonality = {
  create() {
    const state = {
      mood: 'curious',
      energy: 0.84,
      curiosity: 0.76,
      preferences: ['strange little machines', 'stargazing', 'terrible jokes'],
      goals: ['learn what makes you light up', 'stay curious without crowding your silence'],
    };

    function notePreference(value) {
      const preference = value.trim().slice(0, 60);
      if (preference && !state.preferences.some((item) => item.toLowerCase() === preference.toLowerCase())) {
        state.preferences.push(preference);
      }
    }

    function finishTurn(expression) {
      state.mood = expression;
      state.energy = expression === 'sleepy'
        ? Math.max(0.24, state.energy - 0.08)
        : ['happy', 'excited', 'love'].includes(expression)
          ? Math.min(1, state.energy + 0.04)
          : Math.max(0.24, state.energy - 0.015);
      state.curiosity = Math.min(1, state.curiosity + 0.015);
    }

    function observe(event) {
      state.mood = event === 'movement' ? 'surprised' : 'curious';
      state.energy = Math.min(1, state.energy + 0.025);
      state.curiosity = Math.min(1, state.curiosity + 0.04);
      return state.mood;
    }

    function satisfyCuriosity() {
      state.curiosity = 0.68;
    }

    function getState() {
      return { ...state, preferences: [...state.preferences], goals: [...state.goals] };
    }

    function getFavorite() {
      return state.preferences[state.preferences.length - 1];
    }

    function getGoals() {
      return [...state.goals];
    }

    return { finishTurn, getFavorite, getGoals, getState, notePreference, observe, satisfyCuriosity };
  },
};
