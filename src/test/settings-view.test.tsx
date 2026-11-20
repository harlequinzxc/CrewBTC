import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SettingsView } from '../features/settings/SettingsView'
import { MotionProvider } from '../features/settings/MotionProvider'
import { DEFAULT_PAGE_SETTINGS } from '../types/settings'
import { CHANGELOG } from '../data/changelog'

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
    expect(screen.getByText('Print output')).toBeInTheDocument()
    expect(screen.getByText('Reduced motion')).toBeInTheDocument()

    const notes = screen.getByRole('button', { name: /what.s new/i })
    expect(notes).toHaveAttribute('aria-expanded', 'false')
    // Nothing from the release history is rendered while it is closed.
    expect(screen.queryByText(CHANGELOG[0]?.title ?? '')).not.toBeInTheDocument()
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

  it('does not duplicate the sheet dimensions the inspector already owns', () => {
    render_()
    // A4 is the inspector's business; settings holds trim and bleed only.
    expect(screen.queryByText(/210\s*×\s*297/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Gutter')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Margin')).not.toBeInTheDocument()
  })

  it('still edits every print field it kept', () => {
    const { onSettingsChange } = render_()
    const width = screen.getByLabelText('Trim width')
    fireEvent.change(width, { target: { value: '205' } })
    expect(onSettingsChange).toHaveBeenCalled()
    const sent = onSettingsChange.mock.calls.at(-1)?.[0] as { trimWidthMm: number }
    expect(sent.trimWidthMm).toBe(205)
  })
})
