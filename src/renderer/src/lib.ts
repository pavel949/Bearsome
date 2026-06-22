import type { IpcResult } from '@shared/types'

/**
 * Unwrap an IpcResult, throwing on failure so callers can use try/catch.
 */
export async function unwrap<T>(p: Promise<IpcResult<T>>): Promise<T> {
  const res = await p
  if (!res.ok) throw new Error(res.error)
  return res.data
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
