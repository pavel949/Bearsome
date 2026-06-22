# Bearsome — Project Overview

> A friendly desktop app for gamers to find and install Minecraft mods in a
> couple of clicks.

## Vision

Installing mods today means juggling browser tabs, checking loader/version
compatibility by hand, downloading raw `.jar` files, hunting down dependencies,
and dragging everything into the right folder. **Bearsome collapses that into:
search → click Install → play.**

The first target is **Minecraft mods via Modrinth**, but the product and the
code are deliberately structured so the same experience can grow to more games
and more content sources (resource packs, shaders, modpacks; CurseForge; other
games) behind one consistent UI.

## Who it's for

| Persona | Need | How Bearsome helps |
| --- | --- | --- |
| **Casual modder** | "I just want Sodium and JEI in my game." | Search, one-click install, auto-detected mods folder. |
| **Tinkerer** | Specific loader + MC version, picks exact builds. | Loader/version filters, per-version install, dependency toggle. |
| **Multi-instance player** | Uses Prism/MultiMC/CurseForge instances. | Configurable mods directory per the active instance. |

## Scope

### In scope (current)
- Search Modrinth for **mods** with filters: loader (Fabric / Forge / Quilt /
  NeoForge), Minecraft version, sort order (relevance, downloads, follows,
  newest, updated).
- Project detail view with description, categories, links, and a version list.
- **One-click install** (latest compatible version for the active filters) and
  **per-version install** from the detail view.
- **Automatic required-dependency resolution** (with a toggle).
- **Library**: list installed mods (title, icon, size, install time) and remove
  them.
- Auto-detect the vanilla `.minecraft/mods` folder per OS; override to any
  launcher instance folder.
- Live download progress; success/error toasts; persisted settings.

### Explicitly out of scope (for now)
- Accounts / Modrinth auth (all endpoints used are public).
- Launching Minecraft or managing Java/loaders.
- Modpack import/export, update checking — see [ROADMAP](./docs/ROADMAP.md).
- Mobile.

## Product principles

1. **One screen to value.** A user should get a working mod installed without
   reading instructions.
2. **Never surprise the filesystem.** Bearsome only writes `.jar` files into the
   folder the user chose and never deletes anything unprompted.
3. **Honest about compatibility.** Filters and version badges make
   loader/version fit obvious; the app never hides an incompatible install.
4. **Fast and quiet.** Network work is streamed; the UI stays responsive and
   reports progress and errors plainly.
5. **Extensible by construction.** Game/source specifics live behind a small
   main-process layer so the UI stays generic.

## Success signals

- Time from launch to first installed mod < 60 seconds.
- Installs that pull required dependencies "just work" without manual hunting.
- Works against any launcher instance, not just vanilla.

## Tech at a glance

- **Electron** (desktop shell, Node filesystem + networking)
- **React + TypeScript** (renderer UI)
- **Vite / electron-vite** (build & dev)
- **electron-store** (persisted settings + install metadata)
- **Modrinth API v2** (content source)

Full technical detail in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Repository map

```
.
├── CLAUDE.md                 # guide for AI agents working in the repo
├── PROJECT.md                # this file
├── README.md                 # quick start
├── docs/                     # the documentation stack
│   ├── ARCHITECTURE.md
│   ├── IPC_API.md
│   ├── DESIGN_SYSTEM.md
│   ├── SECURITY.md
│   ├── CONTRIBUTING.md
│   └── ROADMAP.md
├── src/
│   ├── main/                 # Electron main process
│   ├── preload/              # contextBridge
│   ├── renderer/             # React UI
│   └── shared/               # shared types + IPC contract
├── electron.vite.config.ts
└── tsconfig*.json
```
