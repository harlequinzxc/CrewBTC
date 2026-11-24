import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { uploadPdf } from './fixtures'

/**
 * The diagnostic itself, because it has been wrong in a way that cost a release.
 *
 * Its report is read by someone who cannot attach a debugger, so a line that is not true
 * is worse than no line at all. The first version of the timeline asked "did the handler
 * run?" inside the window-capture handler — the first stop on the press's path, before the
 * press had been delivered anywhere. The answer was always "no", and a real report was read
 * as if it meant something.
 */

const run = async (page: Page): Promise<string> => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Check what a click lands on' }).click()
  const box = (await page.getByRole('button', { name: /card text:/i }).first().boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.up()
  await page.waitForTimeout(900)
  return (await page.locator('[data-click-probe]').textContent()) ?? ''
}

test('a working press reports every step of the timeline', async ({ page }) => {
  await uploadPdf(page)
  const text = await run(page)
  expect(text).toContain('the document saw the press')
  expect(text).toContain('the button handler ran')
  expect(text).toContain('a field appeared')
  // The field's whole life is watched, not just sampled: it must be seen arriving.
  expect(text).toContain('a field WAS rendered')
})

/*
  The distinction that four releases could not make: "no field" was reported for both a
  field that never existed and one that existed and was removed before anything sampled the
  page. The observer records the removal, so the two read differently.
*/
test('a field that is removed after mounting is reported as such', async ({ page }) => {
  await uploadPdf(page)
  await page.evaluate(() => {
    new MutationObserver(() => {
      const field = document.querySelector('textarea[aria-label="Edit card text"]')
      if (field !== null) (field as HTMLTextAreaElement).blur()
    }).observe(document.body, { childList: true, subtree: true })
  })
  const text = await run(page)
  expect(text).toContain('a field WAS rendered')
})


test('a press stopped below the document reports the rescue stepping in', async ({ page }) => {
  await uploadPdf(page)
  await page.evaluate(() => {
    const sever = (event: Event): void => {
      if ((event.target as Element)?.closest?.('button[aria-label^="Card text:"]')) {
        event.stopPropagation()
      }
    }
    document.documentElement.addEventListener('pointerdown', sever, true)
    document.documentElement.addEventListener('click', sever, true)
  })
  const text = await run(page)
  expect(text).toContain('the document saw the press')
  expect(text).toContain('the rescue opened it')
})

/*
  The case that matters most: a press stopped at window capture never descends to
  `document`, so the rescue cannot see it and no amount of in-page cleverness will help.
  The report must say exactly that rather than blaming the button or the rescue.
*/
test('a press stopped above the document is reported as unreachable', async ({ page }) => {
  await uploadPdf(page)
  await page.evaluate(() => {
    // Added after the probe's own window listener, so it runs second and then severs.
    window.addEventListener(
      'pointerdown',
      (event) => {
        if ((event.target as Element)?.closest?.('button[aria-label^="Card text:"]')) {
          event.stopPropagation()
        }
      },
      true,
    )
  })
  const text = await run(page)
  expect(text).toContain('the press never reached the document')
})
