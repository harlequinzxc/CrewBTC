import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Info, TriangleAlert, XCircle } from 'lucide-react'
import { cn } from '../../lib/cn'
import { MOTION } from '../../lib/motion'

export type ToastVariant = 'success' | 'info' | 'warning' | 'error'

export interface ToastMessage {
  readonly id: string
  readonly variant: ToastVariant
  readonly title: string
  readonly description?: string | undefined
  /** Optional undo affordance for destructive actions (§6). */
  readonly undo?: (() => void) | undefined
  /** Text for the action button. Defaults to "Undo", which is what most actions are. */
  readonly action?: string | undefined
}

const ICONS = {
  success: CheckCircle2,
  info: Info,
  warning: TriangleAlert,
  error: XCircle,
} as const

const TONES: Record<ToastVariant, string> = {
  success: 'text-emerald-300',
  info: 'text-ink-secondary',
  warning: 'text-amber-300',
  error: 'text-accent-bright',
}

export interface ToastProps {
  readonly toast: ToastMessage
  readonly onDismiss: (id: string) => void
  readonly durationMs?: number | undefined
}

/** §3A/§6: announced via `role="status"`, never blocks interaction, and unmounts
 *  on a timer (§3) rather than `transitionend`. */
export function Toast({ toast, onDismiss, durationMs = 6000 }: ToastProps) {
  const [leaving, setLeaving] = useState(false)
  const [dismissedId, setDismissedId] = useState(toast.id)
  const timer = useRef<number | null>(null)
  const Icon = ICONS[toast.variant]

  // Reset when a different toast arrives — during render, not in an effect.
  if (dismissedId !== toast.id) {
    setDismissedId(toast.id)
    setLeaving(false)
  }

  useEffect(() => {
    const exitIn = Math.max(0, durationMs - MOTION.sheetExit)
    timer.current = window.setTimeout(() => setLeaving(true), exitIn)
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [durationMs, toast.id])

  useEffect(() => {
    if (!leaving) return
    const id = window.setTimeout(() => onDismiss(toast.id), MOTION.sheetExit)
    return () => window.clearTimeout(id)
  }, [leaving, onDismiss, toast.id])

  return (
    <div
      role={toast.variant === 'error' ? 'alert' : 'status'}
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
      className={cn(
        'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border p-3',
        'border-hairline bg-surface-raised shadow-lg shadow-black/40 backdrop-blur',
        'transition-[opacity,transform] ease-out',
        leaving ? 'translate-y-2 opacity-0' : 'translate-y-0 opacity-100',
      )}
      style={{ transitionDuration: `${MOTION.sheetExit}ms` }}
    >
      <Icon
        aria-hidden="true"
        strokeWidth={2}
        className={cn('mt-0.5 size-5 shrink-0', TONES[toast.variant])}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-ink-primary">{toast.title}</p>
        {toast.description === undefined ? null : (
          <p className="mt-0.5 text-[11px] text-ink-secondary">{toast.description}</p>
        )}
      </div>
      {toast.undo === undefined ? null : (
        <button type="button" data-target="dense" onClick={() => {
            toast.undo?.()
            onDismiss(toast.id)
          }} className="h-8 min-h-8 rounded-md px-2 text-xs font-semibold text-accent-bright transition-colors duration-150 ease-out hover:bg-surface-active focus-visible:bg-surface-active">
          {toast.action ?? 'Undo'}
        </button>
      )}
    </div>
  )
}
