// Filesystem side of the app: finding the Minecraft mods folder on each OS,
// downloading mod jars with progress, listing what's installed and removing
// mods. Everything here is pure-ish and takes the mods directory as input so
// it stays testable and instance-agnostic (vanilla, Prism, MultiMC, ...).

import { createWriteStream } from 'node:fs'
import { mkdir, readdir, rm, stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { homedir, platform } from 'node:os'
import { dirname, isAbsolute, join, normalize, resolve, sep } from 'node:path'

/**
 * Best-effort guess of the default vanilla `.minecraft/mods` directory for
 * the current operating system. The user can always override this.
 */
export function detectModsDir(): string {
  const home = homedir()
  switch (platform()) {
    case 'win32': {
      const appData = process.env.APPDATA ?? join(home, 'AppData', 'Roaming')
      return join(appData, '.minecraft', 'mods')
    }
    case 'darwin':
      return join(home, 'Library', 'Application Support', 'minecraft', 'mods')
    default:
      // Linux and everything else.
      return join(home, '.minecraft', 'mods')
  }
}

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
}

/** List the `.jar` files present in a mods directory. */
export async function listJarFiles(
  modsDir: string
): Promise<Array<{ filename: string; path: string; sizeBytes: number; mtimeMs: number }>> {
  let entries: string[]
  try {
    entries = await readdir(modsDir)
  } catch {
    // Folder doesn't exist yet — treat as empty.
    return []
  }
  const jars = entries.filter((f) => f.toLowerCase().endsWith('.jar'))
  const out: Array<{ filename: string; path: string; sizeBytes: number; mtimeMs: number }> = []
  for (const filename of jars) {
    const path = join(modsDir, filename)
    try {
      const s = await stat(path)
      out.push({ filename, path, sizeBytes: s.size, mtimeMs: s.mtimeMs })
    } catch {
      // Skip files that vanished between readdir and stat.
    }
  }
  return out
}

/**
 * Resolve a relative path inside a base directory, refusing anything that would
 * escape it (absolute paths, `..` traversal). Returns the safe absolute path.
 * Used when writing files whose paths come from untrusted sources (e.g. a
 * `.mrpack` index).
 */
export function safeResolve(base: string, relPath: string): string {
  const cleaned = normalize(relPath).replace(/\\/g, '/')
  if (isAbsolute(relPath) || isAbsolute(cleaned) || cleaned.split('/').includes('..')) {
    throw new Error(`Unsafe path in pack: ${relPath}`)
  }
  const baseResolved = resolve(base)
  const target = resolve(baseResolved, cleaned)
  if (target !== baseResolved && !target.startsWith(baseResolved + sep)) {
    throw new Error(`Unsafe path in pack: ${relPath}`)
  }
  return target
}

/**
 * Stream-download a URL to an absolute destination path, creating parent
 * directories as needed. Reports progress via the callback. Returns byte size.
 */
export async function downloadToPath(
  url: string,
  dest: string,
  onProgress?: (receivedBytes: number, totalBytes: number) => void
): Promise<number> {
  await mkdir(dirname(dest), { recursive: true })

  const res = await fetch(url, { headers: { 'User-Agent': 'bearsome/0.1.0' } })
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`)
  }

  const totalBytes = Number(res.headers.get('content-length') ?? 0)
  let received = 0

  // Convert the web ReadableStream to a Node stream and tap progress.
  const nodeStream = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0])
  nodeStream.on('data', (chunk: Buffer) => {
    received += chunk.length
    onProgress?.(received, totalBytes)
  })

  await pipeline(nodeStream, createWriteStream(dest))

  return (await stat(dest)).size
}

/**
 * Stream-download a URL into `modsDir`. Returns the absolute path and size.
 */
export async function downloadToMods(
  modsDir: string,
  url: string,
  filename: string,
  onProgress?: (receivedBytes: number, totalBytes: number) => void
): Promise<{ path: string; sizeBytes: number }> {
  const dest = join(modsDir, filename)
  const sizeBytes = await downloadToPath(url, dest, onProgress)
  return { path: dest, sizeBytes }
}

/** Delete a single mod file by name from the mods directory. */
export async function removeMod(modsDir: string, filename: string): Promise<void> {
  // Guard against path traversal — only allow plain filenames.
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    throw new Error('Invalid mod filename')
  }
  await rm(join(modsDir, filename), { force: true })
}
