import { useEffect, useState } from 'react'
import type { CardExportOptions } from '../sheet/use-card-export'
import { renderPdfPreview } from './render-preview'

type Inputs = Omit<CardExportOptions, 'notify'> & { readonly sheetIndex: number }
interface PreviewState {
  readonly image: string | null
  readonly status: 'loading' | 'ready' | 'error'
  readonly message: string
  readonly inputs: Inputs | null
}
const initial: PreviewState = { image: null, status: 'loading', message: 'Preparing PDF preview…', inputs: null }

/** Debounce edits and discard obsolete renders; the latest input always wins. */
export function usePdfPreview(options: Omit<CardExportOptions, 'notify'>, sheetIndex: number) {
  const { settings, grid, pages, drawCutMarks, cards } = options
  const [state, setState] = useState<PreviewState>(initial)
  useEffect(() => {
    let active = true
    const inputs = { settings, grid, pages, drawCutMarks, cards, sheetIndex }
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await renderPdfPreview({ settings, grid, pages, drawCutMarks, cards }, sheetIndex)
          if (!active) return
          setState({ image: result.image, status: 'ready', inputs, message: result.cardsSkipped > 0 ? `${result.cardsSkipped} cards could not be rendered completely.` : 'PDF preview up to date' })
        } catch {
          if (active) setState({ image: null, status: 'error', inputs, message: 'Could not generate PDF preview. Check your cards and try again.' })
        }
      })()
    }, 500)
    return () => { active = false; window.clearTimeout(timer) }
  }, [settings, grid, pages, drawCutMarks, cards, sheetIndex])
  const previous = state.inputs
  const current = previous !== null && previous.settings === settings && previous.grid === grid &&
    previous.pages === pages && previous.drawCutMarks === drawCutMarks && previous.cards === cards && previous.sheetIndex === sheetIndex
  if (current) return state
  return { ...state, status: 'loading' as const, message: 'Updating PDF preview…', image: previous?.sheetIndex === sheetIndex ? state.image : null }
}
