import { useCallback } from 'react'
import type { Keywords } from '../../../types/format-keywords'
import type { ToastInput } from '../../../components/ui/use-toasts'
import type { Card } from '../../../types/card'
import type { CardSeed, CardStore } from './use-cards'
import { automateCard } from './auto-format'

export function useAutoFormat(store: CardStore, seeds: readonly CardSeed[], keywords: Keywords, notify: (input: ToastInput) => void) {
  const available = seeds.length > 0 && seeds.every((seed) => store.cards[seed.key] !== undefined)
  const apply = useCallback(() => {
    if (!window.confirm('Format all occupied cards? Non-empty lines in bottom text will gain bullets, and matching CROCKERIES text will be permanently uppercased.')) return
    const before: Record<string, Card> = {}
    const after: Record<string, Card> = {}
    for (const { key } of seeds) {
      const card = store.cards[key]
      if (card === undefined) continue
      const result = automateCard(card, keywords)
      if (JSON.stringify(card) === JSON.stringify(result)) continue
      before[key] = card
      after[key] = result
    }
    if (Object.keys(after).length === 0) {
      notify({ variant: 'info', title: 'No formatting changes needed' })
      return
    }
    store.restoreCards({ ...store.cards, ...after })
    notify({ variant: 'success', title: 'Formatting applied', description: `${Object.keys(after).length} cards updated. Review the results.`, undo: () => store.undoFormattedCards(before, after), action: 'Undo' })
  }, [store, seeds, keywords, notify])
  return { available, apply }
}
