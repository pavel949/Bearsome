import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { detectModsDir, listJarFiles, removeMod } from '../src/main/minecraft'

describe('detectModsDir', () => {
  it('returns a path ending in mods', () => {
    expect(detectModsDir().endsWith('mods')).toBe(true)
  })
})

describe('listJarFiles', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'bearsome-test-'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('returns [] for a directory that does not exist', async () => {
    const result = await listJarFiles(join(dir, 'nope'))
    expect(result).toEqual([])
  })

  it('lists only .jar files', async () => {
    await writeFile(join(dir, 'sodium.jar'), 'a')
    await writeFile(join(dir, 'notes.txt'), 'b')
    await writeFile(join(dir, 'LITHIUM.JAR'), 'cc') // case-insensitive

    const result = await listJarFiles(dir)
    const names = result.map((r) => r.filename).sort()
    expect(names).toEqual(['LITHIUM.JAR', 'sodium.jar'])
  })

  it('reports byte sizes', async () => {
    await writeFile(join(dir, 'mod.jar'), 'hello') // 5 bytes
    const [entry] = await listJarFiles(dir)
    expect(entry.sizeBytes).toBe(5)
  })
})

describe('removeMod', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'bearsome-test-'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('deletes a file inside the mods dir', async () => {
    const file = join(dir, 'mod.jar')
    await writeFile(file, 'x')
    await removeMod(dir, 'mod.jar')
    expect(existsSync(file)).toBe(false)
  })

  it.each(['../evil.jar', 'sub/dir.jar', '..\\evil.jar'])(
    'rejects path traversal: %s',
    async (bad) => {
      await expect(removeMod(dir, bad)).rejects.toThrow('Invalid mod filename')
    }
  )
})
