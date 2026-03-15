import { app, BrowserWindow, shell } from 'electron';
import { ChildProcess, spawn } from 'child_process';
import http from 'http';
import path from 'path';
import { createServer } from 'net';

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let nextServerProcess: ChildProcess | null = null;

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address !== 'string') {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        reject(new Error('Could not find free port'));
      }
    });
    server.on('error', reject);
  });
}

function waitForServer(port: number, maxAttempts = 50): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const check = () => {
      attempts++;
      const req = http.get(`http://localhost:${port}`, () => {
        resolve();
      });
      req.on('error', () => {
        if (attempts >= maxAttempts) {
          reject(
            new Error(`Server didn't start after ${maxAttempts} attempts`)
          );
        } else {
          setTimeout(check, 200);
        }
      });
    };
    check();
  });
}

function startNextServer(port: number): ChildProcess {
  const standaloneDir = path.join(process.resourcesPath, 'standalone');
  const serverPath = path.join(standaloneDir, 'server.js');

  const child = spawn(process.execPath, [serverPath], {
    cwd: standaloneDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(port),
      HOSTNAME: 'localhost',
    },
    stdio: 'pipe',
  });

  child.stdout?.on('data', (data: Buffer) => {
    console.log(`[next] ${data.toString().trim()}`);
  });

  child.stderr?.on('data', (data: Buffer) => {
    console.error(`[next] ${data.toString().trim()}`);
  });

  child.on('error', err => {
    console.error('Failed to start Next.js server:', err);
  });

  return child;
}

function createWindow(port: number) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'RollKeeper',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://localhost:${port}`);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', async () => {
  try {
    if (isDev) {
      const devPort = parseInt(process.env.DEV_SERVER_PORT || '3000', 10);
      createWindow(devPort);
    } else {
      const port = await findFreePort();
      nextServerProcess = startNextServer(port);
      await waitForServer(port);
      createWindow(port);
    }
  } catch (err) {
    console.error('Failed to start application:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    const port = parseInt(process.env.DEV_SERVER_PORT || '3000', 10);
    createWindow(port);
  }
});

app.on('before-quit', () => {
  if (nextServerProcess) {
    nextServerProcess.kill();
    nextServerProcess = null;
  }
});
