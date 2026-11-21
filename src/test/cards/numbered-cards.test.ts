import { describe, expect, it } from 'vitest'
import { numberedCards } from '../../features/workspace/cards/numbered-cards'
import { blankCard } from '../../features/workspace/cards/use-cards'
import { computeGrid } from '../../lib/imposition/grid'
import { DEFAULT_SHEET } from '../../types/imposition'
import { cardKey } from '../../types/card'

describe('sheet numbering', () => {
  it('continues across sheets, wraps at 40 and honours a later restart', () => {
    const grid = computeGrid(DEFAULT_SHEET)
    const pages = Array.from({ length: grid.cellCount * 2 + 1 }, (_, i) => ({ documentId: 'doc', fileName: 'book.pdf', pageNumber: i + 1, widthMm: 100, heightMm: 100 }))
    const key = (i: number) => cardKey(i % grid.cellCount, 'doc', i + 1)
    const cards = Object.fromEntries(pages.map((_, i) => [key(i), { ...blankCard(grid.cellHeightMm), ...(i === 0 ? { numberStart: 39 } : {}), ...(i === grid.cellCount + 1 ? { numberStart: 15 } : {}) }]))
    const result = numberedCards(cards, pages, grid, 1.5)
    expect(result[key(0)]?.displayNumber).toBe(39)
    expect(result[key(1)]?.displayNumber).toBe(40)
    expect(result[key(2)]?.displayNumber).toBe(1)
    expect(result[key(grid.cellCount)]?.displayNumber).toBe((39 + grid.cellCount - 1) % 40 + 1)
    expect(result[key(grid.cellCount + 1)]?.displayNumber).toBe(15)
    expect(result[key(grid.cellCount + 2)]?.displayNumber).toBe(16)
    expect(result[key(0)]?.textScale).toBe(1.5)
    expect(cards[key(0)]?.textScale).toBeUndefined()
  })
})

it('inherits labels until a later editable restart, including across sheets', () => {
  const grid = computeGrid(DEFAULT_SHEET)
  const pages = Array.from({ length: grid.cellCount + 2 }, (_, i) => ({ documentId: 'doc', fileName: 'book.pdf', pageNumber: i + 1, widthMm: 100, heightMm: 100 }))
  const key = (i: number) => cardKey(i % grid.cellCount, 'doc', i + 1)
  const cards = Object.fromEntries(pages.map((_, i) => [key(i), { ...blankCard(grid.cellHeightMm), cornerLabel: i === 0 ? 'TEST' : 'old', ...(i === 2 ? { cornerLabelStart: 'REST' } : {}) }]))
  const resolved = numberedCards(cards, pages, grid, 0.8)
  expect([0, 1, 2, 3, grid.cellCount, grid.cellCount + 1].map((i) => resolved[key(i)]?.displayCornerLabel)).toEqual(['TEST', 'TEST', 'REST', 'REST', 'REST', 'REST'])
  expect(cards[key(1)]?.cornerLabel).toBe('old')
  const cleared = numberedCards({ ...cards, [key(2)]: { ...cards[key(2)]!, cornerLabelStart: '' } }, pages, grid, 0.8)
  expect(cleared[key(1)]?.displayCornerLabel).toBe('TEST')
  expect(cleared[key(2)]?.displayCornerLabel).toBe('')
  expect(cleared[key(3)]?.displayCornerLabel).toBe('')
})
