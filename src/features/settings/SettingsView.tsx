import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Switch } from '../workspace/inspector/Switch'
import { useMotion } from './use-motion'
import type { PageSettings } from '../../types/settings'
import { UNIT_ORDER, UNITS } from '../../lib/units'
import type { UnitSystem } from '../../lib/units'
import { CHANGELOG } from '../../data/changelog'
import { cn } from '../../lib/cn'

export interface SettingsViewProps {
  readonly settings: PageSettings
  readonly onSettingsChange: (settings: PageSettings) => void
}

/**
 * Settings, in the inspector's own language: titled sections, label-left rows, no prose.
 *
 * One section, because there is one preference that changes anything: the unit the whole
 * interface reads in. Units sits first because it is what people open this dialog for, and
 * because everything else that can be measured — the sheet, the cells, the spacing, a
 * card's boxes — already follows it.
 *
 * The changelog is not a preference, so it is a single collapsed row at the bottom: closed,
 * it costs one line and tells you the version you are on; open, it is the release history.
 *
 * Trim, bleed and crop marks are deliberately absent. They were here, and none of them
 * reached the exporter.
 */
export function SettingsView({ settings, onSettingsChange }: SettingsViewProps) {
  const { choice, setChoice } = useMotion()
  const [notesOpen, setNotesOpen] = useState(false)
  const latest = CHANGELOG[0]

  return (
    <div className="flex flex-col">
      <section className="border-b border-hairline px-4 py-3">
        <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-secondary">
          General
        </h3>

        <div className="flex min-h-6 items-center justify-between">
          <span className="text-[11px] text-ink-secondary">Units</span>
          <select
            aria-label="Units"
            value={settings.units}
            onChange={(event) =>
              onSettingsChange({ ...settings, units: event.target.value as UnitSystem })
            }
            className={cn(
              'h-6 min-h-6 rounded border border-hairline-strong bg-surface-raised px-1.5',
              'text-[11px] text-ink-primary focus-visible:border-accent focus-visible:outline-none',
            )}
          >
            {UNIT_ORDER.map((unit) => (
              <option key={unit} value={unit}>
                {UNITS[unit].label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-1 flex min-h-6 items-center justify-between">
          <span className="text-[11px] text-ink-secondary">Reduced motion</span>
          <Switch
            label="Reduced motion"
            checked={choice === 'on'}
            onChange={(checked) => setChoice(checked ? 'on' : 'off')}
          />
        </div>
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
