import type { IngestedDocument } from '../../types/document'
import type { PageRef } from '../imposition/sheet'
import { PT_PER_MM } from '../units'

/**
 * Every page of every parsed document becomes a placeable object (user decision:
 * "every page is an object"). Phase 2 records exact sizes for page 1 only, so
 * later pages inherit that size — accurate for the consistently formatted batches
 * this app targets, and flagged in the README.
 */
export function toPageRefs(documents: readonly IngestedDocument[]): readonly PageRef[] {
  const refs: PageRef[] = []

  for (const document of documents) {
    if (document.status !== 'parsed' || document.metrics === null) continue

    const widthMm = document.metrics.widthPt / PT_PER_MM
    const heightMm = document.metrics.heightPt / PT_PER_MM
    if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm)) continue
    if (widthMm <= 0 || heightMm <= 0) continue

    for (let pageNumber = 1; pageNumber <= document.metrics.pageCount; pageNumber += 1) {
      refs.push({
        // The exporter resolves source bytes by file name (see doc-cache).
        documentId: document.fileName,
        fileName: document.fileName,
        pageNumber,
        widthMm: Math.round(widthMm * 100) / 100,
        heightMm: Math.round(heightMm * 100) / 100,
      })
    }
  }

  return refs
}
