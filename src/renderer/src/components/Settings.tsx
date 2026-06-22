import type { AppSettings, Loader } from '@shared/types'
import { LOADERS } from '@shared/types'

interface Props {
  settings: AppSettings
  gameVersions: string[]
  onChange: (patch: Partial<AppSettings>) => void
  onPickFolder: () => void
  onDetectFolder: () => void
}

export function Settings({
  settings,
  gameVersions,
  onChange,
  onPickFolder,
  onDetectFolder
}: Props): JSX.Element {
  return (
    <div className="settings">
      <h2>Settings</h2>

      <section className="setting-group">
        <label className="setting-label">Mods folder</label>
        <p className="setting-help">
          Where Bearsome installs mods. This should be the <code>mods</code> folder of your
          Minecraft installation or launcher instance (Prism, MultiMC, CurseForge, …).
        </p>
        <div className="folder-row">
          <input className="input folder-input" readOnly value={settings.modsDir} />
          <button className="btn btn-ghost" onClick={onPickFolder}>Browse…</button>
          <button className="btn btn-ghost" onClick={onDetectFolder}>Auto-detect</button>
        </div>
      </section>

      <section className="setting-group">
        <label className="setting-label">Default mod loader</label>
        <p className="setting-help">Used to filter search results and pick compatible versions.</p>
        <select
          className="input"
          value={settings.defaultLoader}
          onChange={(e) => onChange({ defaultLoader: e.target.value as Loader })}
        >
          {LOADERS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </section>

      <section className="setting-group">
        <label className="setting-label">Default Minecraft version</label>
        <p className="setting-help">Leave as “Any” to see mods for all versions.</p>
        <select
          className="input"
          value={settings.defaultGameVersion}
          onChange={(e) => onChange({ defaultGameVersion: e.target.value })}
        >
          <option value="">Any</option>
          {gameVersions.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </section>

      <section className="setting-group about">
        <p>
          Bearsome downloads mods from <strong>Modrinth</strong>. Always make sure a mod is
          compatible with your Minecraft version and loader before launching the game.
        </p>
      </section>
    </div>
  )
}
