import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useSheet } from '../features/workspace/use-sheet'
import { validate } from '../lib/storage/snapshot'
import { DEFAULT_SHEET } from '../types/imposition'

afterEach(() => localStorage.clear())

describe('storage upgrades', () => {
  it('retains a v1 session and upgrades it to v2', () => {
    const old = { version: 1, documents: [], cards: { key: { headerText: 'edited' } }, activeId: null, savedAt: '2026-01-01' }
    const migrated = validate(old)
    expect(migrated?.version).toBe(2)
    expect(migrated?.cards.key?.headerText).toBe('edited')
  })
  it('retains legacy sheet geometry and writes the versioned setting', async () => {
    localStorage.setItem('crewbtc.sheet', JSON.stringify({ ...DEFAULT_SHEET, cellWidthMm: 60 }))
    const { result } = renderHook(() => useSheet())
    expect(result.current.settings.cellWidthMm).toBe(60)
    expect(result.current.settings.textScale).toBe(1)
    await waitFor(() => expect(localStorage.getItem('crewbtc.sheet.v2')).not.toBeNull())
  })
})
