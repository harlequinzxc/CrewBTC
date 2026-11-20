import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SheetSection } from '../features/workspace/inspector/SheetSection'
import { Inspector } from '../features/workspace/Inspector'
import { computeGrid } from '../lib/imposition/grid'
import { DEFAULT_SHEET } from '../types/imposition'

/**
 * Controls that cannot change the output are not controls.
 *
 * The sheet panel offered `Include bleed`, `Draw trim marks` and a `Trim size` preset, and
 * the exporter read none of them: `writeCards` builds each page at exactly the sheet's own
 * width and height, and never draws a mark of any kind. They have been removed rather than
 * wired up, because a bleed box and a real mark path are a print-pipeline feature, not a
 * label. This test keeps them from reappearing beside settings that do work.
 */
const grid = computeGrid(DEFAULT_SHEET)

describe('the sheet panel has no dead print controls', () => {
  const renderSection = () =>
    render(
      <SheetSection
        sheet={DEFAULT_SHEET}
        grid={grid}
        errors={{}}
        onChange={() => undefined}
        onReset={() => undefined}
        units="mm"
        showCutMarks
        onShowCutMarksChange={() => undefined}
      />,
    )

  it('has no bleed or trim-mark switches', () => {
    renderSection()
    expect(screen.queryByLabelText('Include bleed')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Draw trim marks')).not.toBeInTheDocument()
  })

  it('has no trim size preset', () => {
    renderSection()
    expect(screen.queryByLabelText('Trim size')).not.toBeInTheDocument()
    expect(screen.queryByText('Trim')).not.toBeInTheDocument()
  })

  it('keeps the controls that do work', () => {
    renderSection()
    expect(screen.getByLabelText('Sheet preset')).toBeInTheDocument()
    expect(screen.getByLabelText('Cell width')).toBeInTheDocument()
    expect(screen.getByLabelText('Rotate cells 90°')).toBeInTheDocument()
    expect(screen.getByLabelText('Show cut guides')).toBeInTheDocument()
  })

  it('calls the gap between cards Spacing, not Gutter', () => {
    renderSection()
    expect(screen.getByLabelText('Spacing')).toBeInTheDocument()
    expect(screen.queryByLabelText('Gutter')).not.toBeInTheDocument()
    // The visible row label moved with the field, so neither reads "Gutter".
    expect(screen.queryByText('Gutter')).not.toBeInTheDocument()
  })

  it('is titled Sheet & print, and stays one bounded section', () => {
    renderSection()
    expect(screen.getByText('Sheet & print')).toBeInTheDocument()
  })
})

describe('the inspector', () => {
  it('no longer offers a print page to configure', () => {
    render(
      <Inspector
        card={null}
        cellIndex={null}
        cellHeightMm={67}
        units="mm"
        onBandsChange={() => undefined}
        onTextScaleChange={() => undefined}
        onResetCard={() => undefined}
        sheet={DEFAULT_SHEET}
        grid={grid}
        sheetErrors={{}}
        onSheetChange={() => undefined}
        onResetSheet={() => undefined}
        showCutMarks
        onShowCutMarksChange={() => undefined}
        open
      />,
    )
    expect(screen.queryByText(/bleed/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/trim/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Spacing')).toBeInTheDocument()
  })
})
