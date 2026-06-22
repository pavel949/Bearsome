import type { InstalledMod, IpcResult } from '@shared/types'

/**
 * Unwrap an IpcResult, throwing on failure so callers can use try/catch.
 */
export async function unwrap<T>(p: Promise<IpcResult<T>>): Promise<T> {
  const res = await p
  if (!res.ok) throw new Error(res.error)
  return res.data
}

/**
 * Find installed files that conflict: two or more jars belonging to the same
 * Modrinth project. Loading multiple versions of one mod usually crashes
 * Minecraft, so we surface these so the user can remove the extras. Mods
 * without a tracked projectId can't be grouped, so they're never flagged.
 */
export function duplicateFilenames(mods: InstalledMod[]): Set<string> {
  const byProject = new Map<string, string[]>()
  for (const m of mods) {
    if (!m.projectId) continue
    const list = byProject.get(m.projectId) ?? []
    list.push(m.filename)
    byProject.set(m.projectId, list)
  }
  const dupes = new Set<string>()
  for (const files of byProject.values()) {
    if (files.length > 1) files.forEach((f) => dupes.add(f))
  }
  return dupes
}

const numberFmt = new Intl.NumberFormat()

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return numberFmt.format(n)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function timeAgo(ms: number): string {
  const seconds = Math.floor((Date.now() - ms) / 1000)
  const units: Array<[number, string]> = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [30, 'day'],
    [12, 'month'],
    [Number.POSITIVE_INFINITY, 'year']
  ]
  let value = seconds
  let unit = 'second'
  for (const [size, name] of units) {
    if (value < size) {
      unit = name
      break
    }
    value = Math.floor(value / size)
    unit = name
  }
  if (value <= 0) return 'just now'
  return `${value} ${unit}${value === 1 ? '' : 's'} ago`
}
