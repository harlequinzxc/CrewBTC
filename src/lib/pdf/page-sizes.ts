import type { IngestedDocument } from '../../types/document'
import { PT_PER_MM } from '../units'

export interface PageSizeMm {
  readonly widthMm: number
  readonly heightMm: number
}

/**
 * Every page's real size. Phase 2 recorded page 1 only; the exporter needs true sizes per
 * page because a PDF may mix orientations, and guessing would distort placement.
 */
export async function measureAllPages(
  getPage: (pageNumber: number) => Promise<{
    getViewport: (options: { scale: number }) => { width: number; height: number }
  }>,
  pageCount: number,
  fallback: PageSizeMm,
): Promise<readonly PageSizeMm[]> {
  const sizes: PageSizeMm[] = []

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    try {
      const page = await getPage(pageNumber)
      const viewport = page.getViewport({ scale: 1 })
      const widthMm = viewport.width / PT_PER_MM
      const heightMm = viewport.height / PT_PER_MM
      sizes.push(
        Number.isFinite(widthMm) && Number.isFinite(heightMm) && widthMm > 0 && heightMm > 0
          ? { widthMm: Math.round(widthMm * 100) / 100, heightMm: Math.round(heightMm * 100) / 100 }
          : fallback,
      )
    } catch {
      sizes.push(fallback)
    }
  }

  return sizes
}

/** Total pages across every successfully parsed document. */
export function totalPages(documents: readonly IngestedDocument[]): number {
  return documents.reduce(
    (sum, document) =>
      document.status === 'parsed' && document.metrics !== null
        ? sum + document.metrics.pageCount
        : sum,
    0,
  )
}
