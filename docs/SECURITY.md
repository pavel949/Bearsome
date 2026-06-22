# Security Model

Bearsome runs untrusted content (mod titles, descriptions, icons, and the mod
files themselves come from the internet) and writes files to the user's disk.
The architecture is built to contain that. This document records the model and
the rules that keep it intact.

## Threat model

- **Untrusted text/HTML** from Modrinth rendered in the UI.
- **Untrusted images** from Modrinth's CDN.
- **Untrusted binaries** (mod `.jar`s) downloaded to disk.
- The app must never let any of the above read the user's filesystem, run
  arbitrary code in a privileged context, or write outside the chosen mods
  folder.

## Process isolation

The renderer (where untrusted content lives) is locked down in
`src/main/index.ts` `webPreferences`:

| Setting | Value | Why |
| --- | --- | --- |
| `contextIsolation` | `true` | Page JS can't reach Electron/Node internals. |
| `nodeIntegration` | `false` | No `require`/Node globals in the page. |
| `sandbox` | `false` | Required only so the **ESM preload** can load; the renderer is still isolated and has no Node integration. |
| `preload` | `…/preload/index.mjs` | The single controlled bridge. |

The renderer's only access to the system is the `window.bearsome` object exposed
via `contextBridge`. There is no other channel. A compromised renderer can call
only the documented IPC methods — it cannot read files, spawn processes, or
escalate.

## Content Security Policy

`src/renderer/index.html` sets a strict CSP:

```
default-src 'self';
img-src 'self' https://cdn.modrinth.com data:;
style-src 'self' 'unsafe-inline';
script-src 'self'
```

- Scripts only from our own bundle (`script-src 'self'`).
- Images only from our bundle and **Modrinth's CDN** (mod icons) + `data:`.
- No remote script execution; no arbitrary image hosts.

When adding a feature that needs another origin (e.g. a second content source),
widen the CSP **explicitly and minimally**.

## IPC surface

- Every handler returns `IpcResult<T>` and is wrapped by `handle()`, so thrown
  errors become data, never uncaught exceptions that could crash or leak stack
  traces into the UI uncontrolled.
- The surface is small and explicit (see [`IPC_API.md`](./IPC_API.md)). Inputs
  are used narrowly; nothing evaluates arbitrary strings as code.

## Filesystem safety

All disk access goes through `src/main/minecraft.ts`:

- Writes only ever go **inside the configured `modsDir`** as `.jar` files.
- `removeMod()` rejects filenames containing `/`, `\`, or `..` — no path
  traversal; deletions are limited to a single file in the mods folder.
- The app never deletes anything the user didn't explicitly remove.
- Downloads are streamed to the target path; a failed HTTP response throws
  before anything partial is treated as installed.

## External links

External URLs (Modrinth pages, source repos) are opened in the user's default
browser via `shell.openExternal`. The window's `setWindowOpenHandler` denies
in-app navigation to external content and routes it to the browser instead, so
remote pages never load inside the Electron window.

## Network

- All network calls happen in the **main process** (Node), not the renderer.
- The Modrinth client sends a descriptive `User-Agent` and talks only to
  `api.modrinth.com` / `cdn.modrinth.com` over HTTPS.

## What Bearsome does *not* do

- It does not execute downloaded mods — it only places `.jar` files in a folder;
  Minecraft loads them later. Users should still trust the mods they install.
- It does not require or store any credentials (all Modrinth endpoints used are
  public).

## Rules for contributors

1. Never enable `nodeIntegration` or disable `contextIsolation`.
2. Never expose raw `ipcRenderer`, `fs`, `child_process`, or `electron` to the
   page — extend `window.bearsome` with a specific, validated method instead.
3. Validate any path/filename that reaches the filesystem.
4. Keep the CSP as tight as the feature allows.
