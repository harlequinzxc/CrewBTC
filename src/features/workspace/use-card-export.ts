import { useCallback, useState } from 'react'
import { getSource } from '../../lib/export/doc-cache'
import { downloadBytes } from '../../lib/export/download'
import { writeCards } from '../../lib/export/write-cards'
import { planSheets } from '../../lib/imposition/sheet'
import type { PageRef } from '../../lib/imposition/sheet'
import type { GridLayout, SheetSettings } from '../../types/imposition'
import type { ToastInput } from '../../components/ui/use-toasts'
import type { Card, PhotoSource } from '../../types/card'

export interface CardExportApi {
  readonly busy: boolean
  /** Every sheet, in order, as one PDF. */
  readonly exportAll: () => void
  /** Just the sheet being looked at — the first one, since that is the one drawn. */
  readonly exportCurrent: () => void
  /** Whether a second sheet exists, and so whether "current" means anything. */
  readonly hasMoreThanOneSheet: boolean
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

  const plans = planSheets(pages, grid)
  const firstSheetPages = plans[0]?.placements.length ?? 0

  /**
   * `pages` narrowed to the first sheet.
   *
   * The exporter already slices `pages` into sheets itself, so handing it only the pages
   * that belong to the first sheet produces exactly that sheet — one page of output —
   * without the export path needing a mode flag.
   */
  const currentSheetPages = pages.slice(0, firstSheetPages)

  const run = useCallback(
    (selection: readonly PageRef[], filename: string) => {
    void (async () => {
      setBusy(true)
      try {
        const sources = new Map<string, ArrayBuffer>()
        for (const page of selection) {
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
          pages: selection,
          sources,
          drawCutMarks,
          cards,
          photos,
        })

        if (result.bytes.length === 0) {
          notify({ variant: 'error', title: 'Nothing to export', description: 'Place a page first.' })
          return
        }

        downloadBytes(result.bytes, filename)
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
    },
    [settings, grid, drawCutMarks, cards, notify],
  )

  const exportAll = useCallback(() => run(pages, 'crewbtc-cards.pdf'), [run, pages])
  const exportCurrent = useCallback(
    () => run(currentSheetPages, 'crewbtc-sheet-1.pdf'),
    [run, currentSheetPages],
  )

  return { busy, exportAll, exportCurrent, hasMoreThanOneSheet: plans.length > 1 }
}
