import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SettingsDialog } from '../features/settings/SettingsDialog'
import { MotionProvider } from '../features/settings/MotionProvider'
import { DEFAULT_PAGE_SETTINGS } from '../types/settings'

/**
 * A native `<dialog>` is positioned by the user agent, not by its parent, so a centred
 * grid or flex wrapper does nothing for it: without `m-auto` the panel sits in the
 * top-left corner and reads as a drawer sliding in rather than a modal. That is a one-word
 * regression with no other symptom, so it is pinned here.
 */
const open = (): void => {
  render(
    <MotionProvider>
      <SettingsDialog
        open
        onClose={() => undefined}
        settings={DEFAULT_PAGE_SETTINGS}
        onSettingsChange={() => undefined}
      />
    </MotionProvider>,
  )
}

describe('the settings dialog', () => {
  it('centres itself in the viewport', () => {
    open()
    const dialog = screen.getByRole('dialog', { name: 'Settings' })
    expect(dialog.className).toContain('m-auto')
    // ...and does not pin itself to a corner instead.
    expect(dialog.className).not.toMatch(/\b(absolute|fixed)\b/)
  })

  it('is a bounded panel, not a full-bleed drawer', () => {
    open()
    const dialog = screen.getByRole('dialog', { name: 'Settings' })
    expect(dialog.className).toContain('w-[min(32rem,calc(100vw-32px))]')
    expect(dialog.className).not.toContain('h-full')
    expect(dialog.className).not.toContain('inset-y-0')
  })

  it('is announced as a modal with a name', () => {
    open()
    const dialog = screen.getByRole('dialog', { name: 'Settings' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })
})
