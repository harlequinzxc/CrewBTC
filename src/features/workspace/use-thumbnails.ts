import { useEffect, useRef, useState } from 'react'
import { renderThumbnail, thumbnailKey } from '../../lib/pdf/thumbnails'

export interface ThumbnailRequest {
  readonly fileName: string
  readonly pageNumber: number
}

/**
 * Renders page artwork for the cells on screen, one page at a time so a big batch
 * never blocks the UI. Results are cached by file+page, so returning to a sheet is
 * instant and no page is rendered twice.
 */
export function useThumbnails(
  requests: readonly ThumbnailRequest[],
  signature: string,
): Readonly<Record<string, string>> {
  const cache = useRef(new Map<string, string>())
  const [urls, setUrls] = useState<Readonly<Record<string, string>>>({})

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const next: Record<string, string> = {}

      for (const request of requests) {
        if (cancelled) return

        const key = thumbnailKey(request.fileName, request.pageNumber)
        const cached = cache.current.get(key)
        if (cached !== undefined) {
          next[key] = cached
          continue
        }

        const url = await renderThumbnail(request.fileName, request.pageNumber)
        if (cancelled) return
        if (url !== null) {
          cache.current.set(key, url)
          next[key] = url
        }
      }

      // Publish on every settled run, not only when something was rendered: going
      // back to an already-rendered sheet hits only the cache, and must still show
      // its artwork instead of the previous sheet's keys.
      if (!cancelled) setUrls(next)
    })()

    return () => {
      cancelled = true
    }
    // `signature` is the stable identity of this set of pages; `requests` changes
    // identity on every render and must not retrigger the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  return urls
}
