import { X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useModalMotion } from '../../components/ui/use-modal-motion'
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
  readonly onProbe?: () => void
  readonly settings: PageSettings
  readonly onSettingsChange: (settings: PageSettings) => void
}

export function SettingsDialog({ open, onClose, onProbe, settings, onSettingsChange }: SettingsDialogProps) {
  const { ref, onAnimationEnd } = useModalMotion(open)

  return (
    <dialog
      ref={ref}
      aria-modal="true"
      aria-label="Settings"
      className={cn(
        // A native <dialog> is placed by the UA's own absolute positioning, so it does not
        // respond to a grid or flex parent. `m-auto` is what centres it; without it the
        // panel sits in the top-left corner and reads as a drawer rather than a modal.
        'm-auto',
        'max-h-[min(720px,calc(100svh-48px))] w-[min(32rem,calc(100vw-32px))] overflow-hidden',
        'rounded-xl border border-hairline bg-surface-panel p-0 text-ink-primary',
        'shadow-2xl shadow-black/70',
        'backdrop:bg-black/60 backdrop:backdrop-blur-[1px]',
        'open:flex open:flex-col',
      )}
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onAnimationEnd={onAnimationEnd}
      onPointerDown={(event) => {
        // A click on the backdrop lands on the dialog element itself, outside the panel.
        const panel = ref.current?.querySelector('[data-settings-panel]')
        if (panel !== null && panel !== undefined && !panel.contains(event.target as Node)) {
          onClose()
        }
      }}
    >
      <div data-settings-panel data-dialog-focus tabIndex={-1} className="flex min-h-0 flex-col focus-visible:outline-none">
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
            {onProbe === undefined ? null : <button type="button" data-target="dense" onClick={onProbe} className="mx-4 mb-4 min-h-8 rounded px-2 text-xs text-ink-secondary hover:bg-surface-active focus-visible:bg-surface-active">Check what a click lands on</button>}
          </div>
        </div>
    </dialog>
  )
}
