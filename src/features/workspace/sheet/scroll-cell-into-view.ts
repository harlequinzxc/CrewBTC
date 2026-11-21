import { revealScrollTop } from './reveal-cell'

/**
 * Impure half of revealing a cell: measure, then scroll.
 *
 * The pane is found by walking up from the cell rather than passed in, because the cell is
 * rendered inside a paper inside the pane and the call site that decides *to* reveal has no
 * reference to any of them. The first scrollable ancestor is by definition the thing that
 * can move the cell.
 */
export function scrollCellIntoView(cell: HTMLElement): void {
  let pane: HTMLElement | null = cell.parentElement
  while (pane !== null) {
    const { overflowY } = getComputedStyle(pane)
    if ((overflowY === 'auto' || overflowY === 'scroll') && pane.scrollHeight > pane.clientHeight) break
    pane = pane.parentElement
  }
  if (pane === null) return

  const cellBox = cell.getBoundingClientRect()
  const paneBox = pane.getBoundingClientRect()
  const next = revealScrollTop(
    { top: cellBox.top, bottom: cellBox.bottom },
    { top: paneBox.top, bottom: paneBox.bottom },
    pane.scrollTop,
  )
  pane.scrollTop = next
}
