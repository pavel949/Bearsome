// Optional "write straight into your mods folder" support, built on the
// File System Access API. This is only available on Chromium-based desktop
// browsers (Chrome, Edge, Opera). Everywhere else `isSupported()` is false
// and callers fall back to a normal download.
//
// Security model: the browser only ever gives us access to the single folder
// the user explicitly picks, and only after they grant read/write permission.
// We persist the directory handle in IndexedDB so the choice survives reloads,
// but the browser still re-confirms permission when needed.

// --- Minimal typings for the parts of the API not in every lib.dom ---------
interface PermissionCapableHandle {
  queryPermission(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>
  requestPermission(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>
}

declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      id?: string
      mode?: 'read' | 'readwrite'
      startIn?: string
    }) => Promise<FileSystemDirectoryHandle>
  }
}

export function isSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
}

// --- IndexedDB persistence of the chosen directory handle -------------------
const DB_NAME = 'bearsome'
const STORE = 'handles'
const KEY = 'modsDir'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(value: FileSystemDirectoryHandle | null): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    if (value) tx.objectStore(STORE).put(value, KEY)
    else tx.objectStore(STORE).delete(KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function idbGet(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDb()
  const value = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(KEY)
    req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) ?? null)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return value
}

// --- Permission helpers -----------------------------------------------------
async function queryPermission(handle: FileSystemDirectoryHandle): Promise<PermissionState> {
  const h = handle as unknown as PermissionCapableHandle
  return h.queryPermission({ mode: 'readwrite' })
}

/** Request read/write permission. Must be called from a user gesture. */
async function ensurePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const h = handle as unknown as PermissionCapableHandle
  if ((await h.queryPermission({ mode: 'readwrite' })) === 'granted') return true
  return (await h.requestPermission({ mode: 'readwrite' })) === 'granted'
}

// --- Public API -------------------------------------------------------------

/**
 * Restore a previously-chosen folder if its permission is still granted.
 * Safe to call on load (does not prompt). Returns null if none/again-needed.
 */
export async function restoreSavedDir(): Promise<FileSystemDirectoryHandle | null> {
  if (!isSupported()) return null
  try {
    const handle = await idbGet()
    if (handle && (await queryPermission(handle)) === 'granted') return handle
  } catch {
    /* ignore */
  }
  return null
}

/** Prompt the user to pick a folder and persist it. Returns null if cancelled. */
export async function pickDir(): Promise<FileSystemDirectoryHandle | null> {
  if (!window.showDirectoryPicker) return null
  try {
    const handle = await window.showDirectoryPicker({
      id: 'bearsome-mods',
      mode: 'readwrite',
      startIn: 'downloads'
    })
    if (!(await ensurePermission(handle))) return null
    await idbSet(handle)
    return handle
  } catch {
    // User cancelled the picker, or permission denied.
    return null
  }
}

/** Forget the saved folder. */
export async function forgetDir(): Promise<void> {
  try {
    await idbSet(null)
  } catch {
    /* ignore */
  }
}

/**
 * Write bytes into the chosen directory under `filename`. Re-confirms
 * permission first (may prompt — call from a user gesture).
 */
export async function writeFile(
  dir: FileSystemDirectoryHandle,
  filename: string,
  data: Blob
): Promise<void> {
  if (!(await ensurePermission(dir))) {
    throw new Error('Permission to write to the folder was denied')
  }
  const fileHandle = await dir.getFileHandle(filename, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(data)
  await writable.close()
}
