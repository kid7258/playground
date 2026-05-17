import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import {
  startAutomation,
  stopAutomation,
  getState,
  DEFAULT_CONFIG,
  AutomationConfig,
} from './automation';
import { saveCroppedReference, captureScreen, hasReferenceImage } from './screen-detect';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 560,
    resizable: false,
    title: 'FC Online Bot',
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(
    app.isPackaged
      ? path.join(__dirname, '..', '..', 'src', 'renderer', 'index.html')
      : path.join(__dirname, '..', '..', 'src', 'renderer', 'index.html')
  );

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── IPC: Automation control ──

ipcMain.handle('automation:start', async (_event, config: Partial<AutomationConfig>) => {
  if (!mainWindow) return;
  const merged: AutomationConfig = { ...DEFAULT_CONFIG, ...config };
  startAutomation(mainWindow, merged);
});

ipcMain.handle('automation:stop', () => {
  stopAutomation();
});

ipcMain.handle('automation:getState', () => {
  return getState();
});

// ── IPC: Reference image capture ──

ipcMain.handle('capture:takeScreenshot', async () => {
  try {
    const png = await captureScreen();
    return { ok: true, png: png.toString('base64') };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle(
  'capture:saveRegion',
  async (_event, { filename, x, y, width, height }: {
    filename: string; x: number; y: number; width: number; height: number;
  }) => {
    try {
      await saveCroppedReference(filename, x, y, width, height);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }
);

ipcMain.handle('capture:hasReference', async (_event, filename: string) => {
  return hasReferenceImage(filename);
});
