import { Section } from './Section'
import type { Keywords } from '../../../types/format-keywords'

interface Props {
  readonly keywords: Keywords
  readonly onChange: (value: Keywords) => void
  readonly onApply: () => void
  readonly onRemove: () => void
  readonly available: boolean
  readonly busy: boolean
}

export function AutoFormatSection({ keywords, onChange, onApply, onRemove, available, busy }: Props) {
  return (
    <Section title="Automate formatting" collapsible>
      <p className="mb-2 text-[11px] text-ink-secondary">Define keyword or phrase per line for automatic formatting.</p>
      <div className="flex flex-col gap-2">
        {(['crockeries', 'directions', 'condiments'] as const).map((category) => (
          <label key={category} className="flex flex-col gap-1 text-[11px] font-medium uppercase text-ink-secondary">
            {category}
            <textarea
              aria-label={`${category} keywords`}
              value={keywords[category]}
              onChange={(event) => onChange({ ...keywords, [category]: event.target.value })}
              maxLength={10000}
              rows={2}
              className="w-full resize-y rounded border border-hairline bg-[#16181D] px-2 py-1 text-xs normal-case text-[#E4E4E7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              placeholder="One per line"
            />
          </label>
        ))}
        {available ? (
          <div className="flex flex-col gap-1">
            <button type="button" data-target="dense" disabled={busy} onClick={onApply} className="flex min-h-8 items-center justify-center rounded border border-hairline-strong bg-[#1E2028] px-2 py-1 text-xs font-semibold text-ink-primary hover:bg-surface-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50">
              Automate formatting
            </button>
            <button type="button" data-target="dense" disabled={busy} onClick={onRemove} className="flex min-h-8 items-center justify-center rounded border border-hairline px-2 py-1 text-xs font-semibold text-ink-primary hover:bg-surface-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50">
              Remove formatting
            </button>
          </div>
        ) : null}
      </div>
    </Section>
  )
}
