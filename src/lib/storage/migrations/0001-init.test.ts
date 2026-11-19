import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { openDB } from 'idb'
import { V1_STORES } from './0001-init'

const DB = 'migration-test'

describe('schema v1 migration', () => {
  it('creates every store on a fresh database', async () => {
    const db = await openDB(DB, 1, {
      upgrade(database) {
        for (const store of V1_STORES) database.createObjectStore(store, { keyPath: 'id' })
      },
    })
    expect([...db.objectStoreNames].sort()).toEqual([...V1_STORES].sort())
    db.close()
  })

  it('preserves existing records when upgrading from v0 data', async () => {
    const legacy = await openDB(`${DB}-legacy`, 1, {
      upgrade(database) {
        database.createObjectStore('settings', { keyPath: 'id' })
      },
    })
    await legacy.put('settings', { id: 'page', marker: 'kept' })
    legacy.close()

    const upgraded = await openDB(`${DB}-legacy`, 2, {
      upgrade(database, fromVersion) {
        if (fromVersion < 2 && !database.objectStoreNames.contains('templates')) {
          database.createObjectStore('templates', { keyPath: 'id' })
        }
      },
    })
    const kept = await upgraded.get('settings', 'page')
    expect(kept).toEqual({ id: 'page', marker: 'kept' })
    expect(upgraded.objectStoreNames.contains('templates')).toBe(true)
    upgraded.close()
  })
})
