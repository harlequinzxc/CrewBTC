import { useCallback, useEffect, useRef, useState } from 'react'
import { useElementSize } from '../../../lib/use-element-size'
import { useNonPassiveWheel } from '../../../lib/use-wheel'
import { fitWidthScale, nextZoom, previousZoom, wheelZoom } from '../../../lib/zoom'

/**
 * One zoom value, owned above the sheet.
 *
 * The zoom controls moved into the top bar, which is outside the pane that the sheet is
 * fitted into — so the fit cannot be computed where the sheet is drawn any more. This hook
 * measures the *canvas region* instead (the box between the two rails and under the bar),
 * which is exactly the space the sheet has, and hands back both the number and the
 * handlers the bar needs.
 *
 * `manualScale === null` means "follow the window's width". That is the resting state the
 * app opens in, and it is what `Fit` restores. It is *not* a pressed state: Fit is a
 * momentary action, so the button never stays lit — see `TopBar`. The first `-` or `+`
 * pins a scale and the sheet scrolls instead of resizing under the pointer.
 */
export interface SheetZoom {
  /** Callback ref for the canvas region; it measures itself and captures Ctrl/Cmd + wheel. */
  readonly paneRef: (node: HTMLDivElement | null) => void
  readonly scale: number
  /** Whether the sheet is currently following the window's width. */
  readonly fitting: boolean
  /** `null` returns to width-fit. */
  readonly setScale: (scale: number | null) => void
  readonly step: (direction: 1 | -1) => void
  readonly fit: () => void
}

/** Breathing room either side of the paper, in CSS pixels. The user asked for 32. */
export const CANVAS_PADDING = 32

/**
 * `sheetWidthMm` is the only dimension the fit depends on now; height is not a parameter
 * because width-fit must not start caring about it again.
 */
export function useSheetZoom(sheetWidthMm: number): SheetZoom {
  const [manualScale, setManualScale] = useState<number | null>(null)

  /**
   * Leave width-fit.
   *
   * Every manual change comes through here, so there is exactly one place that decides
   * what counts as "the user has taken over". A pinned scale that happens to equal the
   * fitted one is still pinned: the number must not be able to drift back into fit on a
   * later resize.
   */
  const pin = (next: number): void => setManualScale(next)
  const [measureRef, size] = useElementSize<HTMLDivElement>()

  // Width, not height: filling the width is what makes a card's type readable on load.
  // The sheet is taller than the pane as a result, and the pane scrolls vertically.
  const scale =
    manualScale ?? fitWidthScale(Math.max(0, size.width - CANVAS_PADDING * 2), sheetWidthMm)

  // Ctrl/Cmd + wheel is the third way to zoom, and it must not reach the browser, which
  // would scale the whole page instead. React's delegated wheel listener is passive, so
  // this is bound directly with `{ passive: false }`.
  const wheelScale = useRef(scale)
  useEffect(() => {
    wheelScale.current = scale
  }, [scale])
  const wheelRef = useNonPassiveWheel<HTMLDivElement>((event) => {
    // Ctrl/Cmd + wheel is zoom. A plain wheel is a *scroll*, and the sheet is taller than
    // the pane whenever it is width-fitted — swallowing that would leave no way to reach
    // the bottom of the page.
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    pin(wheelZoom(wheelScale.current, event.deltaY))
  })

  // Two things need this node: the measurer (a callback ref) and the wheel listener (an
  // object ref). Forwarding to `measureRef` is what makes the fit happen at all — writing
  // `.current` onto a callback ref function, which is what this did when the measurer was
  // ref-shaped, silently measured nothing and left the sheet at 100%.
  const attach = useCallback(
    (node: HTMLDivElement | null) => {
      measureRef(node)
      wheelRef.current = node
    },
    [measureRef, wheelRef],
  )

  return {
    paneRef: attach,
    scale,
    fitting: manualScale === null,
    setScale: (next) => {
      if (next === null) setManualScale(null)
      else pin(next)
    },
    step: (direction) => pin(direction === 1 ? nextZoom(scale) : previousZoom(scale)),
    fit: () => setManualScale(null),
  }
}
