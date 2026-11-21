import { planSheets } from '../../../lib/imposition/sheet'
import { toPageRefs } from '../../../lib/pdf/page-refs'
import { cardKey } from '../../../types/card'
import { numberedCards } from '../cards/numbered-cards'
import type { Card } from '../../../types/card'
import type { GridLayout } from '../../../types/imposition'
import type { PageRef } from '../../../lib/imposition/sheet'
import type { IngestedDocument } from '../../../types/document'

/** Stable identity includes station, original placement, file identity and page. */
export interface PrintCandidate {
  readonly id: string
  readonly stationId: string
  readonly stationName: string
  readonly page: PageRef
  readonly card: Card
  readonly sheetIndex: number
  readonly cellIndex: number
}
export interface PrintStation {
  readonly id: string
  readonly name: string
  readonly documents: readonly IngestedDocument[]
  readonly cards: Readonly<Record<string, Card>>
}

/** Resolve propagated labels and numbers before packing, so selection cannot alter them. */
export function printCandidates(stations: readonly PrintStation[], grid: GridLayout, textScale: number): PrintCandidate[] {
  const result: PrintCandidate[] = []
  for (const station of stations) {
    const refs = toPageRefs(station.documents)
    const resolved = numberedCards(station.cards, refs, grid, textScale)
    for (const [sheetIndex, sheet] of planSheets(refs, grid).entries()) {
      for (const placement of sheet.placements) {
        const key = cardKey(placement.cellIndex, placement.documentId, placement.pageNumber)
        const card = resolved[key]
        const page = refs.find((ref) => ref.documentId === placement.documentId && ref.pageNumber === placement.pageNumber)
        if (page === undefined || card === undefined) continue
        result.push({ id: JSON.stringify([station.id, sheetIndex, key]), stationId: station.id, stationName: station.name, page, card, sheetIndex, cellIndex: placement.cellIndex })
      }
    }
  }
  return result
}

/** Synthetic identities avoid collisions between stations and remap cards to packed cells. */
export function packPrintSelection(selected: readonly PrintCandidate[], grid: GridLayout): { pages: PageRef[]; cards: Record<string, Card> } {
  if (grid.isEmpty || grid.cellCount <= 0) return { pages: [], cards: {} }
  const cards: Record<string, Card> = {}
  const pages = selected.map((item, index) => {
    const documentId = `print-${index}`
    const page = { ...item.page, documentId }
    cards[cardKey(index % grid.cellCount, documentId, page.pageNumber)] = item.card
    return page
  })
  return { pages, cards }
}
