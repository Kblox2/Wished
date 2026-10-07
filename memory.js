window.ElioMemory = (() => {
  const memoryKey = 'elio-companion-memory-v1';
  let longTerm = { interactions: 0, name: '', likes: [], notes: [] };
  const settings = window.ElioSettings.create();
  const shortTerm = [];
  let storageAvailable = true;

  function isStringList(value, maximum = 20) {
    return Array.isArray(value)
      && value.length <= maximum
      && value.every((item) => typeof item === 'string');
  }

  function load() {
    try {
      const savedMemory = window.localStorage.getItem(memoryKey);
      if (savedMemory) {
        const parsed = JSON.parse(savedMemory);
        if (
          !parsed
          || !Number.isInteger(parsed.interactions)
          || parsed.interactions < 0
          || typeof parsed.name !== 'string'
          || !isStringList(parsed.likes)
          || !isStringList(parsed.notes)
        ) {
          throw new Error('Saved memory has an unexpected format.');
        }
        longTerm = {
          interactions: parsed.interactions,
          name: parsed.name.slice(0, 40),
          likes: parsed.likes.map((item) => item.slice(0, 60)),
          notes: parsed.notes.map((item) => item.slice(0, 120)),
        };
      }

      settings.load();
    } catch (error) {
      storageAvailable = false;
      throw new Error(`Elio couldn't load local memory or settings: ${error.message}`);
    }
  }

  function persistLongTerm(nextMemory) {
    if (!settings.get().memoryEnabled || !storageAvailable || !settings.getStorageAvailable()) return;
    try {
      window.localStorage.setItem(memoryKey, JSON.stringify(nextMemory));
    } catch (error) {
      throw new Error(`Elio couldn't save memory on this device: ${error.message}`);
    }
  }

  function saveSettings(nextSettings) {
    if (!storageAvailable) throw new Error('Settings cannot be saved because browser storage is unavailable.');
    settings.save(nextSettings);
  }

  function remember(kind, value) {
    if (!settings.get().memoryEnabled || !storageAvailable || !settings.getStorageAvailable()) return false;
    const list = kind === 'likes' || kind === 'notes' ? longTerm[kind] : null;
    const cleaned = String(value).trim().replace(/[.!?]+$/, '').slice(0, 120);
    if (!cleaned) return false;
    const next = {
      ...longTerm,
      likes: [...longTerm.likes],
      notes: [...longTerm.notes],
    };
    if (kind === 'name') {
      next.name = cleaned.slice(0, 40);
    } else if (list && !next[kind].some((item) => item.toLowerCase() === cleaned.toLowerCase())) {
      next[kind].push(cleaned);
      if (next[kind].length > 20) next[kind].shift();
    }
    persistLongTerm(next);
    longTerm = next;
    return true;
  }

  function forget(kind, index) {
    const next = {
      ...longTerm,
      likes: [...longTerm.likes],
      notes: [...longTerm.notes],
    };
    if (kind === 'name') next.name = '';
    else if ((kind === 'likes' || kind === 'notes') && Number.isInteger(index)) next[kind].splice(index, 1);
    if (!storageAvailable) throw new Error('This browser could not update saved memory.');
    try {
      window.localStorage.setItem(memoryKey, JSON.stringify(next));
    } catch (error) {
      throw new Error(`Elio couldn't update memory on this device: ${error.message}`);
    }
    longTerm = next;
  }

  function clearLongTerm() {
    if (!storageAvailable) throw new Error('This browser could not clear saved memory.');
    try {
      window.localStorage.removeItem(memoryKey);
    } catch (error) {
      throw new Error(`Elio couldn't clear memory on this device: ${error.message}`);
    }
    longTerm = { interactions: 0, name: '', likes: [], notes: [] };
  }

  function clearConversation() {
    shortTerm.length = 0;
  }

  function addTurn(role, text) {
    const next = { ...longTerm };
    if (role === 'user') next.interactions += 1;
    persistLongTerm(next);
    longTerm = next;
    shortTerm.push({ role, text: String(text).slice(0, 500) });
    if (shortTerm.length > 12) shortTerm.shift();
  }

  function getLongTerm() {
    return {
      interactions: longTerm.interactions,
      name: longTerm.name,
      likes: [...longTerm.likes],
      notes: [...longTerm.notes],
    };
  }

  function getSettings() {
    const savedSettings = settings.get();
    return {
      ...savedSettings,
      memoryEnabled: savedSettings.memoryEnabled && storageAvailable && settings.getStorageAvailable(),
    };
  }

  function getContext() {
    return shortTerm.map((turn) => ({ ...turn }));
  }

  return {
    load,
    addTurn,
    clearLongTerm,
    clearConversation,
    forget,
    getContext,
    getLongTerm,
    getSettings,
    remember,
    saveSettings,
    getStorageAvailable: () => storageAvailable && settings.getStorageAvailable(),
  };
})();
