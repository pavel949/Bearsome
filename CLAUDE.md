# CLAUDE.md

Guidance for Claude Code (and other AI agents) working in this repository.
Read this first — it captures how Bearsome is built, the conventions to follow,
and the commands that verify your work.

## What this project is

**Bearsome** is a cross-platform **Electron + React + TypeScript** desktop app
that lets gamers search [Modrinth](https://modrinth.com) and install Minecraft
mods directly into their game's `mods` folder, including automatic dependency
resolution. See [`PROJECT.md`](./PROJECT.md) for the product spec and
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the technical design.

## Commands

```bash
npm install          # install dependencies
npm run dev          # launch the app in development with hot reload
npm run build        # production build into out/ (main, preload, renderer)
npm run start        # preview a production build
npm run typecheck    # type-check all three TS projects (node + web)
npm test             # run the vitest unit suite (test/**/*.test.ts)
npm run package      # build a distributable installer (electron-builder)
```

No linter is configured yet. **`npm run typecheck`, `npm test` and `npm run
build` are the gate** — all must pass before you commit (CI runs the same three
on every PR via `.github/workflows/ci.yml`). When a change could affect runtime
wiring (IPC, preload path, window creation), do a headless smoke launch:

```bash
npm run build && timeout 30 xvfb-run -a node_modules/.bin/electron out/main/index.js --no-sandbox
```

A clean boot has no `Unable to load preload script` and no module-load crash.
TLS/dbus/GPU errors in a sandbox are environmental, not app bugs.

## Architecture in one screen

Three TypeScript "projects", one per Electron process, plus shared code:

```
src/
├── main/        # Electron main process — Node access, no DOM
│   ├── index.ts      # window creation, app lifecycle, IPC handler registration,
│   │                 # install orchestration (incl. dependency resolution)
│   ├── modrinth.ts   # Modrinth API v2 client (search/project/versions/tags)
│   └── minecraft.ts  # filesystem: detect mods dir, stream downloads, list, remove
├── preload/     # the ONLY bridge between processes
│   └── index.ts      # contextBridge → window.bearsome (typed BearsomeApi)
├── renderer/    # React UI — DOM access, NO Node/Electron access
│   ├── index.html    # CSP locked to self + cdn.modrinth.com images
│   └── src/
│       ├── App.tsx           # top-level state + Browse/Library/Settings views
│       ├── lib.ts            # unwrap(IpcResult), formatters
│       ├── styles.css        # all styling + design tokens (CSS variables)
│       └── components/       # ModCard, ModDetail, Library, Settings
└── shared/      # imported by BOTH main and renderer
    ├── types.ts      # domain types (ModHit, ProjectVersion, AppSettings, ...)
    └── ipc.ts        # IPC channel names + BearsomeApi interface (the contract)
```

Data flow: **renderer → `window.bearsome.*` (preload) → `ipcRenderer.invoke` →
`ipcMain.handle` (main) → Modrinth/filesystem → back as `IpcResult<T>`**.

## Hard rules / conventions

1. **The renderer never imports `electron`, `node:*`, or anything from
   `src/main`.** It only talks to the backend through `window.bearsome`. If the
   UI needs a new capability, add it to the IPC contract (see below), not by
   reaching into Node.

2. **Adding an IPC endpoint is a 4-file change, in this order:**
   - `src/shared/ipc.ts` — add the channel name to `IPC` and the method to the
     `BearsomeApi` interface.
   - `src/main/index.ts` — register a handler via the `handle()` wrapper.
   - `src/preload/index.ts` — forward it with `ipcRenderer.invoke`.
   - Renderer — call `window.bearsome.<method>` (wrap with `unwrap()` from
     `lib.ts`).

3. **All IPC handlers return `IpcResult<T>`** (`{ ok: true, data } | { ok:
   false, error }`). The `handle()` wrapper in `index.ts` turns thrown errors
   into `{ ok: false }` so the renderer renders an error instead of crashing.
   In the renderer, use `unwrap()` to convert that back into a value/throw.

4. **Path aliases:** `@shared/*` → `src/shared/*` (both processes),
   `@renderer/*` → `src/renderer/src/*` (renderer only). These are declared in
   BOTH `electron.vite.config.ts` (for bundling) and the `tsconfig.*.json`
   `paths` (for type-checking). Update both if you add an alias.

5. **TypeScript is strict**, with `noUnusedLocals`/`noUnusedParameters`. Don't
   leave unused imports. There are three configs: `tsconfig.node.json`
   (main + preload + shared), `tsconfig.web.json` (renderer + shared), and the
   root `tsconfig.json` references both.

6. **Styling lives in `src/renderer/src/styles.css`** as plain CSS with design
   tokens defined as `:root` CSS variables. No CSS-in-JS, no Tailwind. Reuse the
   tokens and existing class patterns — see [`docs/DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md).

7. **Filesystem safety:** anything that writes/deletes goes through
   `src/main/minecraft.ts`, which guards against path traversal and only ever
   touches the configured mods directory. Keep it that way.

8. **Modrinth etiquette:** the API client sends a descriptive `User-Agent`.
   Keep it. Network calls live in the main process only (avoids CORS and lets us
   stream downloads to disk).

## Gotchas

- **Preload is built as `index.mjs`**, not `.js` (package is `"type":
  "module"`). The main process references `../preload/index.mjs`. If you change
  build output, fix that path or the bridge silently won't load.
- **`electron-store` is instantiated at module load** in `index.ts`. A bad
  import there crashes the app immediately on boot.
- The renderer is sandboxed with `contextIsolation: true` and
  `nodeIntegration: false`. `sandbox: false` is required only so the ESM preload
  can run.

## Where to read more

- [`PROJECT.md`](./PROJECT.md) — product vision, scope, personas
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — processes, data flow, modules
- [`docs/IPC_API.md`](./docs/IPC_API.md) — the full IPC/`window.bearsome` reference
- [`docs/DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md) — tokens, components, patterns
- [`docs/SECURITY.md`](./docs/SECURITY.md) — sandboxing, CSP, filesystem safety
- [`docs/CONTRIBUTING.md`](./docs/CONTRIBUTING.md) — workflow & code style
- [`docs/ROADMAP.md`](./docs/ROADMAP.md) — what's planned
