import { fromMm, UNITS } from '../../../lib/units'
import type { UnitSystem } from '../../../lib/units'
import type { Card } from '../../../types/card'
import { DEFAULT_TEXT_SCALE } from '../../../types/card-typography'
import { Section } from './Section'

/** Read-only geometry and sheet-wide type size for the selected card. */
export function CardReadout({ card, cellIndex, units }: { readonly card: Card; readonly cellIndex: number; readonly units: UnitSystem }) {
  const entries = [
    { label: 'Top', value: `${fromMm(card.bands.headerMm, units)} ${UNITS[units].suffix}` },
    { label: 'Bottom', value: `${fromMm(card.bands.footerMm, units)} ${UNITS[units].suffix}` },
    { label: 'Text', value: `${Math.round((card.textScale ?? DEFAULT_TEXT_SCALE) * 100)}%` },
  ]
  return (
    <Section title={`Card ${cellIndex + 1}`}>
      <dl className="grid grid-cols-3 gap-1.5">
        {entries.map(({ label, value }) => (
          <div key={label}>
            <dt className="mb-0.5 text-[10px] text-ink-secondary">{label}</dt>
            <dd aria-label={`${label} value`} className="tabular rounded border border-hairline-strong bg-surface-raised px-1.5 py-1 text-[11px] text-ink-primary">{value}</dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}
