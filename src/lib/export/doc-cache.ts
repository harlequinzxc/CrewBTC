/**
 * Holds the original bytes of each imported PDF so the exporter can embed real pages
 * (`embedPage`), rather than re-encoding anything. Bytes are released on clear.
 *
 * Keyed by file name because the exporter looks pages up by the id that reaches
 * `PageRef.documentId`.
 */
const sources = new Map<string, ArrayBuffer>()

export function keepSource(id: string, bytes: ArrayBuffer): void {
  sources.set(id, bytes)
}

export function getSource(id: string): ArrayBuffer | null {
  return sources.get(id) ?? null
}

export function releaseSource(id: string): void {
  sources.delete(id)
}

export function releaseAll(): void {
  sources.clear()
}

export function sourceCount(): number {
  return sources.size
}
