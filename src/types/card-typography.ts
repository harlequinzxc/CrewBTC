import { ptToMm } from '../lib/units'

/** Shared nominal type size and line pitch for all four text areas on a card. */
export const DEFAULT_TEXT_SCALE = 0.9
export const CARD_TEXT_PT = 9
export const CARD_LINE_HEIGHT = 1.25
export const CARD_FONT_STACK = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'

/** A single line with breathing room above and below, in sheet millimetres. */
export function cornerHeightMm(textScale: number): number {
  return ptToMm(CARD_TEXT_PT * textScale * CARD_LINE_HEIGHT) + 1.6
}

/** Print uses 0.4 mm less padding on each side of the line. */
export function printedCornerHeightMm(textScale: number): number {
  return cornerHeightMm(textScale) - 0.8
}
