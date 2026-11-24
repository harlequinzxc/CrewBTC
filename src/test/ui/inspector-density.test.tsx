import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SheetSection } from '../../features/workspace/inspector/SheetSection'
import { computeGrid } from '../../lib/imposition/grid'
import { DEFAULT_SHEET } from '../../types/imposition'

/**
 * Spacing and Margin read like Size and Cell, because they are the same kind of thing.
 *
 * They were `w-full` inside a `justify-between` row, so a 4 mm spacing stretched to the
 * whole width of the rail: the number sat at the far right of an empty box with its unit
 * a conspicuous gap away. A single figure is now sized to the same proportion as one half
 * of a `W × H` pair, so the whole column of numbers lines up as one ladder.
 */
const grid = computeGrid(DEFAULT_SHEET)

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

const shell = (label: string): HTMLElement =>
  screen.getByLabelText(label).parentElement as HTMLElement

describe('the sheet panel’s numeric rows', () => {
  it('places all numbers in a consistent two-column grid', () => {
    renderSection()
    for (const label of ['Spacing', 'Margin']) {
      expect(shell(label).className).toContain('w-full')
    }
    const grid = screen.getByLabelText('Sheet width').closest('.grid')
    expect(grid?.className).toContain('grid-cols-2')
    for (const label of ['Sheet width', 'Sheet height', 'Cell width', 'Cell height', 'All text size']) expect(shell(label).className).toContain('w-full')
  })

  it('keeps the number hard against its unit', () => {
    renderSection()
    for (const label of ['Spacing', 'Margin']) {
      const box = shell(label)
      // The input takes the slack, so the suffix sits immediately after the digits
      // instead of being pushed to the far edge by a fixed-width box.
      const input = box.querySelector('input') as HTMLInputElement
      expect(input.className).toContain('w-full')
      expect(input.className).toContain('text-right')
      // One gap, no padding: nothing between the number and its unit.
      expect(box.className).toContain('gap-1')
      expect(box.className).toContain('px-1.5')
    }
  })

  it('gives every numeric field the same height, and it is 28px', () => {
    // 24px was the first pass; at that size the digits sit on the border and the field
    // reads as a readout rather than as something you can type into. The user ruled 28,
    // so 28 is what this asserts — `h-7` is 1.75rem.
    renderSection()
    for (const label of ['Spacing', 'Margin', 'Sheet width', 'Cell height']) {
      expect(shell(label).className).toContain('h-7')
    }
  })

  it('keeps a border that answers hover and focus', () => {
    renderSection()
    for (const label of ['Spacing', 'Margin']) {
      const classes = shell(label).className
      expect(classes).toContain('border-hairline-strong')
      expect(classes).toContain('hover:border-ink-muted')
      expect(classes).toContain('focus-within:border-accent')
    }
  })
})
