import type { Loader } from '../types'
import { LOADERS } from '../types'

export interface WebSettings {
  defaultLoader: Loader
  defaultGameVersion: string
}

interface Props {
  settings: WebSettings
  gameVersions: string[]
  onChange: (patch: Partial<WebSettings>) => void
}

export function Settings({ settings, gameVersions, onChange }: Props): JSX.Element {
  return (
    <div className="settings">
      <h2>Settings</h2>

      <section className="setting-group">
        <label className="setting-label">How installing works on the web</label>
        <p className="setting-help">
          Clicking <strong>Download</strong> saves the mod's <code>.jar</code> to your browser's
          downloads folder. Move it into your Minecraft <code>mods</code> folder (or your launcher
          instance's folder) to install it. When dependencies are enabled, each required mod is
          downloaded too.
        </p>
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
