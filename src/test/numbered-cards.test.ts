import { describe, expect, it } from 'vitest'
import { numberedCards } from '../features/workspace/numbered-cards'
import { blankCard } from '../features/workspace/use-cards'
import { computeGrid } from '../lib/imposition/grid'
import { DEFAULT_SHEET } from '../types/imposition'
import { cardKey } from '../types/card'

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

it('mirrors the first card through subsequent sheets without destroying older individual labels', () => {
  const grid = computeGrid(DEFAULT_SHEET)
  const pages = Array.from({ length: grid.cellCount + 1 }, (_, i) => ({ documentId: 'doc', fileName: 'book.pdf', pageNumber: i + 1, widthMm: 100, heightMm: 100 }))
  const key = (i: number) => cardKey(i % grid.cellCount, 'doc', i + 1)
  const cards = Object.fromEntries(pages.map((_, i) => [key(i), { ...blankCard(grid.cellHeightMm), cornerLabel: i === 0 ? 'FIRST' : 'old' }]))
  const resolved = numberedCards(cards, pages, grid, 0.8)
  expect(resolved[key(0)]?.cornerLabelMirrored).toBe(false)
  expect(resolved[key(1)]?.displayCornerLabel).toBe('FIRST')
  expect(resolved[key(grid.cellCount)]?.displayCornerLabel).toBe('FIRST')
  expect(resolved[key(grid.cellCount)]?.cornerLabelMirrored).toBe(true)
  expect(cards[key(1)]?.cornerLabel).toBe('old')
  const cleared = numberedCards({ ...cards, [key(0)]: { ...cards[key(0)]!, cornerLabel: '' } }, pages, grid, 0.8)
  expect(cleared[key(1)]?.displayCornerLabel).toBe('')
})
