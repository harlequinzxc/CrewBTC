import type { IngestedDocument } from '../../types/document'

/**
 * How a file's row reads at a glance: parsed, still working, failed, or nothing to cut.
 *
 * Four states, one dot and one word. Split from the row component because a file that
 * exports both a component and the functions beside it breaks Fast Refresh, and because
 * "what state is this file in" is a question `BatchQueue` asks as well.
 */
export type FileStatus = 'failed' | 'parsing' | 'empty' | 'parsed'

export const STATUS_TEXT: Record<FileStatus, string> = {
  failed: 'Failed',
  parsing: 'Parsing',
  empty: 'No text found',
  parsed: 'Parsed',
}

/** A file with no regions parsed cleanly but has nothing to lay out. */
export function statusOf(document: IngestedDocument): FileStatus {
  if (document.status === 'failed') return 'failed'
  if (document.status === 'parsing') return 'parsing'
  if (document.regions.length === 0) return 'empty'
  return 'parsed'
}
