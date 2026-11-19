import type { PageSettings } from '../types/settings'
import { LIMITS } from '../types/settings'

/** Page geometry in millimetres. Boxes are inclusive of the origin edge. */
export interface PageGeometry {
  readonly trimWidthMm: number
  readonly trimHeightMm: number
  readonly bleedMm: number
  readonly markMarginMm: number
  /** Full page including bleed and crop-mark clearance. */
  readonly mediaWidthMm: number
  readonly mediaHeightMm: number
  /** Offset from the media edge to the bleed edge. */
  readonly bleedOffsetMm: number
  /** Whether crop marks can be drawn without falling inside the trim. */
  readonly marksFit: boolean
}

export interface ValidationResult {
  readonly ok: boolean
  readonly errors: Readonly<Record<string, string>>
}

/**
 * §5: 3 mm of bleed leaves no room for standard trim marks, which need roughly
 * 5 mm of clear space outside the trim edge. Marks therefore add their own
 * margin to the media box instead of being drawn inside the bleed.
 */
export const MIN_MARK_MARGIN_MM = 4

export function isWithin(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max
}

export function validatePageSettings(settings: PageSettings): ValidationResult {
  const errors: Record<string, string> = {}

  if (!isWithin(settings.trimWidthMm, LIMITS.minTrimMm, LIMITS.maxTrimMm)) {
    errors.trimWidthMm = `Width must be between ${LIMITS.minTrimMm} and ${LIMITS.maxTrimMm} mm`
  }
  if (!isWithin(settings.trimHeightMm, LIMITS.minTrimMm, LIMITS.maxTrimMm)) {
    errors.trimHeightMm = `Height must be between ${LIMITS.minTrimMm} and ${LIMITS.maxTrimMm} mm`
  }
  if (!isWithin(settings.bleedMm, 0, LIMITS.maxBleedMm)) {
    errors.bleedMm = `Bleed must be between 0 and ${LIMITS.maxBleedMm} mm`
  }
  if (!isWithin(settings.markMarginMm, LIMITS.minMarkMarginMm, LIMITS.maxMarkMarginMm)) {
    errors.markMarginMm = `Mark margin must be between ${LIMITS.minMarkMarginMm} and ${LIMITS.maxMarkMarginMm} mm`
  }

  return { ok: Object.keys(errors).length === 0, errors }
}

/**
 * Pure geometry. Never throws on unvalidated input — callers validate first, and
 * the clamp here guarantees no negative or non-finite dimension reaches a PDF.
 */
export function computePageGeometry(settings: PageSettings): PageGeometry {
  const bleed = Number.isFinite(settings.bleedMm) ? Math.max(0, settings.bleedMm) : 0
  const margin = Number.isFinite(settings.markMarginMm)
    ? Math.max(0, settings.markMarginMm)
    : 0
  const trimWidth = Number.isFinite(settings.trimWidthMm)
    ? Math.max(0, settings.trimWidthMm)
    : 0
  const trimHeight = Number.isFinite(settings.trimHeightMm)
    ? Math.max(0, settings.trimHeightMm)
    : 0

  const inset = bleed + margin
  const marksFit = margin >= MIN_MARK_MARGIN_MM

  return {
    trimWidthMm: trimWidth,
    trimHeightMm: trimHeight,
    bleedMm: bleed,
    markMarginMm: margin,
    mediaWidthMm: trimWidth + inset * 2,
    mediaHeightMm: trimHeight + inset * 2,
    bleedOffsetMm: inset,
    marksFit,
  }
}

/** Crop-mark segments in millimetres, relative to the media box origin.
 *  Returns an empty list when marks are disabled or there is no room for them. */
export function cropMarkSegments(
  geometry: PageGeometry,
  options: { enabled: boolean; lengthMm?: number; gapMm?: number },
): readonly { x1: number; y1: number; x2: number; y2: number }[] {
  if (!options.enabled || !geometry.marksFit) return []

  const length = options.lengthMm ?? 4
  const gap = options.gapMm ?? 1.5
  const { mediaWidthMm, mediaHeightMm, bleedOffsetMm, marksFit } = geometry
  if (!marksFit) return []

  const left = bleedOffsetMm
  const right = mediaWidthMm - bleedOffsetMm
  const top = bleedOffsetMm
  const bottom = mediaHeightMm - bleedOffsetMm

  // Marks sit outside the bleed edge, travelling outward into the mark margin.
  const outerLeft = Math.max(0, left - gap - length)
  const outerRight = Math.min(mediaWidthMm, right + gap + length)
  const outerTop = Math.max(0, top - gap - length)
  const outerBottom = Math.min(mediaHeightMm, bottom + gap + length)
  const innerLeft = Math.max(0, left - gap)
  const innerRight = Math.min(mediaWidthMm, right + gap)
  const innerTop = Math.max(0, top - gap)
  const innerBottom = Math.min(mediaHeightMm, bottom + gap)

  const segments = [
    { x1: outerLeft, y1: top, x2: innerLeft, y2: top },
    { x1: outerLeft, y1: bottom, x2: innerLeft, y2: bottom },
    { x1: innerRight, y1: top, x2: outerRight, y2: top },
    { x1: innerRight, y1: bottom, x2: outerRight, y2: bottom },
    { x1: left, y1: outerTop, x2: left, y2: innerTop },
    { x1: right, y1: outerTop, x2: right, y2: innerTop },
    { x1: left, y1: innerBottom, x2: left, y2: outerBottom },
    { x1: right, y1: innerBottom, x2: right, y2: outerBottom },
  ]

  return segments.filter(
    (segment) => Number.isFinite(segment.x1) && Number.isFinite(segment.y2),
  )
}
