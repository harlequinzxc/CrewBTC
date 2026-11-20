import 'fake-indexeddb/auto'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../App'

/**
 * The chrome's skeleton, as geometry.
 *
 * These are the numbers the redesign is actually about — a 48px bar, a 220px queue, a
 * 260px inspector, and a canvas that takes everything left over. jsdom does not lay
 * anything out, so the classes that *carry* those numbers are asserted directly; a future
 * edit that quietly widens a rail or grows the bar fails here rather than shipping.
 */

function desktop(width = 1440): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes('min-width: 64rem') ? width >= 1024 : false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  })
}

describe('chrome geometry', () => {
  it('is a 48px bar over a 220px queue, a canvas, and a 260px inspector', () => {
    desktop()
    render(<App />)

    const bar = screen.getByRole('banner')
    expect(bar.className).toContain('h-12')

    const files = screen.getByRole('complementary', { name: 'Files' })
    expect(files.className).toContain('w-[220px]')

    const inspector = screen.getByRole('complementary', { name: 'Inspector' })
    expect(inspector.className).toContain('w-[260px]')
  })

  it('gives the sheet the whole area between the bar and the window bottom', () => {
    desktop()
    render(<App />)

    const main = screen.getByRole('main')
    // No second row, no docked drawer: one flex row that consumes the remaining height.
    expect(main.className).toContain('flex-1')
    expect(main.className).toContain('min-h-0')
    // The old bottom band panel is gone; nothing renders below the canvas.
    expect(screen.queryByTestId('band-panel')).not.toBeInTheDocument()
  })

  it('drives the zoom readout from the sheet scale', () => {
    desktop()
    render(<App />)

    const bar = screen.getByRole('banner')
    const percent = within(bar).getByLabelText(/^Zoom level/)
    // Fit is the default, and a fitted sheet is drawn at some positive percentage.
    expect(percent.textContent).toMatch(/^\d+%$/)
    expect(within(bar).getByRole('button', { name: 'Fit to window' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('moves the sheet when the bar steps, then returns to Fit', () => {
    desktop()
    render(<App />)

    const level = screen.getByLabelText(/^Zoom level/)
    const fitted = level.textContent
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(level.textContent).not.toBe(fitted)
    expect(screen.getByRole('button', { name: 'Fit to window' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Fit to window' }))
    expect(level.textContent).toBe(fitted)
    expect(screen.getByRole('button', { name: 'Fit to window' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})
