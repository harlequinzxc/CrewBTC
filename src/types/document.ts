import type { NormalisedBox } from './template'

/** One extracted text region, positioned in normalised page space. */
export interface TextRegion {
  readonly id: string
  readonly text: string
  readonly box: NormalisedBox
  readonly fontSizeRatio: number
}

/** Header and footer copy read off the page at upload time. Never empty if avoidable. */
export interface RecipeCopy {
  readonly header: string
  readonly footer: string
}

export interface DocumentMetrics {
  readonly pageCount: number
  readonly widthPt: number
  readonly heightPt: number
}

export type IngestStatus = 'queued' | 'parsing' | 'parsed' | 'failed'

export interface IngestedDocument {
  readonly id: string
  readonly fileName: string
  readonly byteLength: number
  readonly addedAt: string
  readonly status: IngestStatus
  readonly metrics: DocumentMetrics | null
  readonly regions: readonly TextRegion[]
  readonly pagePreviewUrl: string | null
  /** Copy from the first page. Kept for the single-page case and older callers. */
  readonly copy: RecipeCopy | null
  /**
   * Copy per page, `1`-based. A multi-card PDF has a different dish on every page, so
   * reading only the first would put one dish's name on all of them.
   */
  readonly copies: Readonly<Record<number, RecipeCopy>>
  /** The first page's embedded photo. Kept for the queue's single-thumbnail view. */
  readonly photoUrl: string | null
  /**
   * Embedded photo per page, `1`-based. A page with no extractable image is absent, and
   * the sheet falls back to that page's cropped render rather than an empty band.
   */
  readonly photos: Readonly<Record<number, string>>
  readonly error: string | null
}

/** Geometric centre of a normalised box — used for region assignment. */
export function boxCentre(box: NormalisedBox): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

export function boxContains(box: NormalisedBox, point: { x: number; y: number }): boolean {
  return (
    point.x >= box.x &&
    point.x <= box.x + box.width &&
    point.y >= box.y &&
    point.y <= box.y + box.height
  )
}
