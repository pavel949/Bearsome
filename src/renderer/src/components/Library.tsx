import { useState } from 'react'
import type { InstalledMod, ModUpdate } from '@shared/types'
import { duplicateFilenames, formatBytes, timeAgo } from '../lib'

interface Props {
  mods: InstalledMod[]
  modsDir: string
  updates: Record<string, ModUpdate>
  checking: boolean
  updatingFile: string | null
  onUninstall: (filename: string) => void
  onRemoveSelected: (filenames: string[]) => void
  onOpenFolder: () => void
  onRefresh: () => void
  onCheckUpdates: () => void
  onUpdate: (filename: string) => void
  onUpdateAll: () => void
  onExportPack: () => void
  onImportPack: () => void
  onImportMrpack: () => void
  busyFilename: string | null
}

export function Library({
  mods,
  modsDir,
  updates,
  checking,
  updatingFile,
  onUninstall,
  onRemoveSelected,
  onOpenFolder,
  onRefresh,
  onCheckUpdates,
  onUpdate,
  onUpdateAll,
  onExportPack,
  onImportPack,
  onImportMrpack,
  busyFilename
}: Props): JSX.Element {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const updateCount = Object.keys(updates).length
  const dupes = duplicateFilenames(mods)

  const toggle = (filename: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(filename)) next.delete(filename)
      else next.add(filename)
      return next
    })
  }

  const removeSelected = (): void => {
    onRemoveSelected([...selected])
    setSelected(new Set())
  }

  return (
    <div className="library">
      <div className="library-bar">
        <div>
          <h2>Installed mods</h2>
          <p className="path-hint" title={modsDir}>{modsDir}</p>
        </div>
        <div className="library-actions">
          {selected.size > 0 && (
            <button className="btn btn-danger" onClick={removeSelected}>
              Remove selected ({selected.size})
            </button>
          )}
          {updateCount > 0 && (
            <button className="btn btn-primary" onClick={onUpdateAll} disabled={updatingFile !== null}>
              Update all ({updateCount})
            </button>
          )}
          <button className="btn btn-ghost" onClick={onCheckUpdates} disabled={checking || mods.length === 0}>
            {checking ? 'Checking…' : 'Check for updates'}
          </button>
          <button className="btn btn-ghost" onClick={onImportMrpack}>Import .mrpack</button>
          <button className="btn btn-ghost" onClick={onImportPack}>Import pack</button>
          <button className="btn btn-ghost" onClick={onExportPack} disabled={mods.length === 0}>
            Export pack
          </button>
          <button className="btn btn-ghost" onClick={onRefresh}>Refresh</button>
          <button className="btn btn-ghost" onClick={onOpenFolder}>Open folder</button>
        </div>
      </div>

      {dupes.size > 0 && (
        <div className="warning-banner">
          ⚠ You have multiple files for the same mod installed. Running more than one
          version of a mod can crash Minecraft — remove the extras (marked
          “duplicate”) below.
        </div>
      )}

      {mods.length === 0 ? (
        <div className="state">
          No mods installed yet. Head to <strong>Browse</strong> to find some!
        </div>
      ) : (
        <ul className="installed-list">
          {mods.map((m) => {
            const update = updates[m.filename]
            const isDupe = dupes.has(m.filename)
            return (
              <li key={m.filename} className={`installed-row${isDupe ? ' installed-row--dupe' : ''}`}>
                <input
                  type="checkbox"
                  className="row-check"
                  checked={selected.has(m.filename)}
                  onChange={() => toggle(m.filename)}
                  aria-label={`Select ${m.filename}`}
                />
                {m.iconUrl ? (
                  <img className="installed-icon" src={m.iconUrl} alt="" />
                ) : (
                  <div className="installed-icon card-icon--placeholder">
                    {(m.title ?? m.filename).charAt(0)}
                  </div>
                )}
                <div className="installed-info">
                  <span className="installed-title">
                    {m.title ?? m.filename}
                    {update && <span className="update-badge">update</span>}
                    {isDupe && <span className="dupe-badge">duplicate</span>}
                  </span>
                  <span className="installed-meta">
                    {m.filename} · {formatBytes(m.sizeBytes)} · {timeAgo(m.installedAt)}
                  </span>
                  {update && (
                    <span className="update-note">
                      {update.currentVersionNumber} → {update.latestVersionNumber}
                    </span>
                  )}
                </div>
                {update && (
                  <button
                    className="btn btn-primary"
                    disabled={updatingFile === m.filename}
                    onClick={() => onUpdate(m.filename)}
                  >
                    {updatingFile === m.filename ? 'Updating…' : 'Update'}
                  </button>
                )}
                <button
                  className="btn btn-danger"
                  disabled={busyFilename === m.filename}
                  onClick={() => onUninstall(m.filename)}
                >
                  {busyFilename === m.filename ? 'Removing…' : 'Remove'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
