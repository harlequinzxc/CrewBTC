import type { ReviewIssue } from './review-cards'
import { scrollCellIntoView } from '../sheet/scroll-cell-into-view'

export function jumpToReviewIssue(issue: ReviewIssue, goToSheet: (index: number) => void, selectCell: (index: number, page: { documentId: string; pageNumber: number }) => void) {
  goToSheet(issue.sheetIndex)
  selectCell(issue.cellIndex, { documentId: issue.documentId, pageNumber: issue.pageNumber })
  window.requestAnimationFrame(() => {
    const cell = document.querySelector<HTMLElement>(`[data-sheet="${issue.sheetIndex + 1}"] [data-cell="${issue.cellIndex}"]`)
    if (cell !== null) scrollCellIntoView(cell)
  })
}
