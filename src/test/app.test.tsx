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
  it('mounts the workspace with all three panes at desktop width', async () => {
    render(<App />)

    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Workspace' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Queue' })).toBeInTheDocument()
    expect(screen.getByText('Sheet & cells')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /export current pdf/i })).toBeDisabled()
    expect(screen.getByText(/no PDFs yet/i)).toBeInTheDocument()
    // The dead-button regression: these must be wired, not decorative.
    expect(screen.getAllByRole('button', { name: /add pdfs/i }).length).toBeGreaterThan(0)
    // The grid engine's result must be visible without any PDF loaded.
    expect(screen.getByText('3 × 4 = 12 per sheet')).toBeInTheDocument()
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
