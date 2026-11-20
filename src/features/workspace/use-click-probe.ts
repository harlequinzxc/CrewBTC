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
        ) as HTMLElement | null
        if (zone !== null && zone !== undefined) {
          const box = zone.getBoundingClientRect()
          const declared = /height:\s*([\d.]+)px/.exec(zone.getAttribute('style') ?? '')?.[1]
          lines.push(
            `text box renders ${box.height.toFixed(1)}px, declares ${declared ?? '?'}px`,
          )
        }

        /*
          Everything below is a *timeline*, because everything that matters happens after
          this handler returns.

          This handler runs at window capture: the first stop on the press's path, before
          the press has been delivered to anything. An earlier version asked "did the
          button's handler run?" and "did the rescue open it?" right here — before either
          could possibly have happened — and printed "did not run" and "did not open it".
          Both answers were guaranteed by the moment they were asked, so neither meant
          anything. A real report was read as if they did.

          So: facts are recorded when they happen, and the absences are declared only once
          the whole gesture is over.
        */
        const t0 = press.timeStamp
        const facts: string[] = []
        const said = new Set<string>()

        const note = (key: string, what: string): void => {
          if (said.has(key)) return
          said.add(key)
          const delta = performance.now() - t0
          const elapsed = Number.isFinite(delta) && delta > 0 ? delta : 0
          facts.push(`+${elapsed.toFixed(0)}ms  ${what}`)
        }

        /*
          The question this handler is uniquely placed to answer, because it runs first.

          A listener added to a later node during dispatch still fires for the event in
          flight, so adding one to `document` from here reports whether the press survives
          as far as the node the rescue watches. If it never fires, the press is stopped
          above `document` and nothing inside the page can see it — which is the difference
          between "the rescue is wrong" and "the rescue is blind".
        */
        const onDocument = (event: Event): void => {
          if (event !== press) return
          note('document', 'the document saw the press')
          document.removeEventListener('pointerdown', onDocument, true)
        }
        document.addEventListener('pointerdown', onDocument, true)

        /*
          Whether the field *ever existed*, which no sample can tell you.

          Every sample so far was taken after the press had settled, and all of them said
          "no field". That cannot distinguish a field that was never rendered from one that
          was rendered and removed in the same gesture — and those are different bugs with
          different fixes. So the DOM itself is watched: a field that appears and goes is
          recorded as such, with the times.
        */
        const fieldSeen = { appeared: 0, removed: 0 }
        const observer = new MutationObserver((records) => {
          for (const record of records) {
            for (const node of record.addedNodes) {
              if (node instanceof HTMLTextAreaElement && node.getAttribute('aria-label') === 'Edit card text') {
                fieldSeen.appeared += 1
                note('field-mount', 'a field WAS rendered')
              }
            }
            for (const node of record.removedNodes) {
              if (node instanceof HTMLTextAreaElement && node.getAttribute('aria-label') === 'Edit card text') {
                fieldSeen.removed += 1
                note('field-unmount', `the field was removed (+${(performance.now() - t0).toFixed(0)}ms)`)
              }
            }
          }
        })
        observer.observe(document.body, { childList: true, subtree: true })

        /*
          And whether anything threw while the press was being handled. A React handler that
          throws is not a crash the user sees: it is reported, the state update is abandoned,
          and the next paint looks exactly like "nothing happened".
        */
        const onError = (event: Event): void => {
          const message = event instanceof ErrorEvent ? event.message : 'unknown error'
          note('error', `an exception was thrown: ${message.slice(0, 90)}`)
        }
        window.addEventListener('error', onError)

        const sample = (): void => {
          if (zone !== null && zone !== undefined) {
            if (zone.getAttribute('data-press-handled') === 'true') {
              note('handler', 'the button handler ran')
            }
            const registered = zone.getAttribute('data-press-begin')
            if (registered === 'unregistered') {
              note('map', 'the fallback did not know this box (harmless since v1.9.8)')
            }
            if (zone.hasAttribute('data-text-gesture-opened')) {
              note('rescue', 'the rescue opened it')
            }
          }
          const field = document.querySelector<HTMLTextAreaElement>(
            'textarea[aria-label="Edit card text"]',
          )
          if (field !== null) {
            note(
              'field',
              document.activeElement === field
                ? 'a field appeared, focused'
                : `a field appeared, focus is ${document.activeElement?.tagName ?? 'nothing'}`,
            )
            if (document.activeElement !== field) {
              note('blur', `focus is not in the field: ${document.activeElement?.tagName ?? 'nothing'}`)
            }
          }
        }

        for (const delay of [0, 16, 60, 140, 260, 500]) window.setTimeout(sample, delay)

        /*
          Then the verdict, once: the gesture is over, so an absence is finally a fact.
          Nothing is said at all if every step was seen, because there is nothing to say.
        */
        window.setTimeout(() => {
          if (!said.has('document')) {
            finished.push(
              'the press never reached the document — it is being stopped above the page,',
              'so nothing inside the app can act on it',
            )
          } else if (zone !== null && zone !== undefined && !said.has('handler') && !said.has('rescue')) {
            finished.push('the press reached the document, but neither the button nor the rescue acted')
          } else if (!said.has('field')) {
            finished.push('the press was handled, but no field ever appeared')
          }
          observer.disconnect()
          window.removeEventListener('error', onError)
          if (fieldSeen.appeared > 0 && fieldSeen.removed > 0) {
            finished.push(
              'a field was rendered and then removed before the gesture ended —',
              'something is closing the editor as soon as it opens',
            )
          } else if (fieldSeen.appeared > 0 && !document.querySelector('textarea[aria-label="Edit card text"]')) {
            finished.push('a field was rendered and is now gone')
          }
          draw()
          console.info('[crewbtc click probe]\n' + panel.textContent)
        }, 620)

        // Also on screen: the user is not necessarily in the console, and the panel is
        // rewritten as the timeline fills so what is on screen is the finished report.
        const panel = document.createElement('div')
        panel.setAttribute('role', 'status')
        panel.setAttribute('data-click-probe', '')
        panel.style.cssText =
          'position:fixed;left:12px;bottom:12px;z-index:9999;max-width:min(560px,90vw);' +
          'padding:10px 12px;border-radius:8px;background:#18181b;color:#fafafa;' +
          'font:12px/1.5 ui-monospace,SFMono-Regular,monospace;white-space:pre-wrap;' +
          'box-shadow:0 8px 24px rgba(0,0,0,.4);border:1px solid #3f3f46'
        const finished: string[] = []
        const draw = (): void => {
          const body = [...lines, '', ...facts, '', ...finished]
          panel.textContent = body.join('\n') + '\n\n(click anywhere to dismiss)'
        }
        draw()
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
