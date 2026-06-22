import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import Store from 'electron-store'

import { IPC } from '../shared/ipc'
import type {
  AppSettings,
  InstallRequest,
  InstallResult,
  InstalledMod,
  IpcResult,
  ProjectVersion,
  SearchParams
} from '../shared/types'
import * as modrinth from './modrinth'
import {
  detectModsDir,
  downloadToMods,
  listJarFiles,
  removeMod
} from './minecraft'

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
  handle(IPC.openModsDir, async () => {
    const { modsDir } = getSettings()
    await shell.openPath(modsDir)
    return null
  })
  handle(IPC.openExternal, async (url) => {
    await shell.openExternal(url as string)
    return null
  })
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
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
