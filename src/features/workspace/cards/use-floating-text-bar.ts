import { useLayoutEffect, useRef } from 'react'

/** Position the bar in the visible sheet viewport, not in the scrolled paper. */
export function useFloatingTextBar(sheet: number, cell: number) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const bar = ref.current
    const host = bar?.parentElement
    const pane = host?.querySelector<HTMLElement>('[data-testid="sheet-pane"]')
    const card = pane?.querySelector<HTMLElement>(`[data-sheet="${sheet + 1}"] [data-cell="${cell}"]`)
    if (!bar || !host || !pane || !card) return
    const gap = 6
    const update = () => {
      const viewport = pane.getBoundingClientRect()
      const origin = host.getBoundingClientRect()
      const anchor = card.getBoundingClientRect()
      // clientWidth/Height exclude scrollbars, which are not usable overlay space.
      const width = pane.clientWidth
      const height = pane.clientHeight
      bar.style.maxWidth = `${Math.max(0, width - gap * 2)}px`
      bar.style.maxHeight = `${Math.max(0, height - gap * 2)}px`
      const box = bar.getBoundingClientRect()
      const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, Math.max(min, max)))
      const x = clamp(anchor.left + anchor.width / 2 - viewport.left - box.width / 2, gap, width - box.width - gap)
      const above = anchor.top - viewport.top - box.height - gap
      const below = anchor.bottom - viewport.top + gap
      // If neither side fits (e.g. a zoomed-in card taller than the viewport),
      // keep the pill at the nearest visible edge rather than outside the preview.
      const y = above >= gap ? above : below + box.height <= height - gap ? below : above
      bar.style.left = `${viewport.left - origin.left + x}px`
      bar.style.top = `${viewport.top - origin.top + clamp(y, gap, height - box.height - gap)}px`
      bar.style.visibility = 'visible'
    }
    update()
    pane.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(pane)
    observer?.observe(card)
    observer?.observe(bar)
    return () => {
      pane.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      observer?.disconnect()
    }
  }, [sheet, cell])
  return ref
}
