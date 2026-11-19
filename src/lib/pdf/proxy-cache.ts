import { openPdf } from './client'
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from './engine'

interface Entry {
  readonly doc: PDFDocumentProxy
  readonly task: PDFDocumentLoadingTask
}

/**
 * One parsed proxy per source file. Thumbnailing 12 cells must not re-parse the same
 * PDF 12 times, which is what a naive `openPdf` per cell would do.
 */
const cache = new Map<string, Entry>()
const pending = new Map<string, Promise<Entry | null>>()

export async function getProxy(fileName: string, bytes: ArrayBuffer): Promise<Entry | null> {
  const hit = cache.get(fileName)
  if (hit !== undefined) return hit

  const inFlight = pending.get(fileName)
  if (inFlight !== undefined) return inFlight

  const work = (async (): Promise<Entry | null> => {
    // `openPdf` copies the buffer, so the caller's bytes stay usable.
    const opened = await openPdf(bytes)
    if (!opened.ok) return null
    const entry: Entry = { doc: opened.doc, task: opened.task }
    cache.set(fileName, entry)
    pending.delete(fileName)
    return entry
  })()

  pending.set(fileName, work)
  return work
}

export function releaseProxies(): void {
  for (const entry of cache.values()) {
    void entry.task.destroy().catch(() => undefined)
  }
  cache.clear()
  pending.clear()
}

export function proxyCount(): number {
  return cache.size
}
