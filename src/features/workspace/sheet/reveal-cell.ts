/**
 * Scroll the cell holding a document's first page into view.
 *
 * Clicking a file used to scroll its *sheet* to the top, which is not the same thing: a
 * sheet is twelve cells tall, so the card could end up below the fold on a viewport shorter
 * than the page, and the user still had to hunt for it. The ring said where it was; the
 * window did not show it.
 *
 * Measured from the DOM rather than computed from millimetres: the cells are absolutely
 * positioned inside a transformed, zoomed stack, so their own `offsetTop` already accounts
 * for zoom, the stack gap between sheets, and the canvas padding. Recomputing that here
 * would be a second implementation of the layout, and the two would drift.
 *
 * Centred when it fits, nearest-edge when the cell is taller than the viewport — the same
 * rule a text editor uses for `scrollIntoView({ block: 'nearest' })`, applied to the
 * containing box rather than the window, because the pane scrolls, not the document.
 */
export interface RevealBox {
  readonly top: number
  readonly bottom: number
}

/** Where to set `scrollTop` to bring `cell` into `viewport` comfortably. */
export function revealScrollTop(
  cell: RevealBox,
  viewport: RevealBox,
  scrollTop: number,
  margin = 24,
): number {
  const visible = viewport.bottom - viewport.top
  const height = cell.bottom - cell.top

  // Taller than the pane: align its top rather than centring, or the top of the card ends
  // up above the fold and the text band — the part worth seeing — is what gets cut.
  if (height + margin * 2 > visible) return Math.max(0, scrollTop + cell.top - viewport.top - margin)

  const above = cell.top - viewport.top
  const below = cell.bottom - viewport.bottom
  // Comfortably inside: leave the canvas exactly where it is. Scrolling when the target is
  // already fully visible is what makes a click feel like it did something arbitrary.
  if (above >= margin && below <= -margin) return scrollTop
  const centre = scrollTop + (cell.top + cell.bottom) / 2 - (viewport.top + viewport.bottom) / 2
  return Math.max(0, centre)
}
