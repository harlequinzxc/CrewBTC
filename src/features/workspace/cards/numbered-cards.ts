import { planSheets } from '../../../lib/imposition/sheet'
import type { PageRef } from '../../../lib/imposition/sheet'
import { cardKey, clampTextScale } from '../../../types/card'
import type { Card } from '../../../types/card'
import type { GridLayout } from '../../../types/imposition'

/** Resolve numbering and label restarts in reading order, across sheet boundaries. */
export function numberedCards(
  cards: Readonly<Record<string, Card>>,
  pages: readonly PageRef[],
  grid: GridLayout,
  textScale: number,
): Readonly<Record<string, Card>> {
  const result: Record<string, Card> = { ...cards }
  let number = 1
  const plans = planSheets(pages, grid)
  let label = ''
  let isFirst = true
  for (const plan of plans) {
    for (const placement of plan.placements) {
      const key = cardKey(placement.cellIndex, placement.documentId, placement.pageNumber)
      const card = cards[key]
      if (card?.cornerLabelStart !== undefined) label = card.cornerLabelStart
      else if (isFirst) label = card?.cornerLabel ?? ''
      isFirst = false
      if (card?.numberStart !== undefined && Number.isInteger(card.numberStart) && card.numberStart >= 1 && card.numberStart <= 40) number = card.numberStart
      if (card !== undefined) result[key] = { ...card, displayNumber: number, displayCornerLabel: label, textScale: clampTextScale(textScale) }
      number = number % 40 + 1
    }
  }
  return result
}

/** Do not snapshot values derived from the current placement order. */
export function cardForStorage(card: Card): Card {
  const { displayNumber, displayCornerLabel, cornerLabelMirrored, ...stored } = card
  void displayNumber; void displayCornerLabel; void cornerLabelMirrored
  return stored
}
