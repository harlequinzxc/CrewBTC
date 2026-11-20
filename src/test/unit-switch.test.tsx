import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SheetSection } from '../features/workspace/inspector/SheetSection'
import { CardSection } from '../features/workspace/inspector/CardSection'
import { computeGrid } from '../lib/imposition/grid'
import { DEFAULT_SHEET } from '../types/imposition'
import { cardFromPage } from '../types/card'

/**
 * Switching units changes what the whole app reads, and nothing else.
 *
 * The setting existed before and was never consulted, so the dropdown moved and every
 * field stayed in millimetres. These tests hold the wire in place from that dropdown to
 * the inspector: the same stored millimetres must render as `67`, `6.7`, or `2.638`
 * depending on one preference, and the suffix inside the box has to move with the number.
 */
const grid = computeGrid(DEFAULT_SHEET)

const sheetSection = (units: 'mm' | 'cm' | 'in') =>
  render(
    <SheetSection
      sheet={DEFAULT_SHEET}
      grid={grid}
      errors={{}}
      onChange={() => undefined}
      onReset={() => undefined}
      units={units}
      showCutMarks
      onShowCutMarksChange={() => undefined}
    />,
  )

describe('the unit setting reaches the sheet panel', () => {
  it('reads the cell height in the document unit', () => {
    const { unmount } = sheetSection('mm')
    expect((screen.getByLabelText('Cell height') as HTMLInputElement).value).toBe('67')
    unmount()

    sheetSection('cm')
    expect((screen.getByLabelText('Cell height') as HTMLInputElement).value).toBe('6.7')
  })

  it('reads an A4 sheet as 21 × 29.7 in centimetres', () => {
    sheetSection('cm')
    expect((screen.getByLabelText('Sheet width') as HTMLInputElement).value).toBe('21')
    expect((screen.getByLabelText('Sheet height') as HTMLInputElement).value).toBe('29.7')
  })

  it('shows inches to three places, because that is what they need', () => {
    sheetSection('in')
    expect((screen.getByLabelText('Cell width') as HTMLInputElement).value).toBe('2.047')
    expect((screen.getByLabelText('Cell height') as HTMLInputElement).value).toBe('2.638')
  })

  it('moves the suffix inside the box with the number', () => {
    const { container, unmount } = sheetSection('mm')
    expect(container.textContent).toContain('mm')
    expect(container.textContent).not.toContain('cm')
    unmount()

    const cm = sheetSection('cm')
    expect(cm.container.textContent).toContain('cm')
  })

  it('reports an edited value back in millimetres, whatever the unit', () => {
    const onChange = vi.fn()
    render(
      <SheetSection
        sheet={DEFAULT_SHEET}
        grid={grid}
        errors={{}}
        onChange={onChange}
        onReset={() => undefined}
        units="cm"
        showCutMarks
        onShowCutMarksChange={() => undefined}
      />,
    )
    const spacing = screen.getByLabelText('Spacing') as HTMLInputElement
    // The field shows 0.4 cm for the 4 mm default, and typing 0.7 means 7 mm.
    expect(spacing.value).toBe('0.4')
    fireEvent.change(spacing, { target: { value: '0.7' } })
    // 0.7 cm is 7 mm: the field converts at its own edge, so the model never sees a unit.
    expect(onChange).toHaveBeenCalledWith({ gutterMm: 7 })
  })
})

describe('the unit setting reaches the card panel', () => {
  const card = cardFromPage({ photo: null, headerText: 'A', bodyText: 'B' }, 67)

  it('reads a band height in the document unit', () => {
    const { unmount } = render(
      <CardSection
        card={card}
        cellIndex={0}
        cellHeightMm={67}
        units="cm"
        onBandsChange={() => undefined}
        onTextScaleChange={() => undefined}
        onReset={() => undefined}
      />,
    )
    // The seeded header band is ~9.5 mm.
    const top = Number((screen.getByLabelText('Top') as HTMLInputElement).value)
    expect(top).toBeGreaterThan(0.5)
    expect(top).toBeLessThan(1.1)
    unmount()
  })

  it('leaves the text percentage a percentage', () => {
    render(
      <CardSection
        card={card}
        cellIndex={0}
        cellHeightMm={67}
        units="cm"
        onBandsChange={() => undefined}
        onTextScaleChange={() => undefined}
        onReset={() => undefined}
      />,
    )
    expect((screen.getByLabelText('Text') as HTMLInputElement).value).toBe('100')
  })
})
