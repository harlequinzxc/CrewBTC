import 'fake-indexeddb/auto'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'

function mockMatchMedia(width = 1440): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes('min-width: 64rem') ? width >= 1024 : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })
}

beforeEach(() => {
  localStorage.clear()
  mockMatchMedia(1440)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('App shell', () => {
  it('mounts the single-screen workspace with no navigation rail', async () => {
    render(<App />)

    // The chrome: a top bar, a Files rail, the canvas, and the inspector. Nothing else.
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Files' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Inspector' })).toBeInTheDocument()

    // One action per area: exactly one add control, in the queue, and no second copy in a
    // header. This is the regression the redesign exists to fix.
    expect(screen.getAllByRole('button', { name: /add pdfs/i })).toHaveLength(1)

    // Export is a single control, disabled with an empty batch.
    expect(screen.getByRole('button', { name: /export pdf/i })).toBeDisabled()

    // Zoom lives in the top bar, at the same value the sheet is drawn at.
    expect(screen.getByLabelText(/^Zoom level/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fit to window' })).toBeInTheDocument()
  })

  it('shows the grid arithmetic in the inspector, where the numbers are', async () => {
    render(<App />)
    const inspector = await screen.findByRole('complementary', { name: 'Inspector' })
    // Twelve cells at 52 × 67 mm is the whole point of the sheet; it is stated once,
    // beside the cell size that produces it, and never repeated in the top bar.
    expect(inspector.textContent).toContain('12 cells')
    // …and nowhere else in the chrome: the changelog may mention it, the top bar may not.
    expect(screen.getByRole('banner').textContent).not.toContain('cells')
  })

  it('opens settings as a dialog and closes it again', async () => {
    render(<App />)
    screen.getByRole('button', { name: 'Settings' }).click()
    const dialog = await screen.findByRole('dialog', { name: 'Settings' })
    expect(dialog).toBeInTheDocument()
    screen.getByRole('button', { name: 'Close settings' }).click()
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument()
    })
  })

  it('renders the reduced-motion switch in Settings and persists the choice', async () => {
    render(<App />)
    screen.getByRole('button', { name: 'Settings' }).click()

    const toggle = await screen.findByRole('switch', { name: 'Reduced motion' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    toggle.click()
    await waitFor(() => {
      expect(localStorage.getItem('ps.reduced-motion')).toBe('on')
    })
    expect(document.documentElement.dataset['reducedMotion']).toBe('true')
  })

  it('shows the desktop-only notice below 1024px', () => {
    mockMatchMedia(500)
    render(<App />)
    expect(screen.getByText('Designed for desktop')).toBeInTheDocument()
  })
})
