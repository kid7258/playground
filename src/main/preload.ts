import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('fcBot', {
  // Automation
  start: (config: Record<string, unknown>) => ipcRenderer.invoke('automation:start', config),
  stop: () => ipcRenderer.invoke('automation:stop'),
  getState: () => ipcRenderer.invoke('automation:getState'),

  // Status events from main → renderer
  onStatus: (cb: (data: { status: string }) => void) => {
    ipcRenderer.on('automation:status', (_e, data) => cb(data));
  },
  onCount: (cb: (data: { count: number }) => void) => {
    ipcRenderer.on('automation:count', (_e, data) => cb(data));
  },
  onError: (cb: (data: { message: string }) => void) => {
    ipcRenderer.on('automation:error', (_e, data) => cb(data));
  },
  onStopped: (cb: () => void) => {
    ipcRenderer.on('automation:stopped', () => cb());
  },

  // Capture helper
  takeScreenshot: () => ipcRenderer.invoke('capture:takeScreenshot'),
  saveRegion: (args: { filename: string; x: number; y: number; width: number; height: number }) =>
    ipcRenderer.invoke('capture:saveRegion', args),
  hasReference: (filename: string) => ipcRenderer.invoke('capture:hasReference', filename),
});
