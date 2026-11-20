import { planSheets } from '../../lib/imposition/sheet'
import type { PageRef } from '../../lib/imposition/sheet'
import { cardKey, clampTextScale } from '../../types/card'
import type { Card } from '../../types/card'
import type { GridLayout } from '../../types/imposition'

/** Resolve numbering in reading order, across sheet boundaries. Overrides restart the sequence. */
export function numberedCards(
  cards: Readonly<Record<string, Card>>,
  pages: readonly PageRef[],
  grid: GridLayout,
  textScale: number,
): Readonly<Record<string, Card>> {
  const result: Record<string, Card> = { ...cards }
  let number = 1
  for (const plan of planSheets(pages, grid)) {
    for (const placement of plan.placements) {
      const key = cardKey(placement.cellIndex, placement.documentId, placement.pageNumber)
      const card = cards[key]
      if (card?.numberStart !== undefined && Number.isInteger(card.numberStart) && card.numberStart >= 1 && card.numberStart <= 40) number = card.numberStart
      if (card !== undefined) result[key] = { ...card, displayNumber: number, textScale: clampTextScale(textScale) }
      number = number % 40 + 1
    }
  }
  return result
}
