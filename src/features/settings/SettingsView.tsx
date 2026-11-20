import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { NumberField } from '../../components/ui/NumberField'
import { Switch } from '../workspace/inspector/Switch'
import { useMotion } from './use-motion'
import type { PageSettings } from '../../types/settings'
import { LIMITS } from '../../types/settings'
import { validatePageSettings } from '../../lib/trim'
import { CHANGELOG } from '../../data/changelog'
import { cn } from '../../lib/cn'

export interface SettingsViewProps {
  readonly settings: PageSettings
  readonly onSettingsChange: (settings: PageSettings) => void
}

/**
 * Settings, in the inspector's own language: titled sections, label-left rows, no prose.
 *
 * Two sections are preferences — print output and motion. The changelog is not, so it is a
 * single collapsed row at the bottom: closed, it costs one line and tells you the version
 * you are on; open, it is the release history. Putting eight releases above the fold is
 * what made the dialog need scrolling to reach a toggle that was already visible on screen.
 *
 * The sheet's own dimensions are deliberately *not* here. A4, gutter and margin belong to
 * the thing on screen and live in the inspector beside it; duplicating them in two panels
 * meant two places to change one number, and two places for them to disagree.
 */
export function SettingsView({ settings, onSettingsChange }: SettingsViewProps) {
  const { choice, setChoice } = useMotion()
  const validation = validatePageSettings(settings)
  const [notesOpen, setNotesOpen] = useState(false)
  const latest = CHANGELOG[0]

  const numberField = (
    key: 'trimWidthMm' | 'trimHeightMm' | 'bleedMm' | 'markMarginMm',
    label: string,
  ): React.ReactNode => (
    <div key={key} className="flex flex-col gap-1">
      <span className="text-[11px] text-ink-secondary">{label}</span>
      <NumberField
        label=""
        name={label}
        suffix="mm"
        value={settings[key]}
        min={0}
        step={0.5}
        onChange={(next) => onSettingsChange({ ...settings, [key]: next })}
        className={cn(validation.errors[key] === undefined ? undefined : 'border-accent')}
      />
    </div>
  )

  return (
    <div className="flex flex-col">
      <section className="border-b border-hairline px-4 py-3">
        <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-secondary">
          Print output
        </h3>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          {numberField('trimWidthMm', 'Trim width')}
          {numberField('trimHeightMm', 'Trim height')}
          {numberField('bleedMm', 'Bleed')}
          {numberField('markMarginMm', 'Crop-mark margin')}
        </div>

        <div className="mt-2 flex min-h-6 items-center justify-between">
          <span className="text-[11px] text-ink-secondary">Units</span>
          <select
            aria-label="Units"
            value={settings.units}
            onChange={(event) =>
              onSettingsChange({ ...settings, units: event.target.value === 'in' ? 'in' : 'mm' })
            }
            className={cn(
              'h-6 min-h-6 rounded border border-hairline bg-surface-raised px-1.5',
              'text-[11px] text-ink-primary focus-visible:border-accent focus-visible:outline-none',
            )}
          >
            <option value="mm">Millimetres</option>
            <option value="in">Inches</option>
          </select>
        </div>

        {validation.ok ? null : (
          <p role="alert" className="mt-2 text-[11px] text-accent-bright">
            Trim must be {LIMITS.minTrimMm}–{LIMITS.maxTrimMm} mm per side.
          </p>
        )}
      </section>

      <section className="flex min-h-9 items-center justify-between border-b border-hairline px-4">
        <span className="text-[11px] text-ink-secondary">Reduced motion</span>
        <Switch
          label="Reduced motion"
          checked={choice === 'on'}
          onChange={(checked) => setChoice(checked ? 'on' : 'off')}
        />
      </section>

      <section>
        <button
          type="button"
          data-target="dense"
          aria-expanded={notesOpen}
          onClick={() => setNotesOpen((open) => !open)}
          className={cn(
            'flex h-9 w-full items-center gap-1.5 px-4 text-left text-[11px] text-ink-secondary',
            'transition-colors duration-150 ease-out',
            'hover:bg-surface-active hover:text-ink-primary focus-visible:bg-surface-active focus-visible:text-ink-primary',
          )}
        >
          <ChevronRight
            aria-hidden
            className={cn(
              'size-3 transition-transform duration-150 ease-out',
              notesOpen && 'rotate-90',
            )}
          />
          <span>What&rsquo;s new</span>
          {latest === undefined ? null : (
            <span className="tabular text-ink-muted">v{latest.version}</span>
          )}
        </button>

        {notesOpen ? (
          <ol className="flex flex-col gap-3 px-4 pb-4 pt-1">
            {CHANGELOG.map((release) => (
              <li key={release.version}>
                <div className="flex items-baseline gap-2">
                  <span className="tabular text-[11px] font-semibold text-accent-bright">
                    v{release.version}
                  </span>
                  <span className="tabular text-[10px] text-ink-muted">{release.date}</span>
                </div>
                <p className="text-[12px] text-ink-primary">{release.title}</p>
                <ul className="mt-1 list-disc pl-4 text-[11px] text-ink-secondary">
                  {release.highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        ) : null}
      </section>
    </div>
  )
}
