import { useCallback, useState } from 'react'
import { getSource } from '../../lib/export/doc-cache'
import { downloadBytes, writeSheets } from '../../lib/export/write-sheet'
import type { PageRef } from '../../lib/imposition/sheet'
import type { GridLayout, SheetSettings } from '../../types/imposition'
import type { ToastInput } from '../../components/ui/use-toasts'

export interface ExportApi {
  readonly busy: boolean
  readonly exportAll: () => void
}

export interface ExportOptions {
  readonly settings: SheetSettings
  readonly grid: GridLayout
  readonly pages: readonly PageRef[]
  readonly drawCutMarks: boolean
  readonly notify: (input: ToastInput) => void
}

/** Writes the imposed sheets and hands the browser a download. Never blocks the UI. */
export function useExport({
  settings,
  grid,
  pages,
  drawCutMarks,
  notify,
}: ExportOptions): ExportApi {
  const [busy, setBusy] = useState(false)

  const exportAll = useCallback(() => {
    void (async () => {
      if (pages.length === 0) {
        notify({ variant: 'info', title: 'Nothing to export', description: 'Add PDFs first.' })
        return
      }

      const sources = new Map<string, ArrayBuffer>()
      for (const page of pages) {
        if (sources.has(page.documentId)) continue
        const bytes = getSource(page.documentId)
        if (bytes !== null) sources.set(page.documentId, bytes.slice(0))
      }

      if (sources.size === 0) {
        notify({
          variant: 'warning',
          title: 'Source files are no longer in memory',
          description: 'Re-run the batch, then export again.',
        })
        return
      }

      setBusy(true)
      try {
        const result = await writeSheets({ settings, grid, pages, sources, drawCutMarks })

        if (result.bytes.byteLength === 0) {
          notify({ variant: 'warning', title: 'Nothing could be placed on a sheet' })
          return
        }

        const stamp = new Date().toISOString().slice(0, 10)
        downloadBytes(result.bytes, `crewbtc-sheets-${stamp}.pdf`)

        const skipped =
          result.pagesSkipped > 0
            ? ` · ${result.pagesSkipped} page${result.pagesSkipped === 1 ? '' : 's'} skipped`
            : ''
        notify({
          variant: result.pagesSkipped > 0 ? 'warning' : 'success',
          title: `${result.sheetCount} sheet${result.sheetCount === 1 ? '' : 's'} exported`,
          description: `${result.pagesPlaced} pages placed${skipped}`,
        })
      } catch {
        notify({
          variant: 'error',
          title: 'Export failed',
          description: 'The sheets could not be written. Try a smaller batch.',
        })
      } finally {
        setBusy(false)
      }
    })()
  }, [settings, grid, pages, drawCutMarks, notify])

  return { busy, exportAll }
}
