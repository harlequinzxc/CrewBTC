import type { RectMm } from './imposition'

/**
 * Text the user typed for one cell, keyed by cell + page.
 *
 * Deliberately not derived from the PDF: the old approach parsed the source into
 * blocks and let you edit each one, which was fragile and needed a per-line form.
 * You now paste the wording once per page and it is typeset into two fixed zones.
 *
 * The first line becomes the header; the remaining lines become the footer. One field
 * rather than two because it is pasted as one block, and the split is shown in the UI.
 */
export interface CellText {
  readonly documentId: string
  readonly pageNumber: number
  /** Raw pasted text, newlines preserved. Empty means "no text on this card". */
  readonly text: string
}

/** How a band's text looks. Per band, so the header and footer can differ. */
export interface TextStyle {
  /** Colour as a hex string, e.g. `#111827`. */
  readonly color: string
  /** Highlight behind the text, or null for none. */
  readonly highlight: string | null
}

export const DEFAULT_TEXT_STYLE: TextStyle = { color: '#111827', highlight: null }

/** Swatches offered for colour and highlight: dark ink, and warm markers. */
export const TEXT_SWATCHES = ['#111827', '#b91c1c', '#1d4ed8', '#15803d'] as const
export const HIGHLIGHT_SWATCHES = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fecaca'] as const

/** Artwork transform, in millimetres relative to the picture box. */
export interface ImageTransform {
  readonly offsetXMm: number
  readonly offsetYMm: number
  /** Multiplier on the cover scale. 1 = exactly covers the box, with no white gaps. */
  readonly scale: number
}

export const DEFAULT_IMAGE_TRANSFORM: ImageTransform = {
  offsetXMm: 0,
  offsetYMm: 0,
  scale: 1,
}

export const MIN_IMAGE_SCALE = 0.2
export const MAX_IMAGE_SCALE = 4

/** How a cell is divided vertically. Picture takes whatever the text does not. */
export interface CellBands {
  readonly headerMm: number
  readonly pictureMm: number
  readonly footerMm: number
}

export interface CellZones extends CellBands {
  readonly header: RectMm
  readonly picture: RectMm
  readonly footer: RectMm
}

export const BAND_LIMITS = {
  minHeaderMm: 4,
  maxHeaderMm: 60,
  minFooterMm: 4,
  maxFooterMm: 60,
} as const

/** Sensible starting split: a title line, most of the card for the picture, a footer. */
export function defaultBands(cellHeightMm: number): CellBands {
  const header = Math.min(BAND_LIMITS.maxHeaderMm, Math.max(BAND_LIMITS.minHeaderMm, cellHeightMm * 0.16))
  const footer = Math.min(BAND_LIMITS.maxFooterMm, Math.max(BAND_LIMITS.minFooterMm, cellHeightMm * 0.12))
  // Never let the bands eat the picture: on a tiny cell the text shrinks, not the art.
  const picture = Math.max(cellHeightMm * 0.4, cellHeightMm - header - footer)
  return { headerMm: header, pictureMm: picture, footerMm: footer }
}

/**
 * Splits a cell into header / picture / footer. Always contiguous and top-to-bottom,
 * so there is no unused space: the three bands add up to the cell height exactly.
 */
export function cellZones(cellRect: RectMm, bands: CellBands): CellZones {
  const total = bands.headerMm + bands.pictureMm + bands.footerMm
  // Scale the bands to the cell so a settings change can never leave a gap at the bottom.
  const factor = total > 0 ? cellRect.heightMm / total : 1

  const headerMm = bands.headerMm * factor
  const pictureMm = bands.pictureMm * factor
  const footerMm = cellRect.heightMm - headerMm - pictureMm

  return {
    headerMm,
    pictureMm,
    footerMm,
    header: { xMm: cellRect.xMm, yMm: cellRect.yMm, widthMm: cellRect.widthMm, heightMm: headerMm },
    picture: {
      xMm: cellRect.xMm,
      yMm: cellRect.yMm + headerMm,
      widthMm: cellRect.widthMm,
      heightMm: pictureMm,
    },
    footer: {
      xMm: cellRect.xMm,
      yMm: cellRect.yMm + headerMm + pictureMm,
      widthMm: cellRect.widthMm,
      heightMm: footerMm,
    },
  }
}

export interface TextSplit {
  readonly header: string
  readonly footer: string
}

/** First non-empty line is the header; the rest is the footer. */
export function splitCellText(text: string): TextSplit {
  const lines = text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line, index, all) => line.trim() !== '' || index < all.length - 1)

  const headerIndex = lines.findIndex((line) => line.trim() !== '')
  if (headerIndex === -1) return { header: '', footer: '' }

  const header = (lines[headerIndex] ?? '').trim()
  const footer = lines
    .slice(headerIndex + 1)
    .join('\n')
    .trim()
  return { header, footer }
}

export const textKey = (cellIndex: number, documentId: string, pageNumber: number): string =>
  `${cellIndex}|${documentId}|${pageNumber}`

export function textFor(
  texts: Readonly<Record<string, CellText>>,
  cellIndex: number,
  documentId: string,
  pageNumber: number,
): string {
  return texts[textKey(cellIndex, documentId, pageNumber)]?.text ?? ''
}

/**
 * Where the page image sits inside the picture box, in cell-relative millimetres.
 *
 * `cover` rather than `contain`: the image always fills the box, because a card with
 * white bars down the sides is not what "picture content box" means. Overflow is
 * clipped by whatever draws it — the preview via CSS, the exporter via a real PDF clip.
 */
export function coverRectMm(
  box: RectMm,
  sourceWidthMm: number,
  sourceHeightMm: number,
  transform: ImageTransform,
): { xMm: number; yMm: number; widthMm: number; heightMm: number } | null {
  if (
    !Number.isFinite(sourceWidthMm) ||
    !Number.isFinite(sourceHeightMm) ||
    sourceWidthMm <= 0 ||
    sourceHeightMm <= 0 ||
    box.widthMm <= 0 ||
    box.heightMm <= 0
  ) {
    return null
  }

  const cover = Math.max(box.widthMm / sourceWidthMm, box.heightMm / sourceHeightMm)
  if (!Number.isFinite(cover) || cover <= 0) return null

  const scale = Number.isFinite(transform.scale) && transform.scale > 0 ? transform.scale : 1
  // Centre on the scaled size, not the unscaled one: zooming must grow the picture
  // about the middle of its box, or every zoom step would also shift it up-left.
  const width = sourceWidthMm * cover * scale
  const height = sourceHeightMm * cover * scale

  const baseX = box.xMm + (box.widthMm - width) / 2
  const baseY = box.yMm + (box.heightMm - height) / 2

  return {
    xMm: baseX + transform.offsetXMm,
    yMm: baseY + transform.offsetYMm,
    widthMm: width,
    heightMm: height,
  }
}

export const imageKey = (cellIndex: number, documentId: string, pageNumber: number): string =>
  textKey(cellIndex, documentId, pageNumber)
