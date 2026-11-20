import { getSource } from '../export/doc-cache'

/**
 * A `File` for a document that came back from a saved session.
 *
 * The snapshot stores what ingestion produced, not the upload: re-parsing is deliberately
 * not how a reload works, because it cannot reproduce band heights, swapped photos or
 * framing. That leaves one gap — actions that genuinely need the bytes again, like
 * re-running extraction.
 *
 * Those bytes are usually still here: `doc-cache` keeps them for the exporter and is what
 * an export embeds either way. This wraps them back into a `File`, so a restored batch
 * behaves like a freshly added one. Returns `null` when the bytes are gone, which the
 * caller has to handle honestly rather than inventing an empty file.
 */
export function fileFromSnapshot(name: string, type = 'application/pdf'): File | null {
  const bytes = getSource(name)
  if (bytes === null) return null
  return new File([bytes], name, { type })
}
