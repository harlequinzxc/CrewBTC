export const MM_PER_INCH = 25.4
export const PT_PER_INCH = 72
export const PT_PER_MM = PT_PER_INCH / MM_PER_INCH

export const mmToPt = (mm: number): number => mm * PT_PER_MM
export const ptToMm = (pt: number): number => pt / PT_PER_MM
export const inToMm = (inches: number): number => inches * MM_PER_INCH
export const mmToIn = (mm: number): number => mm / MM_PER_INCH

const round = (value: number, decimals: number): number => {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/** Round to hundredths of a millimetre — below print tolerance, above float noise. */
export const roundMm = (mm: number): number => round(mm, 2)

export const formatMm = (mm: number): string => `${roundMm(mm).toFixed(2)} mm`
export const formatPt = (pt: number): string => `${round(pt, 2).toFixed(2)} pt`

/**
 * The unit the interface is reading in.
 *
 * Nothing is ever stored in any of these: every dimension in the model and in the PDF is
 * millimetres, and a unit is a *display* choice made at the last moment. That is the only
 * way one switch can change the whole app without a single value drifting — `210` stays
 * `210` in memory and only reads as `21` on screen.
 */
export type UnitSystem = 'mm' | 'cm' | 'in'

export interface UnitSpec {
  /** How many millimetres one of these units is. */
  readonly mm: number
  /** Short suffix printed inside a field. */
  readonly suffix: string
  /** Decimal places a typed value is kept to. */
  readonly decimals: number
  /** Smallest step the arrow keys move by, in this unit. */
  readonly step: number
  /** Full name, for the dropdown. */
  readonly label: string
}

export const UNITS: Readonly<Record<UnitSystem, UnitSpec>> = {
  mm: { mm: 1, suffix: 'mm', decimals: 2, step: 0.5, label: 'Millimetres (mm)' },
  cm: { mm: 10, suffix: 'cm', decimals: 2, step: 0.1, label: 'Centimetres (cm)' },
  in: { mm: MM_PER_INCH, suffix: 'in', decimals: 3, step: 0.05, label: 'Inches (in)' },
}

export const UNIT_ORDER: readonly UnitSystem[] = ['mm', 'cm', 'in']

/**
 * A stored millimetre value as the number the field should show.
 *
 * Trailing zeros are dropped by `fromMm`'s rounding, so 25.4 mm reads as `1` in inches
 * rather than `1.000`, and 210 mm reads as `21` in centimetres rather than `21.00`.
 */
export const fromMm = (mm: number, units: UnitSystem): number =>
  round(mm / UNITS[units].mm, UNITS[units].decimals)

/**
 * A typed number back to millimetres.
 *
 * This is the round trip that has to stay honest: `21` cm → 210 mm exactly, `8.27` in →
 * 210.058 mm (which is what 8.27 inches *is*), and the exporter keeps whatever comes out
 * rather than snapping it back to a "nice" figure. Typing a value in inches is therefore
 * slightly lossy by nature — that is arithmetic, not a bug — but nothing is lost by the
 * *switch* itself, because switching never rewrites the numbers.
 */
export const toMm = (value: number, units: UnitSystem): number => roundMm(value * UNITS[units].mm)

export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
