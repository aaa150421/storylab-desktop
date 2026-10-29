const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;
let updateDialogOpen = false;
let manualUpdateCheckPromise = null;

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
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'storylab.html'), { query: { version: app.getVersion() } });
  mainWindow.on('closed', () => { mainWindow = null; });
}

function showUpdateDialog(options) {
  if (updateDialogOpen) return Promise.resolve(null);
  updateDialogOpen = true;
  const parent = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
  const dialogPromise = parent
    ? dialog.showMessageBox(parent, options)
    : dialog.showMessageBox(options);
  return dialogPromise.finally(() => { updateDialogOpen = false; });
}

ipcMain.handle('storylab:check-for-updates', async () => {
  if (!app.isPackaged) {
    return { status: 'unsupported', currentVersion: app.getVersion(), message: '설치된 데스크톱 앱에서 이용할 수 있습니다.' };
  }
  if (process.platform !== 'win32') {
    return { status: 'unsupported', currentVersion: app.getVersion(), message: '현재 Windows 버전에서 업데이트 확인을 지원합니다.' };
  }
  if (manualUpdateCheckPromise) return { status: 'checking', currentVersion: app.getVersion() };

  manualUpdateCheckPromise = autoUpdater.checkForUpdates()
    .then(result => {
      const info = result && result.updateInfo;
      return {
        status: result && result.isUpdateAvailable ? 'available' : 'current',
        currentVersion: app.getVersion(),
        latestVersion: info && info.version ? info.version : app.getVersion()
      };
    })
    .catch(error => ({
      status: 'error',
      currentVersion: app.getVersion(),
      message: error && error.message ? error.message : '업데이트 서버에 연결하지 못했습니다.'
    }))
    .finally(() => { manualUpdateCheckPromise = null; });

  return manualUpdateCheckPromise;
});

function configureAutoUpdates() {
  if (!app.isPackaged || process.platform !== 'win32') return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.logger = console;

  autoUpdater.on('checking-for-update', () => {
    console.log('이야기공방 업데이트 확인 중');
  });

  autoUpdater.on('update-available', info => {
    console.log(`이야기공방 새 버전 확인: ${info.version}`);
    showUpdateDialog({
      type: 'info',
      title: '이야기공방 업데이트',
      message: `새 버전 ${info.version}을 발견했습니다.`,
      detail: '업데이트 파일을 자동으로 다운로드합니다. 다운로드가 끝나면 설치 여부를 안내합니다.',
      buttons: ['확인'],
      defaultId: 0,
      noLink: true
    });
  });

  autoUpdater.on('update-not-available', info => {
    console.log(`이야기공방은 최신 버전입니다: ${info.version}`);
  });

  autoUpdater.on('download-progress', progress => {
    console.log(`이야기공방 업데이트 다운로드: ${Math.round(progress.percent)}%`);
  });

  autoUpdater.on('update-downloaded', async info => {
    console.log(`이야기공방 업데이트 다운로드 완료: ${info.version}`);
    const result = await showUpdateDialog({
      type: 'info',
      title: '이야기공방 업데이트 준비 완료',
      message: `새 버전 ${info.version}을 설치할 준비가 되었습니다.`,
      detail: '지금 다시 시작하면 업데이트를 설치합니다. 나중에 선택하면 프로그램을 종료할 때 자동으로 설치됩니다.',
      buttons: ['지금 다시 시작', '나중에'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    });

    if (result && result.response === 0) {
      setImmediate(() => autoUpdater.quitAndInstall(false, true));
    }
  });

  autoUpdater.on('error', error => {
    console.warn('이야기공방 자동 업데이트 오류:', error == null ? '알 수 없는 오류' : error.message || error);
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(error => {
      console.warn('이야기공방 업데이트 확인 실패:', error.message || error);
    });
  }, 8000);

  setInterval(() => {
    autoUpdater.checkForUpdates().catch(error => {
      console.warn('이야기공방 업데이트 확인 실패:', error.message || error);
    });
  }, 6 * 60 * 60 * 1000);
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  configureAutoUpdates();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
