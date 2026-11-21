import { describe, expect, it } from 'vitest'
import { packPrintSelection, printCandidates } from '../../features/workspace/stations/print-selection'
import { blankCard } from '../../features/workspace/cards/use-cards'
import { cardKey } from '../../types/card'
import { DEFAULT_SHEET } from '../../types/imposition'
import { computeGrid } from '../../lib/imposition/grid'
import { planSheets } from '../../lib/imposition/sheet'
import type { IngestedDocument } from '../../types/document'

const grid = computeGrid(DEFAULT_SHEET)
function station(id: string, count: number) {
  const document = { id, fileName: 'same.pdf', status: 'parsed', metrics: { pageCount: count, widthPt: 420, heightPt: 595 } } as IngestedDocument
  const cards = Object.fromEntries(Array.from({ length: count }, (_, index) => [cardKey(index % grid.cellCount, 'same.pdf', index + 1), { ...blankCard(67), headerText: `${id}-${index + 1}`, ...(index === 0 ? { cornerLabel: id } : {}) }]))
  return { id, name: id, documents: [document], cards }
}

describe('mixed station print selection', () => {
  it('packs five and three cards on one sheet, with independent labels and no key collisions', () => {
    const sin = station('SIN', 5); const hnd = station('HND', 3)
    const original = JSON.stringify([sin, hnd])
    const candidates = printCandidates([sin, hnd], grid, 0.9)
    const packed = packPrintSelection(candidates, grid)
    expect(planSheets(packed.pages, grid)).toHaveLength(1)
    expect(Object.values(packed.cards).map((card) => card.headerText)).toEqual(['SIN-1', 'SIN-2', 'SIN-3', 'SIN-4', 'SIN-5', 'HND-1', 'HND-2', 'HND-3'])
    expect(Object.values(packed.cards).map((card) => card.displayCornerLabel)).toEqual(['SIN', 'SIN', 'SIN', 'SIN', 'SIN', 'HND', 'HND', 'HND'])
    expect(JSON.stringify([sin, hnd])).toBe(original)
  })
  it('packs individual cards across a sheet boundary without mutating their original numbers', () => {
    const choices = printCandidates([station('SIN', 15)], grid, 0.9)
    const selected = choices.slice(2)
    const packed = packPrintSelection(selected, grid)
    expect(planSheets(packed.pages, grid)).toHaveLength(2)
    expect(Object.values(packed.cards)[0]?.displayNumber).toBe(3)
    expect(Object.values(packed.cards).at(-1)?.displayNumber).toBe(15)
    expect(packPrintSelection([], grid)).toEqual({ pages: [], cards: {} })
  })
})
