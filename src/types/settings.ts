export type UnitSystem = 'mm' | 'in'

/** Physical output settings. Every export dimension derives from this. */
export interface PageSettings {
  /** Trim width in millimetres. */
  readonly trimWidthMm: number
  /** Trim height in millimetres. */
  readonly trimHeightMm: number
  /** Bleed on all sides in millimetres. `0` disables bleed. */
  readonly bleedMm: number
  /** Clear space reserved outside the bleed for crop marks, in millimetres. */
  readonly markMarginMm: number
  readonly units: UnitSystem
}

export interface TrimPreset {
  readonly id: string
  readonly label: string
  readonly widthMm: number
  readonly heightMm: number
}

export const TRIM_PRESETS: readonly TrimPreset[] = [
  { id: 'a4', label: 'A4 — 210 × 297 mm', widthMm: 210, heightMm: 297 },
  { id: 'a5', label: 'A5 — 148 × 210 mm', widthMm: 148, heightMm: 210 },
  { id: 'a3', label: 'A3 — 297 × 420 mm', widthMm: 297, heightMm: 420 },
  { id: 'letter', label: 'US Letter — 8.5 × 11 in', widthMm: 215.9, heightMm: 279.4 },
  { id: 'legal', label: 'US Legal — 8.5 × 14 in', widthMm: 215.9, heightMm: 355.6 },
  { id: 'square', label: 'Square — 210 × 210 mm', widthMm: 210, heightMm: 210 },
]

export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  trimWidthMm: 210,
  trimHeightMm: 297,
  bleedMm: 3,
  markMarginMm: 5,
  units: 'mm',
}

/** Bounds that keep the export geometry physically meaningful. */
export const LIMITS = {
  minTrimMm: 50,
  maxTrimMm: 1200,
  maxBleedMm: 20,
  minMarkMarginMm: 0,
  maxMarkMarginMm: 20,
} as const
