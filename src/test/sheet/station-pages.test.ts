import { describe, expect, it } from 'vitest'
import { parsePageFilter } from '../../features/workspace/stations/page-filter'
import { remapStationCards } from '../../features/workspace/stations/rebase-cards'
import { toPageRefs } from '../../lib/pdf/page-refs'
import { blankCard } from '../../features/workspace/cards/use-cards'
import { cardKey } from '../../types/card'
import { DEFAULT_SHEET } from '../../types/imposition'
import { computeGrid } from '../../lib/imposition/grid'
import type { IngestedDocument } from '../../types/document'

describe('pages within a station', () => {
  it('validates ranges, sorts and deduplicates', () => {
    expect(parsePageFilter('3, 1-2, 2', 5)).toEqual([1, 2, 3])
    expect(parsePageFilter('none', 5)).toEqual([])
    expect(parsePageFilter('4-7', 5)).toBeNull()
    expect(parsePageFilter('2-1', 5)).toBeNull()
  })
  it('excludes pages without discarding edited cards and restores them when selected again', () => {
    const grid = computeGrid(DEFAULT_SHEET)
    const doc = { id: 'x', fileName: 'x.pdf', status: 'parsed', metrics: { pageCount: 3, widthPt: 420, heightPt: 595 } } as IngestedDocument
    const cards = Object.fromEntries([1, 2, 3].map((page) => [cardKey(page - 1, 'x.pdf', page), { ...blankCard(67), headerText: `EDIT ${page}` }]))
    const station = { id: 'a', name: 'A', documents: [doc], cards, activeId: null }
    const filtered = remapStationCards(station, [{ ...doc, includedPages: [2, 3] }], grid, grid)
    expect(toPageRefs(filtered.documents).map((page) => page.pageNumber)).toEqual([2, 3])
    expect(filtered.cards[cardKey(0, 'x.pdf', 2)]?.headerText).toBe('EDIT 2')
    const restored = remapStationCards(filtered, [doc], grid, grid)
    expect(restored.cards[cardKey(0, 'x.pdf', 1)]?.headerText).toBe('EDIT 1')
    expect(restored.cards[cardKey(1, 'x.pdf', 2)]?.headerText).toBe('EDIT 2')
    expect(restored.cards[cardKey(2, 'x.pdf', 3)]?.headerText).toBe('EDIT 3')
  })
})
