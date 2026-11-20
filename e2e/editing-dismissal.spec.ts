import { expect, test } from '@playwright/test'
import { textZones, uploadPdf } from './fixtures'

/**
 * Why an edit ends.
 *
 * The field has exactly one way to be closed by focus: `onBlur`. That was too eager. A
 * newly focused element blurs for reasons the user had no part in — the window losing
 * focus to another window, a scroll, the layout shift caused by the field mounting — and
 * each of those closed the editor milliseconds after it opened. The probe caught the
 * shape of it: "a field WAS rendered" one moment, "the field was removed" the next, and by
 * the time anything sampled the page there was nothing to see.
 *
 * Ending an edit is now decided by what the user did, not by focus: Escape, a press
 * elsewhere, or focus genuinely moving to another control. These two tests are the halves
 * of that — a stray blur must not close it, and a real one must.
 */
test('a stray blur does not close the editor, and it keeps the caret', async ({ page }) => {
  await uploadPdf(page)
  await page.evaluate(() => {
    // One blur as soon as the field exists: the window-focus / layout-shift case.
    let done = false
    new MutationObserver(() => {
      const field = document.querySelector('textarea[aria-label="Edit card text"]')
      if (field !== null && !done) {
        done = true
        ;(field as HTMLTextAreaElement).blur()
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
  // Still open is not enough: an open but unfocused field takes no typing.
  await expect(field).toBeFocused()
  await page.keyboard.type('Z')
  await expect(field).toHaveValue(/Z$/)
})

test('a press on the backdrop still closes the editor', async ({ page }) => {
  await uploadPdf(page)
  const box = await textZones(page).first().boundingBox()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.down()
  await page.mouse.up()
  await expect(page.getByLabel('Edit card text')).toBeVisible()

  await page.mouse.click(20, 200)
  await expect(page.getByLabel('Edit card text')).toHaveCount(0)
})
