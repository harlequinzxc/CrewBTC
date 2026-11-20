import { CARD_FONT_STACK, CARD_LINE_HEIGHT } from '../../types/card-typography'
import { layoutStyledBand } from '../../lib/export/styled-band'
import type { StyledBandLayout } from '../../lib/export/styled-band'
import type { TextStyle, TextRun } from '../../types/card'

/**
 * The typesetting half of a card's text box.
 *
 * It lives apart from the component for the same reason the exporter does: half of it is
 * one measurement. `layoutStyledBand` decides where every line breaks, at what size, and
 * how wide each line drew; the preview's only job is to turn those millimetres into pixels.
 * Keeping that arithmetic out of the JSX is what made room for the alignment and capital
 * support without the component growing past its line budget.
 */

/** Points to millimetres — the one conversion this file needs. */
export const PT_TO_MM = 25.4 / 72

/** Line pitch, matching the exporter so a break lands on the same line in both. */
export const LINE_HEIGHT = CARD_LINE_HEIGHT
/** The exporter's band padding (`PADDING_MM` in `draw-card`). Previews must match it. */
export const PADDING_MM = 0.8

/**
 * The ink an empty box's hint is drawn in.
 *
 * Shared with the field's `::placeholder` rule in `CardZoneText`, so the hint does not
 * change colour when the caret arrives — the browser's default placeholder ink is the
 * field's own colour at half alpha, which is a different grey from this one.
 */
export const PLACEHOLDER_INK = '#9ca3af'

/**
 * Real glyph widths, measured once with a canvas.
 *
 * This used to be `text.length * sizePt * 0.5` — an estimate of half an em per character.
 * It was good enough to break a line in roughly the right place, and it was *not* good
 * enough to centre a line: the estimate for "Dish code · Dish name" is 132px where the
 * browser draws 157px, so the drawn box placed its text 12.6px left of where the textarea
 * put it — visible as the text jumping sideways the moment the box was clicked.
 *
 * A single reused 2D context is the browser's own metrics engine, so the preview now
 * measures with the same numbers the textarea uses. The measurement is in the same units
 * the layout wants — millimetres on the sheet — because `scale` divides it back out.
 */
let metrics: CanvasRenderingContext2D | null = null
const contextFor = (): CanvasRenderingContext2D | null => {
  if (metrics !== null) return metrics
  if (typeof document === 'undefined') return null
  metrics = document.createElement('canvas').getContext('2d')
  return metrics
}

/** Width of `text` at `sizePt`, in millimetres of sheet. */
const measureAt = (text: string, sizePt: number, bold: boolean, scale: number): number => {
  const context = contextFor()
  // Canvas sizes are CSS pixels, and the sheet is `scale` pixels per millimetre, so a
  // point is `PT_TO_MM * scale` pixels wide on this canvas.
  const sizePx = sizePt * PT_TO_MM * scale
  if (context === null) return text.length * sizePx * 0.5
  context.font = `${bold ? '700' : '400'} ${sizePx}px ${CARD_FONT_STACK}`
  return context.measureText(text).width / scale
}

export interface ZoneLayoutInput {
  readonly text: string
  readonly placeholder: string
  readonly style: TextStyle
  readonly runs: readonly TextRun[]
  readonly widthMm: number
  readonly heightMm: number
  readonly maxPt: number
  readonly textScale: number
  /**
   * Whether a block shorter than its box is pushed to the middle.
   *
   * The name box centres vertically because it is a heading with nothing under it; the
   * steps box does not, because a printed step list should begin where a reader's eye
   * expects it to — at the top. Space left over belongs below the words.
   */
  readonly centreVertically: boolean
}

/** A laid-out box, already converted to the pixels the preview draws in. */
export interface ZoneLayout {
  readonly layout: StyledBandLayout
  readonly fontSize: number
  readonly lineHeight: number
  /** Where a line's top edge sits, in pixels from the box's top. */
  readonly positionPx: (line: StyledBandLayout['lines'][number]) => string
  /** Where a line's first glyph starts, in pixels from the box's left edge. */
  readonly leftPx: (line: StyledBandLayout['lines'][number]) => string
  /** True when the box draws its text in capitals. */
  readonly caps: boolean
  /**
   * How far a centred block is pushed down inside its band, in pixels. Zero for a band
   * pinned to the top.
   *
   * Only the *division* of spare height: the rest of the field's inset comes from
   * `textTopPx`, which is where the drawn line actually starts.
   */
  readonly centrePx: number
  /**
   * Where the drawn first line's box starts, measured from the band's top.
   *
   * This — not the padding — is what the field must reproduce. Both boxes set the same
   * font at the same line height, so if their first line *boxes* start at the same offset
   * their glyphs must too, whatever the browser does with the leading inside. Deriving it
   * from the padding instead left a pixel of drift that no amount of half-leading
   * arithmetic closed, because the two elements' line boxes are not built identically.
   */
  readonly textTopPx: number
}

export function layoutZone(input: ZoneLayoutInput, scale: number): ZoneLayout {
  const { text, style } = input
  const empty = text === ''
  // A placeholder is a hint, not content: it never takes the box's ink or highlight, but
  // it does take its weight, alignment and capitals, because it sits exactly where the
  // first typed character will land.
  const shown = empty ? input.placeholder : text

  const layout = layoutStyledBand(
    {
      text: shown,
      base: {
        text: '',
        bold: style.bold,
        color: empty ? PLACEHOLDER_INK : style.color,
        highlight: empty ? null : style.highlight,
        ...(style.uppercase === undefined ? {} : { uppercase: style.uppercase }),
        ...(style.align === undefined ? {} : { align: style.align }),
      },
      runs: empty ? [] : input.runs,
    },
    0,
    input.widthMm,
    input.heightMm,
    input.maxPt * input.textScale,
    LINE_HEIGHT,
    (candidate, sizePt, bold) => measureAt(candidate, sizePt, bold, scale),
  )

  const fontSize = Math.max(0, layout.sizePt * scale * PT_TO_MM)
  const lineHeight = fontSize * LINE_HEIGHT

  /*
    A block shorter than its box may be centred in it, or pinned to the top. Never
    negative: a block that overflows gets no offset rather than being lifted until it
    covers the card above it. The box clips it, which is the backstop, not the plan.
  */
  const blockMm = layout.lines.length * layout.sizePt * LINE_HEIGHT * PT_TO_MM
  const innerMm = Math.max(0, input.heightMm - PADDING_MM * 2)
  const centreMm = input.centreVertically ? Math.max(0, innerMm - blockMm) / 2 : 0

  return {
    layout,
    fontSize,
    lineHeight,
    // `yMm` is the baseline and already carries the band's padding, so only the ascent
    // comes off it. Placing lines on the band's own rhythm keeps the drawn block no taller
    // than the block that was measured to fit.
    positionPx: (line) =>
      `${(line.yMm - layout.sizePt * LINE_HEIGHT * PT_TO_MM + centreMm) * scale}px`,
    // The left edge as the layout measured it: the plain padding for a left line, the
    // half-slack for a centred one.
    leftPx: (line) => `${line.xMm * scale}px`,
    caps: style.uppercase === true,
    centrePx: centreMm * scale,
    textTopPx:
      (layout.lines[0] === undefined
        ? PADDING_MM + centreMm
        : layout.lines[0].yMm -
          layout.sizePt * LINE_HEIGHT * PT_TO_MM +
          centreMm) * scale,
  }
}
