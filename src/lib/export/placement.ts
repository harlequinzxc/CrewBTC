/**
 * The exporter and the preview must agree on geometry, so both import the same
 * functions rather than re-deriving them.
 */
export { planSheets, cutMarksFor } from '../imposition/sheet'
export { containFit } from '../imposition/grid'
export type { SheetPlan, Placement, PageRef } from '../imposition/sheet'
