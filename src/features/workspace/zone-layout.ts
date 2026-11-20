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
export const LINE_HEIGHT = 1.25
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

/** Approximate width of a character at a given size, used for on-screen wrapping only. */
const measure = (text: string, sizePt: number): number => text.length * sizePt * 0.5 * PT_TO_MM

export interface ZoneLayoutInput {
  readonly text: string
  readonly placeholder: string
  readonly style: TextStyle
  readonly runs: readonly TextRun[]
  readonly widthMm: number
  readonly heightMm: number
  readonly maxPt: number
  readonly textScale: number
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
    (candidate, sizePt, bold) => (bold ? measure(candidate, sizePt) * 1.06 : measure(candidate, sizePt)),
  )

  const fontSize = Math.max(0, layout.sizePt * scale * PT_TO_MM)
  const lineHeight = fontSize * LINE_HEIGHT

  /*
    A block shorter than its band is centred in it rather than pinned to the top. Text is
    drawn at the largest size that fits, so a zone taller than it needs is a zone with room
    to spare — dividing that room either side is what makes a hand-tuned tall band look
    deliberate instead of leaving one conspicuous gap under the words.

    Never negative: a block that overflows gets no offset rather than being lifted until it
    covers the card above it. The box clips it, which is the backstop, not the plan.
  */
  const blockMm = layout.lines.length * layout.sizePt * LINE_HEIGHT * PT_TO_MM
  const innerMm = Math.max(0, input.heightMm - PADDING_MM * 2)
  const centreMm = Math.max(0, innerMm - blockMm) / 2

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
  }
}
