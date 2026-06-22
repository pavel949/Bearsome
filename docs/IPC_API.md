# IPC / `window.bearsome` API Reference

The renderer talks to the main process through a single typed object exposed by
the preload script: **`window.bearsome`**. Its shape is the `BearsomeApi`
interface in [`src/shared/ipc.ts`](../src/shared/ipc.ts); the channel names live
in the `IPC` map in the same file. This page documents every method.

## Conventions

- **Every method returns `Promise<IpcResult<T>>`**, where
  `IpcResult<T> = { ok: true; data: T } | { ok: false; error: string }`.
  The `installProgress` subscription is the one exception (see below).
- In the renderer, wrap calls with `unwrap()` from `src/renderer/src/lib.ts` to
  get the value or throw:
  ```ts
  import { unwrap } from './lib'
  const result = await unwrap(window.bearsome.search({ query: 'sodium' }))
  ```
- On the main side, every handler is wrapped by `handle()` in
  `src/main/index.ts`, which turns thrown errors into `{ ok: false, error }`.

## Adding a new endpoint (the 4-file recipe)

1. `src/shared/ipc.ts` → add a channel name to `IPC` and a method to
   `BearsomeApi`.
2. `src/main/index.ts` → `handle(IPC.yourChannel, (...args) => ...)`.
3. `src/preload/index.ts` → `yourMethod: (args) => ipcRenderer.invoke(IPC.yourChannel, args)`.
4. Renderer → call `window.bearsome.yourMethod(...)` (via `unwrap`).

---

## Modrinth / content

### `search(params: SearchParams): Promise<IpcResult<SearchResult>>`
Search Modrinth for mods.
- `params.query` — free text.
- `params.loader?` — `'fabric' | 'forge' | 'quilt' | 'neoforge'`.
- `params.gameVersion?` — e.g. `'1.20.1'`.
- `params.index?` — `'relevance' | 'downloads' | 'follows' | 'newest' | 'updated'`.
- `params.limit?` / `params.offset?` — pagination (default limit 20).
- Returns `{ hits: ModHit[], total, offset, limit }`.

### `getProject(idOrSlug: string): Promise<IpcResult<ProjectDetail>>`
Full project detail (description, body, categories, links, counts).

### `getVersions(idOrSlug, filters?): Promise<IpcResult<ProjectVersion[]>>`
Published versions for a project, newest first.
- `filters.loader?`, `filters.gameVersion?` narrow the list.
- Each `ProjectVersion` includes `files[]` (with the primary downloadable),
  `game_versions`, `loaders`, `version_type`, and `dependencies[]`.

### `getGameVersions(): Promise<IpcResult<string[]>>`
List of **release** Minecraft versions (newest first), for the filter dropdowns.

---

## Settings

### `getSettings(): Promise<IpcResult<AppSettings>>`
Current settings: `{ modsDir, defaultGameVersion, defaultLoader }`.

### `setSettings(patch: Partial<AppSettings>): Promise<IpcResult<AppSettings>>`
Merge a patch into settings; returns the updated settings.

### `pickModsDir(): Promise<IpcResult<string | null>>`
Open a native folder picker for the mods directory. Returns the chosen path (and
persists it) or `null` if cancelled.

### `detectModsDir(): Promise<IpcResult<string>>`
Return the OS-default vanilla mods folder (does not persist it).

---

## Mods / library

### `listInstalled(): Promise<IpcResult<InstalledMod[]>>`
Mods present in the configured `modsDir`, merged with stored metadata (title,
icon, install time), sorted newest first.

### `install(req: InstallRequest): Promise<IpcResult<InstallResult>>`
Download and install a version.
- `req.projectId`, `req.versionId`.
- `req.withDependencies` — also resolve & install required dependencies.
- Returns `{ installed: InstalledMod[], dependencies: string[] }`
  (`dependencies` = names pulled in automatically).
- Emits `installProgress` events while downloading (see below).

### `uninstall(filename: string): Promise<IpcResult<InstalledMod[]>>`
Delete a mod `.jar` by filename and drop its metadata. Returns the new installed
list. Filenames are validated against path traversal in the main process.

### `uninstallMany(filenames: string[]): Promise<IpcResult<InstalledMod[]>>`
Remove several mods in one call (used by the Library's multi-select "Remove
selected"). Each filename is path-traversal validated; metadata is dropped for
all of them and the updated installed list is returned.

### `checkUpdates(): Promise<IpcResult<ModUpdate[]>>`
Check every tracked installed mod for a newer compatible version on Modrinth.
For each mod it looks up the installed version's loader + Minecraft version and
finds the most recently published version for those filters; if that version is
newer than the installed one, it's returned as a `ModUpdate`. Mods with no
tracked metadata (jars added outside the app) are skipped, and a single project
failing does not abort the whole check.

### `updateMod(filename: string): Promise<IpcResult<InstallResult>>`
Install the latest compatible version for an installed mod, then remove the old
`.jar` if the new version has a different filename. Throws `Already up to date.`
if there's nothing newer. Returns the standard `InstallResult`.

### `exportPack(): Promise<IpcResult<string | null>>`
Open a native save dialog and write the current library to a `.json` Bearsome
pack (`{ format, version, name, createdAt, mods: [{projectId, versionId, title}]
}`). Returns the saved path, or `null` if cancelled. Only mods with tracked
metadata are included.

### `importPack(): Promise<IpcResult<PackImportResult>>`
Open a native file picker for a `.json` Bearsome pack, then install every entry
by its `versionId`. Returns `{ installed: InstalledMod[], failed: string[] }`
(both empty if cancelled). A single failing entry is recorded in `failed` and
does not abort the rest.

### `openModsDir(): Promise<IpcResult<null>>`
Open the mods folder in the OS file manager.

### `openExternal(url: string): Promise<IpcResult<null>>`
Open a URL in the user's default browser (used for Modrinth/source links).

### `getVersion(): Promise<IpcResult<string>>`
The app's version string (from `package.json`), shown in the sidebar footer.

---

## Events

### `onInstallProgress(cb): () => void`
Subscribe to download progress. The callback receives
`{ filename: string; receivedBytes: number; totalBytes: number }` and the method
returns an **unsubscribe** function. Use it inside a React `useEffect` and call
the returned function on cleanup:

```ts
useEffect(() => {
  return window.bearsome.onInstallProgress((p) => {
    const pct = p.totalBytes ? Math.round((p.receivedBytes / p.totalBytes) * 100) : 0
    // ...update UI
  })
}, [])
```

---

## Type index

All types are defined in [`src/shared/types.ts`](../src/shared/types.ts):
`Loader`, `ModHit`, `SearchResult`, `SearchParams`, `VersionFile`,
`ProjectVersion`, `ProjectDetail`, `InstalledMod`, `AppSettings`,
`InstallRequest`, `InstallProgress`, `InstallResult`, `ModUpdate`, `Pack`,
`PackEntry`, `PackImportResult`, `IpcResult<T>`.
