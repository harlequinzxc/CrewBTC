import { Card } from '../../components/ui/Card'
import { Toggle } from '../../components/ui/Toggle'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { useMotion } from './use-motion'
import type { PageSettings } from '../../types/settings'
import { LIMITS } from '../../types/settings'
import { validatePageSettings } from '../../lib/trim'
import { CHANGELOG } from '../../data/changelog'

export interface SettingsViewProps {
  readonly settings: PageSettings
  readonly onSettingsChange: (settings: PageSettings) => void
}

export function SettingsView({ settings, onSettingsChange }: SettingsViewProps) {
  const { choice, setChoice } = useMotion()
  const validation = validatePageSettings(settings)

  const numberField = (
    key: 'trimWidthMm' | 'trimHeightMm' | 'bleedMm' | 'markMarginMm',
    label: string,
  ): React.ReactNode => (
    <Input
      key={key}
      label={label}
      type="number"
      inputMode="decimal"
      suffix="mm"
      value={String(settings[key])}
      error={validation.errors[key]}
      onChange={(event) => {
        const next = Number(event.target.value)
        onSettingsChange({ ...settings, [key]: Number.isFinite(next) ? next : 0 })
      }}
    />
  )

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-5 overflow-y-auto p-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-50">Settings</h1>
        <p className="mt-0.5 text-sm text-zinc-400">
          Applies to every export in this browser. Stored locally.
        </p>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-zinc-100">Print output</h2>
        <div className="mt-4 grid grid-cols-2 gap-4">
          {numberField('trimWidthMm', 'Trim width')}
          {numberField('trimHeightMm', 'Trim height')}
          {numberField('bleedMm', 'Bleed')}
          {numberField('markMarginMm', 'Crop-mark margin')}
        </div>
        <div className="mt-4">
          <Select
            label="Units"
            value={settings.units}
            onChange={(event) =>
              onSettingsChange({
                ...settings,
                units: event.target.value === 'in' ? 'in' : 'mm',
              })
            }
            options={[
              { value: 'mm', label: 'Millimetres' },
              { value: 'in', label: 'Inches' },
            ]}
          />
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Trim size is limited to {LIMITS.minTrimMm}–{LIMITS.maxTrimMm} mm per side.
        </p>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-zinc-100">Motion</h2>
        <div className="mt-3">
          <Toggle
            label="Reduced motion"
            description="Removes sliding and scaling. State changes cross-fade instead."
            checked={choice === 'on'}
            onChange={(checked) => setChoice(checked ? 'on' : 'off')}
          />
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-zinc-100">What&rsquo;s new</h2>
        <ol className="mt-3 flex flex-col gap-3">
          {CHANGELOG.map((release) => (
            <li key={release.version}>
              <div className="flex items-baseline gap-2">
                <span className="tabular text-xs font-semibold text-red-400">
                  v{release.version}
                </span>
                <span className="text-xs text-zinc-500">{release.date}</span>
              </div>
              <p className="text-sm text-zinc-200">{release.title}</p>
              <ul className="mt-1 list-disc pl-5 text-xs text-zinc-400">
                {release.highlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}
