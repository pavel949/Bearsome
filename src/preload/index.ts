import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type BearsomeApi } from '../shared/ipc'

// The single, typed bridge between the sandboxed renderer and the main
// process. Nothing else from Node/Electron is exposed.
const api: BearsomeApi = {
  search: (params) => ipcRenderer.invoke(IPC.search, params),
  getProject: (idOrSlug) => ipcRenderer.invoke(IPC.getProject, idOrSlug),
  getVersions: (idOrSlug, filters) => ipcRenderer.invoke(IPC.getVersions, idOrSlug, filters),
  getGameVersions: () => ipcRenderer.invoke(IPC.getGameVersions),

  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  setSettings: (patch) => ipcRenderer.invoke(IPC.setSettings, patch),
  pickModsDir: () => ipcRenderer.invoke(IPC.pickModsDir),
  detectModsDir: () => ipcRenderer.invoke(IPC.detectModsDir),

  listInstalled: () => ipcRenderer.invoke(IPC.listInstalled),
  install: (req) => ipcRenderer.invoke(IPC.install, req),
  uninstall: (filename) => ipcRenderer.invoke(IPC.uninstall, filename),
  uninstallMany: (filenames) => ipcRenderer.invoke(IPC.uninstallMany, filenames),
  checkUpdates: () => ipcRenderer.invoke(IPC.checkUpdates),
  updateMod: (filename) => ipcRenderer.invoke(IPC.updateMod, filename),
  exportPack: () => ipcRenderer.invoke(IPC.exportPack),
  importPack: () => ipcRenderer.invoke(IPC.importPack),
  importMrpack: () => ipcRenderer.invoke(IPC.importMrpack),
  openModsDir: () => ipcRenderer.invoke(IPC.openModsDir),
  openExternal: (url) => ipcRenderer.invoke(IPC.openExternal, url),
  getVersion: () => ipcRenderer.invoke(IPC.getVersion),

  onInstallProgress: (cb) => {
    const listener = (
      _e: unknown,
      payload: { filename: string; receivedBytes: number; totalBytes: number }
    ): void => cb(payload)
    ipcRenderer.on(IPC.installProgress, listener)
    return () => ipcRenderer.removeListener(IPC.installProgress, listener)
  }
}

contextBridge.exposeInMainWorld('bearsome', api)
