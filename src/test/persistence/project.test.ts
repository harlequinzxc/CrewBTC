import { describe, expect, it } from 'vitest'
import { decodeSource, encodeSource, parseProject } from '../../lib/project/project'
import { DEFAULT_SHEET } from '../../types/imposition'
import { blankCard } from '../../features/workspace/cards/use-cards'

const project = () => ({
  format: 'crewbtc-project', version: 1,
  snapshot: { version: 3, documents: [{ id: 'one', fileName: 'dish.pdf', byteLength: 8, addedAt: '2026', status: 'parsed', metrics: { pageCount: 1, widthPt: 100, heightPt: 200 }, regions: [], pagePreviewUrl: null, copy: null, copies: {}, photoUrl: null, photos: {}, error: null }], cards: { card: blankCard(67) }, activeId: 'one', savedAt: 'now' },
  sheet: DEFAULT_SHEET, preferences: { units: 'mm' }, showCutMarks: true,
  sources: { one: btoa('%PDF-1.4') },
})

describe('editable project validation', () => {
  it('round-trips binary data including large buffers', () => {
    const original = new Uint8Array(100000).map((_, index) => index % 256)
    expect(new Uint8Array(decodeSource(encodeSource(original.buffer)))).toEqual(original)
  })
  it('accepts a project with or without original PDFs', () => {
    const value = project()
    expect(parseProject(JSON.stringify(value)).snapshot.documents).toHaveLength(1)
    expect(parseProject(JSON.stringify(value)).keywords).toEqual({ crockeries: '', directions: '', condiments: '' })
    const keywords = { crockeries: 'plate', directions: 'pour', condiments: 'soy' }
    expect(parseProject(JSON.stringify({ ...value, version: 2, keywords })).keywords).toEqual(keywords)
    expect(parseProject(JSON.stringify({ ...value, sources: {} })).sources).toEqual({})
  })
  it('rejects a future version and malformed nested content', () => {
    const value = project()
    expect(() => parseProject(JSON.stringify({ ...value, version: 3 }))).toThrow()
    expect(() => parseProject(JSON.stringify({ ...value, version: 2, keywords: { crockeries: 42 } }))).toThrow()
    expect(() => parseProject(JSON.stringify({ ...value, sheet: { ...value.sheet, sheetWidthMm: -1 } }))).toThrow()
    expect(() => parseProject(JSON.stringify({ ...value, sources: { one: btoa('not a pdf') } }))).toThrow()
    expect(() => parseProject(JSON.stringify({ ...value, snapshot: { ...value.snapshot, cards: { card: { photo: null } } } }))).toThrow()
    expect(() => parseProject(JSON.stringify({ ...value, snapshot: { ...value.snapshot, documents: [{ ...value.snapshot.documents[0], copies: [] }] } }))).toThrow()
  })
})
