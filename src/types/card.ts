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
  /** Drawn in capitals without altering the stored text. Absent means off. */
  readonly uppercase?: boolean
  /** `left` (default) or `centre`d within the box's width. Absent means left. */
  readonly align?: 'left' | 'center'
}
/**
 * The look every card's text starts with: **bold black**, top text **centred**.
 *
 * It used to be plain black on top and plain red below, which described the PDF's
 * typography rather than the card a cook reads. Only the top box is centred: dish names
 * are headings, and centring the steps as well lets a long instruction wrap raggedly on
 * both sides.
 */
export const DEFAULT_TEXT_STYLE: TextStyle = {
  bold: true,
  color: '#111827',
  highlight: null,
}

/** The style a card's instruction box starts with: bold black, flush left. */
export const DEFAULT_BODY_STYLE: TextStyle = {
  bold: true,
  color: '#111827',
  highlight: null,
}

/** The style a card's *name* box starts with: bold black, centred. */
export const DEFAULT_HEADER_STYLE: TextStyle = {
  bold: true,
  color: '#111827',
  highlight: null,
  align: 'center',
}

export const TEXT_COLORS = ['#111827', '#b91c1c', '#15803d', '#1d4ed8'] as const
export const HIGHLIGHT_COLORS = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fecaca'] as const
/** Extra highlight inks that read as pen marks on a printed card. */
export const REFERENCE_HIGHLIGHTS = {
  red: '#fca5a5',
  green: '#86efac',
  amber: '#fde68a',
} as const

import type { TextRun } from './text-runs'
export { containRectMm, fitInsideMm } from './photo-rect'
export { MAX_TEXT_SCALE, MIN_TEXT_SCALE, clampTextScale } from './text-runs'

export type { TextRun } from './text-runs'

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

/**
 * Keeps two hand-tuned bands inside the card and apart from each other.
 *
 * The invariant is that the three zones always tile the cell with a photo at least
 * `PICTURE_MIN_MM` tall between them. The obvious implementation clamps the header and
 * then clamps the footer to whatever is left — which quietly breaks the invariant, because
 * the footer's own minimum can still land on the photo's share. With a cell of 67 mm and
 * the defaults that produced a 6 mm photo instead of 12, on 7,130 of the possible
 * header/footer pairs.
 *
 * So the pair is treated as a budget: the two bands together get whatever the photo does
 * not take, the header gets its share first, and the footer gets the remainder. Any
 * request that cannot be honoured proportionally is scaled down rather than clipped, which
 * keeps the picture at its minimum instead of stealing from it.
 */
export function clampBands(bands: CardBands, cellHeightMm: number): CardBands {
  const min = BAND_MIN_MM
  // A cell too small for both minimums still has to yield something drawable.
  const budget = Math.max(min * 2, cellHeightMm - PICTURE_MIN_MM)

  const header = Math.max(min, Number.isFinite(bands.headerMm) ? bands.headerMm : min)
  const footer = Math.max(min, Number.isFinite(bands.footerMm) ? bands.footerMm : min)

  // Room the two bands have to share once each minimum is honoured.
  const spare = Math.max(0, budget - min * 2)
  const wanted = header - min + (footer - min)
  if (wanted <= spare || wanted <= 0) {
    return { headerMm: header, footerMm: footer }
  }

  // Both want more than exists: split what is left in proportion to what each asked for.
  // The header is rounded *up* and the footer takes the exact remainder, so rounding can
  // never eat into the photo's minimum by a hundredth of a millimetre.
  const share = spare / wanted
  const headerMm = Math.min(budget - min, Math.ceil((min + (header - min) * share) * 100) / 100)
  const footerMm = Math.max(min, Math.floor((budget - headerMm) * 100) / 100)
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
/** Everything one cell shows. */
export interface Card {
  /** Optional numbering restart and editable corner label. */
  readonly numberStart?: number
  readonly cornerLabel?: string
  /** Resolved in sheet order; not a numbering restart. */
  readonly displayNumber?: number
  readonly headerText: string
  readonly bodyText: string
  /** Selection-level styling, empty when the whole box shares one style. */
  readonly headerRuns?: readonly TextRun[]
  readonly bodyRuns?: readonly TextRun[]
  readonly photo: PhotoSource | null
  readonly headerStyle: TextStyle
  readonly bodyStyle: TextStyle
  readonly imageTransform: ImageTransform
  readonly bands: CardBands
  /** Type size multiplier; 1 is as measured by `layoutBand`. Absent means 1. */
  readonly textScale?: number
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
    headerRuns: [],
    bodyRuns: [],
    photo: scan.photo,
    headerStyle: DEFAULT_HEADER_STYLE,
    bodyStyle: DEFAULT_BODY_STYLE,
    imageTransform: DEFAULT_IMAGE_TRANSFORM,
    bands: defaultBands(cellHeightMm),
    textScale: 1,
  }
}

/**
 * A card's identity: the cell it sits in, the file, and the page of that file.
 *
 * The cell is the *drawing* cell index, and every reader must agree on that — the canvas,
 * the exporter, the strip and the inspector all key off `placement.cellIndex`. A page's
 * ordinal in the flattened list works for the first sheet and breaks every sheet after it.
 */
export const cardKey = (cellIndex: number, documentId: string, pageNumber: number): string =>
  `${cellIndex}|${documentId}|${pageNumber}`
