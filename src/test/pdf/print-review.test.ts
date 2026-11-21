import { describe, expect, it } from 'vitest'
import { reviewCards } from '../../features/workspace/review/review-cards'
import { blankCard } from '../../features/workspace/cards/use-cards'
import { cardKey } from '../../types/card'
import { DEFAULT_SHEET } from '../../types/imposition'
import { computeGrid } from '../../lib/imposition/grid'
import { planSheets } from '../../lib/imposition/sheet'

const grid = computeGrid(DEFAULT_SHEET)
const pages = Array.from({ length: grid.cellCount + 1 }, (_, i) => ({ documentId: 'a.pdf', fileName: 'a.pdf', pageNumber: i + 1, widthMm: 210, heightMm: 297 }))
const sheets = planSheets(pages, grid)

describe('print and batch review', () => {
  it('identifies issues using the correct sheet and card identity', async () => {
    const key = cardKey(0, 'a.pdf', grid.cellCount + 1)
    const card = { ...blankCard(67), headerText: '😀', bodyText: 'lots of words '.repeat(300), displayCornerLabel: 'a very long corner label', displayNumber: 13 }
    const issues = await reviewCards(sheets, grid, { [key]: card })
    const second = issues.find((issue) => issue.sheetIndex === 1)
    expect(second?.cellIndex).toBe(0)
    expect(second?.messages).toContain('Top text has unsupported characters')
    expect(second?.messages).toContain('Bottom text may clip')
    expect(second?.messages).toContain('Missing photo')
    expect(second?.messages).toContain('Corner label will be truncated')
  })

  it('reports cards not yet seeded instead of silently passing', async () => {
    const issues = await reviewCards(sheets, grid, {})
    expect(issues).toHaveLength(pages.length)
    expect(issues[0]?.messages).toContain('Card not ready')
  })
})
