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
  fsaSupported: boolean
  folderName: string | null
  onPickFolder: () => void
  onForgetFolder: () => void
}

export function Settings({
  settings,
  gameVersions,
  onChange,
  fsaSupported,
  folderName,
  onPickFolder,
  onForgetFolder
}: Props): JSX.Element {
  return (
    <div className="settings">
      <h2>Settings</h2>

      <section className="setting-group">
        <label className="setting-label">Mods folder</label>
        {fsaSupported ? (
          <>
            <p className="setting-help">
              Choose your Minecraft <code>mods</code> folder (or a launcher instance's folder) once,
              and Bearsome will write mods — and their required dependencies — straight into it when
              you click <strong>Install</strong>. Your browser remembers the choice and asks for
              permission the first time.
            </p>
            <div className="folder-row">
              <input
                className="input folder-input"
                readOnly
                value={folderName ? `📁 ${folderName}` : 'No folder chosen — files download instead'}
              />
              <button className="btn btn-ghost" onClick={onPickFolder}>
                {folderName ? 'Change…' : 'Choose folder…'}
              </button>
              {folderName && (
                <button className="btn btn-ghost" onClick={onForgetFolder}>Forget</button>
              )}
            </div>
          </>
        ) : (
          <p className="setting-help">
            Your browser doesn't support writing directly to a folder, so clicking
            <strong> Download</strong> saves the mod's <code>.jar</code> to your downloads folder —
            move it into your Minecraft <code>mods</code> folder to install it. For one-click
            install into the right folder, use <strong>Chrome or Edge</strong> (or the Bearsome
            desktop app).
          </p>
        )}
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
