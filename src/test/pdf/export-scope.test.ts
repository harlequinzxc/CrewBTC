import { describe, expect, it } from 'vitest'
import { planSheets } from '../../lib/imposition/sheet'
import type { PageRef } from '../../lib/imposition/sheet'
import { DEFAULT_SHEET } from '../../types/imposition'
import { computeGrid } from '../../lib/imposition/grid'

/**
 * "This sheet" has to mean something.
 *
 * The export menu offers the sheet you are looking at, and every sheet after it — two
 * routes that must differ in what they write, not just in which handler they call. The
 * export hook produces the first one by handing the writer only the pages the first sheet
 * holds, so this test pins the arithmetic that makes that a real slice.
 */
const page = (index: number): PageRef => ({
  documentId: `doc-${index}.pdf`,
  fileName: `doc-${index}.pdf`,
  pageNumber: 1,
  widthMm: 210,
  heightMm: 297,
})

const grid = computeGrid(DEFAULT_SHEET)

describe('export scope', () => {
  it('draws twelve cards on the first sheet of an A4 batch', () => {
    const pages = Array.from({ length: 26 }, (_, index) => page(index))
    const plans = planSheets(pages, grid)

    expect(plans).toHaveLength(3)

    // What `exportCurrent` passes to the writer: exactly the first sheet's pages.
    const currentSheetPages = pages.slice(0, plans[0]?.placements.length ?? 0)
    expect(currentSheetPages).toHaveLength(12)

    // …and re-planning that slice yields a single sheet, which is what the PDF will be.
    const currentPlans = planSheets(currentSheetPages, grid)
    expect(currentPlans).toHaveLength(1)
    expect(currentPlans[0]?.placements).toHaveLength(12)
  })

  it('is a single sheet when the batch fits on one', () => {
    const pages = Array.from({ length: 5 }, (_, index) => page(index))
    const plans = planSheets(pages, grid)
    expect(plans).toHaveLength(1)
  })

  it('honours a rotated grid, where a sheet holds ten', () => {
    const rotated = computeGrid({ ...DEFAULT_SHEET, rotateCells: true })
    const pages = Array.from({ length: 21 }, (_, index) => page(index))
    const plans = planSheets(pages, rotated)
    expect(plans[0]?.placements).toHaveLength(rotated.cellCount)
    expect(rotated.cellCount).toBe(10)
  })
})
