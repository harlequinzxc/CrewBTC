import { useCallback, useEffect, useRef } from 'react'
import { activeSheetAt, scrollTopForSheet } from './sheet-stack'
import type { SheetOffset } from './sheet-stack'
import { scrollToTop } from './scroll-stack'

/**
 * Scrolling the stack, and reporting where it landed.
 *
 * The canvas draws every sheet, so "which sheet" is a measurement rather than a choice.
 * This hook owns the measurement: it attaches to the scroll container, throttles the
 * report to one per frame, and performs the one navigation the app has — a scroll to a
 * sheet, requested from above.
 *
 * Kept out of `CardSheet` because the component was at its line budget and this is the
 * only stateful, imperative part of it.
 */
export interface SheetScroll {
  /** Attach to the scroll container. Compose it with the zoom hook's own ref. */
  readonly ref: (node: HTMLDivElement | null) => void
  readonly onScroll: () => void
  /** Jump back to the top — used when the plan changes under the canvas. */
  readonly reset: () => void
}

export function useSheetScroll(input: {
  readonly offsets: readonly SheetOffset[]
  readonly scrollTo: number | null
  readonly onScrolled: (sheetIndex: number) => void
  readonly onScrollHandled: () => void
}): SheetScroll {
  const node = useRef<HTMLDivElement | null>(null)
  const frame = useRef(0)
  const { scrollTo, onScrolled, onScrollHandled } = input
  const { offsets } = input

  // A request from above: scroll there, then say it is done. Saying so is what stops a
  // navigation from being re-applied after the user has scrolled away by hand.
  useEffect(() => {
    if (scrollTo === null) return
    const element = node.current
    if (element !== null) scrollToTop(element, scrollTopForSheet(offsets, scrollTo))
    onScrollHandled()
  }, [scrollTo, offsets, onScrollHandled])

  // One announcement per frame. A scroll event fires far faster than the highlight can be
  // redrawn, and the last one in a frame is the only one that describes the screen.
  const onScroll = useCallback(() => {
    if (frame.current !== 0) return
    frame.current = window.requestAnimationFrame(() => {
      frame.current = 0
      const element = node.current
      if (element === null) return
      onScrolled(activeSheetAt(element.scrollTop, element.clientHeight, offsets))
    })
  }, [offsets, onScrolled])

  useEffect(
    () => () => {
      if (frame.current !== 0) window.cancelAnimationFrame(frame.current)
    },
    [],
  )

  const ref = useCallback((element: HTMLDivElement | null) => {
    node.current = element
  }, [])

  const reset = useCallback(() => {
    const element = node.current
    if (element !== null) element.scrollTop = 0
  }, [])

  return { ref, onScroll, reset }
}
