import 'fake-indexeddb/auto'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'

/**
 * A narrow window must not throw the work away.
 *
 * The app is desktop-first by decision, but the notice below 1024px used to *replace* the
 * workspace, which unmounted it. Everything the session holds — the uploaded PDFs, the
 * photos pulled out of them, every card edit — lives only in React state, so an unmount is
 * data loss: drag the window narrow and back and the sheet is gone. These tests hold the
 * fix in place: the workspace stays mounted, hidden, and comes back intact.
 */

/** A matchMedia that reports the breakpoint, and can be told it changed. */
const installMediaQuery = (initial: boolean) => {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const state = { desktop: initial }

  const matches = (): boolean => state.desktop

  vi.stubGlobal(
    'matchMedia',
    (query: string) => ({
      matches: matches(),
      media: query,
      onchange: null,
      addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener)
      },
      removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener)
      },
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  )

  return {
    resizeTo(desktop: boolean) {
      state.desktop = desktop
      for (const listener of listeners) {
        listener({ matches: desktop } as MediaQueryListEvent)
      }
    },
  }
}

describe('below the desktop breakpoint', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the notice instead of the workspace', () => {
    installMediaQuery(false)
    render(<App />)
    expect(screen.getByText('Designed for desktop')).toBeInTheDocument()
  })

  it('keeps the workspace mounted, not unmounted', () => {
    installMediaQuery(false)
    render(<App />)
    // The shell is in the document but hidden. `queryByRole` cannot see it — that is the
    // point of `aria-hidden` — so look at the DOM directly.
    const header = document.querySelector('header')
    expect(header).not.toBeNull()
    expect(header?.closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('brings the sheet back when the window widens again', () => {
    const media = installMediaQuery(true)
    render(<App />)
    expect(screen.getByRole('banner')).toBeInTheDocument()

    act(() => media.resizeTo(false))
    expect(screen.getByText('Designed for desktop')).toBeInTheDocument()

    act(() => media.resizeTo(true))
    // Still the same mounted tree: the top bar never left the document.
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.queryByText('Designed for desktop')).not.toBeInTheDocument()
  })

  it('is hidden from assistive tech and from the tab order while narrow', () => {
    const media = installMediaQuery(true)
    render(<App />)
    expect(document.querySelector('[inert]')).toBeNull()

    act(() => media.resizeTo(false))
    const hidden = document.querySelector('[inert]')
    expect(hidden).not.toBeNull()
    expect(hidden?.getAttribute('aria-hidden')).toBe('true')
  })
})
