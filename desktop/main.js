const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

const SITE = 'https://mjmasters91.github.io/toon-orbit-battle/';

function isAllowed(url) {
  let parsed;
  try { parsed = new URL(url); }
  catch (e) { return false; }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
  if (parsed.hostname === 'mjmasters91.github.io') {
    return parsed.pathname === '/toon-orbit-battle' || parsed.pathname.startsWith('/toon-orbit-battle/');
  }
  return parsed.hostname === 'orbzytpukjywqkbkbtcs.supabase.co';
}

function openOutside(url) {
  if (!url || url.startsWith('file:')) return;
  shell.openExternal(url).catch(() => {});
}

function wire(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowed(url)) return { action: 'allow' };
    openOutside(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (isAllowed(url)) return;
    event.preventDefault();
    openOutside(url);
  });
  win.webContents.on('did-fail-load', (event, errorCode, _desc, url, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return;
    if (String(url).startsWith('file:')) return;
    win.loadFile(path.join(__dirname, 'offline.html'));
  });
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    title: 'Toon Orbit Battle',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.setMenuBarVisibility(false);
  wire(win);
  const ses = win.webContents.session;
  await ses.clearCache();
  let revealed = false;
  const reveal = () => {
    if (revealed || win.isDestroyed()) return;
    revealed = true;
    win.show();
  };
  win.webContents.once('did-finish-load', () => {
    win.webContents.once('did-finish-load', reveal);
    win.webContents.once('did-fail-load', reveal);
    win.webContents.reloadIgnoringCache();
  });
  win.webContents.once('did-fail-load', reveal);
  await win.loadURL(SITE, {
    extraHeaders: 'Cache-Control: no-cache\r\nPragma: no-cache\r\n',
  });
}

function checkWrapperUpdate() {
  if (!app.isPackaged) return;
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = false;
    autoUpdater.checkForUpdates().catch(() => {});
  } catch (e) { /* unsigned builds may not have update metadata yet */ }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  checkWrapperUpdate();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
