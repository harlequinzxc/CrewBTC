import { openDB } from 'idb'
import type { Card } from '../../types/card'
import type { IngestedDocument } from '../../types/document'
import { SNAPSHOT_VERSION } from '../../types/persisted'
import type { UnknownSnapshot, WorkspaceSnapshot } from '../../types/persisted'

/**
 * The workspace snapshot: what the last session was, so the next one is not empty.
 *
 * Two deliberate choices:
 *
 * 1. **Its own database, not a new store in `crewbtc`.** Adding a store means bumping the
 *    schema, and `onupgradeneeded` is the one place a bug is unrecoverable — a bad upgrade
 *    leaves the user with a database the app cannot open at all. This feature stores no
 *    settings and shares no records with that database, so it does not earn that risk.
 *    It is still one library (`idb`), which is what §5A asks for: one wrapper, not two.
 *
 * 2. **One record, replaced whole.** A batch is read as a unit — documents and the cards
 *    laid out from them are meaningless apart — so partial writes would be able to leave
 *    cards pointing at pages that no longer exist. Whole-record replacement is atomic and
 *    makes the invariant impossible to break.
 */

export const SNAPSHOT_DB = 'crewbtc-session'
const STORE = 'workspace'
const KEY = 'current'

interface SessionSchema {
  workspace: { key: string; value: WorkspaceSnapshot }
}

let connection: Promise<import('idb').IDBPDatabase<SessionSchema>> | null = null

function getDb(): Promise<import('idb').IDBPDatabase<SessionSchema>> {
  connection ??= openDB<SessionSchema>(SNAPSHOT_DB, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    },
  })
  return connection
}

export async function readSnapshot(): Promise<WorkspaceSnapshot | null> {
  try {
    const db = await getDb()
    return validate(await db.get(STORE, KEY))
  } catch {
    // A snapshot that cannot be read is not an error the user can act on, and failing to
    // start because the cache is corrupt would be worse than starting empty.
    return null
  }
}

export async function writeSnapshot(snapshot: WorkspaceSnapshot): Promise<void> {
  try {
    const db = await getDb()
    await db.put(STORE, snapshot, KEY)
  } catch {
    // Out of quota, or private mode with storage disabled. The session still works; it
    // just will not be restorable. Never surface this as a failure of the user's task.
  }
}

export async function clearSnapshot(): Promise<void> {
  try {
    const db = await getDb()
    await db.delete(STORE, KEY)
  } catch {
    // Nothing to do: a stale snapshot is validated on read anyway.
  }
}

/**
 * Reject an unknown shape rather than coercing it (§5: validate before trusting storage).
 *
 * Versions 1 and 2 are migrated without discarding edited cards. Future versions are
 * rejected rather than read as a shape this build cannot understand.
 */
export function validate(raw: UnknownSnapshot): WorkspaceSnapshot | null {
  if (typeof raw !== 'object' || raw === null) return null
  const value = raw as Partial<WorkspaceSnapshot>
  const version = (raw as { version?: unknown }).version
  // Older cards retain their labels; only the first legacy label starts a sequence.
  // New per-card restarts are optional and resolve from placement order at render time.
  if (version !== 1 && version !== 2 && version !== 3 && version !== SNAPSHOT_VERSION) return null
  if (!Array.isArray(value.documents)) return null
  if (typeof value.cards !== 'object' || value.cards === null) return null

  const documents = value.documents.filter(isDocument)
  // A partially-valid batch is not restored: half a batch is a different batch, and the
  // cards laid out from the missing half would point at pages that no longer exist.
  if (documents.length !== value.documents.length) return null
  // An *empty* batch is valid and says something specific — the user cleared their files.
  // Treating it as "nothing stored" would be relying on an accident to get the same
  // answer, and would make the record unable to express a real state.

  let stations: WorkspaceSnapshot['stations']
  let activeStationId: string
  if (version === SNAPSHOT_VERSION) {
    if (!Array.isArray(value.stations) || value.stations.length === 0 || typeof value.activeStationId !== 'string') return null
    const seen = new Set<string>()
    for (const station of value.stations) {
      if (typeof station !== 'object' || station === null || typeof station.id !== 'string' || !station.id ||
          seen.has(station.id) || typeof station.name !== 'string' || !station.name.trim() ||
          !Array.isArray(station.documents) || !station.documents.every(isDocument) ||
          typeof station.cards !== 'object' || station.cards === null || Array.isArray(station.cards) ||
          (station.activeId !== null && typeof station.activeId !== 'string')) return null
      seen.add(station.id)
    }
    if (!seen.has(value.activeStationId)) return null
    stations = value.stations
    activeStationId = value.activeStationId
    const active = stations.find((station) => station.id === activeStationId)!
    // The active station is authoritative; mirror fields are derived below.
    return { version: SNAPSHOT_VERSION, documents: active.documents, cards: active.cards, activeId: active.activeId, stations, activeStationId, savedAt: typeof value.savedAt === 'string' ? value.savedAt : new Date().toISOString() }
  }
  activeStationId = 'station-default'
  stations = [{ id: activeStationId, name: 'Station 1', documents, cards: value.cards as Record<string, Card>, activeId: typeof value.activeId === 'string' ? value.activeId : null }]
  return {
    version: SNAPSHOT_VERSION,
    documents,
    cards: value.cards as Record<string, Card>,
    activeId: typeof value.activeId === 'string' ? value.activeId : null,
    stations, activeStationId,
    savedAt: typeof value.savedAt === 'string' ? value.savedAt : new Date().toISOString(),
  }
}

/**
 * Enough of `IngestedDocument` to be safe to render. Not a full schema check: the fields
 * a missing value would crash on are the ones checked, and the rest are defaulted at the
 * read site. Over-validating here would mean a stored snapshot goes stale every time the
 * document type gains a field.
 */
function isDocument(value: unknown): value is IngestedDocument {
  if (typeof value !== 'object' || value === null) return false
  const doc = value as Partial<IngestedDocument>
  return (
    typeof doc.id === 'string' &&
    typeof doc.fileName === 'string' &&
    typeof doc.status === 'string' &&
    (doc.includedPages === undefined || (Array.isArray(doc.includedPages) && doc.includedPages.every((page) => Number.isInteger(page) && page > 0 && (doc.metrics == null || page <= doc.metrics.pageCount)) && new Set(doc.includedPages).size === doc.includedPages.length)) &&
    typeof doc.copies === 'object' &&
    doc.copies !== null &&
    typeof doc.photos === 'object' &&
    doc.photos !== null &&
    Array.isArray(doc.regions)
  )
}
