import { useCallback, useEffect, useRef } from 'react'
import type { Card } from '../../../types/card'
import type { SheetSettings } from '../../../types/imposition'
import type { useCards } from '../cards/use-cards'
import type { useSheet } from '../sheet/use-sheet'
import type { useSharedSheet } from '../stations/use-shared-sheet'
import type { IngestedDocument } from '../../../types/document'
import { cardForStorage } from '../cards/numbered-cards'
import { useEditHistory } from './use-edit-history'

export function useWorkspaceHistory(store: ReturnType<typeof useCards>, sheet: ReturnType<typeof useSheet>, shared: ReturnType<typeof useSharedSheet>, stationId: string, documents: readonly IngestedDocument[]) {
  const history = useEditHistory(store.patchCards, shared.update)
  const { record, clear } = history
  const signature = JSON.stringify([stationId, documents.map((document) => [document.id, document.includedPages])])
  const boundary = useRef(signature)
  useEffect(() => {
    if (boundary.current !== signature) { boundary.current = signature; clear() }
  }, [signature, clear])
  const cardChange = useCallback((key: string, card: Card) => {
    const before = store.cards[key], after = cardForStorage(card)
    if (before !== undefined) {
      const focused = document.activeElement
      const isText = focused instanceof HTMLTextAreaElement && focused.getAttribute('aria-label') === 'Edit card text' && (before.headerText !== after.headerText || before.bodyText !== after.bodyText)
      const bandChange = JSON.stringify(before.bands) !== JSON.stringify(after.bands)
      const group = isText ? `text:${key}:${focused?.getAttribute('placeholder')}` : bandChange ? `bands:${key}` : null
      record({ kind: 'cards', before: { [key]: before }, after: { [key]: after } }, group)
    }
    store.setCard(key, after)
  }, [store, record])
  const sheetChange = useCallback((patch: Partial<SheetSettings>) => {
    const before = sheet.settings, after = { ...before, ...patch }
    const group = document.activeElement instanceof HTMLInputElement ? `sheet:${Object.keys(patch).sort().join(',')}` : null
    record({ kind: 'sheet', before, after }, group)
    shared.update(patch)
  }, [sheet.settings, shared, record])
  const batchChange = useCallback((before: Readonly<Record<string, Card>>, after: Readonly<Record<string, Card>>) => {
    record({ kind: 'cards', before, after })
  }, [record])
  return { ...history, cardChange, sheetChange, batchChange }
}
