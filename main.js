const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const path = require('path');

let mainWindow;

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hidden',
    backgroundColor: '#1e1e1e',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.setMenuBarVisibility(false);

  // Spoof Desktop User-Agent to enable full track playback in Spotify Iframe
  const desktopUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  mainWindow.webContents.setUserAgent(desktopUA);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  // Handle Note Minimizing
  ipcMain.on('minimize-window', () => {
    if (mainWindow) mainWindow.minimize();
  });

  // Handle Note Closing
  ipcMain.on('close-window', () => {
    if (mainWindow) mainWindow.close();
  });

  // Handle Note Selecting from Windows Explorer
  ipcMain.handle('open-file-dialog', async () => {
    console.log('Main Process: Received open-file-dialog request');
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Text Files', extensions: ['txt'] }]
      });
      return result.filePaths;
    } catch (e) {
      console.error('File dialog error:', e);
      return [];
    }
  });

  // Handle Note Saving to Windows Explorer
  ipcMain.handle('save-file-dialog', async (event, defaultName) => {
    console.log('Main Process: Received save-file-dialog request');
    try {
      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: defaultName,
        filters: [{ name: 'Text Files', extensions: ['txt'] }]
      });
      return result.canceled ? null : result.filePath;
    } catch (e) {
      console.error('Save dialog error:', e);
      return null;
    }
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Spotify Internal Flow
ipcMain.handle('spotify-login', async (event, authUrl) => {
  return new Promise((resolve, reject) => {
    let authWindow = new BrowserWindow({
      width: 500,
      height: 700,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false // Temporarily disable to see if it fixes the white screen
      }
    });

    authWindow.loadURL(authUrl);
    
    // Also spoof UA for auth window just for consistency
    const desktopUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    authWindow.webContents.setUserAgent(desktopUA);

    authWindow.once('ready-to-show', () => {
      authWindow.show();
    });

    // Intercept navigation to loopback callback
    authWindow.webContents.on('will-navigate', (event, url) => {
      handleCallback(url);
    });

    authWindow.webContents.on('will-redirect', (event, url) => {
      handleCallback(url);
    });
    
    authWindow.webContents.on('did-navigate', (event, url) => {
      handleCallback(url);
    });

    function handleCallback(url) {
      if (url.startsWith('http://127.0.0.1:8888/callback')) {
        const urlObj = new URL(url);
        const code = urlObj.searchParams.get('code');
        const error = urlObj.searchParams.get('error');

        if (code) {
          resolve(code);
        } else if (error) {
          reject(new Error(error));
        }
        
        if (authWindow) {
          authWindow.close();
        }
      }
    }

    authWindow.on('closed', () => {
      authWindow = null;
      reject(new Error('Auth window closed by user'));
    });
  });
});

ipcMain.handle('spotify-logout', async () => {
  try {
    await session.defaultSession.clearStorageData({
      storages: ['cookies']
    });
    return true;
  } catch (error) {
    console.error('Failed to clear session data:', error);
    return false;
  }
});

ipcMain.handle('google-login', async (event, authUrl) => {
  return new Promise((resolve, reject) => {
    let authWindow = new BrowserWindow({
      width: 600,
      height: 700,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    authWindow.loadURL(authUrl);

    authWindow.once('ready-to-show', () => {
      authWindow.show();
    });

    // Intercept navigation to localhost callback
    const handleCallback = (url) => {
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
        const urlObj = new URL(url);
        const code = urlObj.searchParams.get('code');
        const error = urlObj.searchParams.get('error');

        if (code) {
          resolve(code);
        } else if (error) {
          reject(new Error(error));
        }

        if (authWindow) {
          authWindow.close();
        }
      }
    };

    authWindow.webContents.on('will-navigate', (event, url) => handleCallback(url));
    authWindow.webContents.on('will-redirect', (event, url) => handleCallback(url));
    authWindow.webContents.on('did-navigate', (event, url) => handleCallback(url));

    authWindow.on('closed', () => {
      authWindow = null;
      reject(new Error('Auth window closed by user'));
    });
  });
});

ipcMain.handle('google-logout', async () => {
  try {
    await session.defaultSession.clearStorageData({
      storages: ['cookies']
    });
    return true;
  } catch (error) {
    console.error('Failed to clear Google session data:', error);
    return false;
  }
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
