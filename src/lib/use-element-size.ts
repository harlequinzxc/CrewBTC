/**
 * Measures an element's content box with ResizeObserver, height in CSS pixels.
 *
 * The element can arrive late. The sheet pane is only rendered once there is a batch to
 * draw, and the workspace re-renders around it, so a measurement taken once on mount
 * measured `null` and the sheet was thereafter drawn at 100% — "a postage stamp in the
 * middle of the screen" — because nothing ever looked at the element again.
 *
 * So the observer is attached through a callback ref: it binds to whatever element is
 * currently there, and rebinds whenever the node changes, however many times that happens.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export interface ElementSize {
  readonly width: number
  readonly height: number
}

/**
 * Tracks an element's rendered size so a physical preview can be scaled to fit the
 * space actually available — no hardcoded zoom, no scrolling inside the pane.
 */
export function useElementSize<T extends HTMLElement>(): [(node: T | null) => void, ElementSize] {
  const observerRef = useRef<ResizeObserver | null>(null)
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 })

  // Only a *changed* measurement is state. A ref callback can be detached and re-attached
  // for reasons that have nothing to do with size (a new closure identity each render, for
  // one), and writing an equal value back would be an update that schedules another
  // attach — which is how a measurer becomes an infinite render loop.
  const commit = useCallback((width: number, height: number) => {
    setSize((previous) =>
      previous.width === width && previous.height === height ? previous : { width, height },
    )
  }, [])

  const ref = useCallback(
    (node: T | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null

    if (node === null) return

    if (typeof ResizeObserver !== 'function') {
      commit(node.clientWidth, node.clientHeight)
      return
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry === undefined) return
      commit(entry.contentRect.width, entry.contentRect.height)
    })
    observer.observe(node)
    observerRef.current = observer
    },
    [commit],
  )

  useEffect(() => () => observerRef.current?.disconnect(), [])

  return [ref, size]
}
