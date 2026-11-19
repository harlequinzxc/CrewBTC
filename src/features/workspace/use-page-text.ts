import { useEffect, useRef, useState } from 'react'
import { extractPageText } from '../../lib/pdf/extract'
import { getProxy } from '../../lib/pdf/proxy-cache'
import { getSource, sourceVersion } from '../../lib/export/doc-cache'
import type { TextRegion } from '../../types/document'
import { pageKey } from '../../lib/pdf/page-text-key'

export interface PageTextRequest {
  readonly fileName: string
  readonly pageNumber: number
}

const keyFor = (request: PageTextRequest, version: number): string =>
  pageKey(request.fileName, request.pageNumber, version)

/**
 * Text blocks for pages that are on screen. Ingestion only reads page 1, but every
 * page can be edited here, so blocks are extracted on demand and cached by
 * file + version + page (the version makes a re-upload invalidate them).
 *
 * A page with no text layer resolves to an empty list, not an error: scanned pages are
 * a legitimate input, they simply have nothing to edit.
 */
export function usePageText(
  requests: readonly PageTextRequest[],
  signature: string,
): Readonly<Record<string, readonly TextRegion[]>> {
  const cache = useRef(new Map<string, readonly TextRegion[]>())
  const [blocks, setBlocks] = useState<Readonly<Record<string, readonly TextRegion[]>>>({})

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const next: Record<string, readonly TextRegion[]> = {}

      for (const request of requests) {
        if (cancelled) return

        const bytes = getSource(request.fileName)
        const version = sourceVersion(request.fileName)
        const key = keyFor(request, version)
        const cached = cache.current.get(key)
        if (cached !== undefined) {
          next[key] = cached
          continue
        }

        let regions: readonly TextRegion[] = []
        if (bytes !== null && version !== 0) {
          const entry = await getProxy(request.fileName, bytes, version)
          if (cancelled) return
          if (entry !== null) {
            try {
              const page = await entry.doc.getPage(request.pageNumber)
              const outcome = await extractPageText(page)
              if (cancelled) return
              if (outcome.ok) regions = outcome.regions
            } catch {
              regions = []
            }
          }
        }

        cache.current.set(key, regions)
        next[key] = regions
      }

      // Publish every settled run, so revisiting a sheet shows its blocks again.
      if (!cancelled) setBlocks(next)
    })()

    return () => {
      cancelled = true
    }
    // `signature` is the stable identity of this set of pages; `requests` is a new
    // array on every render and must not retrigger extraction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  return blocks
}

export const pageTextKey = keyFor
