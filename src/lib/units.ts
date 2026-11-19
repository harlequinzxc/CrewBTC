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

/** Converts a value between display units without losing precision in storage. */
export const fromMm = (mm: number, units: 'mm' | 'in'): number =>
  units === 'in' ? round(mmToIn(mm), 3) : roundMm(mm)

export const toMm = (value: number, units: 'mm' | 'in'): number =>
  units === 'in' ? roundMm(inToMm(value)) : roundMm(value)

export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
