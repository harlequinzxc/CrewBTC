import { applyToSelection, shiftRuns, styleAt } from '../../../types/text-runs'
import { clampBands } from '../../../types/card'
import type { Card, CardBands, TextRun, TextStyle } from '../../../types/card'

/**
 * The pure edits a card can receive from the editor.
 *
 * Kept away from the component so they can be reasoned about — and tested — without
 * rendering: what happens to a highlight when a word before it is deleted is a question
 * about strings, not about React.
 */

export type Zone = 'header' | 'body'

const runsOf = (card: Card, zone: Zone): readonly TextRun[] =>
  (zone === 'header' ? card.headerRuns : card.bodyRuns) ?? []

const textOf = (card: Card, zone: Zone): string =>
  zone === 'header' ? card.headerText : card.bodyText

const styleOf = (card: Card, zone: Zone): TextStyle =>
  zone === 'header' ? card.headerStyle : card.bodyStyle

/** Applies a style to the whole box. */
export function styleInto(card: Card, zone: Zone, style: TextStyle): Card {
  return zone === 'header' ? { ...card, headerStyle: style } : { ...card, bodyStyle: style }
}

/**
 * Applies a style to just the selected characters.
 *
 * The box style stays as it is and the selection becomes a run that overrides part of it.
 * That is what makes "highlight this word green" possible without turning the whole card
 * green, and it is why the bar reports whether it is acting on a selection or the box.
 */
export function styleSelection(
  card: Card,
  zone: Zone,
  selection: { readonly start: number; readonly end: number },
  style: TextStyle,
): Card {
  const next = applyToSelection(styleOf(card, zone), runsOf(card, zone), selection, {
    bold: style.bold,
    color: style.color,
    highlight: style.highlight,
    ...(style.uppercase === undefined ? {} : { uppercase: style.uppercase }),
    ...(style.align === undefined ? {} : { align: style.align }),
  })
  return zone === 'header' ? { ...card, headerRuns: next } : { ...card, bodyRuns: next }
}

/** The style in force at one offset — what the formatting bar should show as active. */
export function activeStyle(
  card: Card,
  zone: Zone,
  selection: { readonly start: number } | null,
): TextStyle {
  const base = styleOf(card, zone)
  return selection === null ? base : styleAt(base, runsOf(card, zone), selection.start)
}

/**
 * The single span that changed between two versions of a string.
 *
 * A text field reports one edit at a time, so old and new share a prefix and a suffix and
 * what lies between them is the replacement. Recovering it here means runs can be moved
 * without the textarea having to report its edit history.
 */
export function changedSpan(before: string, after: string): { start: number; end: number } {
  const shortest = Math.min(before.length, after.length)
  let start = 0
  while (start < shortest && before[start] === after[start]) start += 1

  let suffix = 0
  while (
    suffix < shortest - start &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1
  }

  return { start, end: before.length - suffix }
}

/**
 * Applies a text edit and carries the runs with it.
 *
 * Without this a highlighted word loses its highlight the moment anything is typed
 * before it, because a run is an offset and offsets move.
 */
export function textInto(card: Card, zone: Zone, text: string): Card {
  const before = textOf(card, zone)
  const { start, end } = changedSpan(before, text)
  const runs = shiftRuns(runsOf(card, zone), start, end, text.length - (before.length - (end - start)), text.length)

  return zone === 'header'
    ? { ...card, headerText: text, headerRuns: runs }
    : { ...card, bodyText: text, bodyRuns: runs }
}

/** Clamp divider changes to keep room for the photo. */
export function bandsInto(card: Card, bands: CardBands, cellHeightMm: number): Card {
  return { ...card, bands: clampBands(bands, cellHeightMm) }
}

/**
 * Gives every card the same band split as one chosen card.
 *
 * "Margins" here are the two band heights — the boundaries between the name, the photo and
 * the steps — not a page margin: they are what a drag on the card's dividers changes, and
 * what has to match for a sheet of cards to look like one set rather than twelve
 * decisions. Applying one card's split to the others is the tedious part of that.
 *
 * Each card is clamped against **its own** height, because cards on the same sheet are all
 * the same height but a card can be seeded for a different cell, and a split that fits one
 * card can exceed another's minimum photo. Clamping per card keeps the invariant that
 * every card keeps a photo band instead of inheriting one that does not fit.
 */
export function matchBandsInto(
  cards: Readonly<Record<string, Card>>,
  source: CardBands,
  cellHeightMm: number,
): Readonly<Record<string, Card>> {
  const next: Record<string, Card> = {}
  for (const [key, card] of Object.entries(cards)) {
    next[key] = { ...card, bands: clampBands(source, cellHeightMm) }
  }
  return next
}
