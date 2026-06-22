import { useEffect, useState } from 'react'
import type { Loader, ProjectDetail, ProjectVersion } from '@shared/types'
import { formatCount, unwrap } from '../lib'

interface Props {
  idOrSlug: string
  loader: Loader
  gameVersion: string
  onClose: () => void
  onInstall: (versionId: string, withDeps: boolean) => Promise<void>
  installingVersionId: string | null
  installedVersionIds: Set<string>
}

export function ModDetail({
  idOrSlug,
  loader,
  gameVersion,
  onClose,
  onInstall,
  installingVersionId,
  installedVersionIds
}: Props): JSX.Element {
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [versions, setVersions] = useState<ProjectVersion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [withDeps, setWithDeps] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      unwrap(window.bearsome.getProject(idOrSlug)),
      unwrap(
        window.bearsome.getVersions(idOrSlug, {
          loader,
          gameVersion: gameVersion || undefined
        })
      )
    ])
      .then(([proj, vers]) => {
        if (cancelled) return
        setProject(proj)
        setVersions(vers)
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [idOrSlug, loader, gameVersion])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        {loading && <div className="state">Loading…</div>}
        {error && <div className="state state-error">{error}</div>}

        {project && (
          <>
            <header className="detail-head">
              {project.icon_url ? (
                <img className="detail-icon" src={project.icon_url} alt="" />
              ) : (
                <div className="detail-icon card-icon--placeholder">{project.title.charAt(0)}</div>
              )}
              <div>
                <h2>{project.title}</h2>
                <p className="detail-sub">
                  ⬇ {formatCount(project.downloads)} · ❤ {formatCount(project.followers)}
                </p>
                <div className="detail-links">
                  <a href="#" onClick={(e) => { e.preventDefault(); window.bearsome.openExternal(`https://modrinth.com/mod/${project.slug}`) }}>
                    Modrinth page
                  </a>
                  {project.source_url && (
                    <a href="#" onClick={(e) => { e.preventDefault(); window.bearsome.openExternal(project.source_url!) }}>
                      Source
                    </a>
                  )}
                </div>
              </div>
            </header>

            <p className="detail-desc">{project.description}</p>

            <div className="detail-cats">
              {project.categories.map((c) => (
                <span key={c} className="chip">{c}</span>
              ))}
            </div>

            <h3 className="detail-section">
              Versions
              {(loader || gameVersion) && (
                <span className="detail-filter">
                  {' '}matching {loader}
                  {gameVersion ? ` · ${gameVersion}` : ''}
                </span>
              )}
            </h3>

            <label className="deps-toggle">
              <input
                type="checkbox"
                checked={withDeps}
                onChange={(e) => setWithDeps(e.target.checked)}
              />
              Also install required dependencies
            </label>

            {versions.length === 0 && !loading && (
              <div className="state">
                No versions found for these filters. Try changing the loader or Minecraft version.
              </div>
            )}

            <ul className="version-list">
              {versions.slice(0, 25).map((v) => {
                const isInstalled = installedVersionIds.has(v.id)
                return (
                  <li key={v.id} className="version-row">
                    <div className="version-info">
                      <span className={`badge badge-${v.version_type}`}>{v.version_type}</span>
                      <span className="version-name">{v.version_number}</span>
                      {isInstalled && <span className="installed-tag">✓ installed</span>}
                      <span className="version-meta">
                        {v.game_versions.slice(0, 3).join(', ')}
                        {v.game_versions.length > 3 ? '…' : ''} · {v.loaders.join(', ')}
                      </span>
                    </div>
                    <button
                      className={isInstalled ? 'btn btn-ghost' : 'btn btn-primary'}
                      disabled={installingVersionId !== null}
                      onClick={() => onInstall(v.id, withDeps)}
                    >
                      {installingVersionId === v.id
                        ? 'Installing…'
                        : isInstalled
                          ? 'Reinstall'
                          : 'Install'}
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
