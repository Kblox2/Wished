const elements = {
  robotScene: document.getElementById('robotScene'),
  moodLabel: document.getElementById('moodLabel'),
  sceneCaption: document.getElementById('sceneCaption'),
  welcomeTitle: document.getElementById('welcomeTitle'),
  cameraButton: document.getElementById('cameraButton'),
  cameraButtonLabel: document.getElementById('cameraButtonLabel'),
  cameraPreview: document.getElementById('cameraPreview'),
  cameraVideo: document.getElementById('cameraVideo'),
  cameraPlaceholder: document.getElementById('cameraPlaceholder'),
  voiceButton: document.getElementById('voiceButton'),
  voiceButtonLabel: document.getElementById('voiceButtonLabel'),
  soundButton: document.getElementById('soundButton'),
  soundIcon: document.getElementById('soundIcon'),
  memoryHeading: document.getElementById('memoryHeading'),
  memorySummary: document.getElementById('memorySummary'),
  memoryCount: document.getElementById('memoryCount'),
  messages: document.getElementById('messages'),
  chatForm: document.getElementById('chatForm'),
  messageInput: document.getElementById('messageInput'),
  clearChatButton: document.getElementById('clearChatButton'),
  settingsButton: document.getElementById('settingsButton'),
  settingsDialog: document.getElementById('settingsDialog'),
  closeSettingsButton: document.getElementById('closeSettingsButton'),
  memoryEnabled: document.getElementById('memoryEnabled'),
  autonomyEnabled: document.getElementById('autonomyEnabled'),
  memoryList: document.getElementById('memoryList'),
  memoryEmpty: document.getElementById('memoryEmpty'),
  forgetAllButton: document.getElementById('forgetAllButton'),
  openMemoriesButton: document.getElementById('openMemoriesButton'),
};

const initialMessages = elements.messages.innerHTML;
let memoryError = '';
const expressions = window.ElioExpressions.create({
  scene: elements.robotScene,
  moodLabel: elements.moodLabel,
});

function showCaption(message) {
  elements.sceneCaption.textContent = message;
}

function setExpression(expression, caption, moodLabel) {
  expressions.set(expression, moodLabel);
  if (caption) showCaption(caption);
}

function currentTitle() {
  const titles = window.ElioMemory.getSettings().selectedTitles;
  const turnCount = window.ElioMemory.getLongTerm().interactions;
  if (!Array.isArray(titles) || !titles.length) return 'Architect';
  const safeTurnCount = Number.isInteger(turnCount) && turnCount >= 0 ? turnCount : 0;
  return titles[safeTurnCount % titles.length] || 'Architect';
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
      : 'Elio remembers the little things you choose to share.';
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
  author.textContent = speaker === 'elio' ? 'ELIO' : 'YOU';
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
}

const brain = window.ElioBrain.createProvider({ memory: window.ElioMemory });

const voice = window.ElioVoice.createBrowserProvider({
  onExpression: (expression) => {
    setExpression(expression);
    const listening = expression === 'listening';
    elements.voiceButton.setAttribute('aria-pressed', String(listening));
    elements.voiceButtonLabel.textContent = listening
      ? 'Listening · tap to stop'
      : voice.speaking ? 'Interrupt & talk' : 'Talk to Elio';
  },
  onCaption: showCaption,
  onTranscript: (transcript) => sendMessage(transcript),
  isEnabled: () => window.ElioMemory.getSettings().speechEnabled,
});

const vision = window.ElioVision.createBrowserProvider({
  video: elements.cameraVideo,
  onStatus: (caption, active) => {
    elements.cameraButton.setAttribute('aria-pressed', String(active));
    elements.cameraButtonLabel.textContent = active ? 'Turn camera off' : 'Turn camera on';
    elements.cameraPreview.classList.toggle('active', active);
    elements.cameraPlaceholder.setAttribute('aria-hidden', String(active));
    showCaption(caption);
  },
  onEvent: (event) => {
    const observation = brain.observe(event);
    const title = currentTitle();
    const reply = event === 'face'
      ? `There you are, ${title}. The System spotted a face.`
      : `The System noticed some movement, ${title}. Should I be curious?`;
    addMessage('elio', reply);
    setExpression(observation.expression, reply, observation.mood);
    voice.speak(reply);
    behavior.recordActivity();
  },
});

const behavior = window.ElioBehavior.create({
  onCheckIn: () => {
    const title = currentTitle();
    const prompt = [
      `Architect? I had a thought. Do you think clouds know they’re being dramatic?`,
      `Captain, I noticed how quiet it got. I can stay quiet too, if you like.`,
      `Boss, the System has a question: what’s one small thing that made today yours?`,
    ][Math.floor(Math.random() * 3)];
    addMessage('elio', prompt.replace(/\b(?:Architect|Captain|Boss)\b/, title));
    setExpression('curious', prompt.replace(/\b(?:Architect|Captain|Boss)\b/, title));
    voice.speak(prompt.replace(/\b(?:Architect|Captain|Boss)\b/, title));
  },
  onSleep: () => setExpression('sleepy', 'I’m getting a little quiet. I’ll be here when you need me.'),
  onWake: () => setExpression('curious', 'Oh, you’re back. I was only resting my eyes.'),
});

function sendMessage(message) {
  const text = message.trim();
  if (!text) return;
  behavior.recordActivity();
  if (voice.listening) voice.abortListening();
  addMessage('you', text);
  setExpression('thinking', 'Let me turn that over for a second.');

  try {
    const result = brain.think({ message: text });
    if (!result || typeof result.reply !== 'string' || !result.reply) {
      throw new Error('Elio could not produce a reply. Please try again.');
    }
    addMessage('elio', result.reply);
    setExpression(result.expression, result.reply, result.mood);
    updateMemoryDisplay();
    voice.speak(result.reply);
  } catch (error) {
    showCaption(error.message);
    addMessage('elio', 'I hit a snag saving that moment. Your message is still here in this chat.');
    setExpression('confused', 'I hit a snag. Your message is still here in this chat.');
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
  elements.soundButton.setAttribute('aria-label', enabled ? "Mute Elio's voice" : "Unmute Elio's voice");
  elements.soundIcon.textContent = enabled ? '♫' : '♪';
  if (!enabled) voice.stopSpeech();
  showCaption(enabled ? 'Voice replies are on.' : 'Voice replies are muted. I’ll keep chatting here.');
}

function clearConversation() {
  window.ElioMemory.clearConversation();
  elements.messages.innerHTML = initialMessages;
  addMessage('elio', `Still right here, ${currentTitle()}. What shall we talk about?`);
  setExpression('happy', `A fresh little chat. I’m all ears, ${currentTitle()}.`);
  voice.speak(`Still right here, ${currentTitle()}. What shall we talk about?`);
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
elements.cameraButton.addEventListener('click', toggleCamera);
elements.voiceButton.addEventListener('click', () => {
  behavior.recordActivity();
  voice.listen();
  elements.voiceButton.setAttribute('aria-pressed', String(voice.listening));
  elements.voiceButtonLabel.textContent = voice.listening ? 'Listening · tap to stop' : 'Talk to Elio';
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

window.addEventListener('pagehide', () => {
  behavior.stop();
  vision.stop();
  voice.dispose();
});

try {
  window.ElioMemory.load();
} catch (error) {
  memoryError = error.message;
}
updateMemoryDisplay();
const savedSettings = window.ElioMemory.getSettings();
elements.soundButton.setAttribute('aria-pressed', String(savedSettings.speechEnabled));
elements.soundButton.setAttribute('aria-label', savedSettings.speechEnabled ? "Mute Elio's voice" : "Unmute Elio's voice");
elements.soundIcon.textContent = savedSettings.speechEnabled ? '♫' : '♪';
behavior.setEnabled(savedSettings.autonomyEnabled);
behavior.start();
