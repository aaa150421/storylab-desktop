const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('storylabUpdates', Object.freeze({
  checkForUpdates: () => ipcRenderer.invoke('storylab:check-for-updates')
}));
