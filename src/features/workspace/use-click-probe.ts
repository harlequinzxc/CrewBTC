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
 * On `Shift+?`, this arms and the next pointer press anywhere is described in a panel at
 * the bottom of the window.
 *
 * It can also be *started* from a button in the top bar, which is not a convenience: the
 * person reporting the bug could not be sure a keyboard shortcut was reaching the app, and
 * a diagnostic that depends on a keystroke it cannot confirm is not a working diagnostic.
 * If the button produces a report and the shortcut does not, that alone is the answer.
 */
export function useClickProbe(version: string): { readonly arm: () => void } {
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

        /*
          Then watch what the app does with it.

          The hit-test above answers "did the press reach the text". This answers the next
          question: did a field appear, and did anything take the caret away again. Those
          are different failures and they need different fixes, so the report must not stop
          at the one that happens to be easy to measure.
        */
        const seen: string[] = []
        /*
          And whether the handler that starts an edit ran at all.

          "No field" has two very different causes: the press never reached the code that
          opens the box, or it did and the state it set was thrown away. Marking the button
          from `onPress` distinguishes them without a debugger, which matters when the
          report comes from a machine I cannot attach to.
        */
        seen.push(
          (press.target as Element | null)?.closest?.('[data-press-handled]') === null
            ? 'the press handler did not run'
            : 'the press handler ran',
        )
        const capture = (): boolean => {
          const field = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Edit card text"]')
          seen.push(
            field === null
              ? 'no field'
              : document.activeElement === field
                ? 'field focused'
                : `field present, focus is ${document.activeElement?.tagName ?? 'none'}`,
          )
          return field !== null
        }
        window.setTimeout(() => {
          capture()
          window.setTimeout(() => {
            const opened = capture()
            lines.push(`after the press: ${seen.join(' -> ')}`)
            if (!opened) {
              lines.push('the field never appeared — the press did not start an edit')
            }
            console.info('[crewbtc click probe]\n' + lines.join('\n'))
            panel.textContent = lines.join('\n') + '\n\n(click anywhere to dismiss)'
          }, 400)
        }, 60)

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

  const arm = useCallback(() => {
    // A synthetic keydown keeps one implementation of the report. Guarded because a
    // `KeyboardEvent` has no meaning outside a document, and this hook is mounted in
    // tests that render the shell without one.
    if (typeof window === 'undefined' || typeof KeyboardEvent === 'undefined') return
    const synthetic = new KeyboardEvent('keydown', { key: '?', shiftKey: true, bubbles: true })
    window.dispatchEvent(synthetic)
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onKeyDown])

  return { arm }
}
