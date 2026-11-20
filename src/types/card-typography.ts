import { ptToMm } from '../lib/units'

/** Shared nominal type size and line pitch for all four text areas on a card. */
export const CARD_TEXT_PT = 9
export const CARD_LINE_HEIGHT = 1.25
export const CARD_FONT_STACK = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'

/** A single line with breathing room above and below, in sheet millimetres. */
export function cornerHeightMm(textScale: number): number {
  return ptToMm(CARD_TEXT_PT * textScale * CARD_LINE_HEIGHT) + 1.6
}
