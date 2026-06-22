import { describe, expect, it } from 'vitest'
import type { InstalledMod } from '../src/shared/types'
import {
  duplicateFilenames,
  formatBytes,
  formatCount,
  timeAgo,
  unwrap
} from '../src/renderer/src/lib'

function mod(filename: string, projectId?: string): InstalledMod {
  return { filename, path: `/mods/${filename}`, sizeBytes: 1, installedAt: 0, projectId }
}

describe('formatCount', () => {
  it('formats small numbers plainly', () => {
    expect(formatCount(0)).toBe('0')
    expect(formatCount(999)).toBe('999')
  })
  it('uses K for thousands', () => {
    expect(formatCount(1500)).toBe('1.5K')
  })
  it('uses M for millions', () => {
    expect(formatCount(2_300_000)).toBe('2.3M')
  })
})

describe('formatBytes', () => {
  it('handles bytes, KB and MB', () => {
    expect(formatBytes(500)).toBe('500 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})

describe('timeAgo', () => {
  it('returns "just now" for the present', () => {
    expect(timeAgo(Date.now())).toBe('just now')
  })
  it('formats minutes', () => {
    expect(timeAgo(Date.now() - 5 * 60 * 1000)).toBe('5 minutes ago')
  })
  it('formats a single day without pluralising', () => {
    expect(timeAgo(Date.now() - 25 * 60 * 60 * 1000)).toBe('1 day ago')
  })
})

describe('duplicateFilenames', () => {
  it('flags two files from the same project', () => {
    const dupes = duplicateFilenames([
      mod('sodium-1.jar', 'AANobbMI'),
      mod('sodium-2.jar', 'AANobbMI'),
      mod('lithium.jar', 'gvQqBUqZ')
    ])
    expect(dupes).toEqual(new Set(['sodium-1.jar', 'sodium-2.jar']))
  })

  it('returns empty when there are no conflicts', () => {
    const dupes = duplicateFilenames([
      mod('sodium.jar', 'AANobbMI'),
      mod('lithium.jar', 'gvQqBUqZ')
    ])
    expect(dupes.size).toBe(0)
  })

  it('never flags mods without a tracked projectId', () => {
    const dupes = duplicateFilenames([mod('mystery-a.jar'), mod('mystery-b.jar')])
    expect(dupes.size).toBe(0)
  })
})

describe('unwrap', () => {
  it('returns data on success', async () => {
    await expect(unwrap(Promise.resolve({ ok: true, data: 42 }))).resolves.toBe(42)
  })
  it('throws the error message on failure', async () => {
    await expect(
      unwrap(Promise.resolve({ ok: false, error: 'boom' }))
    ).rejects.toThrow('boom')
  })
})
