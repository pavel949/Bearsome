# Roadmap

Bearsome's current release covers the core loop: search Modrinth → install a mod
(with dependencies) → manage your library. This is where it can go next. Items
are grouped by horizon, not committed dates.

## Now (shipped)

- ✅ Modrinth search with loader / Minecraft-version / sort filters
- ✅ One-click install (latest compatible) and per-version install
- ✅ Automatic required-dependency resolution
- ✅ Library: list installed mods, remove, open folder
- ✅ **Update checking** — compares each installed mod against the latest
  compatible Modrinth version and offers one-click "Update" / "Update all"
- ✅ Auto-detect mods folder; configurable per launcher instance
- ✅ Live download progress, success/error toasts, persisted settings

- ✅ **"Already installed" awareness in Browse** — search results and detail
  versions matching the library are flagged "✓ installed"
- ✅ **Modpack import/export** — save the library to a `.json` Bearsome pack and
  re-install it on another machine / instance
- ✅ **Test suite & CI** — vitest unit tests for the pure logic, run with
  typecheck + build on every PR via GitHub Actions

- ✅ **Conflict / duplicate detection** — the Library warns when two files
  belong to the same mod (a common crash cause) and flags them "duplicate"
- ✅ **Multi-select bulk remove** — select rows and remove them in one action

- ✅ **Modrinth `.mrpack` import** — install the standard Modrinth modpack
  format (managed downloads + `overrides/`) into the instance, with
  traversal-safe paths; mods, resource packs and shaders all land correctly

## Next (high value, self-contained)

- **Optional dependencies prompt.** Today only *required* deps are auto-resolved;
  offer optional ones as opt-in checkboxes.
- **`.mrpack` export.** Write the standard format (needs per-file sha512/size)
  alongside the existing Bearsome JSON pack and `.mrpack` import.

## Later (larger)

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

- ✅ **Automated tests** — vitest unit tests for `modrinth.ts` (facet building),
  `minecraft.ts` (path safety, listing) and the renderer formatters, run in CI.
- **More test coverage** — an e2e/smoke harness exercising the IPC surface and
  install flow end to end.
- **App icon & branding assets** under `resources/` for packaging.
- **Code signing / notarization** for distributable builds.
- **Auto-update** for the app itself (electron-updater).
- **i18n** for the UI strings.

## How to pick something up

Most "Next" items are isolated. Start from
[`CONTRIBUTING.md`](./CONTRIBUTING.md), and use the 4-file IPC recipe in
[`IPC_API.md`](./IPC_API.md) for anything that needs a new backend capability.
