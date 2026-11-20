import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { readSettings, writeSettings } from '../lib/storage/db'

describe('settings persistence', () => {
  it('writes a preference to the inline-key store and reads it back', async () => {
    await writeSettings({ units: 'cm' })
    expect(await readSettings()).toEqual({ units: 'cm' })
  })
})
