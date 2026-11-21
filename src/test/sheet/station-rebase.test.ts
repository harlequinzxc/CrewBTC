import { describe, expect, it } from 'vitest'
import { rebaseStationCards } from '../../features/workspace/stations/rebase-cards'
import { blankCard } from '../../features/workspace/cards/use-cards'
import { cardKey } from '../../types/card'
import { DEFAULT_SHEET } from '../../types/imposition'
import { computeGrid } from '../../lib/imposition/grid'
import type { IngestedDocument } from '../../types/document'

describe('shared grid changes', () => {
  it('retains edited cards as pages move to different cell indices', () => {
    const oldGrid = computeGrid(DEFAULT_SHEET)
    const newGrid = computeGrid({ ...DEFAULT_SHEET, cellWidthMm: 190, cellHeightMm: 200 })
    const doc = { fileName: 'x.pdf', status: 'parsed', metrics: { pageCount: 3, widthPt: 420, heightPt: 595 } } as IngestedDocument
    const cards = Object.fromEntries([1, 2, 3].map((page) => [cardKey(page - 1, 'x.pdf', page), { ...blankCard(67), headerText: `EDIT ${page}` }]))
    const station = { id: 'a', name: 'A', documents: [doc], cards, activeId: null }
    const rebased = rebaseStationCards(station, oldGrid, newGrid)
    expect(rebased.cards[cardKey(0, 'x.pdf', 2)]?.headerText).toBe('EDIT 2')
    expect(rebased.cards[cardKey(0, 'x.pdf', 3)]?.headerText).toBe('EDIT 3')
    const restored = rebaseStationCards(rebased, newGrid, oldGrid)
    expect(restored.cards[cardKey(2, 'x.pdf', 3)]?.headerText).toBe('EDIT 3')
    expect(station.cards).toEqual(cards)
  })
})
