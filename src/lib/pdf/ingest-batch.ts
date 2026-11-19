import type { IngestedDocument } from '../../types/document'
import { ingestFile } from './ingest'

export interface BatchIngestOptions {
  readonly onStart?: (document: IngestedDocument) => void
  readonly onUpdate?: (document: IngestedDocument) => void
  /** Flip to abort the remaining queue. */
  readonly shouldContinue?: () => boolean
}

/**
 * Parses files one at a time. Sequential by design: a 300 DPI preview plus the
 * PDF.js worker is memory-heavy, and parallel parsing has taken the tab down in
 * testing on large batches (§5 storage/memory discipline).
 */
export async function ingestBatch(
  files: readonly File[],
  options: BatchIngestOptions = {},
): Promise<readonly IngestedDocument[]> {
  const results: IngestedDocument[] = []

  for (const file of files) {
    if (options.shouldContinue?.() === false) break
    const document = await ingestFile(file, {
      onUpdate: (update) => {
        options.onStart?.(update)
      },
    })
    results.push(document)
    options.onUpdate?.(document)
  }

  return results
}
