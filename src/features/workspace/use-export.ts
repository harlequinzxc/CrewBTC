import { useCallback, useState } from 'react'
import { getSource } from '../../lib/export/doc-cache'
import { downloadBytes, writeSheets } from '../../lib/export/write-sheet'
import type { PageRef } from '../../lib/imposition/sheet'
import type { GridLayout, SheetSettings } from '../../types/imposition'
import type { ToastInput } from '../../components/ui/use-toasts'
import type { PageEdit } from '../../types/edit'
import type { BlockSource } from '../../lib/export/write-sheet'
import { exportKey, pageKey } from '../../lib/pdf/page-text-key'
import { sourceVersion } from '../../lib/export/doc-cache'

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
  /** Per-cell edits. Empty means every page prints exactly as it arrived. */
  readonly edits?: Readonly<Record<string, PageEdit>> | undefined
  /** Extracted blocks keyed `file#version#page`, so text edits can be re-typeset. */
  readonly blocks?: Readonly<Record<string, readonly BlockSource[]>> | undefined
}

/** Writes the imposed sheets and hands the browser a download. Never blocks the UI. */
export function useExport({
  settings,
  grid,
  pages,
  drawCutMarks,
  notify,
  edits,
  blocks,
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

      // Blocks arrive keyed by the preview's `file#version#page`; the writer asks for
      // `file#page`, so rebuild the map with the same version lookup the UI uses.
      const blocksForExport: Record<string, readonly BlockSource[]> = {}
      if (blocks !== undefined) {
        for (const page of pages) {
          const version = sourceVersion(page.documentId)
          const found = blocks[pageKey(page.documentId, page.pageNumber, version)]
          if (found !== undefined) {
            blocksForExport[exportKey(page.documentId, page.pageNumber)] = found
          }
        }
      }

      setBusy(true)
      try {
        const result = await writeSheets({
          settings,
          grid,
          pages,
          sources,
          drawCutMarks,
          edits,
          blocks: blocksForExport,
        })

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
        // Say it out loud when an edit could not be applied: the file would otherwise
        // look fine while quietly ignoring what the user asked for.
        const unedited =
          result.pagesUnedited > 0
            ? ` · ${result.pagesUnedited} edit${result.pagesUnedited === 1 ? '' : 's'} could not be placed`
            : ''
        const trouble = result.pagesSkipped > 0 || result.pagesUnedited > 0
        notify({
          variant: trouble ? 'warning' : 'success',
          title: `${result.sheetCount} sheet${result.sheetCount === 1 ? '' : 's'} exported`,
          description: `${result.pagesPlaced} pages placed${skipped}${unedited}`,
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
  }, [settings, grid, pages, drawCutMarks, notify, edits, blocks])

  return { busy, exportAll }
}
