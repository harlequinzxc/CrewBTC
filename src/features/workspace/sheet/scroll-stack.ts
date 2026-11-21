/**
 * Moving the stack.
 *
 * Kept in one place because it is the only imperative interaction with the canvas, and it
 * has to survive jsdom. `Element.scrollTo` does not exist there, so calling it unguarded
 * throws inside an effect and takes the whole render down — which is exactly what a
 * navigation test would have done. Assigning `scrollTop` is not a fallback hack: it is the
 * same jump without the easing, and every browser supports it.
 */

/** The scroll container's surface, as much of it as this module needs. */
export interface ScrollSurface {
  scrollTop: number
  readonly clientHeight: number
  scrollTo?: ((options: ScrollToOptions) => void) | undefined
}

/**
 * Put `top` at the top of the viewport.
 *
 * `smooth` is a request, not a promise: a reduced-motion user gets the jump, which is the
 * correct answer for them, and so does anyone whose browser ignores the option.
 */
export function scrollToTop(node: ScrollSurface, top: number, smooth = true): void {
  if (typeof node.scrollTo === 'function') {
    node.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' })
    return
  }
  node.scrollTop = top
}
