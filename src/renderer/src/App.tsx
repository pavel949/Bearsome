import { useCallback, useEffect, useState } from 'react'
import type {
  AppSettings,
  InstalledMod,
  Loader,
  ModHit,
  ModUpdate
} from '@shared/types'
import { ModCard } from './components/ModCard'
import { ModDetail } from './components/ModDetail'
import { Library } from './components/Library'
import { Settings } from './components/Settings'
import { unwrap } from './lib'

type View = 'browse' | 'library' | 'settings'

const SORTS: Array<{ value: 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated'; label: string }> = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'downloads', label: 'Most downloaded' },
  { value: 'follows', label: 'Most followed' },
  { value: 'newest', label: 'Newest' },
  { value: 'updated', label: 'Recently updated' }
]

export default function App(): JSX.Element {
  const [view, setView] = useState<View>('browse')
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [gameVersions, setGameVersions] = useState<string[]>([])

  // Search state
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<(typeof SORTS)[number]['value']>('relevance')
  const [hits, setHits] = useState<ModHit[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Library state
  const [installed, setInstalled] = useState<InstalledMod[]>([])
  const [updates, setUpdates] = useState<Record<string, ModUpdate>>({})
  const [checking, setChecking] = useState(false)
  const [updatingFile, setUpdatingFile] = useState<string | null>(null)

  // Detail / install state
  const [detailId, setDetailId] = useState<string | null>(null)
  const [installingVersionId, setInstallingVersionId] = useState<string | null>(null)
  const [quickBusy, setQuickBusy] = useState<string | null>(null)
  const [removingFile, setRemovingFile] = useState<string | null>(null)
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [progress, setProgress] = useState<{ filename: string; pct: number } | null>(null)

  const flash = useCallback((kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text })
    window.setTimeout(() => setToast(null), 4000)
  }, [])

  // --- Initial load -------------------------------------------------------
  useEffect(() => {
    unwrap(window.bearsome.getSettings()).then(setSettings).catch((e: Error) => flash('err', e.message))
    unwrap(window.bearsome.getGameVersions()).then(setGameVersions).catch(() => {})
  }, [flash])

  const refreshLibrary = useCallback(() => {
    unwrap(window.bearsome.listInstalled()).then(setInstalled).catch((e: Error) => flash('err', e.message))
  }, [flash])

  useEffect(() => {
    refreshLibrary()
  }, [refreshLibrary])

  // --- Download progress --------------------------------------------------
  useEffect(() => {
    return window.bearsome.onInstallProgress((p) => {
      const pct = p.totalBytes > 0 ? Math.round((p.receivedBytes / p.totalBytes) * 100) : 0
      setProgress({ filename: p.filename, pct })
      if (p.totalBytes > 0 && p.receivedBytes >= p.totalBytes) {
        window.setTimeout(() => setProgress(null), 600)
      }
    })
  }, [])

  // --- Search -------------------------------------------------------------
  const runSearch = useCallback(async () => {
    if (!settings) return
    setSearching(true)
    setSearchError(null)
    try {
      const result = await unwrap(
        window.bearsome.search({
          query,
          loader: settings.defaultLoader,
          gameVersion: settings.defaultGameVersion || undefined,
          index: sort,
          limit: 30
        })
      )
      setHits(result.hits)
    } catch (e) {
      setSearchError((e as Error).message)
    } finally {
      setSearching(false)
    }
  }, [query, settings, sort])

  // Run an initial/auto search when filters change or settings first load.
  useEffect(() => {
    if (settings) void runSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.defaultLoader, settings?.defaultGameVersion, sort])

  // --- Install flows ------------------------------------------------------
  const afterInstall = useCallback(
    (titles: string[], deps: string[]) => {
      refreshLibrary()
      const depNote = deps.length ? ` (+ ${deps.length} dependenc${deps.length === 1 ? 'y' : 'ies'})` : ''
      flash('ok', `Installed ${titles.join(', ')}${depNote}`)
    },
    [flash, refreshLibrary]
  )

  const quickInstall = useCallback(
    async (hit: ModHit) => {
      if (!settings) return
      setQuickBusy(hit.project_id)
      try {
        const versions = await unwrap(
          window.bearsome.getVersions(hit.project_id, {
            loader: settings.defaultLoader,
            gameVersion: settings.defaultGameVersion || undefined
          })
        )
        if (versions.length === 0) {
          flash('err', `${hit.title}: no version found for ${settings.defaultLoader}${settings.defaultGameVersion ? ` ${settings.defaultGameVersion}` : ''}`)
          return
        }
        const result = await unwrap(
          window.bearsome.install({ projectId: hit.project_id, versionId: versions[0].id, withDependencies: true })
        )
        afterInstall([hit.title], result.dependencies)
      } catch (e) {
        flash('err', (e as Error).message)
      } finally {
        setQuickBusy(null)
      }
    },
    [settings, flash, afterInstall]
  )

  const detailInstall = useCallback(
    async (versionId: string, withDeps: boolean) => {
      setInstallingVersionId(versionId)
      try {
        const result = await unwrap(
          window.bearsome.install({ projectId: detailId ?? '', versionId, withDependencies: withDeps })
        )
        const title = result.installed[0]?.title ?? 'mod'
        afterInstall([title], result.dependencies)
      } catch (e) {
        flash('err', (e as Error).message)
      } finally {
        setInstallingVersionId(null)
      }
    },
    [detailId, afterInstall, flash]
  )

  const uninstall = useCallback(
    async (filename: string) => {
      setRemovingFile(filename)
      try {
        const next = await unwrap(window.bearsome.uninstall(filename))
        setInstalled(next)
        setUpdates((u) => {
          const { [filename]: _removed, ...rest } = u
          return rest
        })
        flash('ok', `Removed ${filename}`)
      } catch (e) {
        flash('err', (e as Error).message)
      } finally {
        setRemovingFile(null)
      }
    },
    [flash]
  )

  // --- Update checking ----------------------------------------------------
  const checkUpdates = useCallback(async () => {
    setChecking(true)
    try {
      const found = await unwrap(window.bearsome.checkUpdates())
      const map: Record<string, ModUpdate> = {}
      for (const u of found) map[u.filename] = u
      setUpdates(map)
      flash('ok', found.length ? `${found.length} update${found.length === 1 ? '' : 's'} available` : 'Everything is up to date')
    } catch (e) {
      flash('err', (e as Error).message)
    } finally {
      setChecking(false)
    }
  }, [flash])

  const updateOne = useCallback(
    async (filename: string) => {
      setUpdatingFile(filename)
      try {
        await unwrap(window.bearsome.updateMod(filename))
        setUpdates((u) => {
          const { [filename]: _done, ...rest } = u
          return rest
        })
        refreshLibrary()
        flash('ok', `Updated ${filename}`)
      } catch (e) {
        flash('err', (e as Error).message)
      } finally {
        setUpdatingFile(null)
      }
    },
    [flash, refreshLibrary]
  )

  const updateAll = useCallback(async () => {
    const filenames = Object.keys(updates)
    for (const filename of filenames) {
      setUpdatingFile(filename)
      try {
        await unwrap(window.bearsome.updateMod(filename))
        setUpdates((u) => {
          const { [filename]: _done, ...rest } = u
          return rest
        })
      } catch (e) {
        flash('err', `${filename}: ${(e as Error).message}`)
      }
    }
    setUpdatingFile(null)
    refreshLibrary()
    flash('ok', 'Updates complete')
  }, [updates, flash, refreshLibrary])

  // --- Modpack export / import --------------------------------------------
  const exportPack = useCallback(async () => {
    try {
      const path = await unwrap(window.bearsome.exportPack())
      flash('ok', path ? `Exported pack to ${path}` : 'Export cancelled')
    } catch (e) {
      flash('err', (e as Error).message)
    }
  }, [flash])

  const importPack = useCallback(async () => {
    try {
      const result = await unwrap(window.bearsome.importPack())
      if (result.installed.length === 0 && result.failed.length === 0) return // cancelled
      refreshLibrary()
      const failNote = result.failed.length ? `, ${result.failed.length} failed` : ''
      flash('ok', `Imported ${result.installed.length} mod${result.installed.length === 1 ? '' : 's'}${failNote}`)
    } catch (e) {
      flash('err', (e as Error).message)
    }
  }, [flash, refreshLibrary])

  // --- Settings mutations -------------------------------------------------
  const patchSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      const next = await unwrap(window.bearsome.setSettings(patch))
      setSettings(next)
    },
    []
  )

  const pickFolder = useCallback(async () => {
    const dir = await unwrap(window.bearsome.pickModsDir())
    if (dir) {
      setSettings((s) => (s ? { ...s, modsDir: dir } : s))
      refreshLibrary()
    }
  }, [refreshLibrary])

  const detectFolder = useCallback(async () => {
    const dir = await unwrap(window.bearsome.detectModsDir())
    await patchSettings({ modsDir: dir })
    refreshLibrary()
  }, [patchSettings, refreshLibrary])

  // Sets used to flag content the user already has installed.
  const installedProjectIds = new Set(
    installed.map((m) => m.projectId).filter((id): id is string => Boolean(id))
  )
  const installedVersionIds = new Set(
    installed.map((m) => m.versionId).filter((id): id is string => Boolean(id))
  )

  if (!settings) {
    return <div className="boot">Starting Bearsome…</div>
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">🐻</span>
          <span className="brand-name">Bearsome</span>
        </div>
        <nav>
          <button className={`nav-item ${view === 'browse' ? 'active' : ''}`} onClick={() => setView('browse')}>
            🔍 Browse
          </button>
          <button className={`nav-item ${view === 'library' ? 'active' : ''}`} onClick={() => setView('library')}>
            📦 Library {installed.length > 0 && <span className="pill">{installed.length}</span>}
          </button>
          <button className={`nav-item ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>
            ⚙ Settings
          </button>
        </nav>
        <div className="sidebar-foot">
          <div className="loader-badge">{settings.defaultLoader}{settings.defaultGameVersion ? ` · ${settings.defaultGameVersion}` : ''}</div>
          <span>Powered by Modrinth</span>
        </div>
      </aside>

      <main className="content">
        {view === 'browse' && (
          <>
            <div className="searchbar">
              <input
                className="input search-input"
                placeholder="Search for mods (e.g. Sodium, JEI, Create)…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                autoFocus
              />
              <select className="input" value={settings.defaultLoader} onChange={(e) => patchSettings({ defaultLoader: e.target.value as Loader })}>
                {(['fabric', 'forge', 'quilt', 'neoforge'] as Loader[]).map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              <select className="input" value={settings.defaultGameVersion} onChange={(e) => patchSettings({ defaultGameVersion: e.target.value })}>
                <option value="">Any version</option>
                {gameVersions.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              <select className="input" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <button className="btn btn-primary" onClick={runSearch}>Search</button>
            </div>

            {searching && <div className="state">Searching…</div>}
            {searchError && <div className="state state-error">{searchError}</div>}
            {!searching && !searchError && hits.length === 0 && (
              <div className="state">No results. Try a different search or loosen the filters.</div>
            )}

            <div className="grid">
              {hits.map((hit) => (
                <ModCard
                  key={hit.project_id}
                  hit={hit}
                  onOpen={(h) => setDetailId(h.slug || h.project_id)}
                  onQuickInstall={quickInstall}
                  busy={quickBusy === hit.project_id}
                  installed={installedProjectIds.has(hit.project_id)}
                />
              ))}
            </div>
          </>
        )}

        {view === 'library' && (
          <Library
            mods={installed}
            modsDir={settings.modsDir}
            updates={updates}
            checking={checking}
            updatingFile={updatingFile}
            onUninstall={uninstall}
            onOpenFolder={() => window.bearsome.openModsDir()}
            onRefresh={refreshLibrary}
            onCheckUpdates={checkUpdates}
            onUpdate={updateOne}
            onUpdateAll={updateAll}
            onExportPack={exportPack}
            onImportPack={importPack}
            busyFilename={removingFile}
          />
        )}

        {view === 'settings' && (
          <Settings
            settings={settings}
            gameVersions={gameVersions}
            onChange={patchSettings}
            onPickFolder={pickFolder}
            onDetectFolder={detectFolder}
          />
        )}
      </main>

      {detailId && (
        <ModDetail
          idOrSlug={detailId}
          loader={settings.defaultLoader}
          gameVersion={settings.defaultGameVersion}
          onClose={() => setDetailId(null)}
          onInstall={detailInstall}
          installingVersionId={installingVersionId}
          installedVersionIds={installedVersionIds}
        />
      )}

      {progress && (
        <div className="progress-toast">
          <div className="progress-name">Downloading {progress.filename}</div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress.pct}%` }} />
          </div>
        </div>
      )}

      {toast && <div className={`toast toast-${toast.kind}`}>{toast.text}</div>}
    </div>
  )
}
