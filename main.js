const { app, BrowserWindow, ipcMain, dialog, session, shell } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow;

const GOOGLE_INPUT_TOOL_INSTALLERS = {
  as: null,
  bn: null,
  gu: 'GoogleInputGujarati.exe',
  hi: 'GoogleInputHindi.exe',
  kn: 'GoogleInputKannada.exe',
  ml: 'GoogleInputMalayalam.exe',
  mr: 'GoogleInputMarathi.exe',
  ne: 'GoogleInputNepali.exe',
  or: 'GoogleInputOriya.exe',
  pa: 'GoogleInputPunjabi.exe',
  sa: 'GoogleInputSanskrit.exe',
  ta: 'GoogleInputTamil.exe',
  te: 'GoogleInputTelugu.exe'
};

const GOOGLE_INPUT_GENERIC_INSTALLER = 'GoogleInputTools.exe';

function getGoogleInputToolsDirectory() {
  const candidateDirs = [
    path.join(__dirname, 'resources', 'google-input-tools'),
    path.join(process.resourcesPath || '', 'app', 'resources', 'google-input-tools'),
    path.join(process.resourcesPath || '', 'resources', 'google-input-tools'),
    path.join(process.resourcesPath || '', 'google-input-tools')
  ].filter(Boolean);

  return candidateDirs.find((dir) => fs.existsSync(dir)) || candidateDirs[0];
}

function getGoogleInputToolsCatalog() {
  const baseDir = getGoogleInputToolsDirectory();
  const installers = {};

  for (const [lang, installerName] of Object.entries(GOOGLE_INPUT_TOOL_INSTALLERS)) {
    const installerPath = installerName ? path.join(baseDir, installerName) : null;
    installers[lang] = {
      fileName: installerName,
      exists: Boolean(installerPath && fs.existsSync(installerPath))
    };
  }

  const genericInstallerPath = path.join(baseDir, GOOGLE_INPUT_GENERIC_INSTALLER);

  return {
    baseDir,
    exists: fs.existsSync(baseDir),
    installers,
    genericInstaller: {
      fileName: GOOGLE_INPUT_GENERIC_INSTALLER,
      exists: fs.existsSync(genericInstallerPath)
    }
  };
}

function resolveGoogleInputInstaller(installerName) {
  const catalog = getGoogleInputToolsCatalog();
  const allowedNames = new Set(
    [
      GOOGLE_INPUT_GENERIC_INSTALLER,
      ...Object.values(GOOGLE_INPUT_TOOL_INSTALLERS).filter(Boolean)
    ].map((name) => name.toLowerCase())
  );

  if (!installerName || !allowedNames.has(installerName.toLowerCase())) {
    return null;
  }

  const installerPath = path.join(catalog.baseDir, installerName);
  if (!fs.existsSync(installerPath)) {
    return null;
  }

  return installerPath;
}

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

ipcMain.handle('list-google-input-tools', async () => {
  return getGoogleInputToolsCatalog();
});

ipcMain.handle('install-google-input-tool', async (event, installerName) => {
  try {
    const installerPath = resolveGoogleInputInstaller(installerName);
    if (!installerPath) {
      return { ok: false, message: 'Installer file was not found in this build.' };
    }

    const errorMessage = await shell.openPath(installerPath);
    if (errorMessage) {
      return { ok: false, message: errorMessage };
    }

    return { ok: true, message: `Opened ${path.basename(installerPath)}` };
  } catch (error) {
    console.error('Failed to open Google Input Tools installer:', error);
    return { ok: false, message: error.message };
  }
});

ipcMain.handle('open-google-input-tools-folder', async () => {
  try {
    const catalog = getGoogleInputToolsCatalog();
    if (!catalog.exists) {
      return { ok: false, message: 'Google Input Tools folder is not bundled.' };
    }

    const errorMessage = await shell.openPath(catalog.baseDir);
    if (errorMessage) {
      return { ok: false, message: errorMessage };
    }

    return { ok: true };
  } catch (error) {
    console.error('Failed to open Google Input Tools folder:', error);
    return { ok: false, message: error.message };
  }
});

ipcMain.handle('open-input-settings', async () => {
  try {
    await shell.openExternal('ms-settings:regionlanguage');
    return { ok: true };
  } catch (error) {
    console.error('Failed to open Windows language settings:', error);
    return { ok: false, message: error.message };
  }
});

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

  // Handle Plugin File Selection (.star files)
  ipcMain.handle('open-plugin-dialog', async () => {
    console.log('Main Process: Received open-plugin-dialog request');
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Nakshathram Plugin Files', extensions: ['star'] }]
      });
      return result.canceled ? [] : result.filePaths;
    } catch (e) {
      console.error('Plugin dialog error:', e);
      return [];
    }
  });

  // Handle Reading a Plugin File
  ipcMain.handle('read-plugin-file', async (event, filePath) => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return content;
    } catch (e) {
      console.error('Error reading plugin file:', e);
      return null;
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
