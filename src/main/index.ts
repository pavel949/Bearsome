import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { dirname, join } from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import AdmZip from 'adm-zip'
import Store from 'electron-store'

import { IPC } from '../shared/ipc'
import type {
  AppSettings,
  InstallRequest,
  InstallResult,
  InstalledMod,
  IpcResult,
  ModUpdate,
  MrpackImportResult,
  Pack,
  PackEntry,
  PackImportResult,
  ProjectVersion,
  SearchParams
} from '../shared/types'
import * as modrinth from './modrinth'
import {
  detectModsDir,
  downloadToMods,
  downloadToPath,
  listJarFiles,
  removeMod,
  safeResolve
} from './minecraft'
import { parseMrpackIndex } from './mrpack'
import { buildAppMenu } from './menu'

// ---------------------------------------------------------------------------
// Persistent state
// ---------------------------------------------------------------------------

interface StoreSchema {
  settings: AppSettings
  // Metadata about installed jars, keyed by filename, so the library view can
  // show titles/icons that aren't recoverable from a bare .jar.
  installedMeta: Record<
    string,
    { projectId: string; versionId: string; title: string; iconUrl: string | null; installedAt: number }
  >
}

const store = new Store<StoreSchema>({
  defaults: {
    settings: {
      modsDir: detectModsDir(),
      defaultGameVersion: '',
      defaultLoader: 'fabric'
    },
    installedMeta: {}
  }
})

function getSettings(): AppSettings {
  return store.get('settings')
}

// ---------------------------------------------------------------------------
// IPC helpers
// ---------------------------------------------------------------------------

/** Wrap a handler so thrown errors become a serialisable IpcResult. */
function handle<T>(channel: string, fn: (...args: unknown[]) => Promise<T> | T): void {
  ipcMain.handle(channel, async (_event, ...args): Promise<IpcResult<T>> => {
    try {
      return { ok: true, data: await fn(...args) }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, error: message }
    }
  })
}

let mainWindow: BrowserWindow | null = null

function emitProgress(filename: string, receivedBytes: number, totalBytes: number): void {
  mainWindow?.webContents.send(IPC.installProgress, { filename, receivedBytes, totalBytes })
}

// ---------------------------------------------------------------------------
// Install orchestration
// ---------------------------------------------------------------------------

function primaryFile(version: ProjectVersion): { url: string; filename: string } {
  const file = version.files.find((f) => f.primary) ?? version.files[0]
  if (!file) throw new Error(`Version "${version.name}" has no downloadable files`)
  return { url: file.url, filename: file.filename }
}

async function installVersion(
  version: ProjectVersion,
  modsDir: string
): Promise<InstalledMod> {
  const { url, filename } = primaryFile(version)
  const { path, sizeBytes } = await downloadToMods(modsDir, url, filename, (r, t) =>
    emitProgress(filename, r, t)
  )

  // Best-effort: enrich metadata with the project's title/icon.
  let title = version.name
  let iconUrl: string | null = null
  try {
    const project = await modrinth.getProject(version.project_id)
    title = project.title
    iconUrl = project.icon_url
  } catch {
    /* metadata is optional */
  }

  const installedAt = Date.now()
  const meta = store.get('installedMeta')
  meta[filename] = {
    projectId: version.project_id,
    versionId: version.id,
    title,
    iconUrl,
    installedAt
  }
  store.set('installedMeta', meta)

  return { filename, path, sizeBytes, installedAt, projectId: version.project_id, versionId: version.id, title, iconUrl }
}

async function resolveDependencyVersions(
  root: ProjectVersion,
  filters: { loader?: string; gameVersion?: string }
): Promise<ProjectVersion[]> {
  const resolved: ProjectVersion[] = []
  const seenProjects = new Set<string>([root.project_id])
  const queue = [...root.dependencies]

  while (queue.length) {
    const dep = queue.shift()!
    if (dep.dependency_type !== 'required') continue

    try {
      let depVersion: ProjectVersion | null = null
      if (dep.version_id) {
        depVersion = await modrinth.getVersion(dep.version_id)
      } else if (dep.project_id && !seenProjects.has(dep.project_id)) {
        const candidates = await modrinth.getVersions(dep.project_id, filters)
        depVersion = candidates[0] ?? null
      }
      if (!depVersion) continue
      if (seenProjects.has(depVersion.project_id)) continue

      seenProjects.add(depVersion.project_id)
      resolved.push(depVersion)
      // Pull in nested required dependencies too.
      queue.push(...depVersion.dependencies)
    } catch {
      // A missing dependency shouldn't abort the whole install.
    }
  }
  return resolved
}

async function doInstall(req: InstallRequest): Promise<InstallResult> {
  const { modsDir, defaultLoader, defaultGameVersion } = getSettings()
  const version = await modrinth.getVersion(req.versionId)

  const installed: InstalledMod[] = [await installVersion(version, modsDir)]
  const dependencies: string[] = []

  if (req.withDependencies) {
    const filters = {
      loader: version.loaders[0] ?? defaultLoader,
      gameVersion: version.game_versions[0] ?? (defaultGameVersion || undefined)
    }
    const depVersions = await resolveDependencyVersions(version, filters)
    for (const dep of depVersions) {
      const mod = await installVersion(dep, modsDir)
      installed.push(mod)
      dependencies.push(mod.title ?? mod.filename)
    }
  }

  return { installed, dependencies }
}

async function listInstalled(): Promise<InstalledMod[]> {
  const { modsDir } = getSettings()
  const jars = await listJarFiles(modsDir)
  const meta = store.get('installedMeta')
  return jars
    .map((j) => {
      const m = meta[j.filename]
      return {
        filename: j.filename,
        path: j.path,
        sizeBytes: j.sizeBytes,
        installedAt: m?.installedAt ?? j.mtimeMs,
        projectId: m?.projectId,
        versionId: m?.versionId,
        title: m?.title,
        iconUrl: m?.iconUrl ?? null
      }
    })
    .sort((a, b) => b.installedAt - a.installedAt)
}

// ---------------------------------------------------------------------------
// Update checking
// ---------------------------------------------------------------------------

/**
 * Find the newest version of a project compatible with the same loader and
 * Minecraft version as the currently-installed version. Returns null if the
 * project has no other versions for those filters.
 */
async function latestCompatibleVersion(
  projectId: string,
  current: ProjectVersion
): Promise<ProjectVersion | null> {
  const filters = {
    loader: current.loaders[0],
    gameVersion: current.game_versions[0]
  }
  const versions = await modrinth.getVersions(projectId, filters)
  if (versions.length === 0) return null
  // Be defensive about ordering — pick the most recently published.
  return [...versions].sort(
    (a, b) => new Date(b.date_published).getTime() - new Date(a.date_published).getTime()
  )[0]
}

async function checkUpdates(): Promise<ModUpdate[]> {
  const installed = await listInstalled()
  const updates: ModUpdate[] = []

  for (const mod of installed) {
    if (!mod.projectId || !mod.versionId) continue // can't track unknown jars
    try {
      const current = await modrinth.getVersion(mod.versionId)
      const latest = await latestCompatibleVersion(mod.projectId, current)
      if (!latest || latest.id === current.id) continue
      // Only surface it if it's genuinely newer.
      if (new Date(latest.date_published).getTime() <= new Date(current.date_published).getTime()) {
        continue
      }
      updates.push({
        filename: mod.filename,
        projectId: mod.projectId,
        title: mod.title ?? mod.filename,
        iconUrl: mod.iconUrl ?? null,
        currentVersionId: current.id,
        currentVersionNumber: current.version_number,
        latestVersionId: latest.id,
        latestVersionNumber: latest.version_number,
        latestPublished: latest.date_published
      })
    } catch {
      // A single project failing shouldn't abort the whole check.
    }
  }
  return updates
}

async function updateMod(filename: string): Promise<InstallResult> {
  const { modsDir } = getSettings()
  const meta = store.get('installedMeta')
  const entry = meta[filename]
  if (!entry) throw new Error(`No tracked metadata for "${filename}" — can't update it.`)

  const current = await modrinth.getVersion(entry.versionId)
  const latest = await latestCompatibleVersion(entry.projectId, current)
  if (!latest || latest.id === current.id) {
    throw new Error('Already up to date.')
  }

  const installedMod = await installVersion(latest, modsDir)

  // Remove the old jar if the new version has a different filename.
  if (installedMod.filename !== filename) {
    await removeMod(modsDir, filename)
    const after = store.get('installedMeta')
    delete after[filename]
    store.set('installedMeta', after)
  }

  return { installed: [installedMod], dependencies: [] }
}

// ---------------------------------------------------------------------------
// Modpack export / import
// ---------------------------------------------------------------------------

async function exportPack(): Promise<string | null> {
  const installed = await listInstalled()
  const mods: PackEntry[] = installed
    .filter((m): m is InstalledMod & { projectId: string; versionId: string } =>
      Boolean(m.projectId && m.versionId)
    )
    .map((m) => ({ projectId: m.projectId, versionId: m.versionId, title: m.title ?? m.filename }))

  const pack: Pack = {
    format: 'bearsome-pack',
    version: 1,
    name: 'My Bearsome pack',
    createdAt: new Date().toISOString(),
    mods
  }

  const result = await dialog.showSaveDialog(mainWindow!, {
    title: 'Export pack',
    defaultPath: 'bearsome-pack.json',
    filters: [{ name: 'Bearsome pack', extensions: ['json'] }]
  })
  if (result.canceled || !result.filePath) return null

  await writeFile(result.filePath, JSON.stringify(pack, null, 2), 'utf8')
  return result.filePath
}

function parsePack(raw: string): Pack {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  const pack = data as Partial<Pack>
  if (pack.format !== 'bearsome-pack' || !Array.isArray(pack.mods)) {
    throw new Error('That file is not a Bearsome pack.')
  }
  return pack as Pack
}

async function importPack(): Promise<PackImportResult> {
  const open = await dialog.showOpenDialog(mainWindow!, {
    title: 'Import pack',
    filters: [{ name: 'Bearsome pack', extensions: ['json'] }],
    properties: ['openFile']
  })
  if (open.canceled || open.filePaths.length === 0) {
    return { installed: [], failed: [] }
  }

  const pack = parsePack(await readFile(open.filePaths[0], 'utf8'))
  const { modsDir } = getSettings()
  const installed: InstalledMod[] = []
  const failed: string[] = []

  for (const entry of pack.mods) {
    try {
      const version = await modrinth.getVersion(entry.versionId)
      installed.push(await installVersion(version, modsDir))
    } catch {
      failed.push(entry.title || entry.projectId)
    }
  }

  return { installed, failed }
}

async function importMrpack(): Promise<MrpackImportResult> {
  const open = await dialog.showOpenDialog(mainWindow!, {
    title: 'Import Modrinth modpack',
    filters: [{ name: 'Modrinth modpack', extensions: ['mrpack'] }],
    properties: ['openFile']
  })
  if (open.canceled || open.filePaths.length === 0) {
    return { name: '', installed: 0, failed: [] }
  }

  const zip = new AdmZip(open.filePaths[0])
  const indexEntry = zip.getEntry('modrinth.index.json')
  if (!indexEntry) throw new Error('That .mrpack has no modrinth.index.json.')
  const index = parseMrpackIndex(zip.readAsText(indexEntry))

  // Pack paths are relative to the Minecraft instance root, which contains the
  // mods folder. Derive it from the configured mods directory.
  const base = dirname(getSettings().modsDir)
  let installed = 0
  const failed: string[] = []

  // 1) Managed downloads listed in the index.
  for (const file of index.files) {
    try {
      const dest = safeResolve(base, file.path)
      await downloadToPath(file.downloads[0], dest, (r, t) =>
        emitProgress(file.path.split('/').pop() ?? file.path, r, t)
      )
      installed++
    } catch {
      failed.push(file.path)
    }
  }

  // 2) `overrides/` (and client-overrides/) files bundled in the zip.
  for (const entry of zip.getEntries()) {
    const name = entry.entryName
    const prefix = ['overrides/', 'client-overrides/'].find((p) => name.startsWith(p))
    if (!prefix || entry.isDirectory) continue
    const rel = name.slice(prefix.length)
    if (!rel) continue
    try {
      const dest = safeResolve(base, rel)
      await mkdir(dirname(dest), { recursive: true })
      await writeFile(dest, entry.getData())
      installed++
    } catch {
      failed.push(name)
    }
  }

  return { name: index.name, installed, failed }
}

// ---------------------------------------------------------------------------
// Register IPC handlers
// ---------------------------------------------------------------------------

function registerIpc(): void {
  handle(IPC.search, (params) => modrinth.search(params as SearchParams))
  handle(IPC.getProject, (idOrSlug) => modrinth.getProject(idOrSlug as string))
  handle(IPC.getVersions, (idOrSlug, filters) =>
    modrinth.getVersions(idOrSlug as string, filters as { loader?: string; gameVersion?: string } | undefined)
  )
  handle(IPC.getGameVersions, () => modrinth.getGameVersions())

  handle(IPC.getSettings, () => getSettings())
  handle(IPC.setSettings, (patch) => {
    const next = { ...getSettings(), ...(patch as Partial<AppSettings>) }
    store.set('settings', next)
    return next
  })
  handle(IPC.detectModsDir, () => detectModsDir())
  handle(IPC.pickModsDir, async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Choose your Minecraft mods folder',
      defaultPath: getSettings().modsDir,
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const dir = result.filePaths[0]
    store.set('settings', { ...getSettings(), modsDir: dir })
    return dir
  })

  handle(IPC.listInstalled, () => listInstalled())
  handle(IPC.install, (req) => doInstall(req as InstallRequest))
  handle(IPC.uninstall, async (filename) => {
    const { modsDir } = getSettings()
    await removeMod(modsDir, filename as string)
    const meta = store.get('installedMeta')
    delete meta[filename as string]
    store.set('installedMeta', meta)
    return listInstalled()
  })
  handle(IPC.uninstallMany, async (filenames) => {
    const { modsDir } = getSettings()
    const meta = store.get('installedMeta')
    for (const filename of filenames as string[]) {
      await removeMod(modsDir, filename)
      delete meta[filename]
    }
    store.set('installedMeta', meta)
    return listInstalled()
  })
  handle(IPC.checkUpdates, () => checkUpdates())
  handle(IPC.updateMod, (filename) => updateMod(filename as string))
  handle(IPC.exportPack, () => exportPack())
  handle(IPC.importPack, () => importPack())
  handle(IPC.importMrpack, () => importMrpack())
  handle(IPC.openModsDir, async () => {
    const { modsDir } = getSettings()
    await shell.openPath(modsDir)
    return null
  })
  handle(IPC.openExternal, async (url) => {
    await shell.openExternal(url as string)
    return null
  })
  handle(IPC.getVersion, () => app.getVersion())
}

// ---------------------------------------------------------------------------
// Window / app lifecycle
// ---------------------------------------------------------------------------

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'Bearsome',
    backgroundColor: '#0f1117',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  // Open external links in the default browser, not inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpc()
  buildAppMenu(() => getSettings().modsDir)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
