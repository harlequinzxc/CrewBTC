import { useCallback, useState } from 'react'
import { getSource } from '../../lib/export/doc-cache'
import { downloadBytes, writeSheets } from '../../lib/export/write-sheet'
import type { PageRef } from '../../lib/imposition/sheet'
import { planSheets } from '../../lib/imposition/sheet'
import type { GridLayout, SheetSettings } from '../../types/imposition'
import type { ToastInput } from '../../components/ui/use-toasts'
import type { CellText, ImageTransform, PhotoSource } from '../../types/edit'

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
  /** Pasted copy keyed by page index. Empty means cards print with no text. */
  readonly texts?: Readonly<Record<string, string>> | undefined
  /** Artwork framing keyed by page index. */
  readonly images?: Readonly<Record<string, ImageTransform>> | undefined
  /** Extracted dish photos keyed `documentId#pageNumber`, each with its pixel shape. */
  readonly photos?: Readonly<Record<string, PhotoSource>> | undefined
  /** Text styles keyed `pageIndex|band`, as the preview stores them. */
  readonly styles?: Readonly<Record<string, { color: string; highlight: string | null }>> | undefined
}

/** Writes the imposed sheets and hands the browser a download. Never blocks the UI. */
export function useExport({
  settings,
  grid,
  pages,
  drawCutMarks,
  notify,
  texts,
  images,
  photos,
  styles,
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
        // The writer keys by cell + page; the preview keys by page index. Translate
        // once here so neither side has to know about the other's numbering.
        const cellTexts: Record<string, CellText> = {}
        const cellImages: Record<string, ImageTransform> = {}
        const cellStyles: Record<string, { color: string; highlight: string | null }> = {}
        const cellPhotos: Record<string, PhotoSource> = {}
        const plans = planSheets(pages, grid)
        for (const plan of plans) {
          for (const placement of plan.placements) {
            const index = pages.findIndex(
              (page) =>
                page.documentId === placement.documentId &&
                page.pageNumber === placement.pageNumber,
            )
            const text = texts?.[`${index}`]
            if (text !== undefined && text.trim() !== '') {
              cellTexts[`${placement.cellIndex}|${placement.documentId}|${placement.pageNumber}`] = {
                documentId: placement.documentId,
                pageNumber: placement.pageNumber,
                text,
              }
            }
            const image = images?.[`${index}`]
            if (image !== undefined) {
              cellImages[`${placement.cellIndex}|${placement.documentId}|${placement.pageNumber}`] =
                image
            }
            // Keyed the way the exporter reads it, so the card gets its own dish photo.
            const photo = photos?.[`${placement.documentId}#${placement.pageNumber}`]
            if (photo !== undefined) {
              cellPhotos[`${placement.cellIndex}|${placement.documentId}|${placement.pageNumber}`] =
                photo
            }

            for (const band of ['header', 'footer'] as const) {
              const style = styles?.[`${index}|${band}`]
              if (style !== undefined) {
                cellStyles[`${placement.cellIndex}|${band}`] = style
              }
            }
          }
        }

        const result = await writeSheets({
          settings,
          grid,
          pages,
          sources,
          drawCutMarks,
          texts: cellTexts,
          images: cellImages,
          photos: cellPhotos,
          styles: cellStyles,
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
  }, [settings, grid, pages, drawCutMarks, notify, texts, images, photos, styles])

  return { busy, exportAll }
}
