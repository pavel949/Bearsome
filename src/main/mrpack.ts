// Parsing for the Modrinth modpack format (.mrpack). An .mrpack is a ZIP that
// contains a `modrinth.index.json` describing managed downloads, plus optional
// `overrides/` files. This module only handles the pure parsing/validation of
// the index — the ZIP reading and downloading live in the main process.

/** A managed file entry in a `.mrpack` index. */
export interface MrpackFile {
  /** Path relative to the Minecraft instance root, e.g. "mods/sodium.jar". */
  path: string
  /** Mirror URLs to download from; the first is preferred. */
  downloads: string[]
}

export interface MrpackIndex {
  name: string
  versionId: string | null
  files: MrpackFile[]
}

/**
 * Parse and validate a `modrinth.index.json` document. Throws a friendly error
 * if it isn't a recognisable Minecraft mrpack index.
 */
export function parseMrpackIndex(raw: string): MrpackIndex {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('The pack index is not valid JSON.')
  }

  const doc = data as {
    formatVersion?: number
    game?: string
    name?: string
    versionId?: string
    files?: unknown
  }

  if (doc.game !== 'minecraft' || typeof doc.formatVersion !== 'number') {
    throw new Error('This file is not a Minecraft Modrinth modpack (.mrpack).')
  }
  if (!Array.isArray(doc.files)) {
    throw new Error('The pack index has no files list.')
  }

  const files: MrpackFile[] = []
  for (const entry of doc.files) {
    const f = entry as { path?: unknown; downloads?: unknown }
    if (typeof f.path !== 'string' || !Array.isArray(f.downloads) || f.downloads.length === 0) {
      continue // skip malformed entries rather than failing the whole import
    }
    const downloads = f.downloads.filter((d): d is string => typeof d === 'string')
    if (downloads.length === 0) continue
    files.push({ path: f.path, downloads })
  }

  return {
    name: typeof doc.name === 'string' ? doc.name : 'Modrinth modpack',
    versionId: typeof doc.versionId === 'string' ? doc.versionId : null,
    files
  }
}
