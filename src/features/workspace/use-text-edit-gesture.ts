import { useCallback, useEffect, useRef } from 'react'

/**
 * The press that begins a text edit — belt and braces, installed once per sheet.
 *
 * **Why this is a sheet-level hook and not a per-zone one.** A first attempt put the
 * `document` listener inside every `CardZoneText`. A twelve-card sheet then installed
 * twenty-four capture listeners, one press ran all of them, each asked for an edit, and
 * the fight between them left no field open at all — the exact symptom it was written to
 * cure. So the listener lives here, mounted once, and each zone hands in a way to be opened.
 *
 * The ordinary path is the button's own `onPointerDown`. The listener exists only for the
 * case where that handler never runs because something stopped the event on the way down,
 * which no amount of testing from outside can rule out.
 */
export interface TextEditGesture {
  /** Attach to any card-text button's `onPointerDown`. */
  readonly press: (event: React.PointerEvent<HTMLElement>) => void
  /** Attach to the same button's `ref`, so the fallback knows how to open it. */
  readonly register: (element: HTMLElement | null, begin: () => void) => void
}

/** Property the fallback sets on a zone it has opened, so it never opens one twice. */
const OPENED = 'data-text-gesture-opened'

export function useTextEditGesture(): TextEditGesture {
  const handled = useRef(0)
  /** Zone element → the callback that opens it. One entry per rendered text box. */
  const zones = useRef(new WeakMap<Element, () => void>())

  const register = useCallback((element: HTMLElement | null, begin: () => void) => {
    if (element !== null) zones.current.set(element, begin)
  }, [])

  const press = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    handled.current = event.timeStamp
    event.stopPropagation()
    /*
      Suppress the browser's default press handling.

      Without this, the default runs *after* this handler and takes the caret away from the
      field that was just mounted. v1.8.1 began editing on pointer-down without it and
      could not open a text box at all; adding this single call is what fixed it in v1.8.2,
      and a whole-build bisect of every release since 1.7.0 confirms it. It is load-bearing.
    */
    event.preventDefault()
    const begin = zones.current.get(event.currentTarget)
    begin?.()
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return

    /*
      The rescue, and why it must not act *during* the press.

      An earlier version opened the field right here, in the capture phase. That ran before
      the event ever reached the button: the button was replaced by the textarea mid-dispatch,
      React could no longer match the (detached) target to a handler, so the button's own
      `press` never ran at all — and the `mousedown` that followed landed on whatever had
      mounted underneath, closing the field again. The fallback had quietly become the
      primary path, and a broken one. Probe logs of that version show it exactly:
      `capture-rescue found=function`, then `mousedown -> DIV`, then no field.

      So the check is deferred to a task after the press finishes. By then the button's own
      handler has either run (`handled` equals the press's timestamp) or it has not. Only in
      the second case, which is the case this hook exists for, does the field open.
    */
    const onCapture = (event: PointerEvent): void => {
      if (event.button !== 0) return

      const zone = (event.target as Element | null)?.closest?.(
        'button[aria-label^="Card text:"]',
      ) as HTMLElement | null
      if (zone === null || zone === undefined) return

      const { timeStamp } = event
      window.setTimeout(() => {
        // The button's own handler claimed this press; it is not ours to open.
        if (handled.current === timeStamp) return
        // An earlier rescue already opened this zone for the same gesture.
        if (zone.hasAttribute(OPENED)) return

        const begin = zones.current.get(zone)
        if (begin === undefined) return

        zone.setAttribute(OPENED, '')
        window.setTimeout(() => zone.removeAttribute(OPENED), 500)
        handled.current = timeStamp
        begin()
      }, 0)
    }

    document.addEventListener('pointerdown', onCapture, true)
    return () => document.removeEventListener('pointerdown', onCapture, true)
  }, [])

  return { press, register }
}
