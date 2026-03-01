const { app, BrowserWindow, dialog, Menu, Tray } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const http = require('http');

let mainWindow;
let backendProcess;
let mongoProcess;
let tray;
let isQuitting = false;

// Paths
const isDev = !app.isPackaged;
const resourcesPath = isDev ? __dirname + '/..' : process.resourcesPath;
const userDataPath = app.getPath('userData');
const dataPath = path.join(userDataPath, 'data');
const mongoDataPath = path.join(dataPath, 'mongodb');
const logsPath = path.join(dataPath, 'logs');

// Ensure directories exist
function ensureDirectories() {
  [dataPath, mongoDataPath, logsPath].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Check if port is available
function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.request({ host: 'localhost', port, timeout: 1000 }, () => resolve(true));
    req.on('error', () => resolve(false));
    req.end();
  });
}

// Wait for service to be ready
function waitForService(port, maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      checkPort(port).then(available => {
        if (available) {
          resolve();
        } else if (attempts >= maxAttempts) {
          reject(new Error(`Service on port ${port} not ready after ${maxAttempts} attempts`));
        } else {
          setTimeout(check, 1000);
        }
      });
    };
    check();
  });
}

// Start MongoDB
function startMongoDB() {
  return new Promise((resolve, reject) => {
    const mongoPath = isDev 
      ? 'mongod' 
      : path.join(resourcesPath, 'mongodb', 'mongod.exe');
    
    const mongoLogPath = path.join(logsPath, 'mongodb.log');
    
    console.log('Starting MongoDB...');
    console.log('MongoDB data path:', mongoDataPath);
    
    // Try using system MongoDB first in dev mode
    if (isDev) {
      mongoProcess = spawn('mongod', [
        '--dbpath', mongoDataPath,
        '--port', '27017',
        '--bind_ip', 'localhost'
      ], { shell: true });
    } else {
      mongoProcess = spawn(mongoPath, [
        '--dbpath', mongoDataPath,
        '--port', '27017',
        '--bind_ip', 'localhost',
        '--logpath', mongoLogPath
      ]);
    }

    mongoProcess.on('error', (err) => {
      console.error('MongoDB error:', err);
      reject(err);
    });

    // Wait for MongoDB to be ready
    setTimeout(() => {
      waitForService(27017, 20)
        .then(resolve)
        .catch(reject);
    }, 2000);
  });
}

// Start Backend
function startBackend() {
  return new Promise((resolve, reject) => {
    const backendPath = isDev
      ? path.join(__dirname, '..', 'backend')
      : path.join(resourcesPath, 'backend');
    
    const pythonExe = isDev ? 'python' : path.join(backendPath, 'python', 'python.exe');
    const serverScript = path.join(backendPath, 'server.py');
    
    console.log('Starting Backend...');
    console.log('Backend path:', backendPath);
    
    const env = {
      ...process.env,
      MONGO_URL: 'mongodb://localhost:27017',
      DB_NAME: 'ctph_systemqr',
      JWT_SECRET: 'ctph_systemqr_secret_key_2024',
      JWT_ALGORITHM: 'HS256'
    };

    if (isDev) {
      backendProcess = spawn('python', [serverScript], {
        cwd: backendPath,
        env,
        shell: true
      });
    } else {
      // In production, use bundled Python or executable
      const serverExe = path.join(backendPath, 'server.exe');
      if (fs.existsSync(serverExe)) {
        backendProcess = spawn(serverExe, [], { cwd: backendPath, env });
      } else {
        backendProcess = spawn(pythonExe, [serverScript], { cwd: backendPath, env });
      }
    }

    backendProcess.stdout?.on('data', (data) => {
      console.log('Backend:', data.toString());
    });

    backendProcess.stderr?.on('data', (data) => {
      console.error('Backend Error:', data.toString());
    });

    backendProcess.on('error', (err) => {
      console.error('Backend process error:', err);
      reject(err);
    });

    // Wait for backend to be ready
    waitForService(8001, 30)
      .then(resolve)
      .catch(reject);
  });
}

// Create main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'SystemQr - CTPH',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    const reactBuildPath = path.join(__dirname, '..', 'react-build', 'index.html');
    mainWindow.loadFile(reactBuildPath);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Remove menu bar
  Menu.setApplicationMenu(null);
}

// Create system tray
function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  
  if (fs.existsSync(iconPath)) {
    tray = new Tray(iconPath);
    
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Abrir SystemQr', click: () => mainWindow.show() },
      { type: 'separator' },
      { label: 'Salir', click: () => { isQuitting = true; app.quit(); } }
    ]);
    
    tray.setToolTip('SystemQr - CTPH');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => mainWindow.show());
  }
}

// Cleanup on exit
function cleanup() {
  console.log('Cleaning up...');
  
  if (backendProcess) {
    backendProcess.kill();
  }
  
  if (mongoProcess) {
    mongoProcess.kill();
  }
}

// App ready
app.whenReady().then(async () => {
  try {
    ensureDirectories();
    
    // Show splash/loading
    const loadingWindow = new BrowserWindow({
      width: 400,
      height: 300,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      webPreferences: { nodeIntegration: true }
    });
    
    loadingWindow.loadURL(`data:text/html,
      <html>
        <body style="display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#0F172A;color:white;font-family:Arial;flex-direction:column;border-radius:10px;">
          <h1 style="margin:0;font-size:32px;">SystemQr</h1>
          <p style="margin:10px 0;opacity:0.7;">CTPH</p>
          <p style="margin:20px 0;font-size:14px;">Iniciando servicios...</p>
          <div style="width:200px;height:4px;background:#1E293B;border-radius:2px;overflow:hidden;">
            <div style="width:30%;height:100%;background:#EA580C;animation:loading 1.5s infinite;"></div>
          </div>
          <style>@keyframes loading{0%{margin-left:0}50%{margin-left:70%}100%{margin-left:0}}</style>
        </body>
      </html>
    `);

    console.log('Starting services...');
    
    // Start MongoDB
    await startMongoDB();
    console.log('MongoDB ready!');
    
    // Start Backend
    await startBackend();
    console.log('Backend ready!');
    
    // Close loading window and show main app
    loadingWindow.close();
    
    createWindow();
    createTray();
    
  } catch (error) {
    console.error('Startup error:', error);
    dialog.showErrorBox('Error al iniciar', 
      `No se pudo iniciar SystemQr.\n\nError: ${error.message}\n\nPor favor, reinicie la aplicación.`);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    isQuitting = true;
    app.quit();
  }
});

app.on('before-quit', cleanup);
app.on('will-quit', cleanup);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
