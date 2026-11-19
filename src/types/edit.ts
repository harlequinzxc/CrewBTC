import type { NormalisedBox } from './template'
import type { CellSlot } from './imposition'

/**
 * Editable overrides for one source page as it appears in one cell.
 *
 * Keyed by cell *and* page rather than by page alone: the same page can legitimately
 * sit in two cells with different edits — a duplicated card with one line changed is
 * a normal print job, not an edge case.
 */
export interface PageEdit {
  readonly documentId: string
  readonly pageNumber: number
  /** Full-page image transform, in cell-relative millimetres. */
  readonly image: ImageTransform
  /** Per-block overrides, keyed by the block id the extractor assigned. */
  readonly text: Readonly<Record<string, string>>
}

/** Offsets are cell-relative and allowed to be negative: moving artwork is not cropping. */
export interface ImageTransform {
  readonly offsetXMm: number
  readonly offsetYMm: number
  /** Multiplier on the fit scale. 1 = exactly the contained size. */
  readonly scale: number
}

export const DEFAULT_IMAGE_TRANSFORM: ImageTransform = {
  offsetXMm: 0,
  offsetYMm: 0,
  scale: 1,
}

export const MIN_IMAGE_SCALE = 0.2
export const MAX_IMAGE_SCALE = 3

/** Cell-relative box for a text block, in millimetres. */
export interface TextBoxMm {
  readonly xMm: number
  readonly yMm: number
  readonly widthMm: number
  readonly heightMm: number
}

export type EditTarget =
  | {
      readonly kind: 'text'
      readonly cellIndex: number
      readonly blockId: string
      readonly documentId: string
      readonly pageNumber: number
    }
  | {
      readonly kind: 'image'
      readonly cellIndex: number
      readonly documentId: string
      readonly pageNumber: number
    }

/**
 * Where the page sits inside the cell, in cell-relative millimetres, after the user's
 * transform. Both the preview and the exporter call this, so they cannot disagree.
 */
export function fittedRectMm(
  cell: CellSlot,
  sourceWidthMm: number,
  sourceHeightMm: number,
  transform: ImageTransform,
): { xMm: number; yMm: number; widthMm: number; heightMm: number } | null {
  if (
    !Number.isFinite(sourceWidthMm) ||
    !Number.isFinite(sourceHeightMm) ||
    sourceWidthMm <= 0 ||
    sourceHeightMm <= 0
  ) {
    return null
  }

  const cellWidth = cell.rect.widthMm
  const cellHeight = cell.rect.heightMm
  const fit = Math.min(cellWidth / sourceWidthMm, cellHeight / sourceHeightMm)
  if (!Number.isFinite(fit) || fit <= 0) return null

  const scale = Number.isFinite(transform.scale) && transform.scale > 0 ? transform.scale : 1
  const width = sourceWidthMm * fit * scale
  const height = sourceHeightMm * fit * scale
  const centredX = (cellWidth - sourceWidthMm * fit) / 2
  const centredY = (cellHeight - sourceHeightMm * fit) / 2

  return {
    xMm: centredX + transform.offsetXMm,
    yMm: centredY + transform.offsetYMm,
    widthMm: width,
    heightMm: height,
  }
}

/**
 * Maps a normalised block box (source page space) into cell-relative millimetres,
 * using the same rect the artwork is drawn at. Text therefore tracks the artwork when
 * the image is moved or scaled, which is what "what you see is what prints" requires.
 */
export function blockToCellMm(
  block: NormalisedBox,
  artwork: { xMm: number; yMm: number; widthMm: number; heightMm: number },
): TextBoxMm {
  return {
    xMm: artwork.xMm + block.x * artwork.widthMm,
    yMm: artwork.yMm + block.y * artwork.heightMm,
    widthMm: block.width * artwork.widthMm,
    heightMm: block.height * artwork.heightMm,
  }
}

/** Identity of an edit: one cell, one source page. */
export const editKey = (cellIndex: number, documentId: string, pageNumber: number): string =>
  `${cellIndex}|${documentId}|${pageNumber}`

/** Edits for a page on this cell, falling back to defaults when untouched. */
export function editFor(
  edits: Readonly<Record<string, PageEdit>>,
  cellIndex: number,
  documentId: string,
  pageNumber: number,
): PageEdit {
  return (
    edits[editKey(cellIndex, documentId, pageNumber)] ?? {
      documentId,
      pageNumber,
      image: DEFAULT_IMAGE_TRANSFORM,
      text: {},
    }
  )
}

/** True when the user has changed anything at all on this cell. */
export function isEdited(edit: PageEdit): boolean {
  return (
    edit.image.offsetXMm !== 0 ||
    edit.image.offsetYMm !== 0 ||
    edit.image.scale !== 1 ||
    Object.keys(edit.text).length > 0
  )
}
