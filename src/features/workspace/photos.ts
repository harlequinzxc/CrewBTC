import type { IngestedDocument } from '../../types/document'
import type { CellText } from '../../types/edit'

/**
 * Extracted dish photos, keyed `file#page` so the preview can look one up per cell.
 *
 * Only page 1 is read today: upload lifts one photo per file, from the first page, which
 * matches a batch of single-card recipe PDFs. Pages beyond the first fall back to their
 * cropped render rather than showing a photo that belongs to a different dish.
 */
export function photosByPage(
  documents: readonly IngestedDocument[],
): Readonly<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const document of documents) {
    if (document.photoUrl === null) continue
    out[`${document.fileName}#1`] = document.photoUrl
  }
  return out
}

/**
 * Copy per page index, which is the order the sheet places pages in.
 *
 * Cell text is keyed `cellIndex|documentId|pageNumber`; the preview works in page
 * indexes, so the leading index is lifted out once here rather than in every consumer.
 */
export function textsByPageIndex(
  texts: Readonly<Record<string, CellText>>,
): Readonly<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(texts)) {
    const match = /^(\d+)\|/.exec(key)
    if (match === null) continue
    out[match[1] ?? '0'] = value.text
  }
  return out
}
