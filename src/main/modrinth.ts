// Thin client for the Modrinth API (https://docs.modrinth.com/).
// All network calls live in the main process so we avoid browser CORS and
// can stream downloads straight to disk.

import type {
  ProjectDetail,
  ProjectVersion,
  SearchParams,
  SearchResult
} from '../shared/types'

const BASE = 'https://api.modrinth.com/v2'

// Modrinth asks for a descriptive User-Agent identifying the app.
const USER_AGENT = 'bearsome/0.1.0 (Minecraft mod installer)'

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }
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
