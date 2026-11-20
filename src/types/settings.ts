import type { UnitSystem } from '../lib/units'

/**
 * The document's preferences.
 *
 * There is deliberately nothing here about trim, bleed or crop marks. Those settings
 * existed and did nothing: the exporter builds every page from the sheet's own dimensions
 * and has never read a trim box, and the switches that claimed to add bleed and trim marks
 * were not connected to it. A control that cannot change the output is worse than no
 * control, so they are gone rather than left to imply a print pipeline that does not
 * exist. The sheet's size is chosen in the inspector, where its measurements are.
 *
 * `units` is a display preference only. Every stored dimension stays in millimetres.
 */
export interface PageSettings {
  readonly units: UnitSystem
}

export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  units: 'mm',
}

/** A settings record read back from storage may predate this shape. */
export const normalisePageSettings = (value: unknown): PageSettings => {
  if (typeof value !== 'object' || value === null) return DEFAULT_PAGE_SETTINGS
  const units = (value as { units?: unknown }).units
  return { units: units === 'cm' || units === 'in' ? units : 'mm' }
}
