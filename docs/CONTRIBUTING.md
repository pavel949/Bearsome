# Contributing

Thanks for working on Bearsome! This guide covers the workflow, project layout,
and code conventions. For the deeper "why", read
[`ARCHITECTURE.md`](./ARCHITECTURE.md); for AI-agent specifics, see
[`../CLAUDE.md`](../CLAUDE.md).

## Prerequisites

- **Node.js 20+** (developed on Node 22) and npm.
- A desktop OS that can run Electron (Windows, macOS, or Linux).

## Setup

```bash
npm install
npm run dev      # launches the app with hot reload
```

## Project layout

```
src/
├── main/      # Electron main process (Node): window, IPC, Modrinth, filesystem
├── preload/   # contextBridge → window.bearsome
├── renderer/  # React UI (no Node access)
└── shared/    # types + IPC contract used by both sides
```

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for a module-by-module breakdown.

## Workflow

1. Branch off the current working branch.
2. Make your change, following the conventions below.
3. **Verify** (this is the gate — there is no test suite yet):
   ```bash
   npm run typecheck    # must pass
   npm run build        # must pass
   ```
   If you touched runtime wiring (IPC, preload, window, app lifecycle), also do a
   headless smoke launch:
   ```bash
   npm run build && timeout 30 xvfb-run -a node_modules/.bin/electron out/main/index.js --no-sandbox
   ```
   A clean run shows no `Unable to load preload script` and no module-load
   crash. (dbus/GPU/TLS errors in a sandbox are environmental.)
4. Commit with a clear message and open a PR.

## Code conventions

- **TypeScript strict**, including `noUnusedLocals` / `noUnusedParameters`. No
  unused imports or vars.
- **The renderer never imports `electron`, `node:*`, or `src/main`.** Need a new
  capability? Extend the IPC contract — don't reach into Node.
- **Adding an IPC endpoint = 4 files, in order:** `shared/ipc.ts` →
  `main/index.ts` (via the `handle()` wrapper) → `preload/index.ts` →
  renderer (via `unwrap()`). Full recipe in [`IPC_API.md`](./IPC_API.md).
- **IPC handlers return `IpcResult<T>`**; the renderer uses `unwrap()` to get a
  value or throw.
- **Styling** is plain CSS with tokens in `src/renderer/src/styles.css`. Reuse
  tokens and existing class families; see [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md).
- **Filesystem/network** changes belong in the main process
  (`minecraft.ts` / `modrinth.ts`). Validate any path/filename; respect the
  security rules in [`SECURITY.md`](./SECURITY.md).
- **Path aliases** (`@shared/*`, `@renderer/*`) must be kept in sync between
  `electron.vite.config.ts` and the `tsconfig.*.json` `paths`.

## Commit messages

- Imperative summary line ("Add update-check for installed mods").
- A short body explaining the *why* when it isn't obvious.
- Keep unrelated changes in separate commits.

## Documentation

If your change alters behavior, the IPC contract, the design language, or the
architecture, update the matching doc in `docs/` (and `CLAUDE.md` if it changes
conventions). Docs are part of the change, not a follow-up.

## Good first contributions

See [`ROADMAP.md`](./ROADMAP.md) — update checking, modpack import/export, and
additional content sources are all self-contained starting points.
