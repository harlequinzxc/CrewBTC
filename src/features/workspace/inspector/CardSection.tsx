import { NumberField } from '../../../components/ui/NumberField'
import { ResetButton } from '../../../components/ui/ResetButton'
import {
  BAND_MIN_MM,
  MAX_TEXT_SCALE,
  MIN_TEXT_SCALE,
  PICTURE_MIN_MM,
  clampBands,
  clampTextScale,
} from '../../../types/card'
import type { Card, CardBands } from '../../../types/card'
import { Section } from './Section'

/**
 * The selected card's three numbers, in one row.
 *
 * This is the bottom drawer's content, minus the drawer. Three compact fields sit side by
 * side with their units inline, because a full-width slider for "header height" spends an
 * entire row to express a value between 6 and 55 mm and gives up exact entry to do it.
 * The on-card dividers remain draggable for the coarse gesture; these are for the number.
 */
export interface CardSectionProps {
  readonly card: Card
  readonly cellIndex: number
  readonly cellHeightMm: number
  readonly onBandsChange: (bands: CardBands) => void
  readonly onTextScaleChange: (scale: number) => void
  readonly onReset: () => void
}

export function CardSection(props: CardSectionProps) {
  const { card, cellHeightMm } = props
  const bands = card.bands
  const textScale = card.textScale ?? 1

  // Two boxes plus a legible photo; past this the fields would accept a value the sheet
  // cannot honour, so the inputs are bounded by the same arithmetic the dividers use.
  const ceiling = Math.round(Math.max(BAND_MIN_MM, cellHeightMm - PICTURE_MIN_MM) * 100) / 100

  const set = (change: Partial<CardBands>): void =>
    props.onBandsChange(clampBands({ ...bands, ...change }, cellHeightMm))

  return (
    <Section
      title={`Card ${props.cellIndex + 1}`}
      action={<ResetButton label="Reset card" onClick={props.onReset} />}
    >
      <div className="grid grid-cols-3 gap-1.5">
        <NumberField
          label="Top"
          suffix="mm"
          value={bands.headerMm}
          min={BAND_MIN_MM}
          max={ceiling}
          step={0.5}
          onChange={(headerMm) => set({ headerMm })}
        />
        <NumberField
          label="Bottom"
          suffix="mm"
          value={bands.footerMm}
          min={BAND_MIN_MM}
          max={ceiling}
          step={0.5}
          onChange={(footerMm) => set({ footerMm })}
        />
        <NumberField
          label="Text"
          suffix="%"
          value={Math.round(textScale * 100)}
          min={Math.round(MIN_TEXT_SCALE * 100)}
          max={Math.round(MAX_TEXT_SCALE * 100)}
          step={5}
          onChange={(percent) => props.onTextScaleChange(clampTextScale(percent / 100))}
        />
      </div>
    </Section>
  )
}
