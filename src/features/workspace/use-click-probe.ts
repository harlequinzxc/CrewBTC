import { useCallback, useEffect } from 'react'

/**
 * A one-shot report on what is actually under the pointer, for when "nothing happens".
 *
 * Every guess about why a click never reached the text assumed a different cause, and each
 * time it was something else. Rather than ask again in prose, this prints the facts that
 * decide it: which build is running, what the browser delivered the press to, and — when
 * the target *is* the text — how tall its box is compared with the band it represents.
 *
 * Quiet by design: armed by `Shift+?`, reports the very next press, and touches nothing.
 */

/** A human-readable name for whatever the browser hit. */
export function describeTarget(target: Element | null): string {
  if (target === null) return 'nothing'
  const button = target.closest('button')
  const label = button?.getAttribute('aria-label')
  if (label !== undefined && label !== null) return `button "${label.slice(0, 48)}"`
  const element = target as HTMLElement
  const text = (element.textContent ?? '').trim().slice(0, 28)
  return `${element.tagName.toLowerCase()}${text === '' ? '' : ` "${text}"`}`
}

/**
 * On `Shift+?` this arms, and the next pointer press anywhere is described in a panel at
 * the bottom of the window. Attaches its own listener, so the shell needs one line.
 */
export function useClickProbe(version: string): void {
  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!(event.shiftKey && event.key === '?')) return
      event.preventDefault()

      const report = (press: PointerEvent): void => {
        window.removeEventListener('pointerdown', report, true)
        const x = Math.round(press.clientX)
        const y = Math.round(press.clientY)
        const lines = [
          `build ${version}`,
          `the browser hit  ${describeTarget(document.elementFromPoint(x, y))}`,
          `the press went to ${describeTarget(press.target as Element | null)}`,
        ]

        // When the text box *is* the target, its own geometry is the remaining suspect:
        // a box taller than its band overhangs the photo, and the photo takes the press.
        const zone = (press.target as Element | null)?.closest?.(
          'button[aria-label^="Card text:"]',
        )
        if (zone !== null && zone !== undefined) {
          const box = zone.getBoundingClientRect()
          const declared = /height:\s*([\d.]+)px/.exec(zone.getAttribute('style') ?? '')?.[1]
          lines.push(
            `text box renders ${box.height.toFixed(1)}px, declares ${declared ?? '?'}px`,
          )
        }

        console.info('[crewbtc click probe]\n' + lines.join('\n'))

        // Also on screen: the user is not necessarily in the console.
        const panel = document.createElement('div')
        panel.setAttribute('role', 'status')
        panel.setAttribute('data-click-probe', '')
        panel.style.cssText =
          'position:fixed;left:12px;bottom:12px;z-index:9999;max-width:min(560px,90vw);' +
          'padding:10px 12px;border-radius:8px;background:#18181b;color:#fafafa;' +
          'font:12px/1.5 ui-monospace,SFMono-Regular,monospace;white-space:pre-wrap;' +
          'box-shadow:0 8px 24px rgba(0,0,0,.4);border:1px solid #3f3f46'
        panel.textContent = lines.join('\n') + '\n\n(click anywhere to dismiss)'
        document.body.appendChild(panel)

        const dismiss = (): void => {
          panel.remove()
          window.removeEventListener('pointerdown', dismiss, true)
        }
        window.addEventListener('pointerdown', dismiss, true)
      }

      window.addEventListener('pointerdown', report, true)
    },
    [version],
  )

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onKeyDown])
}
