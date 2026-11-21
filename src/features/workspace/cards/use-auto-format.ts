import { useCallback } from 'react'
import type { Keywords } from '../../../types/format-keywords'
import type { ToastInput } from '../../../components/ui/use-toasts'
import type { Card } from '../../../types/card'
import type { CardSeed, CardStore } from './use-cards'
import { automateCard } from './auto-format'
import { removeCalloutFormatting } from './remove-auto-format'

export function useAutoFormat(store: CardStore, seeds: readonly CardSeed[], keywords: Keywords, notify: (input: ToastInput) => void) {
  const available = seeds.length > 0 && seeds.every((seed) => store.cards[seed.key] !== undefined)
  const changeCards = useCallback((transform: (card: Card) => Card, title: string) => {
    const before: Record<string, Card> = {}
    const after: Record<string, Card> = {}
    for (const { key } of seeds) {
      const card = store.cards[key]
      if (card === undefined) continue
      const result = transform(card)
      if (JSON.stringify(card) === JSON.stringify(result)) continue
      before[key] = card
      after[key] = result
    }
    if (Object.keys(after).length === 0) {
      notify({ variant: 'info', title: 'No formatting changes needed' })
      return
    }
    store.restoreCards({ ...store.cards, ...after })
    notify({ variant: 'success', title, description: `${Object.keys(after).length} cards updated. Review the results.`, undo: () => store.undoFormattedCards(before, after), action: 'Undo' })
  }, [store, seeds, notify])

  const apply = useCallback(() => {
    if (!window.confirm('Format all occupied cards? Non-empty lines in bottom text will gain bullets, and matching CROCKERIES text will be permanently uppercased.')) return
    changeCards((card) => automateCard(card, keywords), 'Formatting applied')
  }, [changeCards, keywords])

  const remove = useCallback(() => {
    if (!window.confirm('Remove CROCKERIES, DIRECTIONS and CONDIMENTS formatting from all occupied cards? Bullets and text casing will remain unchanged.')) return
    changeCards(removeCalloutFormatting, 'Formatting removed')
  }, [changeCards])
  return { available, apply, remove }
}
