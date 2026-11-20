import { expect, test } from '@playwright/test'
import { textZones, uploadPdf } from './fixtures'

/**
 * Why an edit ends — and, mostly, why it does not.
 *
 * It used to end on focus loss, and that was the bug behind five releases of "clicking the
 * text does nothing". A field blurs for reasons nobody chose: the window losing focus, a
 * scroll, a layout shift, or another element claiming focus a frame after the field
 * appears. The probe finally caught the shape of it — "a field WAS rendered" one moment,
 * "the field was removed" a millisecond later — and the page was sampled too late to see it.
 *
 * Focus loss therefore ends nothing. Escape, a press on another card, and a press on the
 * paper are what end an edit, because those are things a user actually did.
 */
/*
  The reported case: focus is stolen to *another control* — not lost to nothing — one frame
  after the field appears. Ignoring only a blur-to-nothing was not enough to survive this,
  because the blur carries a `relatedTarget` and reads exactly like a deliberate move.
*/
test('focus stolen by another control does not close the editor', async ({ page }) => {
  await uploadPdf(page)
  await page.evaluate(() => {
    const sink = document.createElement('button')
    sink.id = 'focus-sink'
    sink.textContent = 'sink'
    document.body.prepend(sink)
    let once = false
    new MutationObserver(() => {
      const field = document.querySelector('textarea[aria-label="Edit card text"]')
      if (field !== null && !once) {
        once = true
        ;(sink as HTMLButtonElement).focus()
      }
    }).observe(document.body, { childList: true, subtree: true })
  })

  const box = await textZones(page).first().boundingBox()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.down()
  await page.mouse.up()
  await page.waitForTimeout(400)

  const field = page.getByLabel('Edit card text')
  await expect(field).toBeVisible()
  // Still open is not enough: an open but unfocused field takes no typing, so it must also
  // take the caret back.
  await expect(field).toBeFocused()
  await page.keyboard.type('Z')
  await expect(field).toHaveValue(/Z$/)
})

/*
  The other half: removing focus as a dismissal must not remove dismissal itself. A press
  on the pane's ground — the part of the canvas that is not the sheet — ends the edit. This
  was briefly broken: the ground's own handler called the sheet's `onSelectCell` prop
  directly and so stepped over the dismissal wrapper entirely.
*/
test('a press on the ground still closes the editor', async ({ page }) => {
  await uploadPdf(page)
  const box = await textZones(page).first().boundingBox()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.down()
  await page.mouse.up()
  await expect(page.getByLabel('Edit card text')).toBeVisible()

  // Above the paper, inside the pane's scroll container: the ground, not a card.
  const pane = await page.getByTestId('sheet-pane').boundingBox()
  await page.mouse.click(pane!.x + pane!.width / 2, pane!.y + 8)
  await expect(page.getByLabel('Edit card text')).toHaveCount(0)
})

/*
  Pressing another card's text moves the editor rather than closing it, and the count alone
  cannot tell the two apart: there is one field either way. It has to be asked *where* the
  field is. An earlier version of this test asserted the count and read a working move as a
  failure.
*/
test('pressing another card moves the editor to that card', async ({ page }) => {
  await uploadPdf(page)
  const first = await textZones(page).first().boundingBox()
  await page.mouse.move(first!.x + first!.width / 2, first!.y + first!.height / 2)
  await page.mouse.down()
  await page.mouse.up()

  const where = async (): Promise<string> =>
    page.evaluate(
      () =>
        String(
          document
            .querySelector('textarea[aria-label="Edit card text"]')
            ?.closest('[data-cell]')
            ?.getAttribute('data-cell') ?? 'none',
        ),
    )
  expect(await where()).toBe('0')

  const other = await page.locator('[data-cell="1"]').first().boundingBox()
  await page.mouse.click(other!.x + 10, other!.y + 10)
  await expect(page.getByLabel('Edit card text')).toHaveCount(1)
  expect(await where()).toBe('1')
})
