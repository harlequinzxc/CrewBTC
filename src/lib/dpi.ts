export interface DpiInput {
  /** Width of the source image in pixels. */
  readonly pixelWidth: number
  /** Height of the source image in pixels. */
  readonly pixelHeight: number
  /** Placed width on the printed page, in millimetres. */
  readonly placedWidthMm: number
  /** Placed height on the printed page, in millimetres. */
  readonly placedHeightMm: number
}

export type DpiLevel = 'ok' | 'warning' | 'critical' | 'unknown'

export interface DpiResult {
  readonly dpi: number | null
  readonly level: DpiLevel
  readonly label: string
}

export const DPI_TARGET = 300
export const DPI_WARNING = 200

/**
 * Native effective DPI: source pixels divided by the printed size. This is the
 * number that predicts a blurry print — not the DPI the crop was rendered at.
 * Returns `null` (never `Infinity`/`NaN`) when the input cannot produce a value.
 */
export function effectiveDpi(input: DpiInput): number | null {
  const { pixelWidth, pixelHeight, placedWidthMm, placedHeightMm } = input
  if (
    !Number.isFinite(pixelWidth) ||
    !Number.isFinite(pixelHeight) ||
    !Number.isFinite(placedWidthMm) ||
    !Number.isFinite(placedHeightMm)
  ) {
    return null
  }
  if (pixelWidth <= 0 || pixelHeight <= 0 || placedWidthMm <= 0 || placedHeightMm <= 0) {
    return null
  }

  const MM_PER_INCH = 25.4
  const horizontal = pixelWidth / (placedWidthMm / MM_PER_INCH)
  const vertical = pixelHeight / (placedHeightMm / MM_PER_INCH)
  const worst = Math.min(horizontal, vertical)

  return Number.isFinite(worst) ? Math.round(worst) : null
}

export function classifyDpi(dpi: number | null): DpiLevel {
  if (dpi === null) return 'unknown'
  if (dpi >= DPI_TARGET) return 'ok'
  if (dpi >= DPI_WARNING) return 'warning'
  return 'critical'
}

export function describeDpi(dpi: number | null): DpiResult {
  const level = classifyDpi(dpi)
  if (dpi === null || level === 'unknown') {
    return { dpi: null, level: 'unknown', label: '—' }
  }
  const suffix = level === 'ok' ? '' : level === 'warning' ? ' — low' : ' — too low for print'
  return { dpi, level, label: `${dpi} DPI${suffix}` }
}

/** Largest placed size (mm) that still holds `targetDpi` for a pixel dimension. */
export function maxPlacementForDpi(pixels: number, targetDpi: number): number | null {
  if (!Number.isFinite(pixels) || pixels <= 0) return null
  if (!Number.isFinite(targetDpi) || targetDpi <= 0) return null
  return Math.round((pixels / targetDpi) * 25.4 * 100) / 100
}
