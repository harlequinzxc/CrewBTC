import { fromMm, UNITS } from '../../../lib/units'
import type { UnitSystem } from '../../../lib/units'
import type { Card, CardBands } from '../../../types/card'
import { Section } from './Section'

interface Props {
  readonly card: Card | null
  readonly bands: CardBands
  readonly units: UnitSystem
  readonly onSave: (bands: CardBands) => void
  readonly onReset: () => void
}
export function CardDefaults({ card, bands, units, onSave, onReset }: Props) {
  const label = (mm: number) => `${fromMm(mm, units)} ${UNITS[units].suffix}`
  const button = 'min-h-8 rounded border border-hairline px-2 text-xs text-ink-primary hover:bg-surface-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50'
  const help = `Top ${label(bands.headerMm)} · Bottom ${label(bands.footerMm)}. Applies only to new cards; smaller cells may clamp heights. Text size remains sheet-wide.`
  return <Section title="New card defaults" collapsible action={<button type="button" data-target="dense" aria-label={`New card defaults: ${help}`} title={help} className="inline-flex size-8 items-center justify-center rounded text-xs text-ink-secondary hover:bg-surface-active focus-visible:bg-surface-active">?</button>}>
    <p className="tabular mb-1 text-[11px] text-ink-secondary">Top {label(bands.headerMm)} · Bottom {label(bands.footerMm)}</p>
    <div className="flex flex-wrap gap-1">
      <button type="button" data-target="dense" disabled={card === null} onClick={() => { if (card !== null) onSave(card.bands) }} className={button}>Use selected card</button>
      <button type="button" data-target="dense" onClick={onReset} className={button}>Reset defaults</button>
    </div>
  </Section>
}
