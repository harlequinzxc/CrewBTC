import { describe, expect, it } from 'vitest'
import { serializeProject } from '../../lib/project/project-assets'
import { parseProject } from '../../lib/project/project'
import { blankCard } from '../../features/workspace/cards/use-cards'
import { DEFAULT_SHEET } from '../../types/imposition'

const image = `data:image/png;base64,${'QUJD'.repeat(2000)}`
const modified = `data:image/png;base64,${'REVH'.repeat(2000)}`
const photo = { dataUrl: image, widthPx: 100, heightPx: 80 }
const editedPhoto = { ...photo, dataUrl: modified }
const doc = (id: string) => ({ id, fileName: 'dish.pdf', byteLength: 8, addedAt: '2026', status: 'parsed' as const, metrics: { pageCount: 1, widthPt: 100, heightPt: 200 }, regions: [], pagePreviewUrl: image, copy: null, copies: {}, photoUrl: photo, photos: { 1: photo }, error: null })
const source = btoa('%PDF-1.4 duplicate source')
function project() {
  const documents = [doc('one')]
  const cards = { '0|dish.pdf|1': { ...blankCard(67), headerText: 'EDITED', photo: editedPhoto } }
  const legacy = { format: 'crewbtc-project', version: 2, snapshot: { version: 3, documents, cards, activeId: 'one', savedAt: 'now' }, sheet: DEFAULT_SHEET, preferences: { units: 'mm' }, showCutMarks: true, keywords: { crockeries: 'plate', directions: '', condiments: '' }, sources: { one: source } }
  const parsed = parseProject(JSON.stringify(legacy))
  return { ...parsed, snapshot: { ...parsed.snapshot, stations: [...parsed.snapshot.stations, { id: 'two', name: 'HND', documents: [doc('two')], cards, activeId: 'two' }] }, sources: { one: source, two: source } }
}

describe('lossless project asset deduplication', () => {
  it('stores repeated images and originals once and preserves edited photos and all stations', () => {
    const original = project()
    const output = serializeProject(original)
    const saved = JSON.parse(output) as { version: number; images: string[]; pdfs: string[]; snapshot: Record<string, unknown> }
    expect(saved.version).toBe(4)
    expect(saved.images).toEqual([image, modified])
    expect(saved.pdfs).toEqual([source])
    expect(saved.snapshot).not.toHaveProperty('documents')
    expect(saved.snapshot).not.toHaveProperty('cards')
    const restored = parseProject(output)
    expect(restored.snapshot.stations).toEqual(original.snapshot.stations)
    expect(restored.sources).toEqual(original.sources)
    expect(restored.keywords).toEqual(original.keywords)
    expect(output.length).toBeLessThan(JSON.stringify(original).length / 2)
  })
  it('rejects dangling or malformed references before replacing a workspace', () => {
    const output = JSON.parse(serializeProject(project())) as { sources: Record<string, number>; snapshot: { stations: { cards: Record<string, { photo: { dataUrl: unknown } }> }[] } }
    output.sources.one = 999
    expect(() => parseProject(JSON.stringify(output))).toThrow()
    const badImage = JSON.parse(serializeProject(project())) as typeof output
    badImage.snapshot.stations[0]!.cards['0|dish.pdf|1']!.photo.dataUrl = { $image: -1 }
    expect(() => parseProject(JSON.stringify(badImage))).toThrow()
  })
})
