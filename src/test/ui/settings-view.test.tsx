import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SettingsView } from '../../features/settings/SettingsView'
import { MotionProvider } from '../../features/settings/MotionProvider'
import { DEFAULT_PAGE_SETTINGS } from '../../types/settings'
import { CHANGELOG } from '../../data/changelog'

const render_ = () => {
  const onSettingsChange = vi.fn()
  render(
    <MotionProvider>
      <SettingsView settings={DEFAULT_PAGE_SETTINGS} onSettingsChange={onSettingsChange} />
    </MotionProvider>,
  )
  return { onSettingsChange }
}

/**
 * Settings is scannable: preferences first, release history folded away.
 *
 * The previous version stacked every changelog entry above the fold, so reaching
 * "Reduced motion" meant scrolling past eight releases. The notes are still all there —
 * one disclosure away — because release history is worth keeping, just not worth showing.
 */
describe('settings', () => {
  it('shows the preferences without the changelog', () => {
    render_()
    expect(screen.getByText('Units')).toBeInTheDocument()
    expect(screen.getByText('Reduced motion')).toBeInTheDocument()

    const notes = screen.getByRole('button', { name: /what.s new/i })
    expect(notes).toHaveAttribute('aria-expanded', 'false')
    // Nothing from the release history is rendered while it is closed.
    expect(screen.queryByText(CHANGELOG[0]?.title ?? '')).not.toBeInTheDocument()
  })

  it('puts units first, then motion, then the release notes', () => {
    render_()
    const mark = (node: Element | null): number => {
      if (node === null) throw new Error('missing node')
      return Array.from(document.body.querySelectorAll('*')).indexOf(node)
    }
    const units = mark(screen.getByLabelText('Units'))
    const motion = mark(screen.getByLabelText('Reduced motion'))
    const notes = mark(screen.getByRole('button', { name: /what.s new/i }))

    expect(units).toBeGreaterThan(mark(screen.getByText('General')))
    expect(motion).toBeGreaterThan(units)
    expect(notes).toBeGreaterThan(motion)
  })

  it('offers millimetres, centimetres and inches', () => {
    render_()
    const select = screen.getByLabelText('Units') as HTMLSelectElement
    expect([...select.options].map((option) => option.value)).toEqual(['mm', 'cm', 'in'])
    expect([...select.options].map((option) => option.textContent)).toEqual([
      'Millimetres (mm)',
      'Centimetres (cm)',
      'Inches (in)',
    ])
  })

  it('changes only the display unit, never a stored dimension', () => {
    const { onSettingsChange } = render_()
    fireEvent.change(screen.getByLabelText('Units'), { target: { value: 'cm' } })
    // Nothing else moves: the model is millimetres, and a unit is how it is read.
    expect(onSettingsChange).toHaveBeenCalledWith({ units: 'cm' })
  })

  it('names the current version on the closed row', () => {
    render_()
    const notes = screen.getByRole('button', { name: /what.s new/i })
    expect(notes.textContent).toContain(`v${CHANGELOG[0]?.version}`)
  })

  it('expands the release history on demand, newest first', () => {
    render_()
    const notes = screen.getByRole('button', { name: /what.s new/i })
    fireEvent.click(notes)
    expect(notes).toHaveAttribute('aria-expanded', 'true')

    // Every release is present, including the newest, and the version tags are in order.
    const versions = screen.getAllByText(/^v\d+\.\d+\.\d+$/)
    expect(versions.length).toBeGreaterThanOrEqual(CHANGELOG.length)
    const first = CHANGELOG[0]
    expect(first).toBeDefined()
    if (first !== undefined) {
      // Appears twice on purpose: on the collapsed row and as the newest entry.
      expect(screen.getAllByText(`v${first.version}`).length).toBeGreaterThanOrEqual(2)
      expect(screen.getByText(first.title)).toBeInTheDocument()
    }

    fireEvent.click(notes)
    expect(notes).toHaveAttribute('aria-expanded', 'false')
  })

  it('has no trim, bleed or crop-mark controls', () => {
    render_()
    // These were here and never reached the exporter. A control that cannot change the
    // output is worse than no control, so none of them should come back by accident.
    for (const label of ['Print output', 'Bleed', 'Crop-mark margin', 'Trim width', 'Trim height']) {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    }
    // And the sub-line that only existed to explain them is gone with them.
    expect(screen.queryByText(/global defaults for every sheet/i)).not.toBeInTheDocument()
  })
})
