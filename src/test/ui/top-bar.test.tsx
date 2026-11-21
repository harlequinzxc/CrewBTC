import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TopBar } from '../../components/layout/TopBar'
import { MAX_ZOOM, MIN_ZOOM } from '../../lib/zoom'

const base = {
  paper: { widthMm: 210, heightMm: 297 },
  sheetCount: 2,
  scale: 1,
  fitting: true,
  exporting: false,
  hasBatch: true,
  hasMoreThanOneSheet: true,
} as const

const render_ = (overrides: Partial<React.ComponentProps<typeof TopBar>> = {}) => {
  const props = {
    ...base,
    onStep: vi.fn(),
    onFit: vi.fn(),
    onOpenSettings: vi.fn(),
    onExportCurrent: vi.fn(),
    onExportAll: vi.fn(),
    inspectorOpen: true,
    onToggleInspector: vi.fn(),
    ...overrides,
  }
  render(<TopBar {...props} />)
  return props
}

describe('the top bar', () => {
  it('offers a pressed PDF preview toggle beside export', () => {
    const props = render_({ previewOpen: false, onTogglePreview: vi.fn() })
    const toggle = screen.getByRole('button', { name: 'Preview PDF' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(toggle)
    expect(props.onTogglePreview).toHaveBeenCalledTimes(1)
  })

  it('prints the paper size and the sheet count, once', () => {
    render_()
    expect(screen.getByText('210 × 297 mm · 2 sheets')).toBeInTheDocument()
  })

  it('says "sheet" for a single sheet', () => {
    render_({ sheetCount: 1 })
    expect(screen.getByText('210 × 297 mm · 1 sheet')).toBeInTheDocument()
  })

  it('labels a fitted percentage as fitted, not as a scale you chose', () => {
    render_({ scale: 2.83, fitting: true })
    const level = screen.getByLabelText('Zoom level, fitted to width')
    expect(level.textContent).toBe('283%')
  })

  it('leaves Fit un-pressed, because it is a momentary action', () => {
    // The app already rests in width-fit, so a lit Fit described the default state while
    // looking like a chosen one. It must not report a pressed state even while fitted.
    render_({ scale: 2.83, fitting: true })
    const fit = screen.getByRole('button', { name: 'Fit sheet to width' })
    expect(fit).not.toHaveAttribute('aria-pressed')
    expect(fit.className).not.toContain('bg-accent')
  })

  it('shows the live scale and the three zoom controls', () => {
    const props = render_({ scale: 1.94, fitting: false })
    expect(screen.getByLabelText(/^Zoom level/).textContent).toBe('194%')

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(props.onStep).toHaveBeenCalledWith(1)
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    expect(props.onStep).toHaveBeenCalledWith(-1)
    fireEvent.click(screen.getByRole('button', { name: 'Fit sheet to width' }))
    expect(props.onFit).toHaveBeenCalled()
  })

  it('refuses to step past either end of the zoom ladder', () => {
    render_({ scale: MAX_ZOOM })
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled()

    render_({ scale: MIN_ZOOM })
    // Two renders in one test: the second bar's zoom-out is at the floor.
    const outs = screen.getAllByRole('button', { name: 'Zoom out' })
    expect(outs.at(-1)).toBeDisabled()
  })

  it('opens settings from the gear', () => {
    const props = render_()
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(props.onOpenSettings).toHaveBeenCalled()
  })

  it('exports the current sheet from the primary button', () => {
    const props = render_()
    fireEvent.click(screen.getByRole('button', { name: 'Export PDF' }))
    expect(props.onExportCurrent).toHaveBeenCalled()
  })

  it('keeps the second export route in a menu rather than a second button', () => {
    const props = render_()
    // One visible export label on screen until the menu is opened.
    expect(screen.getAllByText('Export')).toHaveLength(1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Export options' }))
    const menu = screen.getByRole('menu')
    expect(within(menu).getByText('This sheet')).toBeInTheDocument()
    expect(within(menu).getByText('All sheets')).toBeInTheDocument()

    fireEvent.click(within(menu).getByText('All sheets'))
    expect(props.onExportAll).toHaveBeenCalled()
    // Choosing closes the menu.
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('disables export with nothing loaded', () => {
    render_({ hasBatch: false })
    expect(screen.getByRole('button', { name: 'Export PDF' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Export options' })).toBeDisabled()
  })

  it('hides the all-sheets option when there is only one sheet', () => {
    render_({ sheetCount: 1, hasMoreThanOneSheet: false })
    fireEvent.click(screen.getByRole('button', { name: 'Export options' }))
    const menu = screen.getByRole('menu')
    // "This sheet" and "All sheets" would be the same file; offering both is noise.
    expect(within(menu).getByText('This sheet')).toBeInTheDocument()
    expect(within(menu).queryByText('All sheets')).not.toBeInTheDocument()
  })
})
