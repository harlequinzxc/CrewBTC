import { openDB } from 'idb'
import { readSnapshot } from './snapshot'

// A separate database avoids changing existing schemas. String keys are document UUIDs;
// array keys are retirement markers, so older ArrayBuffer records remain readable.
const memory = new Map<string, ArrayBuffer>()
const db = () => openDB('crewbtc-project-sources', 1, {
  upgrade(database) { database.createObjectStore('sources') },
})
const marker = (id: string): IDBValidKey => ['retired', id]
const UNDO_GRACE_MS = 10_000
let pending: Promise<unknown> = Promise.resolve()

// Ordered operations prevent a fast Undo/reopen from racing a pending retirement.
function serial<T>(operation: () => Promise<T>): Promise<T> {
  const result = pending.then(operation, operation)
  pending = result.catch(() => undefined)
  return result
}

export async function putProjectSource(id: string, bytes: ArrayBuffer): Promise<void> {
  memory.set(id, bytes)
  return serial(async () => {
    const database = await db()
    try {
      const tx = database.transaction('sources', 'readwrite')
      await tx.store.put(bytes, id)
      await tx.store.delete(marker(id))
      await tx.done
    } finally { database.close() }
  })
}

export async function getProjectSource(id: string): Promise<ArrayBuffer | null> {
  const held = memory.get(id)
  if (held !== undefined) return held
  try {
    const database = await db()
    try {
      const bytes: unknown = await database.get('sources', id)
      return bytes instanceof ArrayBuffer ? bytes : null
    } finally { database.close() }
  } catch { return null }
}

/** Mark removed originals, but keep them available while Clear can be undone. */
export function retireProjectSources(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return Promise.resolve()
  const expiry = Date.now() + UNDO_GRACE_MS
  const work = serial(async () => {
    const database = await db()
    try {
      const tx = database.transaction('sources', 'readwrite')
      for (const id of ids) await tx.store.put(expiry, marker(id))
      await tx.done
    } finally { database.close() }
  })
  void work.then(() => {
    setTimeout(() => { void sweepProjectSources().catch(() => undefined) }, UNDO_GRACE_MS + 100)
  }).catch(() => undefined)
  return work
}

export function cancelProjectRetirement(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return Promise.resolve()
  return serial(async () => {
    const database = await db()
    try {
      const tx = database.transaction('sources', 'readwrite')
      for (const id of ids) await tx.store.delete(marker(id))
      await tx.done
    } finally { database.close() }
  })
}

/** Resume interrupted cleanup on reload. Never delete a source in the saved workspace. */
export function sweepProjectSources(now = Date.now()): Promise<void> {
  return serial(async () => {
    const snapshot = await readSnapshot()
    if (snapshot === null) return // An unreadable snapshot is not proof that a file is unused.
    const active = new Set(snapshot.stations.flatMap((station) => station.documents.map((document) => document.id)))
    const database = await db()
    try {
      const tx = database.transaction('sources', 'readwrite')
      const keys = await tx.store.getAllKeys()
      let nextExpiry = Infinity
      for (const key of keys) {
        if (!Array.isArray(key) || key.length !== 2 || key[0] !== 'retired' || typeof key[1] !== 'string') continue
        const id = key[1]
        const expiry: unknown = await tx.store.get(key)
        if (typeof expiry !== 'number' || active.has(id)) continue
        if (expiry > now) { nextExpiry = Math.min(nextExpiry, expiry); continue }
        await tx.store.delete(id)
        await tx.store.delete(key)
        memory.delete(id)
      }
      await tx.done
      if (Number.isFinite(nextExpiry)) {
        setTimeout(() => { void sweepProjectSources().catch(() => undefined) }, Math.max(100, nextExpiry - Date.now() + 100))
      }
    } finally { database.close() }
  })
}
