import type { IngestedDocument } from '../../types/document'
import type { CellText } from '../../types/edit'
import { thumbnailKey } from '../../lib/pdf/thumbnails'

/**
 * Extracted dish photos, keyed exactly as the sheet looks them up.
 *
 * The key is built with `thumbnailKey`, not by hand. These two keys drifted once — the map
 * used `file#page` while the lookup used `file#version#page` — and the only symptom was
 * every cell quietly showing a page render instead of the dish photo. Sharing the helper
 * makes that impossible to reintroduce.
 */
export function photosByPage(
  documents: readonly IngestedDocument[],
): Readonly<Record<string, string>> {
  const out: Record<string, string> = {}

  for (const document of documents) {
    for (const [pageNumber, dataUrl] of Object.entries(document.photos)) {
      out[thumbnailKey(document.fileName, Number(pageNumber))] = dataUrl
    }
    // A file read before per-page photos existed still shows its first-page photo.
    if (document.photoUrl !== null && Object.keys(document.photos).length === 0) {
      out[thumbnailKey(document.fileName, 1)] = document.photoUrl
    }
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
