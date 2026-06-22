# Roadmap

Bearsome's current release covers the core loop: search Modrinth → install a mod
(with dependencies) → manage your library. This is where it can go next. Items
are grouped by horizon, not committed dates.

## Now (shipped)

- ✅ Modrinth search with loader / Minecraft-version / sort filters
- ✅ One-click install (latest compatible) and per-version install
- ✅ Automatic required-dependency resolution
- ✅ Library: list installed mods, remove, open folder
- ✅ Auto-detect mods folder; configurable per launcher instance
- ✅ Live download progress, success/error toasts, persisted settings

## Next (high value, self-contained)

- **Update checking.** Compare installed `versionId`s against the latest
  compatible Modrinth version and offer one-click updates. (Metadata already
  stored in `installedMeta`.)
- **"Already installed" awareness in Browse.** Badge search results / detail
  versions that match something in the library.
- **Conflict & duplicate detection.** Warn when installing two versions of the
  same project or known-incompatible mods.
- **Bulk actions** in the Library (update all, remove selected).
- **Optional dependencies prompt.** Today only *required* deps are auto-resolved;
  offer optional ones as opt-in checkboxes.

## Later (larger)

- **Modpack import/export.** Read/write a manifest of installed mods so a setup
  can be shared or restored; Modrinth `.mrpack` support.
- **Profiles / multiple instances** managed inside the app (switch the active
  `modsDir` from a dropdown).
- **Additional content types.** Resource packs, shaders, datapacks (Modrinth
  already serves these — mostly a `project_type` and target-folder change).
- **Additional sources.** A CurseForge provider behind the same UI (add a
  sibling to `modrinth.ts`; see Extension points in
  [`ARCHITECTURE.md`](./ARCHITECTURE.md)).
- **More games.** `GameId` and `detectModsDir()` are the seams; the UI is
  already structured to be game-agnostic.

## Quality / platform

- **Automated tests.** Unit tests for `modrinth.ts` (facet building, parsing)
  and `minecraft.ts` (path safety, listing); a smoke/e2e harness for the IPC
  surface.
- **App icon & branding assets** under `resources/` for packaging.
- **Code signing / notarization** for distributable builds.
- **Auto-update** for the app itself (electron-updater).
- **i18n** for the UI strings.

## How to pick something up

Most "Next" items are isolated. Start from
[`CONTRIBUTING.md`](./CONTRIBUTING.md), and use the 4-file IPC recipe in
[`IPC_API.md`](./IPC_API.md) for anything that needs a new backend capability.
