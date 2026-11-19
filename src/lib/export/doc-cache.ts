/**
 * Holds the original bytes of each imported PDF so the exporter can embed real pages
 * (`embedPage`), rather than re-encoding anything. Bytes are released on clear.
 *
 * Keyed by file name because the exporter looks pages up by the id that reaches
 * `PageRef.documentId`.
 */
const sources = new Map<string, ArrayBuffer>()

/**
 * Monotonic per-file version. Re-uploading `cards.pdf` replaces its bytes, so any
 * cached render or parsed document for the old bytes must stop matching. A global
 * counter (rather than per-file) means a version is never reused, even after clear.
 */
const versions = new Map<string, number>()
let sequence = 0

export function keepSource(id: string, bytes: ArrayBuffer): void {
  sequence += 1
  versions.set(id, sequence)
  sources.set(id, bytes)
}

export function getSource(id: string): ArrayBuffer | null {
  return sources.get(id) ?? null
}

export function releaseSource(id: string): void {
  sources.delete(id)
  versions.delete(id)
}

export function releaseAll(): void {
  sources.clear()
  versions.clear()
}

/** 0 means the file is not currently held, so nothing may be rendered from it. */
export function sourceVersion(id: string): number {
  return versions.get(id) ?? 0
}

export function sourceCount(): number {
  return sources.size
}
