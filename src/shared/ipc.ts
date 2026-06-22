// Central list of IPC channel names plus the shape of the API the preload
// script exposes to the renderer via contextBridge. The renderer never
// touches Node/Electron directly — it only sees `window.bearsome`.

import type {
  AppSettings,
  InstallRequest,
  InstallResult,
  InstalledMod,
  IpcResult,
  ModUpdate,
  ProjectDetail,
  ProjectVersion,
  SearchParams,
  SearchResult
} from './types'

export const IPC = {
  search: 'modrinth:search',
  getProject: 'modrinth:getProject',
  getVersions: 'modrinth:getVersions',
  getGameVersions: 'modrinth:getGameVersions',
  getSettings: 'settings:get',
  setSettings: 'settings:set',
  pickModsDir: 'settings:pickModsDir',
  detectModsDir: 'settings:detectModsDir',
  listInstalled: 'mods:listInstalled',
  install: 'mods:install',
  uninstall: 'mods:uninstall',
  checkUpdates: 'mods:checkUpdates',
  updateMod: 'mods:updateMod',
  openModsDir: 'mods:openModsDir',
  openExternal: 'shell:openExternal',
  installProgress: 'mods:installProgress'
} as const

/** The typed surface available at `window.bearsome` in the renderer. */
export interface BearsomeApi {
  search(params: SearchParams): Promise<IpcResult<SearchResult>>
  getProject(idOrSlug: string): Promise<IpcResult<ProjectDetail>>
  getVersions(
    idOrSlug: string,
    filters?: { loader?: string; gameVersion?: string }
  ): Promise<IpcResult<ProjectVersion[]>>
  getGameVersions(): Promise<IpcResult<string[]>>

  getSettings(): Promise<IpcResult<AppSettings>>
  setSettings(patch: Partial<AppSettings>): Promise<IpcResult<AppSettings>>
  pickModsDir(): Promise<IpcResult<string | null>>
  detectModsDir(): Promise<IpcResult<string>>

  listInstalled(): Promise<IpcResult<InstalledMod[]>>
  install(req: InstallRequest): Promise<IpcResult<InstallResult>>
  uninstall(filename: string): Promise<IpcResult<InstalledMod[]>>
  /** Check every installed mod for a newer compatible version on Modrinth. */
  checkUpdates(): Promise<IpcResult<ModUpdate[]>>
  /** Install the latest compatible version for an installed mod, replacing it. */
  updateMod(filename: string): Promise<IpcResult<InstallResult>>
  openModsDir(): Promise<IpcResult<null>>
  openExternal(url: string): Promise<IpcResult<null>>

  /** Subscribe to download progress. Returns an unsubscribe function. */
  onInstallProgress(cb: (p: { filename: string; receivedBytes: number; totalBytes: number }) => void): () => void
}
