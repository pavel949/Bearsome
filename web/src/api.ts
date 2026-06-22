// Browser-side replacement for the desktop app's Electron backend.
//
// In the desktop app, all Modrinth calls and file writes happen in the main
// process (see src/main/*). On the web there is no Node process and a browser
// cannot write to the user's mods folder, so:
//   - Modrinth calls go directly to the public API (it sends CORS headers).
//   - "Install" becomes a plain browser download of the .jar file(s).

import type {
  ProjectDetail,
  ProjectVersion,
  SearchParams,
  SearchResult
} from './types'
import { writeFile } from './fsaccess'

const BASE = 'https://api.modrinth.com/v2'

// NOTE: unlike the desktop client we can't set a custom User-Agent — browsers
// forbid overriding that header. Modrinth's public API allows anonymous CORS
// requests without one.
async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json' }
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Modrinth API ${res.status} ${res.statusText}: ${text.slice(0, 200)}`)
  }
  return (await res.json()) as T
}

/** Build the `facets` query Modrinth expects (a JSON array of OR-groups). */
function buildFacets(params: SearchParams): string {
  const groups: string[][] = [['project_type:mod']]
  if (params.gameVersion) groups.push([`versions:${params.gameVersion}`])
  if (params.loader) groups.push([`categories:${params.loader}`])
  return JSON.stringify(groups)
}

export async function search(params: SearchParams): Promise<SearchResult> {
  const qs = new URLSearchParams()
  qs.set('query', params.query ?? '')
  qs.set('facets', buildFacets(params))
  qs.set('index', params.index ?? 'relevance')
  qs.set('limit', String(params.limit ?? 20))
  qs.set('offset', String(params.offset ?? 0))
  return api<SearchResult>(`/search?${qs.toString()}`)
}

export async function getProject(idOrSlug: string): Promise<ProjectDetail> {
  return api<ProjectDetail>(`/project/${encodeURIComponent(idOrSlug)}`)
}

export async function getVersions(
  idOrSlug: string,
  filters?: { loader?: string; gameVersion?: string }
): Promise<ProjectVersion[]> {
  const qs = new URLSearchParams()
  if (filters?.loader) qs.set('loaders', JSON.stringify([filters.loader]))
  if (filters?.gameVersion) qs.set('game_versions', JSON.stringify([filters.gameVersion]))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return api<ProjectVersion[]>(`/project/${encodeURIComponent(idOrSlug)}/version${suffix}`)
}

interface TagGameVersion {
  version: string
  version_type: 'release' | 'snapshot' | 'alpha' | 'beta'
}

/** Returns release Minecraft versions, newest first. */
export async function getGameVersions(): Promise<string[]> {
  const all = await api<TagGameVersion[]>(`/tag/game_version`)
  return all.filter((v) => v.version_type === 'release').map((v) => v.version)
}

/** Fetch a single version by its id (used to resolve dependencies). */
export async function getVersion(versionId: string): Promise<ProjectVersion> {
  return api<ProjectVersion>(`/version/${encodeURIComponent(versionId)}`)
}

// ---------------------------------------------------------------------------
// Downloading
// ---------------------------------------------------------------------------

function primaryFile(version: ProjectVersion): { url: string; filename: string } {
  const file = version.files.find((f) => f.primary) ?? version.files[0]
  if (!file) throw new Error(`Version "${version.name}" has no downloadable files`)
  return { url: file.url, filename: file.filename }
}

/** Trigger a plain browser download of a single .jar (lands in Downloads). */
function browserDownload(url: string, filename: string): void {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/**
 * Save one file. If `dir` is given, fetch the .jar and write it straight into
 * that folder; otherwise fall back to a normal browser download. Returns true
 * if it was written into the folder.
 */
async function saveFile(
  url: string,
  filename: string,
  dir: FileSystemDirectoryHandle | null | undefined
): Promise<boolean> {
  if (dir) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Download failed: ${res.status}`)
      await writeFile(dir, filename, await res.blob())
      return true
    } catch {
      // CORS, permission, or network problem — fall back to a download so the
      // user still gets the file.
      browserDownload(url, filename)
      return false
    }
  }
  browserDownload(url, filename)
  return false
}

/**
 * Mirror of the desktop dependency resolver: walk required dependencies and
 * collect a compatible version for each, breadth-first.
 */
async function resolveDependencyVersions(
  root: ProjectVersion,
  filters: { loader?: string; gameVersion?: string }
): Promise<ProjectVersion[]> {
  const resolved: ProjectVersion[] = []
  const seenProjects = new Set<string>([root.project_id])
  const queue = [...root.dependencies]

  while (queue.length) {
    const dep = queue.shift()!
    if (dep.dependency_type !== 'required') continue
    try {
      let depVersion: ProjectVersion | null = null
      if (dep.version_id) {
        depVersion = await getVersion(dep.version_id)
      } else if (dep.project_id && !seenProjects.has(dep.project_id)) {
        const candidates = await getVersions(dep.project_id, filters)
        depVersion = candidates[0] ?? null
      }
      if (!depVersion) continue
      if (seenProjects.has(depVersion.project_id)) continue
      seenProjects.add(depVersion.project_id)
      resolved.push(depVersion)
      queue.push(...depVersion.dependencies)
    } catch {
      // A missing dependency shouldn't abort the whole download.
    }
  }
  return resolved
}

export interface DownloadResult {
  /** Filenames that were saved (the mod plus any dependencies). */
  files: string[]
  /** Names of dependencies that were pulled in automatically. */
  dependencies: string[]
  /** True if files were written straight into the chosen folder. */
  wroteToFolder: boolean
}

/**
 * Save a version (and optionally its required dependencies). If `dir` is
 * provided, files are written directly into that folder; otherwise they are
 * downloaded to the browser's downloads folder.
 */
export async function downloadVersion(
  versionId: string,
  withDependencies: boolean,
  defaults: { loader?: string; gameVersion?: string },
  dir?: FileSystemDirectoryHandle | null
): Promise<DownloadResult> {
  const version = await getVersion(versionId)
  const root = primaryFile(version)
  let wroteToFolder = await saveFile(root.url, root.filename, dir)

  const files = [root.filename]
  const dependencies: string[] = []

  if (withDependencies) {
    const filters = {
      loader: version.loaders[0] ?? defaults.loader,
      gameVersion: version.game_versions[0] ?? defaults.gameVersion
    }
    const deps = await resolveDependencyVersions(version, filters)
    for (const dep of deps) {
      const f = primaryFile(dep)
      const wrote = await saveFile(f.url, f.filename, dir)
      wroteToFolder = wroteToFolder && wrote
      files.push(f.filename)
      dependencies.push(f.filename)
    }
  }

  return { files, dependencies, wroteToFolder }
}
