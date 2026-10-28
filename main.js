const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const https = require('https');
const { spawn } = require('child_process');

let mainWindow = null;
let updatePromptShown = false;
let downloadedUpdate = null;
let updateCheckInProgress = false;

const RELEASES_API = 'https://api.github.com/repos/aaa150421/storylab-desktop/releases/latest';

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
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'storylab.html'), { query: { version: app.getVersion() } });
  mainWindow.on('closed', () => { mainWindow = null; });
}

function compareVersions(a, b) {
  const left = String(a).split('.').map(n => Number.parseInt(n, 10) || 0);
  const right = String(b).split('.').map(n => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const x = left[i] || 0;
    const y = right[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

function getJson(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('업데이트 서버의 리디렉션이 너무 많습니다.'));
    const request = https.get(url, {
      headers: {
        'User-Agent': 'StoryLab-Desktop-Updater',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        response.resume();
        return resolve(getJson(response.headers.location, redirects + 1));
      }
      if (response.statusCode !== 200) {
        response.resume();
        return reject(new Error(`업데이트 정보 요청 실패 (HTTP ${response.statusCode})`));
      }
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error('업데이트 정보 형식이 올바르지 않습니다.')); }
      });
    });
    request.setTimeout(15000, () => request.destroy(new Error('업데이트 서버 응답 시간 초과')));
    request.on('error', reject);
  });
}

function downloadFile(url, destination, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('업데이트 파일의 리디렉션이 너무 많습니다.'));
    const request = https.get(url, {
      headers: { 'User-Agent': 'StoryLab-Desktop-Updater', 'Accept': 'application/octet-stream' }
    }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        response.resume();
        return resolve(downloadFile(response.headers.location, destination, redirects + 1));
      }
      if (response.statusCode !== 200) {
        response.resume();
        return reject(new Error(`업데이트 파일 다운로드 실패 (HTTP ${response.statusCode})`));
      }
      const file = fs.createWriteStream(destination);
      response.pipe(file);
      file.on('finish', () => file.close(() => resolve(destination)));
      file.on('error', error => {
        file.close(() => {});
        fs.rm(destination, { force: true }, () => reject(error));
      });
    });
    request.setTimeout(30000, () => request.destroy(new Error('업데이트 다운로드 시간 초과')));
    request.on('error', error => {
      fs.rm(destination, { force: true }, () => reject(error));
    });
  });
}

async function promptToInstallUpdate(version, installerPath) {
  if (updatePromptShown || !fs.existsSync(installerPath)) return;
  updatePromptShown = true;
  const options = {
    type: 'info',
    title: '이야기공방 업데이트 준비 완료',
    message: `새 버전 ${version}을 다운로드했습니다.`,
    detail: '지금 업데이트를 시작하면 설치 프로그램이 열립니다. 설치를 진행하려면 화면의 안내를 따라 주세요. 나중에 선택하면 다음 확인 때 다시 안내합니다.',
    buttons: ['지금 업데이트', '나중에'],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  };
  const result = mainWindow && !mainWindow.isDestroyed()
    ? await dialog.showMessageBox(mainWindow, options)
    : await dialog.showMessageBox(options);
  if (result.response === 0) {
    const installer = spawn(installerPath, [], { detached: true, stdio: 'ignore' });
    installer.once('error', error => console.warn('업데이트 설치 프로그램 실행 실패:', error.message));
    installer.unref();
    app.quit();
  } else {
    updatePromptShown = false;
  }
}

async function checkForUpdates() {
  if (!app.isPackaged || process.platform !== 'win32' || updateCheckInProgress) return;
  updateCheckInProgress = true;
  try {
    if (downloadedUpdate && fs.existsSync(downloadedUpdate.path)) {
      await promptToInstallUpdate(downloadedUpdate.version, downloadedUpdate.path);
      return;
    }

    const release = await getJson(RELEASES_API);
    if (!release || release.draft || release.prerelease || !release.tag_name) return;
    const version = String(release.tag_name).replace(/^v/, '');
    if (compareVersions(version, app.getVersion()) <= 0) return;

    const asset = (release.assets || []).find(item => item.name === `${version}.exe` && item.browser_download_url);
    if (!asset) {
      console.warn(`이야기공방 ${version} 릴리스에 ${version}.exe 파일이 없습니다.`);
      return;
    }

    const installerPath = path.join(os.tmpdir(), `storylab-update-${version}.exe`);
    console.log(`이야기공방 업데이트 다운로드 시작: ${version}`);
    await downloadFile(asset.browser_download_url, installerPath);
    downloadedUpdate = { version, path: installerPath };
    console.log(`이야기공방 업데이트 다운로드 완료: ${version}`);
    await promptToInstallUpdate(version, installerPath);
  } catch (error) {
    console.warn('이야기공방 자동 업데이트 확인 실패:', error.message);
  } finally {
    updateCheckInProgress = false;
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();

  if (app.isPackaged && process.platform === 'win32') {
    setTimeout(checkForUpdates, 8000);
    setInterval(checkForUpdates, 6 * 60 * 60 * 1000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
