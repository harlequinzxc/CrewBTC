import { useCallback, useEffect, useRef, useState } from 'react'
import { useElementSize } from '../../lib/use-element-size'
import { useNonPassiveWheel } from '../../lib/use-wheel'
import { fitScale, nextZoom, previousZoom, wheelZoom } from '../../lib/zoom'

/**
 * One zoom value, owned above the sheet.
 *
 * The zoom controls moved into the top bar, which is outside the pane that the sheet is
 * fitted into — so the fit cannot be computed where the sheet is drawn any more. This hook
 * measures the *canvas region* instead (the box between the two rails and under the bar),
 * which is exactly the space the sheet has, and hands back both the number and the
 * handlers the bar needs.
 *
 * `manualScale === null` means "follow the window", which is the Fit mode: resizing keeps
 * the sheet fitted. The first `-` or `+` pins a scale and the pane starts scrolling
 * instead of shrinking the paper.
 */
export interface SheetZoom {
  /** Callback ref for the canvas region; it measures itself and captures Ctrl/Cmd + wheel. */
  readonly paneRef: (node: HTMLDivElement | null) => void
  readonly scale: number
  readonly fitting: boolean
  /** `null` returns to Fit. */
  readonly setScale: (scale: number | null) => void
  readonly step: (direction: 1 | -1) => void
  readonly fit: () => void
}

/** Breathing room around the paper, in CSS pixels, on every side. */
export const CANVAS_PADDING = 24

export function useSheetZoom(sheetWidthMm: number, sheetHeightMm: number): SheetZoom {
  const [manualScale, setManualScale] = useState<number | null>(null)
  const [paneRef, size] = useElementSize<HTMLDivElement>()

  const scale =
    manualScale ??
    fitScale(
      Math.max(0, size.width - CANVAS_PADDING * 2),
      Math.max(0, size.height - CANVAS_PADDING * 2),
      sheetWidthMm,
      sheetHeightMm,
    )

  // Ctrl/Cmd + wheel is the third way to zoom, and it must not reach the browser, which
  // would scale the whole page instead. React's delegated wheel listener is passive, so
  // this is bound directly with `{ passive: false }`.
  const wheelScale = useRef(scale)
  useEffect(() => {
    wheelScale.current = scale
  }, [scale])
  const wheelRef = useNonPassiveWheel<HTMLDivElement>((event) => {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    setManualScale(wheelZoom(wheelScale.current, event.deltaY))
  })

  const attach = useCallback(
    (node: HTMLDivElement | null) => {
      paneRef.current = node
      wheelRef.current = node
    },
    [paneRef, wheelRef],
  )

  return {
    paneRef: attach,
    scale,
    fitting: manualScale === null,
    setScale: setManualScale,
    step: (direction) => setManualScale(direction === 1 ? nextZoom(scale) : previousZoom(scale)),
    fit: () => setManualScale(null),
  }
}
