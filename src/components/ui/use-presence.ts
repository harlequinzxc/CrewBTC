import { useEffect, useRef, useState } from 'react'

export interface UsePresenceOptions {
  readonly exitMs: number
}

export interface PresenceState {
  /** Keep the node in the tree while true, including during the exit animation. */
  readonly mounted: boolean
  readonly phase: 'enter' | 'exit'
}

/**
 * Keeps a node mounted through its exit animation and unmounts on an explicit
 * timer. §3 requires this: under `transform: none` and near-zero durations
 * `transitionend` never fires, so a transition-only unmount leaks the node.
 *
 * State is only written from the timer callback and from the event that changes
 * `open` — never synchronously during the effect.
 */
export function usePresence(open: boolean, options: UsePresenceOptions): PresenceState {
  const [mounted, setMounted] = useState(open)
  const [wasOpen, setWasOpen] = useState(open)
  const timer = useRef<number | null>(null)

  // Derive during render rather than calling setState inside an effect.
  if (wasOpen !== open) {
    setWasOpen(open)
    if (open) setMounted(true)
  }

  useEffect(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    if (open) return

    timer.current = window.setTimeout(() => {
      setMounted(false)
      timer.current = null
    }, Math.max(0, options.exitMs))

    return () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current)
        timer.current = null
      }
    }
  }, [open, options.exitMs])

  return { mounted: open || mounted, phase: open ? 'enter' : 'exit' }
}
