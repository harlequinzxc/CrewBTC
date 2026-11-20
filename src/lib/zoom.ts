/**
 * Zoom arithmetic for the sheet preview.
 *
 * Pure functions with no React in them, so the behaviour that is easy to get wrong —
 * stepping past the end of the ladder, or letting `Fit` drift — can be tested without
 * rendering anything.
 */

/** The rungs a manual zoom steps between. Round percentages, so the readout is honest. */
export const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5] as const

export const MIN_ZOOM = ZOOM_STEPS[0] ?? 0.25
export const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1] ?? 5

export const clampZoom = (value: number): number =>
  !Number.isFinite(value) ? 1 : Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))

/** The next rung above `current`, or `current` itself at the top. */
export function nextZoom(current: number): number {
  const rung = ZOOM_STEPS.find((step) => step > current + 1e-6)
  return rung ?? MAX_ZOOM
}

/** The next rung below `current`, or `current` itself at the bottom. */
export function previousZoom(current: number): number {
  const lower = [...ZOOM_STEPS].reverse().find((step) => step < current - 1e-6)
  return lower ?? MIN_ZOOM
}

/**
 * Pixels per millimetre that make the sheet fit the available box.
 *
 * Never returns 0 or a non-finite number: an unmeasured container (the first render
 * before `ResizeObserver` reports) would otherwise collapse the sheet to nothing.
 */
export function fitScale(availableWidth: number, availableHeight: number, sheetWidthMm: number, sheetHeightMm: number): number {
  if (
    !(availableWidth > 0) ||
    !(availableHeight > 0) ||
    !(sheetWidthMm > 0) ||
    !(sheetHeightMm > 0)
  ) {
    return 1
  }
  return Math.min(availableWidth / sheetWidthMm, availableHeight / sheetHeightMm)
}

/** A multiplier that keeps a Ctrl/Cmd-wheel gesture smooth rather than steppy. */
export const wheelZoom = (current: number, direction: number): number =>
  clampZoom(current * (direction < 0 ? 1.1 : 1 / 1.1))

/** Percentage shown in the toolbar. Whole numbers only; a "101.7%" readout helps nobody. */
export const zoomPercent = (scale: number): number => Math.round(scale * 100)
