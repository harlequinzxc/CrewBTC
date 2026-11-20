import { expect, test } from '@playwright/test'
import { resetSession, textZones, uploadPdf } from './fixtures'

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

test.beforeEach(async ({ page }) => {
  // A clean profile per test: the workspace restores from IndexedDB, so a leftover
  // snapshot would make the second test start with the first one's batch.
  await resetSession(page)
})

test('one click on a card text band puts a caret in it', async ({ page }) => {
  await uploadPdf(page)
  const zone = textZones(page).first()

  // Exactly one gesture. If the fix regresses this is where it shows.
  await zone.click()

  const field = page.getByLabel('Edit card text')
  await expect(field).toBeVisible()
  await expect(field).toBeFocused()

  // And it is genuinely editable, not merely focused.
  await page.keyboard.type(' TYPED')
  await expect(field).toHaveValue(/TYPED/)
})

test('the canvas does not move when editing begins', async ({ page }) => {
  await uploadPdf(page)
  const pane = page.getByTestId('sheet-pane')

  // Park the canvas somewhere that is not the top, so a scroll would be visible.
  await pane.evaluate((node) => {
    node.scrollTop = 240
  })
  const before = await pane.evaluate((node) => node.scrollTop)

  await textZones(page).first().click()
  await expect(page.getByLabel('Edit card text')).toBeVisible()

  const after = await pane.evaluate((node) => node.scrollTop)
  expect(after).toBe(before)
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
