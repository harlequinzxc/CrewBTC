/**
 * The stack of sheets, as geometry.
 *
 * Sheets are not one scroll container each; they are one tall column, and these are the
 * numbers that lay it out and answer "which sheet is on screen". Kept pure so the
 * arithmetic can be tested without a browser — jsdom has no layout, and the whole point of
 * the stack is that scrolling and the thumbnails agree about where each sheet is.
 */

/** Space between two sheets in the stack, in CSS pixels. */
export const SHEET_GAP = 24

export interface SheetOffset {
  /** Distance from the top of the stack to this sheet's top, in CSS pixels. */
  readonly top: number
  readonly height: number
}

/** Where each sheet sits in the column. */
export function sheetOffsets(
  sheetCount: number,
  sheetHeightMm: number,
  scale: number,
): readonly SheetOffset[] {
  const height = sheetHeightMm * scale
  return Array.from({ length: Math.max(0, sheetCount) }, (_, index) => ({
    top: index * (height + SHEET_GAP),
    height,
  }))
}

/**
 * Which sheet the viewport is looking at.
 *
 * A sheet becomes current once its top passes a third of the way down the viewport: a
 * sheet has to be meaningfully on screen, not merely have begun to appear, or the
 * highlight flickers between two sheets at the boundary. The *last* sheet whose top is
 * above the probe wins — which is the same thing as "the sheet you are reading", given the
 * column runs top to bottom.
 */
export function activeSheetAt(
  scrollTop: number,
  viewportHeight: number,
  offsets: readonly SheetOffset[],
): number {
  if (offsets.length === 0) return 0
  const probe = scrollTop + viewportHeight / 3
  let active = 0
  for (let index = 0; index < offsets.length; index += 1) {
    const entry = offsets[index]
    if (entry !== undefined && entry.top <= probe) active = index
  }
  return active
}

/** The scroll position that puts a sheet's top at the top of the viewport. */
export function scrollTopForSheet(offsets: readonly SheetOffset[], index: number): number {
  const entry = offsets[Math.min(Math.max(0, index), Math.max(0, offsets.length - 1))]
  return entry === undefined ? 0 : entry.top
}
