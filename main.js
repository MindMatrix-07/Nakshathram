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

ipcMain.handle('export-credentials-pdf', async (event, payload) => {
  let pdfWindow = null;

  try {
    const displayName = String(payload && payload.displayName ? payload.displayName : '').trim();
    const userId = String(payload && payload.userId ? payload.userId : '').trim();
    const password = String(payload && payload.password ? payload.password : '');

    if (!displayName || !userId || !password) {
      return { ok: false, message: 'Display name, user ID, and password are required.' };
    }

    const safeName = displayName
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const safeUserId = userId
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const safePassword = password
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Nakshathram Credentials</title>
        <style>
          body {
            margin: 0;
            padding: 42px;
            font-family: "Segoe UI", Arial, sans-serif;
            color: #132033;
            background: linear-gradient(180deg, #f5f8fc 0%, #e9eff8 100%);
          }
          .sheet {
            padding: 30px 32px;
            border-radius: 24px;
            background: #ffffff;
            border: 1px solid #d7e1ef;
            box-shadow: 0 16px 40px rgba(14, 27, 46, 0.08);
          }
          h1 {
            margin: 0 0 8px;
            font-size: 28px;
            line-height: 1.1;
          }
          .subtitle {
            margin: 0 0 24px;
            color: #4e627d;
            font-size: 14px;
            line-height: 1.7;
          }
          .row {
            margin-bottom: 18px;
            padding: 14px 16px;
            border-radius: 18px;
            background: #f4f7fb;
            border: 1px solid #dde6f3;
          }
          .label {
            display: block;
            margin-bottom: 6px;
            color: #5d6f87;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.14em;
            text-transform: uppercase;
          }
          .value {
            font-size: 18px;
            font-weight: 700;
            word-break: break-word;
          }
          .footer {
            margin-top: 22px;
            color: #60728a;
            font-size: 12px;
            line-height: 1.7;
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <h1>Nakshathram Credentials</h1>
          <p class="subtitle">Keep this PDF safely. It contains the account details used to unlock Nakshathram on this device.</p>
          <div class="row">
            <span class="label">User Name</span>
            <div class="value">${safeName}</div>
          </div>
          <div class="row">
            <span class="label">User ID</span>
            <div class="value">${safeUserId}</div>
          </div>
          <div class="row">
            <span class="label">Password</span>
            <div class="value">${safePassword}</div>
          </div>
          <p class="footer">Generated by Nakshathram on ${new Date().toLocaleString()}.</p>
        </div>
      </body>
      </html>
    `;

    pdfWindow = new BrowserWindow({
      show: false,
      width: 860,
      height: 960,
      webPreferences: {
        sandbox: false
      }
    });

    await pdfWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(html)}`);
    const pdfBuffer = await pdfWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: {
        top: 0.5,
        bottom: 0.5,
        left: 0.5,
        right: 0.5
      }
    });

    const outputPath = path.join(app.getPath('downloads'), 'Nakshathram credentials.pdf');
    fs.writeFileSync(outputPath, pdfBuffer);

    if (pdfWindow) {
      pdfWindow.close();
      pdfWindow = null;
    }

    return { ok: true, filePath: outputPath };
  } catch (error) {
    if (pdfWindow) {
      pdfWindow.close();
    }
    console.error('Failed to export credentials PDF:', error);
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
