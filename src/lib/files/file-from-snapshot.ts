import { getSource } from '../export/doc-cache'

/**
 * A `File` for a document that came back from a saved session.
 *
 * The snapshot stores what ingestion produced, not the upload: re-parsing is deliberately
 * not how a reload works, because it cannot reproduce band heights, swapped photos or
 * framing. That leaves one gap — actions that genuinely need the bytes again, like
 * re-running extraction.
 *
 * The in-memory cache may still hold bytes during this visit. This wraps them back into a
 * `File`; after a full reload they are normally gone. Returns `null` in that case, so the
 * caller can ask for the original file rather than inventing an empty one.
 */
export function fileFromSnapshot(name: string, type = 'application/pdf'): File | null {
  const bytes = getSource(name)
  if (bytes === null) return null
  return new File([bytes], name, { type })
}
