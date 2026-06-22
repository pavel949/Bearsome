# Architecture

Bearsome is a standard, security-hardened Electron application: three isolated
runtimes (main, preload, renderer) that communicate over a single typed IPC
contract. This document explains each layer, how data flows, and the key
modules.

## The three processes

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                Electron app                                │
│                                                                            │
│  ┌────────────────────────┐        ┌────────────────────────────────────┐ │
│  │  RENDERER (Chromium)   │        │   MAIN (Node.js)                   │ │
│  │  src/renderer          │        │   src/main                         │ │
│  │                        │        │                                    │ │
│  │  React UI              │        │  • app/window lifecycle            │ │
│  │  - Browse              │        │  • IPC handlers (index.ts)         │ │
│  │  - Library             │        │  • Modrinth client (modrinth.ts)   │ │
│  │  - Settings            │        │  • Filesystem (minecraft.ts)       │ │
│  │                        │        │  • Settings store (electron-store) │ │
│  │  NO Node / Electron    │        │  Full Node access                  │ │
│  └───────────┬────────────┘        └──────────────────┬─────────────────┘ │
│              │  window.bearsome.*                      │  ipcMain.handle    │
│              │                                         │                    │
│       ┌──────┴─────────────────────────────────────── ┴───────┐            │
│       │            PRELOAD  (src/preload/index.ts)             │            │
│       │  contextBridge.exposeInMainWorld('bearsome', api)      │            │
│       │  ipcRenderer.invoke / ipcRenderer.on                   │            │
│       └────────────────────────────────────────────────────── ┘            │
└──────────────────────────────────────────────────────────────────────────┘
                              │  HTTPS (api.modrinth.com, cdn.modrinth.com)
                              ▼
                        Modrinth API v2  +  local filesystem (mods folder)
```

- **Main process** (`src/main`) — the only place with Node.js privileges. It
  owns the window, all network calls (so we dodge browser CORS and can stream
  downloads), all filesystem access, and persisted state. Runs as an ES module
  bundle (`out/main/index.js`).

- **Preload** (`src/preload`) — a tiny, security-critical shim. It runs in an
  isolated context with access to a restricted Electron surface and uses
  `contextBridge` to expose exactly one object, `window.bearsome`, to the page.
  Built as `out/preload/index.mjs`.

- **Renderer** (`src/renderer`) — the React app. It has DOM access but **no**
  Node or Electron access (`contextIsolation: true`, `nodeIntegration: false`).
  Everything it needs from the system it requests through `window.bearsome`.

## Why this split

- **Security.** A compromised renderer (e.g. via a malicious mod description)
  can't read your disk or run code — it can only call the narrow, validated IPC
  surface. See [`SECURITY.md`](./SECURITY.md).
- **CORS & downloads.** The Modrinth API and CDN are reached from Node, where
  there's no CORS and we can stream a download straight to a file with progress.
- **Testability.** `modrinth.ts` and `minecraft.ts` are mostly pure functions
  that take their inputs (URLs, directories) explicitly.

## Module reference

### `src/shared` — the contract (imported by both sides)

- **`types.ts`** — domain types: `ModHit`, `SearchResult`, `ProjectVersion`,
  `ProjectDetail`, `InstalledMod`, `AppSettings`, `InstallRequest`,
  `InstallResult`, `Loader`, and the generic envelope
  `IpcResult<T> = { ok: true; data: T } | { ok: false; error: string }`.
- **`ipc.ts`** — the `IPC` channel-name map and the `BearsomeApi` interface that
  the preload implements and the renderer consumes. This is the single source of
  truth for the boundary. Full reference: [`IPC_API.md`](./IPC_API.md).

### `src/main`

- **`index.ts`** — application entry. Responsibilities:
  - Creates the `BrowserWindow` with the hardened `webPreferences`.
  - Instantiates the `electron-store` (settings + per-file install metadata).
  - Registers every IPC handler through a `handle()` wrapper that converts
    thrown errors into `IpcResult` failures.
  - **Install orchestration**: `doInstall()` downloads the chosen version's
    primary file, enriches it with project metadata, and — if requested —
    resolves required dependencies (`resolveDependencyVersions()`, a BFS over
    `dependencies` with a visited-set to avoid cycles) and installs those too.
  - **Update checking**: `checkUpdates()` compares each tracked installed mod
    against the latest compatible Modrinth version
    (`latestCompatibleVersion()`); `updateMod()` installs the newer version and
    removes the stale jar.
  - Emits `installProgress` events to the renderer during downloads.
- **`modrinth.ts`** — Modrinth API v2 client. Endpoints used:
  - `GET /search` (with `facets` built from project_type + version + loader)
  - `GET /project/{id|slug}`
  - `GET /project/{id|slug}/version` (filtered by loader/game version)
  - `GET /version/{id}` (resolve a specific version, incl. dependencies)
  - `GET /tag/game_version` (list release Minecraft versions)
  - Sends a descriptive `User-Agent`; throws on non-2xx with a trimmed body.
- **`minecraft.ts`** — filesystem layer (instance-agnostic; takes `modsDir`):
  - `detectModsDir()` — OS-specific default mods folder.
  - `listJarFiles()` — enumerate `.jar`s with size/mtime (tolerates a missing
    folder).
  - `downloadToMods()` — streams a URL to disk with progress via
    `Readable.fromWeb` + `stream/promises.pipeline`.
  - `removeMod()` — deletes a single file, guarding against path traversal.

### `src/renderer/src`

- **`App.tsx`** — top-level component. Holds app state (settings, search
  results, installed list, detail selection, install/remove busy flags, toasts,
  progress) and renders the sidebar nav + the active view.
- **`components/`**
  - `ModCard.tsx` — a search result tile with quick Install / Details.
  - `ModDetail.tsx` — modal that fetches a project + its versions and installs a
    chosen version (with a dependencies toggle).
  - `Library.tsx` — installed mods list with remove / open-folder / refresh.
  - `Settings.tsx` — mods folder picker, default loader, default MC version.
- **`lib.ts`** — `unwrap(IpcResult)` plus `formatCount` / `formatBytes` /
  `timeAgo` formatters.
- **`styles.css`** — all styling and the design tokens. See
  [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md).

## Data flow: installing a mod (end to end)

```
User clicks "Install" on a ModCard
  └─ App.quickInstall(hit)
       └─ window.bearsome.getVersions(projectId, {loader, gameVersion})   ── IPC ──▶ modrinth.getVersions()
       └─ window.bearsome.install({projectId, versionId, withDependencies}) ─ IPC ─▶ main.doInstall()
            ├─ modrinth.getVersion(versionId)
            ├─ minecraft.downloadToMods(...)  ──emits──▶ installProgress ──▶ App progress toast
            ├─ modrinth.getProject(...)  (metadata: title, icon)
            ├─ store.set(installedMeta[filename] = {...})
            └─ if withDependencies: resolveDependencyVersions() → install each
       ◀── IpcResult<InstallResult> ──
  └─ App.afterInstall(): refresh Library, show success toast
```

## Build & tooling

- **electron-vite** builds three bundles from one config
  (`electron.vite.config.ts`): `main`, `preload`, `renderer`. The first two use
  `externalizeDepsPlugin()` (Node deps stay external/required at runtime); the
  renderer uses `@vitejs/plugin-react`.
- **Path aliases** `@shared/*` and `@renderer/*` are configured in both the Vite
  config (bundling) and the `tsconfig.*.json` `paths` (type-checking).
- **TypeScript** is split into `tsconfig.node.json` (main + preload + shared)
  and `tsconfig.web.json` (renderer + shared), both strict.
- **Packaging** is done by `electron-builder` (`npm run package`) using the
  `build` block in `package.json` (Windows NSIS, macOS dmg, Linux AppImage).

## Persistence model

`electron-store` holds two keys:

- `settings: AppSettings` — `modsDir`, `defaultGameVersion`, `defaultLoader`.
- `installedMeta: Record<filename, { projectId, versionId, title, iconUrl,
  installedAt }>` — metadata that can't be recovered from a bare `.jar`, so the
  Library can show real titles/icons. The Library merges this with what's
  actually on disk (`listJarFiles`), so files added or removed outside the app
  still appear / disappear correctly.

## Extension points

- **New content source (e.g. CurseForge):** add a sibling to `modrinth.ts`
  exposing the same shapes, and branch in the install/search handlers. The
  renderer and IPC types stay largely unchanged.
- **New game:** `GameId` in `types.ts` and `detectModsDir()` in `minecraft.ts`
  are the seams; the UI is already game-agnostic in structure.
- **New capability in the UI:** follow the 4-file IPC recipe in
  [`CLAUDE.md`](../CLAUDE.md) / [`IPC_API.md`](./IPC_API.md).
