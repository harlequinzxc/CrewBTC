import { useCallback, useState } from 'react'
import { getSource } from '../../lib/export/doc-cache'
import { downloadBytes } from '../../lib/export/download'
import { writeCards } from '../../lib/export/write-cards'
import type { PageRef } from '../../lib/imposition/sheet'
import type { GridLayout, SheetSettings } from '../../types/imposition'
import type { ToastInput } from '../../components/ui/use-toasts'
import type { Card, PhotoSource } from '../../types/card'

export interface CardExportApi {
  readonly busy: boolean
  readonly exportAll: () => void
}

export interface CardExportOptions {
  readonly settings: SheetSettings
  readonly grid: GridLayout
  readonly pages: readonly PageRef[]
  readonly drawCutMarks: boolean
  readonly cards: Readonly<Record<string, Card>>
  readonly notify: (input: ToastInput) => void
}

/**
 * Exports the sheet as it stands.
 *
 * The photo bytes are gathered here rather than stored twice: a card carries the data
 * URL it displays, and the exporter needs the PNG bytes, so they are decoded once at
 * export time for the cards actually placed on a sheet.
 */
export function useCardExport(options: CardExportOptions): CardExportApi {
  const { settings, grid, pages, drawCutMarks, cards, notify } = options
  const [busy, setBusy] = useState(false)

  const exportAll = useCallback(() => {
    void (async () => {
      setBusy(true)
      try {
        const sources = new Map<string, ArrayBuffer>()
        for (const page of pages) {
          if (sources.has(page.documentId)) continue
          const bytes = getSource(page.documentId)
          if (bytes !== null) sources.set(page.documentId, bytes)
        }

        // Every photo a placed card needs, keyed the way the exporter looks it up.
        const photos: Record<string, PhotoSource> = {}
        for (const [key, card] of Object.entries(cards)) {
          if (card.photo !== null) photos[key] = card.photo
        }

        const result = await writeCards({
          settings,
          grid,
          pages,
          sources,
          drawCutMarks,
          cards,
          photos,
        })

        if (result.bytes.length === 0) {
          notify({ variant: 'error', title: 'Nothing to export', description: 'Place a page first.' })
          return
        }

        downloadBytes(result.bytes, 'crewbtc-cards.pdf')
        notify({
          variant: 'success',
          title: 'Sheet exported',
          description: `${result.sheetCount} ${result.sheetCount === 1 ? 'sheet' : 'sheets'}, ${result.cardsDrawn} ${result.cardsDrawn === 1 ? 'card' : 'cards'}`,
        })
      } catch {
        notify({ variant: 'error', title: 'Export failed', description: 'The sheet could not be written.' })
      } finally {
        setBusy(false)
      }
    })()
  }, [settings, grid, pages, drawCutMarks, cards, notify])

  return { busy, exportAll }
}
