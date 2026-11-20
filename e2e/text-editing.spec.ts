import { expect, test } from '@playwright/test'
import { textZones, uploadPdf } from './fixtures'

/**
 * The suite this harness exists for: **one click on a card's text edits it.**
 *
 * The reported symptom was "clicking on text to edit still jumps around", and then "still
 * not able to click and edit text". Three separate defects produced it and every one was
 * invisible to jsdom:
 *
 *   1. `focus()` scrolled the canvas to reveal the field.
 *   2. The formatting bar was in flow, so entering a field shrank the canvas by 32px.
 *   3. Selecting a card mounts its band dividers, which are `z-10` on the zone boundaries,
 *      so the press mounted them under the pointer and the click never reached the text.
 *
 * These assertions are about what a *browser* does: hit-testing, computed layout, and the
 * real mousedown → focus → mouseup sequence.
 */

test('one REAL mouse click on a card text band puts a caret in it', async ({ page }) => {
  await uploadPdf(page)
  const box = await textZones(page).first().boundingBox()
  expect(box).not.toBeNull()

  /*
    A raw mouse press, not `locator.click()`.

    This is the test that should have caught the four releases in which clicking a text
    box did nothing. It used `locator.click()` and passed, while a user's real press did
    not — the two are not the same sequence, and the difference was the whole bug. Nothing
    in this file may use `locator.click()` for the gesture under test.
  */
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.down()
  await page.mouse.up()

  const field = page.getByLabel('Edit card text')
  await expect(field).toBeVisible()
  await expect(field).toBeFocused()

  // And it is genuinely editable, not merely focused: one character into an empty box,
  // which is the smallest thing that proves a caret is really there.
  await page.keyboard.type('T')
  await expect(field).toHaveValue('T')
})

test('a real press and release opens the field, and the field keeps the caret', async ({
  page,
}) => {
  await uploadPdf(page)
  const box = await textZones(page).first().boundingBox()
  expect(box).not.toBeNull()

  // The failing sequence: press, release, then type. A ref callback that re-focuses on
  // every commit interrupts this between the release and the first keystroke.
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
  const field = page.getByLabel('Edit card text')
  await expect(field).toBeFocused()

  await page.waitForTimeout(400)
  await expect(field).toBeFocused()
  await page.keyboard.type('ABC')
  await expect(field).toHaveValue('ABC')
})

test('typing into existing text appends instead of replacing it', async ({ page }) => {
  await uploadPdf(page)

  // Put a real dish name in the header, the way a parsed card arrives.
  await textZones(page).first().click()
  const field = page.getByLabel('Edit card text')
  await field.fill('Kung Pao Chicken')
  await page.keyboard.press('Escape')
  await expect(textZones(page).first()).toHaveAttribute('aria-label', /Kung Pao Chicken/)

  // Click into the middle of it, exactly where a user aims, and type one character.
  const box = await textZones(page).first().boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.click(box!.x + 60, box!.y + box!.height / 2)

  await expect(field).toBeVisible()
  // Focus used to call `select()`, so this keystroke replaced the entire name.
  await page.keyboard.type('!')
  await expect(field).toHaveValue(/Kung Pao Chicken!/)
})

test('the canvas does not move when editing begins', async ({ page }) => {
  await uploadPdf(page)

  // The canvas scroller is the element with a real vertical range; several shells overflow
  // by a few pixels. Pick by range so the test fails loudly if nothing can scroll at all.
  const handle = await page.evaluateHandle(() =>
    [...document.querySelectorAll<HTMLElement>('div')].find(
      (node) => node.scrollHeight - node.clientHeight > 100 && getComputedStyle(node).overflowY === 'auto',
    ) ?? null,
  )
  const scroller = handle.asElement()
  expect(scroller, 'no scrollable canvas found').not.toBeNull()

  // Park the canvas somewhere that is not the top, then click a band that is still on
  // screen — both of which a user would do.
  const before = await scroller!.evaluate((node) => {
    node.scrollTop = 120
    return node.scrollTop
  })
  expect(before).toBe(120)

  // A zone that the scroll did not push out of the viewport.
  const target = page.locator('button[aria-label^="Card text:"]').filter({ hasNot: page.locator('[hidden]') })
  await target.nth(1).click()
  await expect(page.getByLabel('Edit card text')).toBeVisible()

  const after = await scroller!.evaluate((node) => node.scrollTop)
  expect(after, 'editing must not move the canvas').toBe(before)
})

test('the text being edited does not shift when the formatting bar appears', async ({ page }) => {
  await uploadPdf(page)
  const zone = textZones(page).first()

  const box = await zone.boundingBox()
  await zone.click()
  await expect(page.getByLabel('Edit card text')).toBeVisible()

  // The field must sit exactly where the drawn text was: the bar is an overlay, so it
  // cannot have pushed the canvas down.
  const field = page.getByLabel('Edit card text')
  const fieldBox = await field.boundingBox()
  expect(box).not.toBeNull()
  expect(fieldBox).not.toBeNull()
  expect(Math.abs((fieldBox?.y ?? 0) - (box?.y ?? 0))).toBeLessThan(2)
})

test('escape closes the editor and leaves the text unchanged when nothing was typed', async ({
  page,
}) => {
  await uploadPdf(page)
  await textZones(page).first().click()
  const field = page.getByLabel('Edit card text')
  await expect(field).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(field).toBeHidden()
  await expect(textZones(page).first()).toBeVisible()
})

test('clicking into the header and then the footer switches which band is editable', async ({
  page,
}) => {
  await uploadPdf(page)
  const zones = textZones(page)
  await zones.first().click()
  await expect(page.getByLabel('Edit card text')).toBeVisible()

  // The other band of the same card. If the first edit never closed, this click lands on
  // a field instead of a zone and the count stays at one.
  await zones.nth(1).click()
  await expect(page.getByLabel('Edit card text')).toHaveCount(1)
})

/**
 * The rescue, and what it is for.
 *
 * Nothing found in testing stops the press before it reaches the button, but the user's
 * machine did it four releases running, so the gesture is no longer allowed to depend on
 * the press arriving at all. This test manufactures the failure: it severs both of the
 * button's own ways in — the press and the click that follows it — between the document
 * and the button. The field must still open, and it must open *once*: the first version of
 * the fallback opened a rescued zone during the press and the ordinary press at the same
 * time, and the fight between them left no field at all.
 *
 * The listeners sit on `documentElement`, not `window`. The fallback itself listens on
 * `document` in the capture phase, so a `window` listener would run *first* and sever the
 * press before the fallback ever saw it. `documentElement` is one step further down: the
 * fallback has already been given the press, and the button has not.
 */
test('a press that never reaches the button is rescued by the sheet-level fallback', async ({
  page,
}) => {
  await uploadPdf(page)

  await page.evaluate(() => {
    const sever = (event: Event): void => {
      const target = event.target as Element | null
      if (target?.closest?.('button[aria-label^="Card text:"]')) event.stopPropagation()
    }
    document.documentElement.addEventListener('pointerdown', sever, true)
    document.documentElement.addEventListener('click', sever, true)
  })

  const box = await textZones(page).first().boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.down()
  await page.mouse.up()

  // Exactly one field: a rescued press must not race the press's own handler.
  await expect(page.getByLabel('Edit card text')).toHaveCount(1)
  await expect(page.getByLabel('Edit card text')).toBeVisible()
})
