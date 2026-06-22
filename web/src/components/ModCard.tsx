import type { ModHit } from '../types'
import { formatCount } from '../lib'

interface Props {
  hit: ModHit
  onOpen: (hit: ModHit) => void
  onQuickInstall: (hit: ModHit) => void
  busy: boolean
  writesToFolder: boolean
}

export function ModCard({ hit, onOpen, onQuickInstall, busy, writesToFolder }: Props): JSX.Element {
  return (
    <div className="card" onClick={() => onOpen(hit)}>
      <div className="card-top">
        {hit.icon_url ? (
          <img className="card-icon" src={hit.icon_url} alt="" loading="lazy" />
        ) : (
          <div className="card-icon card-icon--placeholder">{hit.title.charAt(0)}</div>
        )}
        <div className="card-head">
          <h3 className="card-title">{hit.title}</h3>
          <span className="card-author">by {hit.author}</span>
        </div>
      </div>

      <p className="card-desc">{hit.description}</p>

      <div className="card-meta">
        <span title="Downloads">⬇ {formatCount(hit.downloads)}</span>
        <span title="Followers">❤ {formatCount(hit.follows)}</span>
      </div>

      <div className="card-actions">
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation()
            onQuickInstall(hit)
          }}
        >
          {busy ? (writesToFolder ? 'Installing…' : 'Preparing…') : writesToFolder ? 'Install' : 'Download'}
        </button>
        <button
          className="btn btn-ghost"
          onClick={(e) => {
            e.stopPropagation()
            onOpen(hit)
          }}
        >
          Details
        </button>
      </div>
    </div>
  )
}
