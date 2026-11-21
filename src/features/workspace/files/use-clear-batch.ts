import { useCallback } from 'react'
import { retireProjectSources, cancelProjectRetirement } from '../../../lib/storage/project-sources'
import type { useBatch } from './use-batch'
import type { useCards } from '../cards/use-cards'
import type { useToasts } from '../../../components/ui/use-toasts'

/**
 * Clearing the batch, and putting it back.
 *
 * One click destroys a batch and every edit made to it, and there is no second copy
 * anywhere — so the removed documents and cards are held until the toast expires, and
 * Undo restores exactly those. It deliberately does **not** re-parse the files: the bytes
 * may be gone by then, and a second parse would produce a different batch rather than the
 * same one.
 *
 * Split from the screen because the screen is a layout and this is a transaction.
 */
export interface ClearBatch {
  readonly clearAll: () => void
}

export function useClearBatch(input: {
  readonly batch: ReturnType<typeof useBatch>
  readonly store: ReturnType<typeof useCards>
  readonly notify: ReturnType<typeof useToasts>['show']
  readonly clearSelection: () => void
}): ClearBatch {
  const { batch, store, notify, clearSelection } = input

  const clearAll = useCallback(() => {
    const documents = batch.documents
    const activeId = batch.activeId
    const cards = store.cards
    if (documents.length === 0) return

    const ids = documents.map((document) => document.id)
    void retireProjectSources(ids).catch(() => undefined)
    batch.clear()
    store.reset()
    clearSelection()

    notify({
      variant: 'info',
      title: `Cleared ${documents.length} ${documents.length === 1 ? 'file' : 'files'}`,
      description: 'The batch and its card edits were removed.',
      undo: () => {
        void cancelProjectRetirement(ids).catch(() => undefined)
        batch.restoreCleared(documents, activeId)
        store.restoreCards(cards)
      },
      action: 'Undo',
    })
  }, [batch, store, notify, clearSelection])

  return { clearAll }
}
