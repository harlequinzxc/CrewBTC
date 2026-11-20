import { openDB } from 'idb'

// A separate database avoids changing either existing storage schema. Keys are document
// UUIDs, not names: two uploads with the same name must never silently swap their bytes.
const memory = new Map<string, ArrayBuffer>()
const db = () => openDB('crewbtc-project-sources', 1, {
  upgrade(database) { database.createObjectStore('sources') },
})

export async function putProjectSource(id: string, bytes: ArrayBuffer): Promise<void> {
  memory.set(id, bytes)
  const database = await db()
  try { await database.put('sources', bytes, id) } finally { database.close() }
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
