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
import type { UnitSystem } from '../../../lib/units'
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
  readonly units: UnitSystem
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
      {/*
        Three columns, each label stacked above its box rather than sitting inside it.
        Inline, `Top` + two digits + `mm` is more furniture than figure in 74px, so the
        number gets whatever the label leaves — which for a three-digit value in
        centimetres is nothing. Above, each column is a heading and a box that is all
        number.
      */}
      <div className="grid grid-cols-3 gap-1.5">
        {/* The two box heights are geometry, so they follow the document's unit like
            every other length; the text scale is a percentage and does not. */}
        <NumberField
          label="Top"
          labelAbove
          groupClassName="w-full"
          valueMm={bands.headerMm}
          units={props.units}
          min={BAND_MIN_MM}
          max={ceiling}
          onChangeMm={(headerMm) => set({ headerMm })}
          className="w-full"
        />
        <NumberField
          label="Bottom"
          labelAbove
          groupClassName="w-full"
          valueMm={bands.footerMm}
          units={props.units}
          min={BAND_MIN_MM}
          max={ceiling}
          onChangeMm={(footerMm) => set({ footerMm })}
          className="w-full"
        />
        <NumberField
          label="Text"
          labelAbove
          groupClassName="w-full"
          suffix="%"
          value={Math.round(textScale * 100)}
          min={Math.round(MIN_TEXT_SCALE * 100)}
          max={Math.round(MAX_TEXT_SCALE * 100)}
          step={5}
          onChange={(percent) => props.onTextScaleChange(clampTextScale(percent / 100))}
          className="w-full"
        />
      </div>
    </Section>
  )
}
