const { contextBridge, ipcRenderer } = require('electron');

const invokeChannels = new Set([
  'window-action',
  'system-config',
  'mesh:create',
  'mesh:status',
  'mesh:model',
  'mesh:save',
  'mesh:save-buffer',
  'mesh:cancel',
  'ai:generate',
  'ai:cancel',
]);

contextBridge.exposeInMainWorld('forma', {
  invoke(channel, payload) {
    if (!invokeChannels.has(channel)) {
      throw new Error(`IPC channel not allowed: ${channel}`);
    }
    return ipcRenderer.invoke(channel, payload);
  },
  onAIChunk(callback) {
    if (typeof callback !== 'function') throw new TypeError('AI stream callback must be a function.');
    const listener = (_, message) => callback(message);
    ipcRenderer.on('ai:delta', listener);
    return () => ipcRenderer.removeListener('ai:delta', listener);
  },
});
