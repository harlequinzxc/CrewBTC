import { useEffect, useRef } from 'react'
import type { IngestedDocument } from '../../types/document'
import type { PageRef } from '../../lib/imposition/sheet'

export interface AutoCopyOptions {
  readonly documents: readonly IngestedDocument[]
  readonly pages: readonly PageRef[]
  /** Current copy per page index, so a page the user has touched is left alone. */
  readonly texts: Readonly<Record<string, string>>
  /** True when the user has edited this page index. */
  readonly isTouched: (index: number) => boolean
  readonly onFill: (index: number, header: string, footer: string) => void
}

/**
 * Fills each card's bands from the page it came from, as soon as that page is parsed.
 *
 * The rule that matters: **never overwrite something the user typed.** A real batch gets
 * re-run, and a page can be parsed twice; clobbering a corrected dish name because the
 * source was re-read would be worse than leaving a band empty. So a page is filled once,
 * and once the user has touched it the source is a starting point, not the truth.
 */
export function useAutoCopy(options: AutoCopyOptions): void {
  // Which page indexes have already received their source copy this session.
  const filled = useRef(new Set<number>())

  const { documents, pages, texts, isTouched, onFill } = options

  useEffect(() => {
    pages.forEach((page, index) => {
      // Loop breaker, not a spare guard: filling changes `texts`, which re-runs this
      // effect. Without this check the fill repeats forever.
      if (index in texts) return
      if (filled.current.has(index)) return
      if (isTouched(index)) {
        filled.current.add(index)
        return
      }

      const document = documents.find((candidate) => candidate.fileName === page.fileName)
      if (document === undefined || document.status !== 'parsed') return

      // The page's own copy, and nothing else. `document.copy` is only the first page's
      // wording, so falling back to it put one dish's name on every card in a multi-card
      // file. Single-page files still work: `copies[1]` is exactly that copy.
      const copy =
        document.copies[page.pageNumber] ??
        (page.pageNumber === 1 ? document.copy : null)
      if (copy === null) return

      const { header, footer } = copy
      if (header.trim() === '' && footer.trim() === '') {
        // Nothing readable on the page: leave it empty rather than inventing copy.
        filled.current.add(index)
        return
      }

      filled.current.add(index)
      onFill(index, header, footer)
    })
  }, [documents, pages, texts, isTouched, onFill])
}

/**
 * Wires auto-fill to a `useCellText` API and the current page list.
 *
 * App had grown past its line budget doing this inline, and the wiring is the hook's own
 * business: it needs the same touched-state and fill guard that `useAutoCopy` reads.
 */
export function useAutoCopyFor(options: {
  readonly documents: readonly IngestedDocument[]
  readonly pages: readonly PageRef[]
  readonly texts: Readonly<Record<string, string>>
  readonly cellText: {
    readonly isTouched: (index: number) => boolean
    readonly fillFromSource: (index: number, header: string, footer: string) => boolean
  }
}): void {
  useAutoCopy({
    documents: options.documents,
    pages: options.pages,
    texts: options.texts,
    isTouched: options.cellText.isTouched,
    onFill: options.cellText.fillFromSource,
  })
}
