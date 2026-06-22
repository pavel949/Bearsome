# 🐻 Bearsome

A friendly desktop app for gamers to **find and install Minecraft mods** in a
couple of clicks. Search [Modrinth](https://modrinth.com), pick a version for
your loader, and Bearsome downloads the mod straight into your Minecraft
`mods` folder — dependencies included.

> Built to be extensible: Minecraft + Modrinth is the first target, but the
> architecture (a clean main-process "provider" layer + a game-agnostic UI) is
> meant to grow to more games and sources over time.

## Features

- 🔍 **Search Modrinth** with filters for mod loader (Fabric / Forge / Quilt /
  NeoForge), Minecraft version, and sort order.
- ⚡ **One-click install** — grabs the latest compatible version for your
  filters and drops the `.jar` into your mods folder.
- 🧩 **Automatic dependencies** — required dependencies are resolved and
  installed alongside the mod.
- 🔄 **Update checking** — find installed mods with newer compatible versions on
  Modrinth and update them individually or all at once.
- 🎒 **Modpack export/import** — save your whole library to a shareable `.json`
  pack and re-install it on another machine or instance.
- ✅ **Installed-aware browsing** — search results and versions you already have
  are clearly flagged.
- 🧹 **Conflict detection & bulk cleanup** — warns when two files belong to the
  same mod (a common crash cause) and lets you multi-select and remove mods.
- 📦 **Library view** — see everything you've installed, with sizes and install
  times, and remove mods you no longer want.
- 📁 **Works with any launcher** — auto-detects the vanilla `.minecraft/mods`
  folder, or point it at a Prism / MultiMC / CurseForge instance.
- ⬇ **Live download progress** and clear success/error toasts.

## How it works

```
┌─────────────────────────────┐      IPC       ┌──────────────────────────────┐
│  Renderer (React + Vite)    │ ◀───────────▶ │  Main process (Electron/Node) │
│  - Browse / Library / Setup │  contextBridge │  - Modrinth API client        │
│  - No Node access (sandbox) │                │  - Filesystem install/remove  │
└─────────────────────────────┘                │  - Settings (electron-store)  │
                                               └──────────────────────────────┘
```

- **`src/main`** — Electron main process. `modrinth.ts` is the API client,
  `minecraft.ts` handles the filesystem (locating the mods folder, streaming
  downloads with progress, listing & removing mods), and `index.ts` wires up
  the window and all IPC handlers.
- **`src/preload`** — the single, typed `window.bearsome` bridge exposed to the
  renderer via `contextBridge`. The renderer never touches Node directly.
- **`src/renderer`** — the React UI.
- **`src/shared`** — types and the IPC contract shared by both sides.

## Getting started

```bash
npm install      # install dependencies
npm run dev      # launch the app in development (hot reload)
```

Other scripts:

```bash
npm run typecheck   # type-check main, preload and renderer
npm test            # run the vitest unit suite
npm run build       # production build into out/
npm run package     # build a distributable installer with electron-builder
```

Type-check, tests and build also run automatically on every pull request via
GitHub Actions (`.github/workflows/ci.yml`).

## Notes & safety

- Mods are downloaded directly from Modrinth's CDN. Always confirm a mod is
  compatible with your exact Minecraft version and loader before launching.
- Bearsome only writes `.jar` files into the mods folder you choose and never
  deletes anything you didn't ask it to.
- Bearsome is an unofficial client and is not affiliated with Mojang or
  Modrinth.

## Documentation

Full project documentation lives alongside the code:

| Doc | What's in it |
| --- | --- |
| [`PROJECT.md`](./PROJECT.md) | Product vision, scope, personas, principles |
| [`CLAUDE.md`](./CLAUDE.md) | Guide for AI agents: commands, conventions, gotchas |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Processes, data flow, module reference, build |
| [`docs/IPC_API.md`](./docs/IPC_API.md) | The full `window.bearsome` / IPC reference |
| [`docs/DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md) | Tokens, components, UI patterns |
| [`docs/SECURITY.md`](./docs/SECURITY.md) | Sandboxing, CSP, filesystem safety |
| [`docs/CONTRIBUTING.md`](./docs/CONTRIBUTING.md) | Workflow and code conventions |
| [`docs/ROADMAP.md`](./docs/ROADMAP.md) | What's planned next |

## Roadmap ideas

- Update checks for installed mods
- Modpack import/export
- Additional sources (e.g. CurseForge) and more games behind the same UI

See [`docs/ROADMAP.md`](./docs/ROADMAP.md) for the full roadmap.
