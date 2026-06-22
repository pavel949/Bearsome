import { describe, expect, it } from 'vitest'
import { parseMrpackIndex } from '../src/main/mrpack'

const valid = JSON.stringify({
  formatVersion: 1,
  game: 'minecraft',
  name: 'My Pack',
  versionId: '1.0.0',
  files: [
    { path: 'mods/sodium.jar', downloads: ['https://cdn.modrinth.com/a.jar'] },
    { path: 'shaderpacks/x.zip', downloads: ['https://cdn.modrinth.com/x.zip'] }
  ]
})

describe('parseMrpackIndex', () => {
  it('parses a valid Minecraft mrpack index', () => {
    const idx = parseMrpackIndex(valid)
    expect(idx.name).toBe('My Pack')
    expect(idx.versionId).toBe('1.0.0')
    expect(idx.files).toHaveLength(2)
    expect(idx.files[0]).toEqual({
      path: 'mods/sodium.jar',
      downloads: ['https://cdn.modrinth.com/a.jar']
    })
  })

  it('rejects non-minecraft packs', () => {
    const raw = JSON.stringify({ formatVersion: 1, game: 'other', files: [] })
    expect(() => parseMrpackIndex(raw)).toThrow('not a Minecraft')
  })

  it('rejects invalid JSON', () => {
    expect(() => parseMrpackIndex('{ not json')).toThrow('not valid JSON')
  })

  it('skips malformed file entries instead of failing', () => {
    const raw = JSON.stringify({
      formatVersion: 1,
      game: 'minecraft',
      files: [
        { path: 'mods/ok.jar', downloads: ['https://x/ok.jar'] },
        { path: 'mods/bad.jar' }, // no downloads
        { downloads: ['https://x/none'] } // no path
      ]
    })
    const idx = parseMrpackIndex(raw)
    expect(idx.files).toHaveLength(1)
    expect(idx.files[0].path).toBe('mods/ok.jar')
  })

  it('defaults the name when absent', () => {
    const raw = JSON.stringify({ formatVersion: 1, game: 'minecraft', files: [] })
    expect(parseMrpackIndex(raw).name).toBe('Modrinth modpack')
  })
})
