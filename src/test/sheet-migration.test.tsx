import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useSheet } from '../features/workspace/use-sheet'
import { validate } from '../lib/storage/snapshot'
import { DEFAULT_SHEET } from '../types/imposition'

afterEach(() => localStorage.clear())

describe('storage upgrades', () => {
  it('retains a v1 session and upgrades it to v3', () => {
    const old = { version: 1, documents: [], cards: { key: { headerText: 'edited' } }, activeId: null, savedAt: '2026-01-01' }
    const migrated = validate(old)
    expect(migrated?.version).toBe(3)
    expect(migrated?.cards.key?.headerText).toBe('edited')
  })
  it('retains a v2 session with old card labels', () => {
    const old = { version: 2, documents: [], cards: { key: { cornerLabel: 'original' } }, activeId: null }
    const migrated = validate(old)
    expect(migrated?.version).toBe(3)
    expect(migrated?.cards.key?.cornerLabel).toBe('original')
  })
  it('retains legacy sheet geometry and writes the versioned setting', async () => {
    const { textScale: _textScale, ...legacy } = DEFAULT_SHEET
    void _textScale
    localStorage.setItem('crewbtc.sheet', JSON.stringify({ ...legacy, cellWidthMm: 60 }))
    const { result } = renderHook(() => useSheet())
    expect(result.current.settings.cellWidthMm).toBe(60)
    expect(result.current.settings.textScale).toBe(0.8)
    await waitFor(() => expect(localStorage.getItem('crewbtc.sheet.v2')).not.toBeNull())
  })
})


it('defaults to 80 percent while retaining a previously saved choice', () => {
  const first = renderHook(() => useSheet())
  expect(first.result.current.settings.textScale).toBe(0.8)
  first.unmount()
  localStorage.setItem('crewbtc.sheet.v2', JSON.stringify({ ...DEFAULT_SHEET, textScale: 1.5 }))
  const saved = renderHook(() => useSheet())
  expect(saved.result.current.settings.textScale).toBe(1.5)
})
