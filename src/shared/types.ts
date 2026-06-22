// Types shared between the Electron main process, preload bridge and the
// React renderer. Keeping them in one place means the IPC contract stays
// honest on both sides.

/** A supported game. The app is built so more games can be added later. */
export type GameId = 'minecraft'

/** Minecraft mod loaders supported by Modrinth. */
export type Loader = 'fabric' | 'forge' | 'quilt' | 'neoforge'

export const LOADERS: Loader[] = ['fabric', 'forge', 'quilt', 'neoforge']

/** A single search result hit from Modrinth's `/search` endpoint. */
export interface ModHit {
  project_id: string
  slug: string
  title: string
  description: string
  author: string
  downloads: number
  follows: number
  icon_url: string | null
  categories: string[]
  versions: string[]
  client_side: string
  server_side: string
  project_type: string
}

export interface SearchResult {
  hits: ModHit[]
  total: number
  offset: number
  limit: number
}

export interface SearchParams {
  query: string
  /** Filter to a single Minecraft version, e.g. "1.20.1". */
  gameVersion?: string
  /** Filter to a single loader. */
  loader?: Loader
  limit?: number
  offset?: number
  /** Sort index used by Modrinth: relevance | downloads | follows | newest | updated */
  index?: 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated'
}

/** A downloadable file attached to a project version. */
export interface VersionFile {
  url: string
  filename: string
  size: number
  primary: boolean
  hashes: { sha1?: string; sha512?: string }
}

/** A published version of a project. */
export interface ProjectVersion {
  id: string
  project_id: string
  name: string
  version_number: string
  version_type: 'release' | 'beta' | 'alpha'
  game_versions: string[]
  loaders: string[]
  date_published: string
  downloads: number
  files: VersionFile[]
  /** Other projects this version requires/embeds. */
  dependencies: Array<{
    project_id: string | null
    version_id: string | null
    dependency_type: 'required' | 'optional' | 'incompatible' | 'embedded'
  }>
}

/** Full project detail from `/project/{id}`. */
export interface ProjectDetail {
  id: string
  slug: string
  title: string
  description: string
  body: string
  icon_url: string | null
  downloads: number
  followers: number
  categories: string[]
  game_versions: string[]
  loaders: string[]
  source_url: string | null
  wiki_url: string | null
  issues_url: string | null
}

/** A mod the user has installed into a mods folder, as seen on disk. */
export interface InstalledMod {
  filename: string
  path: string
  sizeBytes: number
  installedAt: number
  /** Best-effort metadata captured at install time. */
  projectId?: string
  versionId?: string
  title?: string
  iconUrl?: string | null
}

/** Persisted user preferences. */
export interface AppSettings {
  /** Where mods are installed. Auto-detected on first run, user-overridable. */
  modsDir: string
  /** Default Minecraft version filter for searches. */
  defaultGameVersion: string
  /** Default loader filter for searches. */
  defaultLoader: Loader
}

export interface InstallRequest {
  projectId: string
  versionId: string
  /** Whether to also install required dependencies. */
  withDependencies: boolean
}

export interface InstallProgress {
  filename: string
  receivedBytes: number
  totalBytes: number
}

export interface InstallResult {
  installed: InstalledMod[]
  /** Names of dependencies that were pulled in automatically. */
  dependencies: string[]
}

/** Generic envelope so the renderer can render errors instead of crashing. */
export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string }
