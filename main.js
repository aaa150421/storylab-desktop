const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;
let updatePromptShown = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 760,
    minHeight: 600,
    title: '이야기공방',
    backgroundColor: '#0a0a0b',
    autoHideMenuBar: true,
    webPreferences: {
      // HTML 자체의 원고 저장(localStorage)을 앱 안에서 유지합니다.
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'storylab.html'), { query: { version: app.getVersion() } });
  mainWindow.on('closed', () => { mainWindow = null; });
}

function setupAutoUpdates() {
  // 개발 모드에서는 업데이트를 확인하지 않습니다. 설치형 Windows 앱에서만 동작합니다.
  if (!app.isPackaged || process.platform !== 'win32') return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    console.log(`이야기공방 업데이트 발견: ${info.version}`);
  });

  autoUpdater.on('update-downloaded', async (info) => {
    if (updatePromptShown) return;
    updatePromptShown = true;

    const options = {
      type: 'info',
      title: '이야기공방 업데이트 준비 완료',
      message: `새 버전 ${info.version}을 다운로드했습니다.`,
      detail: '지금 다시 시작하면 업데이트가 설치됩니다. 나중에 선택해도 프로그램을 종료할 때 업데이트가 설치됩니다.',
      buttons: ['지금 다시 시작', '나중에'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    };

    const result = mainWindow && !mainWindow.isDestroyed()
      ? await dialog.showMessageBox(mainWindow, options)
      : await dialog.showMessageBox(options);

    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.on('error', (error) => {
    // 네트워크가 끊겼거나 릴리스가 아직 없는 경우 앱 사용을 방해하지 않도록 로그만 남깁니다.
    console.warn('이야기공방 자동 업데이트 확인 실패:', error.message);
  });

  const checkForUpdates = () => {
    autoUpdater.checkForUpdates().catch((error) => {
      console.warn('이야기공방 업데이트 확인 실패:', error.message);
    });
  };

  // 앱 시작 직후 잠깐 기다린 뒤 확인하고, 이후 6시간마다 다시 확인합니다.
  setTimeout(checkForUpdates, 8000);
  setInterval(checkForUpdates, 6 * 60 * 60 * 1000);
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  setupAutoUpdates();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
