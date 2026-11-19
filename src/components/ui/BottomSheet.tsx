import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { usePresence } from './use-presence'
import { MOTION } from '../../lib/motion'

export interface BottomSheetProps {
  readonly open: boolean
  readonly title: string
  readonly description?: string | undefined
  readonly onClose: () => void
  readonly children: React.ReactNode
  /** Sticky footer CTA row. */
  readonly footer?: React.ReactNode | undefined
  readonly className?: string | undefined
}

/**
 * §2/§3A: slide-up sheet with a drag handle, backdrop and Escape dismissal,
 * trapped focus, and focus restored to the trigger on close. Unmount is driven by
 * an explicit timer (§3), never by `transitionend`.
 */
export function BottomSheet({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  className,
}: BottomSheetProps) {
  const presence = usePresence(open, { exitMs: MOTION.sheetExit })
  const panelRef = useRef<HTMLDialogElement | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement | null
      const first = panelRef.current?.querySelector<HTMLElement>(
        'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])',
      )
      first?.focus()
    } else if (triggerRef.current !== null) {
      triggerRef.current.focus()
      triggerRef.current = null
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusable === undefined || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (first === undefined || last === undefined) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [open, onClose])

  if (!presence.mounted) return null

  const duration = `${presence.phase === 'enter' ? MOTION.sheetEnter : MOTION.sheetExit}ms`

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" data-phase={presence.phase}>
      <button type="button" data-target="default" tabIndex={-1} onClick={onClose} className={cn(
          'min-h-[44px]',
          'min-h-[44px]',
          'absolute inset-0 cursor-default bg-black/70 transition-opacity ease-out',
          presence.phase === 'enter' ? 'opacity-100' : 'opacity-0',
        )}
        style={{ transitionDuration: duration }}
      >
        <span className="sr-only">Close dialog</span>
      </button>
      <dialog
        ref={panelRef}
        open
        aria-modal="true"
        aria-label={title}
        className={cn(
          // Reset UA dialog styles: position, margin, padding, and the 3px default border.
          'relative m-0 h-auto w-full max-w-2xl border-0 border-t border-zinc-800',
          'rounded-t-2xl bg-zinc-900 p-0 text-zinc-50',
          'transition-transform ease-out',
          presence.phase === 'enter' ? 'translate-y-0' : 'translate-y-full',
          className,
        )}
        style={{ transitionDuration: duration }}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-3">
          <div aria-hidden="true" className="mx-auto h-1 w-10 rounded-full bg-zinc-700" />
          <button type="button" data-target="dense" onClick={onClose} aria-label="Close dialog" className="absolute right-3 top-3 h-8 min-h-8 rounded-md p-2 text-zinc-400 transition-colors duration-150 ease-out hover:bg-zinc-800 hover:text-zinc-100 focus-visible:bg-zinc-800 focus-visible:text-zinc-100 focus-visible:ring-2 focus-visible:ring-red-500">
            <X aria-hidden="true" strokeWidth={2} className="size-5" />
          </button>
        </div>
        <div className="px-5 pb-2 pt-3">
          <h2 className="text-lg font-semibold text-zinc-50">{title}</h2>
          {description === undefined ? null : (
            <p className="mt-1 text-sm text-zinc-400">{description}</p>
          )}
        </div>
        <div className="max-h-[70dvh] overflow-y-auto px-5 py-3">{children}</div>
        {footer === undefined ? null : (
          <div className="border-t border-zinc-800 px-5 py-3 pb-[env(safe-area-inset-bottom)]">
            {footer}
          </div>
        )}
      </dialog>
    </div>
  )
}
