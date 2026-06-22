import { useCallback, useEffect, useState } from 'react'
import type { Loader, ModHit } from './types'
import { ModCard } from './components/ModCard'
import { ModDetail } from './components/ModDetail'
import { Settings, type WebSettings } from './components/Settings'
import * as api from './api'

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
  const afterInstall = useCallback(
    (titles: string[], deps: string[]) => {
      const depNote = deps.length ? ` (+ ${deps.length} dependenc${deps.length === 1 ? 'y' : 'ies'})` : ''
      flash('ok', `Downloaded ${titles.join(', ')}${depNote}`)
    },
    [flash]
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
        const result = await api.downloadVersion(versions[0].id, true, {
          loader: settings.defaultLoader,
          gameVersion: settings.defaultGameVersion || undefined
        })
        afterInstall([hit.title], result.dependencies)
      } catch (e) {
        flash('err', (e as Error).message)
      } finally {
        setQuickBusy(null)
      }
    },
    [settings.defaultLoader, settings.defaultGameVersion, flash, afterInstall]
  )

  const detailInstall = useCallback(
    async (versionId: string, withDeps: boolean) => {
      setInstallingVersionId(versionId)
      try {
        const result = await api.downloadVersion(versionId, withDeps, {
          loader: settings.defaultLoader,
          gameVersion: settings.defaultGameVersion || undefined
        })
        afterInstall([result.files[0] ?? 'mod'], result.dependencies)
      } catch (e) {
        flash('err', (e as Error).message)
      } finally {
        setInstallingVersionId(null)
      }
    },
    [settings.defaultLoader, settings.defaultGameVersion, afterInstall, flash]
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
        />
      )}

      {toast && <div className={`toast toast-${toast.kind}`}>{toast.text}</div>}
    </div>
  )
}
