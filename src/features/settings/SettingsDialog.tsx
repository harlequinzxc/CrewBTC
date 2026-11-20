import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { SettingsView } from './SettingsView'
import type { PageSettings } from '../../types/settings'

/**
 * Settings, as a centred dialog rather than a whole screen behind a nav rail.
 *
 * The rail existed to switch between two views. With the view gone there is nowhere for
 * the rail to live and nothing for it to switch, so settings arrives where you are, over
 * the sheet you were just editing, and closes back to it.
 *
 * A native `<dialog>` opened with `showModal()` gives the focus trap, the backdrop, the
 * `aria-modal` semantics and Escape-to-close for free — and it is the element assistive
 * tech already knows how to announce.
 */
export interface SettingsDialogProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly settings: PageSettings
  readonly onSettingsChange: (settings: PageSettings) => void
}

export function SettingsDialog({ open, onClose, settings, onSettingsChange }: SettingsDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog === null) return

    if (open) {
      // `showModal` is what supplies the focus trap and the inert backdrop. Older DOMs and
      // jsdom do not implement it, so the element falls back to the `open` attribute — it
      // still renders and is still announced, it simply is not modal there.
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') dialog.showModal()
        else dialog.setAttribute('open', '')
      }
      // Focus lands on the panel, not on the first field: the point of opening Settings is
      // usually to read what is there.
      dialog.querySelector<HTMLElement>('[data-settings-panel]')?.focus()
      return
    }

    if (dialog.open || dialog.hasAttribute('open')) {
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
    }
  }, [open])

  // The element handles Escape itself, which fires `close`; report that upwards so React's
  // `open` and the DOM cannot disagree.
  useEffect(() => {
    const dialog = ref.current
    if (dialog === null) return
    const onCloseEvent = (): void => {
      if (open) onClose()
    }
    dialog.addEventListener('close', onCloseEvent)
    return () => dialog.removeEventListener('close', onCloseEvent)
  }, [open, onClose])

  return (
    <dialog
      ref={ref}
      aria-modal="true"
      aria-label="Settings"
      className={cn(
        'max-h-[min(720px,calc(100svh-48px))] w-full max-w-lg overflow-hidden rounded-xl border border-hairline',
        'bg-surface-panel p-0 text-ink-primary shadow-2xl shadow-black/70',
        'backdrop:bg-black/60 backdrop:backdrop-blur-[1px]',
        'open:flex open:flex-col',
      )}
      onPointerDown={(event) => {
        // A click on the backdrop lands on the dialog element itself, outside the panel.
        const panel = ref.current?.querySelector('[data-settings-panel]')
        if (panel !== null && panel !== undefined && !panel.contains(event.target as Node)) {
          onClose()
        }
      }}
    >
      <div data-settings-panel tabIndex={-1} className="flex min-h-0 flex-col focus-visible:outline-none">
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-hairline pl-4 pr-1.5">
            <h2 className="text-[13px] font-medium text-ink-primary">Settings</h2>
            <button
              type="button"
              data-target="dense"
              aria-label="Close settings"
              onClick={onClose}
              className="grid size-6 place-items-center rounded text-ink-muted transition-colors duration-150 ease-out hover:bg-surface-active hover:text-ink-primary focus-visible:bg-surface-active focus-visible:text-ink-primary"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SettingsView settings={settings} onSettingsChange={onSettingsChange} />
          </div>
        </div>
    </dialog>
  )
}
