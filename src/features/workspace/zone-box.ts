/**
 * Page-absolute millimetres → card-relative millimetres.
 *
 * `cardZones` returns rectangles in **sheet** coordinates, because the exporter draws
 * onto a page where the origin is the paper's corner. The preview nests the zones
 * inside a `position: relative` card element, so an `absolute` child resolves against
 * the card, not the sheet. Passing sheet coordinates to a child of the card shifts
 * every zone down and right by the card's own offset — which is what pushed the photo
 * out of its cell and over the footer.
 *
 * One conversion, used by every zone, so the two coordinate systems cannot drift.
 */
export interface BoxMm {
  readonly xMm: number
  readonly yMm: number
  readonly widthMm: number
  readonly heightMm: number
}

export function relativeToCard(box: BoxMm, cell: { readonly xMm: number; readonly yMm: number }): BoxMm {
  return {
    xMm: box.xMm - cell.xMm,
    yMm: box.yMm - cell.yMm,
    widthMm: box.widthMm,
    heightMm: box.heightMm,
  }
}
