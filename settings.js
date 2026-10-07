window.ElioSettings = {
  create() {
    const storageKey = 'elio-companion-settings-v1';
    const allowedTitles = ['Architect', 'Captain', 'Boss', 'Sir', 'Architect of the System'];
    const defaults = {
      selectedTitles: ['Architect'],
      memoryEnabled: true,
      autonomyEnabled: true,
      speechEnabled: true,
    };
    let values = {
      ...defaults,
      selectedTitles: [...defaults.selectedTitles],
    };
    let storageAvailable = true;

    function load() {
      try {
        const saved = window.localStorage.getItem(storageKey);
        if (!saved) return;
        const parsed = JSON.parse(saved);
        if (
          !parsed
          || !Array.isArray(parsed.selectedTitles)
          || parsed.selectedTitles.length > allowedTitles.length
          || parsed.selectedTitles.some((title) => !allowedTitles.includes(title))
          || typeof parsed.memoryEnabled !== 'boolean'
          || typeof parsed.autonomyEnabled !== 'boolean'
          || typeof parsed.speechEnabled !== 'boolean'
        ) {
          throw new Error('Saved settings have an unexpected format.');
        }
        values = {
          selectedTitles: parsed.selectedTitles.length ? [...new Set(parsed.selectedTitles)] : [...defaults.selectedTitles],
          memoryEnabled: parsed.memoryEnabled,
          autonomyEnabled: parsed.autonomyEnabled,
          speechEnabled: parsed.speechEnabled,
        };
      } catch (error) {
        storageAvailable = false;
        throw new Error(`Elio couldn't load settings: ${error.message}`);
      }
    }

    function save(nextSettings) {
      const next = { ...values, ...nextSettings };
      const selectedTitles = [...new Set(next.selectedTitles)];
      if (
        selectedTitles.length === 0
        || selectedTitles.some((title) => !allowedTitles.includes(title))
        || typeof next.memoryEnabled !== 'boolean'
        || typeof next.autonomyEnabled !== 'boolean'
        || typeof next.speechEnabled !== 'boolean'
      ) {
        throw new Error('Choose at least one valid title and check your settings.');
      }
      if (!storageAvailable) throw new Error('Settings cannot be saved because browser storage is unavailable.');
      next.selectedTitles = selectedTitles;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (error) {
        storageAvailable = false;
        throw new Error(`Elio couldn't save settings on this device: ${error.message}`);
      }
      values = next;
    }

    function get() {
      return { ...values, selectedTitles: [...values.selectedTitles] };
    }

    return { get, load, save, getStorageAvailable: () => storageAvailable };
  },
};
