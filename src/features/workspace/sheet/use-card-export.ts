import { useCallback, useState } from 'react'
import { downloadBytes } from '../../../lib/export/download'
import { writeCards } from '../../../lib/export/write-cards'
import { planSheets } from '../../../lib/imposition/sheet'
import type { PageRef } from '../../../lib/imposition/sheet'
import type { GridLayout, SheetSettings } from '../../../types/imposition'
import type { ToastInput } from '../../../components/ui/use-toasts'
import type { Card, PhotoSource } from '../../../types/card'

export interface CardExportApi {
  readonly busy: boolean
  /** Every sheet, in order, as one PDF. */
  readonly exportAll: () => void
  /** Just the sheet currently visible in the editor. */
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
  readonly sheetIndex?: number
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
  const sheetIndex = Math.max(0, Math.min(options.sheetIndex ?? 0, plans.length - 1))

  // Each sheet consumes exactly cellCount input pages, even if a placement is skipped.
  const currentSheetPages = pages.slice(sheetIndex * grid.cellCount, (sheetIndex + 1) * grid.cellCount)

  const run = useCallback(
    (selection: readonly PageRef[], filename: string) => {
    void (async () => {
      setBusy(true)
      try {
        // Every photo a placed card needs, keyed the way the exporter looks it up.
        const photos: Record<string, PhotoSource> = {}
        for (const [key, card] of Object.entries(cards)) {
          if (card.photo !== null) photos[key] = card.photo
        }

        const result = await writeCards({
          settings,
          grid,
          pages: selection,
          drawCutMarks,
          cards,
          photos,
        })

        if (result.bytes.length === 0 || result.cardsDrawn === 0) {
          notify({ variant: 'error', title: 'Nothing exported', description: 'No complete cards could be written. Check the cards and photos, then try again.' })
          return
        }

        downloadBytes(result.bytes, filename)
        notify({
          variant: result.cardsSkipped > 0 ? 'warning' : 'success',
          title: result.cardsSkipped > 0 ? 'Export incomplete' : 'Sheet exported',
          description: result.cardsSkipped > 0
            ? `${result.cardsDrawn} cards exported; ${result.cardsSkipped} could not be written completely. Check the affected cards and photos.`
            : `${result.sheetCount} ${result.sheetCount === 1 ? 'sheet' : 'sheets'}, ${result.cardsDrawn} ${result.cardsDrawn === 1 ? 'card' : 'cards'}`,
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
    () => run(currentSheetPages, `crewbtc-sheet-${sheetIndex + 1}.pdf`),
    [run, currentSheetPages, sheetIndex],
  )

  return { busy, exportAll, exportCurrent, hasMoreThanOneSheet: plans.length > 1 }
}
