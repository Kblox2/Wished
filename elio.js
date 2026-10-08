const elements = {
  robotScene: document.getElementById('robotScene'),
  moodLabel: document.getElementById('moodLabel'),
  sceneCaption: document.getElementById('sceneCaption'),
  welcomeTitle: document.getElementById('welcomeTitle'),
  cameraButton: document.getElementById('cameraButton'),
  cameraButtonLabel: document.getElementById('cameraButtonLabel'),
  cameraVideo: document.getElementById('cameraVideo'),
  voiceButton: document.getElementById('voiceButton'),
  voiceButtonLabel: document.getElementById('voiceButtonLabel'),
  soundButton: document.getElementById('soundButton'),
  soundIcon: document.getElementById('soundIcon'),
  memoryHeading: document.getElementById('memoryHeading'),
  memorySummary: document.getElementById('memorySummary'),
  memoryCount: document.getElementById('memoryCount'),
  messages: document.getElementById('messages'),
  providerStatus: document.getElementById('providerStatus'),
  chatForm: document.getElementById('chatForm'),
  messageInput: document.getElementById('messageInput'),
  clearChatButton: document.getElementById('clearChatButton'),
  settingsButton: document.getElementById('settingsButton'),
  settingsDialog: document.getElementById('settingsDialog'),
  closeSettingsButton: document.getElementById('closeSettingsButton'),
  memoryEnabled: document.getElementById('memoryEnabled'),
  autonomyEnabled: document.getElementById('autonomyEnabled'),
  webSearchEnabled: document.getElementById('webSearchEnabled'),
  memoryList: document.getElementById('memoryList'),
  memoryEmpty: document.getElementById('memoryEmpty'),
  forgetAllButton: document.getElementById('forgetAllButton'),
  openMemoriesButton: document.getElementById('openMemoriesButton'),
};

let memoryError = '';
let baseExpression = 'curious';
let webSearchPermissionEnabled = false;
const expressions = window.ElioExpressions.create({
  scene: elements.robotScene,
  moodLabel: elements.moodLabel,
});

function showCaption(message) {
  elements.sceneCaption.textContent = message;
}

function setExpression(expression, caption, moodLabel, intensity) {
  if (expression !== 'speaking' && expression !== 'listening') baseExpression = expression;
  expressions.set(expression, moodLabel);
  if (Number.isFinite(intensity)) elements.robotScene.dataset.intensity = String(Math.max(0, Math.min(1, intensity)));
  if (caption) showCaption(caption);
}

function currentTitle() {
  const titles = window.ElioMemory.getSettings().selectedTitles;
  const turnCount = window.ElioMemory.getLongTerm().interactions;
  return titles[turnCount % titles.length] || 'Architect';
}

function updateMemoryDisplay() {
  const saved = window.ElioMemory.getLongTerm();
  const count = saved.likes.length + saved.notes.length + (saved.name ? 1 : 0);
  const settings = window.ElioMemory.getSettings();
  elements.memoryCount.textContent = String(count);
  elements.welcomeTitle.textContent = currentTitle();

  if (memoryError) {
    elements.memoryHeading.textContent = 'Memory unavailable';
    elements.memorySummary.textContent = memoryError;
  } else if (!settings.memoryEnabled) {
    elements.memoryHeading.textContent = 'Long-term memory is off';
    elements.memorySummary.textContent = count
      ? `${count} saved ${count === 1 ? 'memory remains' : 'memories remain'} on this device.`
      : 'I’ll keep track of this chat, but won’t save anything for next time.';
  } else if (!count) {
    elements.memoryHeading.textContent = 'Getting to know you';
    elements.memorySummary.textContent = saved.interactions
      ? `We’ve shared ${saved.interactions} little ${saved.interactions === 1 ? 'moment' : 'moments'} so far.`
      : 'Kairo remembers the things you choose to share.';
  } else {
    const details = [];
    if (saved.name) details.push(`your name is ${saved.name}`);
    if (saved.likes.length) details.push(`you like ${saved.likes[saved.likes.length - 1]}`);
    if (saved.notes.length) details.push(saved.notes[saved.notes.length - 1]);
    elements.memoryHeading.textContent = 'A few things I know about you';
    elements.memorySummary.textContent = details.join(' · ');
  }
  renderMemoryList();
}

function renderMemoryList() {
  const saved = window.ElioMemory.getLongTerm();
  const entries = [];
  if (saved.name) entries.push({ kind: 'name', index: 0, text: `Your name is ${saved.name}` });
  saved.likes.forEach((text, index) => entries.push({ kind: 'likes', index, text: `You like ${text}` }));
  saved.notes.forEach((text, index) => entries.push({ kind: 'notes', index, text }));
  elements.memoryList.replaceChildren();
  elements.memoryEmpty.hidden = entries.length > 0;

  entries.forEach((entry) => {
    const item = document.createElement('li');
    const text = document.createElement('span');
    text.textContent = entry.text;
    const forgetButton = document.createElement('button');
    forgetButton.type = 'button';
    forgetButton.dataset.kind = entry.kind;
    forgetButton.dataset.index = String(entry.index);
    forgetButton.textContent = 'Forget';
    forgetButton.setAttribute('aria-label', `Forget memory: ${entry.text}`);
    item.append(text, forgetButton);
    elements.memoryList.append(item);
  });
}

function addMessage(speaker, text) {
  const row = document.createElement('div');
  row.className = `message-row ${speaker === 'elio' ? 'elio-row' : 'user-row'}`;
  if (speaker === 'elio') {
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = 'e';
    row.append(avatar);
  }

  const content = document.createElement('div');
  content.className = 'message-content';
  const author = document.createElement('span');
  author.className = 'message-author';
  author.textContent = speaker === 'elio' ? 'KAIRO' : 'YOU';
  const time = document.createElement('span');
  time.textContent = 'JUST NOW';
  author.append(time);

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.textContent = text;
  content.append(author, bubble);
  row.append(content);
  elements.messages.append(row);
  elements.messages.scrollTop = elements.messages.scrollHeight;
  return { row, bubble };
}

const brain = window.ElioBrain.createProvider({ memory: window.ElioMemory });

const voice = window.ElioVoice.createBrowserProvider({
  onExpression: (expression) => {
    if (expression === 'speaking') {
      elements.robotScene.dataset.speaking = 'true';
      elements.moodLabel.textContent = 'SPEAKING';
    } else {
      elements.robotScene.dataset.speaking = 'false';
      setExpression(expression === 'curious' ? baseExpression : expression);
    }
    const listening = expression === 'listening';
    elements.voiceButton.setAttribute('aria-pressed', String(listening));
    elements.voiceButtonLabel.textContent = listening
      ? 'Listening · tap to stop'
      : voice.speaking ? 'Interrupt & talk' : 'Talk to Kairo';
  },
  onCaption: showCaption,
  onTranscript: (transcript) => sendMessage(transcript),
  onViseme: (viseme) => elements.robotScene.dispatchEvent(new CustomEvent('kairo:viseme', { detail: viseme })),
  isEnabled: () => window.ElioMemory.getSettings().speechEnabled,
});

const vision = window.ElioVision.createBrowserProvider({
  video: elements.cameraVideo,
  onStatus: (caption, active) => {
    elements.cameraButton.setAttribute('aria-pressed', String(active));
    elements.cameraButtonLabel.textContent = active ? 'Turn camera off' : 'Turn camera on';
    showCaption(caption);
  },
  onEvent: (event) => {
    const observation = brain.observe(event);
    const caption = event === 'face'
      ? 'Local vision detected a face; no image was sent.'
      : 'Local vision noticed movement; no image was sent.';
    setExpression(observation.expression, caption, observation.mood);
    behavior.recordActivity();
  },
});

const behavior = window.ElioBehavior.create({
  onCheckIn: () => {
    setExpression('curious', 'Quiet moment. I’ll let you choose what comes next.');
  },
  onSleep: () => setExpression('sleepy', 'I’m getting a little quiet. I’ll be here when you need me.'),
  onWake: () => setExpression('curious', 'Oh, you’re back. I was only resting my eyes.'),
});

async function sendMessage(message) {
  const text = String(message || '').trim().slice(0, 500);
  if (!text) return;
  behavior.recordActivity();
  if (voice.listening) voice.abortListening();
  voice.stopSpeech();
  await brain.cancel();
  addMessage('you', text);
  const responseMessage = addMessage('elio', '…');
  setExpression('thinking', 'I’m considering the question.');

  try {
    const result = await brain.think({
      message: text,
      onChunk: (partial) => {
        responseMessage.bubble.textContent = partial;
        elements.messages.scrollTop = elements.messages.scrollHeight;
      },
    });
    if (result.cancelled) {
      responseMessage.row.remove();
      return;
    }
    responseMessage.bubble.textContent = result.reply;
    elements.providerStatus.hidden = true;
    setExpression(result.expression, result.reply, result.mood, result.intensity);
    updateMemoryDisplay();
    voice.speak(result.reply);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    responseMessage.bubble.textContent = `AI request failed: ${detail}`;
    showCaption(detail);
    elements.providerStatus.textContent = detail;
    elements.providerStatus.hidden = false;
    elements.providerStatus.dataset.state = 'error';
    setExpression('worried', 'The AI request did not complete.');
  }
}

function submitMessage(event) {
  event.preventDefault();
  const text = elements.messageInput.value;
  if (!text.trim()) return;
  elements.messageInput.value = '';
  sendMessage(text);
  elements.messageInput.focus();
}

async function toggleCamera() {
  if (vision.active) {
    vision.stop();
    setExpression('curious', 'Camera off. Just us and a little conversation.');
    return;
  }
  elements.cameraButton.disabled = true;
  setExpression('curious', 'Asking your browser for camera permission…');
  await vision.start();
  elements.cameraButton.disabled = false;
  behavior.recordActivity();
}

function openSettings() {
  const settings = window.ElioMemory.getSettings();
  elements.memoryEnabled.checked = settings.memoryEnabled;
  elements.autonomyEnabled.checked = settings.autonomyEnabled;
  elements.webSearchEnabled.checked = webSearchPermissionEnabled;
  document.querySelectorAll('input[name="title"]').forEach((input) => {
    input.checked = settings.selectedTitles.includes(input.value);
  });
  updateMemoryDisplay();
  if (typeof elements.settingsDialog.showModal === 'function') elements.settingsDialog.showModal();
  else elements.settingsDialog.setAttribute('open', '');
}

function closeSettings() {
  if (typeof elements.settingsDialog.close === 'function' && elements.settingsDialog.open) {
    elements.settingsDialog.close();
  } else {
    elements.settingsDialog.removeAttribute('open');
  }
}

function saveSettings(nextSettings) {
  try {
    window.ElioMemory.saveSettings(nextSettings);
    updateMemoryDisplay();
    return true;
  } catch (error) {
    showCaption(error.message);
    return false;
  }
}

function updateTitleSettings() {
  const selectedTitles = [...document.querySelectorAll('input[name="title"]:checked')].map((input) => input.value);
  if (!selectedTitles.length) {
    const firstTitle = document.querySelector('input[name="title"]');
    firstTitle.checked = true;
    showCaption('Pick at least one title so I know how to get your attention.');
    return;
  }
  if (saveSettings({ selectedTitles })) {
    showCaption(`All right, ${currentTitle()}. I’ll use the titles you picked.`);
  }
}

function toggleSpeech() {
  const enabled = !window.ElioMemory.getSettings().speechEnabled;
  if (!saveSettings({ speechEnabled: enabled })) return;
  elements.soundButton.setAttribute('aria-pressed', String(enabled));
  elements.soundButton.setAttribute('aria-label', enabled ? "Mute Kairo's voice" : "Unmute Kairo's voice");
  elements.soundIcon.textContent = enabled ? '♫' : '♪';
  if (!enabled) voice.stopSpeech();
  showCaption(enabled ? 'Voice replies are on.' : 'Voice replies are muted. I’ll keep chatting here.');
}

function clearConversation() {
  window.ElioMemory.clearConversation();
  elements.messages.replaceChildren();
  setExpression('curious', 'A clear thread. Ask me anything.');
  brain.cancel();
  voice.stopSpeech();
}

function forgetMemory(kind, index) {
  try {
    window.ElioMemory.forget(kind, index);
    updateMemoryDisplay();
    showCaption('Forgotten. That memory has been removed from this device.');
  } catch (error) {
    showCaption(error.message);
  }
}

elements.chatForm.addEventListener('submit', submitMessage);
document.querySelectorAll('[data-window-action]').forEach((button) => {
  button.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      await window.kairo.invoke('window-action', button.dataset.windowAction);
    } catch (error) {
      showCaption(`Window action failed: ${error.message}`);
    }
  });
});
elements.cameraButton.addEventListener('click', toggleCamera);
elements.voiceButton.addEventListener('click', () => {
  behavior.recordActivity();
  brain.cancel();
  voice.listen();
  elements.voiceButton.setAttribute('aria-pressed', String(voice.listening));
  elements.voiceButtonLabel.textContent = voice.listening ? 'Listening · tap to stop' : 'Talk to Kairo';
});
elements.soundButton.addEventListener('click', toggleSpeech);
elements.clearChatButton.addEventListener('click', clearConversation);
elements.settingsButton.addEventListener('click', openSettings);
elements.openMemoriesButton.addEventListener('click', openSettings);
elements.closeSettingsButton.addEventListener('click', closeSettings);
elements.memoryEnabled.addEventListener('change', () => {
  if (saveSettings({ memoryEnabled: elements.memoryEnabled.checked })) {
    showCaption(elements.memoryEnabled.checked
      ? 'Long-term memory is on. You can review or remove anything I save here.'
      : 'Long-term memory is off. Existing memories stay here until you remove them.');
  } else {
    elements.memoryEnabled.checked = window.ElioMemory.getSettings().memoryEnabled;
  }
});
elements.autonomyEnabled.addEventListener('change', () => {
  const enabled = elements.autonomyEnabled.checked;
  if (saveSettings({ autonomyEnabled: enabled })) {
    behavior.setEnabled(enabled);
    showCaption(enabled ? 'I’ll check in occasionally, and keep it brief.' : 'I’ll stay quiet unless you start a conversation.');
  } else {
    elements.autonomyEnabled.checked = window.ElioMemory.getSettings().autonomyEnabled;
  }
});
elements.webSearchEnabled.addEventListener('change', async () => {
  if (!elements.webSearchEnabled.checked) {
    try {
      if (window.kairo) await window.kairo.invoke('permissions:revoke', 'web-search');
      webSearchPermissionEnabled = false;
      showCaption('Web search is disabled.');
    } catch (error) {
      elements.webSearchEnabled.checked = true;
      showCaption(`Web search could not be disabled: ${error.message}`);
    }
    return;
  }

  try {
    if (!window.kairo) throw new Error('Web search permissions are available only in the desktop app.');
    webSearchPermissionEnabled = await window.kairo.invoke('permissions:request', 'web-search');
    elements.webSearchEnabled.checked = webSearchPermissionEnabled;
    showCaption(webSearchPermissionEnabled
      ? 'Web search is allowed for this session. You can revoke it in Settings.'
      : 'Web search permission was not granted.');
  } catch (error) {
    webSearchPermissionEnabled = false;
    elements.webSearchEnabled.checked = false;
    showCaption(`Web search permission failed: ${error.message}`);
  }
});
document.querySelectorAll('input[name="title"]').forEach((input) => input.addEventListener('change', updateTitleSettings));
elements.memoryList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-kind]');
  if (button) forgetMemory(button.dataset.kind, Number(button.dataset.index));
});
elements.forgetAllButton.addEventListener('click', () => {
  if (!window.confirm('Forget all saved memories and the conversation count? This cannot be undone.')) return;
  try {
    window.ElioMemory.clearLongTerm();
    updateMemoryDisplay();
    showCaption('All clear. I’ve forgotten the memories saved on this device.');
  } catch (error) {
    showCaption(error.message);
  }
});
document.querySelectorAll('.suggestion').forEach((button) => {
  button.addEventListener('click', () => sendMessage(button.dataset.prompt));
});
elements.settingsDialog.addEventListener('click', (event) => {
  if (event.target === elements.settingsDialog) closeSettings();
});

async function updateProviderStatus() {
  try {
    if (!window.kairo) {
      elements.providerStatus.textContent = 'The desktop AI service is unavailable. Launch this app through Electron.';
      elements.providerStatus.hidden = false;
      return;
    }
    const config = await window.kairo.invoke('system-config');
    webSearchPermissionEnabled = Boolean(config.webSearchEnabled);
    if (config.hasApiKey) {
      elements.providerStatus.hidden = true;
      elements.providerStatus.dataset.state = 'ready';
      return;
    }
    elements.providerStatus.textContent = 'OpenAI is not configured. Copy .env.example to .env, add OPENAI_API_KEY, then restart the app. No scripted AI fallback is used.';
    elements.providerStatus.hidden = false;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    elements.providerStatus.textContent = `AI configuration could not be checked: ${detail}`;
    elements.providerStatus.hidden = false;
  }
}

window.addEventListener('pagehide', () => {
  behavior.stop();
  vision.stop();
  voice.dispose();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'hidden') return;
  vision.stop();
  if (voice.listening) voice.abortListening();
  voice.stopSpeech();
});

try {
  window.ElioMemory.load();
} catch (error) {
  memoryError = error.message;
}
updateMemoryDisplay();
const savedSettings = window.ElioMemory.getSettings();
elements.soundButton.setAttribute('aria-pressed', String(savedSettings.speechEnabled));
elements.soundButton.setAttribute('aria-label', savedSettings.speechEnabled ? "Mute Kairo's voice" : "Unmute Kairo's voice");
elements.soundIcon.textContent = savedSettings.speechEnabled ? '♫' : '♪';
behavior.setEnabled(savedSettings.autonomyEnabled);
behavior.start();
updateProviderStatus();
