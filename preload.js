const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('storylabUpdates', Object.freeze({
  checkForUpdates: () => ipcRenderer.invoke('storylab:check-for-updates')
}));

const closeRequestListeners = new Set();
ipcRenderer.on('storylab:request-close', () => {
  closeRequestListeners.forEach(listener => listener());
});
contextBridge.exposeInMainWorld('storylabApp', Object.freeze({
  onCloseRequest: listener => { if (typeof listener === 'function') closeRequestListeners.add(listener); },
  respondToClose: shouldClose => ipcRenderer.send('storylab:close-response', Boolean(shouldClose))
}));
