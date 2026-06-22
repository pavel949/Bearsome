import type { InstalledMod } from '@shared/types'
import { formatBytes, timeAgo } from '../lib'

interface Props {
  mods: InstalledMod[]
  modsDir: string
  onUninstall: (filename: string) => void
  onOpenFolder: () => void
  onRefresh: () => void
  busyFilename: string | null
}

export function Library({
  mods,
  modsDir,
  onUninstall,
  onOpenFolder,
  onRefresh,
  busyFilename
}: Props): JSX.Element {
  return (
    <div className="library">
      <div className="library-bar">
        <div>
          <h2>Installed mods</h2>
          <p className="path-hint" title={modsDir}>{modsDir}</p>
        </div>
        <div className="library-actions">
          <button className="btn btn-ghost" onClick={onRefresh}>Refresh</button>
          <button className="btn btn-ghost" onClick={onOpenFolder}>Open folder</button>
        </div>
      </div>

      {mods.length === 0 ? (
        <div className="state">
          No mods installed yet. Head to <strong>Browse</strong> to find some!
        </div>
      ) : (
        <ul className="installed-list">
          {mods.map((m) => (
            <li key={m.filename} className="installed-row">
              {m.iconUrl ? (
                <img className="installed-icon" src={m.iconUrl} alt="" />
              ) : (
                <div className="installed-icon card-icon--placeholder">
                  {(m.title ?? m.filename).charAt(0)}
                </div>
              )}
              <div className="installed-info">
                <span className="installed-title">{m.title ?? m.filename}</span>
                <span className="installed-meta">
                  {m.filename} · {formatBytes(m.sizeBytes)} · {timeAgo(m.installedAt)}
                </span>
              </div>
              <button
                className="btn btn-danger"
                disabled={busyFilename === m.filename}
                onClick={() => onUninstall(m.filename)}
              >
                {busyFilename === m.filename ? 'Removing…' : 'Remove'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
