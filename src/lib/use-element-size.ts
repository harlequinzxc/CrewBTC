/** Measures an element's content box with ResizeObserver, height in CSS pixels. */
import { useEffect, useRef, useState } from 'react'

export interface ElementSize {
  readonly width: number
  readonly height: number
}

/**
 * Tracks an element's rendered size so a physical preview can be scaled to fit the
 * space actually available — no hardcoded zoom, no scrolling inside the pane.
 */
export function useElementSize<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  ElementSize,
] {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (element === null) return
    if (typeof ResizeObserver !== 'function') {
      setSize({ width: element.clientWidth, height: element.clientHeight })
      return
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry === undefined) return
      const { width, height } = entry.contentRect
      setSize({ width, height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, size]
}
