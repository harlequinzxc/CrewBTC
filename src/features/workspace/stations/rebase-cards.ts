import { planSheets } from '../../../lib/imposition/sheet'
import { toPageRefs } from '../../../lib/pdf/page-refs'
import { cardKey } from '../../../types/card'
import type { GridLayout } from '../../../types/imposition'
import type { IngestedDocument } from '../../../types/document'
import type { StationWorkspace } from '../../../types/station'

/** Move card keys when a changed grid moves pages to different cell indices. */
export function rebaseStationCards(station: StationWorkspace, oldGrid: GridLayout, newGrid: GridLayout): StationWorkspace {
  if (oldGrid.isEmpty || newGrid.isEmpty || oldGrid.cellCount === newGrid.cellCount) return station
  return remapStationCards(station, station.documents, oldGrid, newGrid)
}

/** Includes or excludes PDF pages without discarding their stored edits. */
export function remapStationCards(station: StationWorkspace, documents: readonly IngestedDocument[], oldGrid: GridLayout, newGrid: GridLayout): StationWorkspace {
  const before = planSheets(toPageRefs(station.documents), oldGrid).flatMap((sheet) => sheet.placements)
  const after = planSheets(toPageRefs(documents), newGrid).flatMap((sheet) => sheet.placements)
  const lookup = new Map(before.map((item) => [JSON.stringify([item.documentId, item.pageNumber]), item]))
  const moves = after.flatMap((item) => {
    const old = lookup.get(JSON.stringify([item.documentId, item.pageNumber]))
    const suffix = `|${item.documentId}|${item.pageNumber}`
    const oldKey = old === undefined ? Object.keys(station.cards).find((key) => key.endsWith(suffix)) : cardKey(old.cellIndex, old.documentId, old.pageNumber)
    if (oldKey === undefined) return []
    const newKey = cardKey(item.cellIndex, item.documentId, item.pageNumber)
    const card = station.cards[oldKey]
    return card === undefined ? [] : [{ oldKey, newKey, card }]
  })
  const cards = { ...station.cards }
  for (const move of moves) delete cards[move.oldKey]
  for (const move of moves) cards[move.newKey] = move.card
  return { ...station, documents, cards }
}
