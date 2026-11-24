import { useCallback, useEffect, useRef } from 'react'
import type { AnimationEvent } from 'react'
import { isReducedMotion, MOTION } from '../../lib/motion'

/** Native modal interaction ends immediately; a non-interactive copy fades out. */
export function useModalMotion(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const cancel = () => {
      if (isReducedMotion() && dialog.dataset.motionPhase === 'enter') delete dialog.dataset.motionPhase
    }
    dialog.addEventListener('animationcancel', cancel)
    return () => dialog.removeEventListener('animationcancel', cancel)
  }, [])
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open) {
      dialog.inert = false
      dialog.removeAttribute('aria-hidden')
      if (isReducedMotion()) delete dialog.dataset.motionPhase
      else dialog.dataset.motionPhase = 'enter'
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') dialog.showModal()
        else dialog.setAttribute('open', '')
      }
      dialog.querySelector<HTMLElement>('[data-dialog-focus]')?.focus()
      return
    }
    if (!dialog.open && !dialog.hasAttribute('open')) return
    dialog.inert = true
    dialog.setAttribute('aria-hidden', 'true')
    if (isReducedMotion()) delete dialog.dataset.motionPhase
    else dialog.dataset.motionPhase = 'exit'
    if (typeof dialog.close === 'function') dialog.close()
    else dialog.removeAttribute('open')
    if (isReducedMotion()) return
    const backdrop = document.createElement('div')
    backdrop.className = 'motion-backdrop-exit'
    backdrop.setAttribute('aria-hidden', 'true')
    document.body.append(backdrop)
    const timer = window.setTimeout(() => { delete dialog.dataset.motionPhase; backdrop.remove() }, MOTION.sheetExit)
    return () => { window.clearTimeout(timer); backdrop.remove() }
  }, [open])
  const onAnimationEnd = useCallback((event: AnimationEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget && event.currentTarget.dataset.motionPhase === 'enter') delete event.currentTarget.dataset.motionPhase
  }, [])
  return { ref, onAnimationEnd }
}
