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
  /**
   * Multiplier on the fitted size. 1 fits the photo inside its box with margin to spare;
   * above 1 it grows until it can overflow, which the box then clips.
   */
  readonly scale: number
}

/**
 * One extracted photo: the pixels, and how big they are.
 *
 * The dimensions are not decoration. Without them the box has to be sized from the PDF
 * page instead, which draws a 360x300 photo at a 420x595 ratio and squashes it — that was
 * the stretching.
 */
export interface PhotoSource {
  readonly dataUrl: string
  readonly widthPx: number
  readonly heightPx: number
}

/** How much clear space "fitted" leaves inside the picture box, per side. */
export const IMAGE_INSET_MM = 0.8

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
/**
 * Where a photo sits inside its picture box, at its own aspect ratio.
 *
 * Two different sources, one rule: the photo never stretches. `widthPx`/`heightPx` give
 * its true shape, and the drawn rectangle keeps that shape whatever the box is.
 *
 * Fit, not cover: at scale 1 the whole photo sits centred with `insetMm` of clear space on
 * every side, so a dish is never cropped by default. Zooming past 1 grows it evenly about
 * the middle until it overflows, and the box clips the overflow.
 */
export function containRectMm(
  box: RectMm,
  photoWidthPx: number,
  photoHeightPx: number,
  transform: ImageTransform,
  insetMm = IMAGE_INSET_MM,
): { xMm: number; yMm: number; widthMm: number; heightMm: number } | null {
  if (
    !Number.isFinite(photoWidthPx) ||
    !Number.isFinite(photoHeightPx) ||
    photoWidthPx <= 0 ||
    photoHeightPx <= 0 ||
    box.widthMm <= 0 ||
    box.heightMm <= 0
  ) {
    return null
  }

  // Padding shrinks the fitting area, and is clamped so a tiny box still holds an image.
  const inset = Math.max(0, Math.min(insetMm, box.widthMm / 4, box.heightMm / 4))
  const availableWidth = Math.max(0.1, box.widthMm - inset * 2)
  const availableHeight = Math.max(0.1, box.heightMm - inset * 2)

  const fit = Math.min(availableWidth / photoWidthPx, availableHeight / photoHeightPx)
  if (!Number.isFinite(fit) || fit <= 0) return null

  const scale = Number.isFinite(transform.scale) && transform.scale > 0 ? transform.scale : 1

  // Centre on the *scaled* size, so a zoom grows about the photograph's middle rather
  // than dragging it into a corner.
  const width = photoWidthPx * fit * scale
  const height = photoHeightPx * fit * scale

  return {
    xMm: box.xMm + (box.widthMm - width) / 2 + transform.offsetXMm,
    yMm: box.yMm + (box.heightMm - height) / 2 + transform.offsetYMm,
    widthMm: width,
    heightMm: height,
  }
}

export const imageKey = (cellIndex: number, documentId: string, pageNumber: number): string =>
  textKey(cellIndex, documentId, pageNumber)

/**
 * The largest rectangle of `widthPx:heightPx` that fits in a box, never stretched.
 *
 * The fallback for a photo whose pixel size was not recorded: the card still has to
 * show it, and the shape must come from the image rather than from the box.
 */
export function fitInsideMm(
  boxWidthMm: number,
  boxHeightMm: number,
  widthPx: number,
  heightPx: number,
): { widthMm: number; heightMm: number } {
  if (widthPx <= 0 || heightPx <= 0) return { widthMm: boxWidthMm, heightMm: boxHeightMm }
  const factor = Math.min(boxWidthMm / widthPx, boxHeightMm / heightPx)
  return { widthMm: widthPx * factor, heightMm: heightPx * factor }
}
