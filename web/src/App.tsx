import { useCallback, useEffect, useState } from 'react'
import type { Loader, ModHit } from './types'
import { ModCard } from './components/ModCard'
import { ModDetail } from './components/ModDetail'
import { Settings, type WebSettings } from './components/Settings'
import * as api from './api'
import * as fsa from './fsaccess'

type View = 'browse' | 'settings'

const SORTS: Array<{ value: 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated'; label: string }> = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'downloads', label: 'Most downloaded' },
  { value: 'follows', label: 'Most followed' },
  { value: 'newest', label: 'Newest' },
  { value: 'updated', label: 'Recently updated' }
]

const SETTINGS_KEY = 'bearsome.settings'

function loadSettings(): WebSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { defaultLoader: 'fabric', defaultGameVersion: '', ...JSON.parse(raw) }
  } catch {
    /* ignore malformed storage */
  }
  return { defaultLoader: 'fabric', defaultGameVersion: '' }
}

export default function App(): JSX.Element {
  const [view, setView] = useState<View>('browse')
  const [settings, setSettings] = useState<WebSettings>(loadSettings)
  const [gameVersions, setGameVersions] = useState<string[]>([])

  // Mods-folder (File System Access API) state
  const fsaSupported = fsa.isSupported()
  const [modsDir, setModsDir] = useState<FileSystemDirectoryHandle | null>(null)

  // Search state
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<(typeof SORTS)[number]['value']>('relevance')
  const [hits, setHits] = useState<ModHit[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Detail / download state
  const [detailId, setDetailId] = useState<string | null>(null)
  const [installingVersionId, setInstallingVersionId] = useState<string | null>(null)
  const [quickBusy, setQuickBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const flash = useCallback((kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text })
    window.setTimeout(() => setToast(null), 4000)
  }, [])

  const patchSettings = useCallback((patch: Partial<WebSettings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch }
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
      } catch {
        /* storage may be unavailable; not fatal */
      }
      return next
    })
  }, [])

  // --- Initial load -------------------------------------------------------
  useEffect(() => {
    api.getGameVersions().then(setGameVersions).catch(() => {})
    fsa.restoreSavedDir().then((h) => h && setModsDir(h))
  }, [])

  // --- Mods folder --------------------------------------------------------
  const pickFolder = useCallback(async () => {
    const handle = await fsa.pickDir()
    if (handle) {
      setModsDir(handle)
      flash('ok', `Mods folder set to “${handle.name}”`)
    }
  }, [flash])

  const forgetFolder = useCallback(async () => {
    await fsa.forgetDir()
    setModsDir(null)
  }, [])

  // --- Search -------------------------------------------------------------
  const runSearch = useCallback(async () => {
    setSearching(true)
    setSearchError(null)
    try {
      const result = await api.search({
        query,
        loader: settings.defaultLoader,
        gameVersion: settings.defaultGameVersion || undefined,
        index: sort,
        limit: 30
      })
      setHits(result.hits)
    } catch (e) {
      setSearchError((e as Error).message)
    } finally {
      setSearching(false)
    }
  }, [query, settings.defaultLoader, settings.defaultGameVersion, sort])

  // Run an initial/auto search when filters change or on first load.
  useEffect(() => {
    void runSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.defaultLoader, settings.defaultGameVersion, sort])

  // --- Download flows -----------------------------------------------------
  const reportResult = useCallback(
    (titles: string[], result: api.DownloadResult) => {
      const depNote = result.dependencies.length
        ? ` (+ ${result.dependencies.length} dependenc${result.dependencies.length === 1 ? 'y' : 'ies'})`
        : ''
      if (result.wroteToFolder) {
        flash('ok', `Installed ${titles.join(', ')}${depNote} into “${modsDir?.name}”`)
      } else {
        flash('ok', `Downloaded ${titles.join(', ')}${depNote}`)
      }
    },
    [flash, modsDir]
  )

  const quickInstall = useCallback(
    async (hit: ModHit) => {
      setQuickBusy(hit.project_id)
      try {
        const versions = await api.getVersions(hit.project_id, {
          loader: settings.defaultLoader,
          gameVersion: settings.defaultGameVersion || undefined
        })
        if (versions.length === 0) {
          flash('err', `${hit.title}: no version found for ${settings.defaultLoader}${settings.defaultGameVersion ? ` ${settings.defaultGameVersion}` : ''}`)
          return
        }
        const result = await api.downloadVersion(
          versions[0].id,
          true,
          { loader: settings.defaultLoader, gameVersion: settings.defaultGameVersion || undefined },
          modsDir
        )
        reportResult([hit.title], result)
      } catch (e) {
        flash('err', (e as Error).message)
      } finally {
        setQuickBusy(null)
      }
    },
    [settings.defaultLoader, settings.defaultGameVersion, modsDir, flash, reportResult]
  )

  const detailInstall = useCallback(
    async (versionId: string, withDeps: boolean) => {
      setInstallingVersionId(versionId)
      try {
        const result = await api.downloadVersion(
          versionId,
          withDeps,
          { loader: settings.defaultLoader, gameVersion: settings.defaultGameVersion || undefined },
          modsDir
        )
        reportResult([result.files[0] ?? 'mod'], result)
      } catch (e) {
        flash('err', (e as Error).message)
      } finally {
        setInstallingVersionId(null)
      }
    },
    [settings.defaultLoader, settings.defaultGameVersion, modsDir, reportResult, flash]
  )

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
          <button className={`nav-item ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>
            ⚙ Settings
          </button>
        </nav>
        <div className="sidebar-foot">
          <div className="loader-badge">{settings.defaultLoader}{settings.defaultGameVersion ? ` · ${settings.defaultGameVersion}` : ''}</div>
          {modsDir ? <span>📁 {modsDir.name}</span> : <span>Powered by Modrinth</span>}
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

            {fsaSupported && !modsDir && (
              <div className="folder-banner">
                <span>
                  Tip: choose your Minecraft <code>mods</code> folder once and Bearsome will install
                  mods straight into it.
                </span>
                <button className="btn btn-ghost" onClick={pickFolder}>Choose mods folder</button>
              </div>
            )}

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
                  writesToFolder={!!modsDir}
                />
              ))}
            </div>
          </>
        )}

        {view === 'settings' && (
          <Settings
            settings={settings}
            gameVersions={gameVersions}
            onChange={patchSettings}
            fsaSupported={fsaSupported}
            folderName={modsDir?.name ?? null}
            onPickFolder={pickFolder}
            onForgetFolder={forgetFolder}
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
          writesToFolder={!!modsDir}
        />
      )}

      {toast && <div className={`toast toast-${toast.kind}`}>{toast.text}</div>}
    </div>
  )
}
