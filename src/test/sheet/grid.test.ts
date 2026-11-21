import { describe, expect, it } from 'vitest'
import { computeGrid, containFit, sheetCountFor, validateSheet, clampSheetValue } from '../../lib/imposition/grid'
import { DEFAULT_SHEET } from '../../types/imposition'
import type { SheetSettings } from '../../types/imposition'

const base: SheetSettings = { ...DEFAULT_SHEET }

describe('A4 default grid (the user’s numbers)', () => {
  const grid = computeGrid(base)

  it('fits 3 x 4 = 12 cells of 52 x 67 mm', () => {
    expect(grid.columns).toBe(3)
    expect(grid.rows).toBe(4)
    expect(grid.cellCount).toBe(12)
    expect(grid.isEmpty).toBe(false)
  })

  it('never places a cell off the sheet', () => {
    for (const cell of grid.cells) {
      expect(cell.rect.xMm).toBeGreaterThanOrEqual(0)
      expect(cell.rect.yMm).toBeGreaterThanOrEqual(0)
      expect(cell.rect.xMm + cell.rect.widthMm).toBeLessThanOrEqual(210 + 0.001)
      expect(cell.rect.yMm + cell.rect.heightMm).toBeLessThanOrEqual(297 + 0.001)
    }
  })

  it('keeps a gutter between neighbours so scissors have a channel', () => {
    const firstRow = grid.cells.filter((cell) => cell.row === 0)
    for (let i = 1; i < firstRow.length; i += 1) {
      const previous = firstRow[i - 1]
      const current = firstRow[i]
      if (previous === undefined || current === undefined) continue
      const gap = current.rect.xMm - (previous.rect.xMm + previous.rect.widthMm)
      expect(gap).toBeCloseTo(4, 5)
    }
  })

  it('leaves equal margins on both sides', () => {
    const left = Math.min(...grid.cells.map((cell) => cell.rect.xMm))
    expect(left).toBeCloseTo(4, 5)
    const right = Math.max(...grid.cells.map((cell) => cell.rect.xMm + cell.rect.widthMm))
    expect(210 - right).toBeCloseTo(4 + grid.slackRightMm, 5)
  })

  it('reports utilisation below 100 and above half the sheet', () => {
    expect(grid.utilisationPercent).toBeGreaterThan(50)
    expect(grid.utilisationPercent).toBeLessThan(100)
  })

  it('numbers cells in reading order', () => {
    const ordered = [...grid.cells].sort((l, r) => l.index - r.index)
    expect(ordered[0]?.column).toBe(0)
    expect(ordered[0]?.row).toBe(0)
    const second = ordered[1]
    expect(second?.row).toBe(0)
    expect(second?.column).toBe(1)
  })
})

describe('rotation', () => {
  it('swaps the cell footprint and yields fewer cells for this ratio', () => {
    const rotated = computeGrid({ ...base, rotateCells: true })
    expect(rotated.cellWidthMm).toBe(67)
    expect(rotated.cellHeightMm).toBe(52)
    // Measured, not assumed: rotating 52x67 on A4 gives 2x5 = 10, not 12.
    expect(rotated.cellCount).toBe(10)
  })
})

describe('gutter trade-off', () => {
  it('4 mm gutter costs no cells versus the 2 mm minimum', () => {
    const tight = computeGrid({ ...base, gutterMm: 2 })
    const comfortable = computeGrid({ ...base, gutterMm: 4 })
    expect(comfortable.cellCount).toBe(tight.cellCount)
  })

  it('a large gutter eventually costs a row', () => {
    const roomy = computeGrid({ ...base, gutterMm: 12 })
    expect(roomy.cellCount).toBeLessThan(12)
  })
})

describe('degenerate input never yields NaN geometry', () => {
  const cases: SheetSettings[] = [
    { ...base, sheetWidthMm: 0 },
    { ...base, sheetHeightMm: 0 },
    { ...base, sheetWidthMm: Number.NaN },
    { ...base, cellWidthMm: Number.NaN },
    { ...base, cellWidthMm: 0 },
    { ...base, cellHeightMm: -10 },
    { ...base, cellWidthMm: 500 },
    { ...base, marginMm: 400 },
    { ...base, gutterMm: Number.POSITIVE_INFINITY },
  ]

  it('always returns a finite, empty grid', () => {
    for (const settings of cases) {
      const grid = computeGrid(settings)
      expect(Number.isFinite(grid.utilisationPercent)).toBe(true)
      expect(Number.isFinite(grid.slackRightMm)).toBe(true)
      for (const cell of grid.cells) {
        expect(Number.isFinite(cell.rect.xMm)).toBe(true)
        expect(Number.isFinite(cell.rect.yMm)).toBe(true)
      }
    }
  })

  it('marks genuinely impossible sheets as empty', () => {
    expect(computeGrid({ ...base, sheetWidthMm: 0 }).isEmpty).toBe(true)
    expect(computeGrid({ ...base, marginMm: 400 }).isEmpty).toBe(true)
    expect(computeGrid({ ...base, cellWidthMm: 500 }).isEmpty).toBe(true)
  })
})

describe('containFit', () => {
  it('scales a tall page to fit a wide cell without cropping', () => {
    const fitted = containFit(210, 297, { xMm: 10, yMm: 10, widthMm: 52, heightMm: 67 })
    expect(fitted).not.toBeNull()
    if (fitted === null) return
    expect(fitted.widthMm).toBeLessThanOrEqual(52.001)
    expect(fitted.heightMm).toBeLessThanOrEqual(67.001)
    // Aspect ratio preserved within rounding.
    expect(fitted.widthMm / fitted.heightMm).toBeCloseTo(210 / 297, 2)
  })

  it('centres the page inside the cell', () => {
    const fitted = containFit(100, 50, { xMm: 0, yMm: 0, widthMm: 52, heightMm: 67 })
    if (fitted === null) throw new Error('expected a fit')
    const leftGap = fitted.xMm
    const rightGap = 52 - (fitted.xMm + fitted.widthMm)
    expect(leftGap).toBeCloseTo(rightGap, 1)
  })

  it('returns null for unusable sources instead of Infinity', () => {
    expect(containFit(0, 100, { xMm: 0, yMm: 0, widthMm: 50, heightMm: 50 })).toBeNull()
    expect(containFit(100, 100, { xMm: 0, yMm: 0, widthMm: 0, heightMm: 50 })).toBeNull()
    expect(containFit(Number.NaN, 100, { xMm: 0, yMm: 0, widthMm: 50, heightMm: 50 })).toBeNull()
  })
})

describe('sheet counting', () => {
  it('rounds up', () => {
    expect(sheetCountFor(12, 12)).toBe(1)
    expect(sheetCountFor(13, 12)).toBe(2)
    expect(sheetCountFor(24, 12)).toBe(2)
  })

  it('handles empty and invalid input', () => {
    expect(sheetCountFor(0, 12)).toBe(0)
    expect(sheetCountFor(12, 0)).toBe(0)
    expect(sheetCountFor(Number.NaN, 12)).toBe(0)
  })
})

describe('validation', () => {
  it('accepts the defaults', () => {
    expect(validateSheet(base).ok).toBe(true)
  })

  it('rejects nonsense with a message per field', () => {
    const result = validateSheet({ ...base, cellWidthMm: 0, gutterMm: -1 })
    expect(result.ok).toBe(false)
    expect(result.errors['cellWidthMm']).toBeDefined()
    expect(result.errors['gutterMm']).toBeDefined()
  })

  it('clamps into range', () => {
    expect(clampSheetValue(Number.NaN, 5, 100)).toBe(5)
    expect(clampSheetValue(-50, 0, 60)).toBe(0)
    expect(clampSheetValue(999, 0, 60)).toBe(60)
  })
})
