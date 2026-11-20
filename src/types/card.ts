/**
 * The card, and everything a card owns.
 *
 * A card is three stacked zones: text, photo, text. The zones are *content*, not sheet
 * settings — every card can hold its own header height, its own photo framing, its own
 * type styles — so two dishes on one sheet can be laid out differently.
 */

/** How a run of card text is drawn. One style per zone, applied to all its words. */
export interface TextStyle {
  readonly bold: boolean
  /** Ink colour, `#rrggbb`. */
  readonly color: string
  /** Highlighter behind the words, or null for none. */
  readonly highlight: string | null
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  bold: false,
  color: '#111827',
  highlight: null,
}

/** The style a card's instruction box starts with: red ink, as a recipe step reads. */
export const DEFAULT_BODY_STYLE: TextStyle = {
  bold: false,
  color: '#b91c1c',
  highlight: null,
}

export const TEXT_COLORS = ['#111827', '#b91c1c', '#15803d', '#1d4ed8'] as const
export const HIGHLIGHT_COLORS = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fecaca'] as const

/** An extracted dish photo with the pixel shape it must be drawn at. */
export interface PhotoSource {
  readonly dataUrl: string
  readonly widthPx: number
  readonly heightPx: number
}

/** How the photo sits inside its bounded box. */
export interface ImageTransform {
  readonly offsetXMm: number
  readonly offsetYMm: number
  readonly scale: number
}

export const DEFAULT_IMAGE_TRANSFORM: ImageTransform = {
  offsetXMm: 0,
  offsetYMm: 0,
  scale: 1,
}

/** Breathing room between the photo and its box edge, in millimetres. */
export const IMAGE_INSET_MM = 0.8
export const MIN_IMAGE_SCALE = 0.2
export const MAX_IMAGE_SCALE = 4

/** Where the photo sits by default: centred, fitted. */
export const containsImage = (transform: ImageTransform): boolean =>
  transform.scale === 1 && transform.offsetXMm === 0 && transform.offsetYMm === 0

/**
 * A card's three zones.
 *
 * `headerMm` and `footerMm` are the two text boxes; the photo takes whatever height is
 * left over. Only two numbers need tuning, and they can never overlap.
 */
export interface CardBands {
  readonly headerMm: number
  readonly footerMm: number
}

/** Bands are tuned by hand, so they are clamped to something that still leaves a photo. */
export const BAND_MIN_MM = 6
/** The photo never gets less than this, so a card cannot become two text boxes. */
export const PICTURE_MIN_MM = 12

/** The bands a card starts with, for a cell of this height. */
export function defaultBands(cellHeightMm: number): CardBands {
  // Roughly the old 13 / 20 split, scaled to however tall the cell actually is.
  const headerMm = Math.max(BAND_MIN_MM, Math.round(cellHeightMm * 0.145))
  const footerMm = Math.max(BAND_MIN_MM, Math.round(cellHeightMm * 0.22))
  return { headerMm, footerMm }
}

/** Keeps two hand-tuned bands inside the card, apart from each other. */
export function clampBands(bands: CardBands, cellHeightMm: number): CardBands {
  const ceiling = Math.max(BAND_MIN_MM, cellHeightMm - PICTURE_MIN_MM)
  const headerMm = Math.min(Math.max(bands.headerMm, BAND_MIN_MM), ceiling)
  const footerCeiling = Math.max(BAND_MIN_MM, ceiling - headerMm)
  const footerMm = Math.min(Math.max(bands.footerMm, BAND_MIN_MM), footerCeiling)
  return { headerMm, footerMm }
}

export interface RectMm {
  readonly xMm: number
  readonly yMm: number
  readonly widthMm: number
  readonly heightMm: number
}

export interface CardZones {
  readonly header: RectMm
  readonly picture: RectMm
  readonly footer: RectMm
}

/**
 * Splits a cell into its three stacked zones, top to bottom.
 *
 * Pure arithmetic on purpose: the preview and the exporter both call this, so a card
 * cannot look one way on screen and print another. The picture takes the remainder, so
 * the three zones always tile the cell exactly — no gaps, no overlap.
 */
export function cardZones(cell: RectMm, bands: CardBands): CardZones {
  const headerMm = Math.max(0, bands.headerMm)
  const footerMm = Math.max(0, bands.footerMm)
  const pictureMm = Math.max(0, cell.heightMm - headerMm - footerMm)

  return {
    header: { xMm: cell.xMm, yMm: cell.yMm, widthMm: cell.widthMm, heightMm: headerMm },
    picture: {
      xMm: cell.xMm,
      yMm: cell.yMm + headerMm,
      widthMm: cell.widthMm,
      heightMm: pictureMm,
    },
    footer: {
      xMm: cell.xMm,
      yMm: cell.yMm + headerMm + pictureMm,
      widthMm: cell.widthMm,
      heightMm: footerMm,
    },
  }
}

/**
 * The rectangle a photo is actually drawn at: fitted to the box, then zoomed, centred,
 * and finally offset by however far the user has dragged it.
 *
 * Fit, never cover: the scale comes from the photo's own pixels, so a dish keeps its
 * shape whatever shape the box happens to be. Returns null for a photo or box with no
 * area, so callers can say "nothing to draw" instead of drawing a zero.
 */
export function containRectMm(
  box: RectMm,
  photoWidthPx: number,
  photoHeightPx: number,
  transform: ImageTransform = DEFAULT_IMAGE_TRANSFORM,
  insetMm: number = IMAGE_INSET_MM,
): RectMm | null {
  if (
    box.widthMm <= 0 ||
    box.heightMm <= 0 ||
    photoWidthPx <= 0 ||
    photoHeightPx <= 0
  ) {
    return null
  }

  // A negative inset would push the photo outside its own box.
  const inset = Math.max(0, Math.min(insetMm, box.widthMm / 2, box.heightMm / 2))
  const roomWidth = Math.max(0.001, box.widthMm - inset * 2)
  const roomHeight = Math.max(0.001, box.heightMm - inset * 2)

  const fit = Math.min(roomWidth / photoWidthPx, roomHeight / photoHeightPx)
  const scale = Math.min(MAX_IMAGE_SCALE, Math.max(MIN_IMAGE_SCALE, transform.scale))

  const widthMm = photoWidthPx * fit * scale
  const heightMm = photoHeightPx * fit * scale

  // Centred on the *scaled* size, so zoom grows about the middle of the box rather
  // than pinning one corner.
  const xMm = box.xMm + (box.widthMm - widthMm) / 2 + transform.offsetXMm
  const yMm = box.yMm + (box.heightMm - heightMm) / 2 + transform.offsetYMm

  return { xMm, yMm, widthMm, heightMm }
}

/** The largest `widthPx:heightPx` rectangle that fits a box. Never stretched. */
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

/** Everything one cell shows. */
export interface Card {
  readonly headerText: string
  readonly bodyText: string
  readonly photo: PhotoSource | null
  readonly headerStyle: TextStyle
  readonly bodyStyle: TextStyle
  readonly imageTransform: ImageTransform
  readonly bands: CardBands
}

/** A card as it is born from one PDF page. */
export function cardFromPage(
  scan: {
    readonly photo: PhotoSource | null
    readonly headerText: string
    readonly bodyText: string
  },
  cellHeightMm: number,
): Card {
  return {
    headerText: scan.headerText,
    bodyText: scan.bodyText,
    photo: scan.photo,
    headerStyle: DEFAULT_TEXT_STYLE,
    bodyStyle: DEFAULT_BODY_STYLE,
    imageTransform: DEFAULT_IMAGE_TRANSFORM,
    bands: defaultBands(cellHeightMm),
  }
}

/** Cards are keyed by position, document and page, so a re-upload finds its own card. */
export const cardKey = (cellIndex: number, documentId: string, pageNumber: number): string =>
  `${cellIndex}|${documentId}|${pageNumber}`
