import { expect, test } from '@playwright/test'
import { resetSession, uploadPdf } from './fixtures'

/**
 * §8A requires one end-to-end path covering the primary task **plus an offline reload**.
 *
 * An installed app has no address bar to refresh from, so "works offline" is not a bonus:
 * it is the whole reason this is a local-first tool. The service worker must have precached
 * the shell by the time the batch is loaded, which is what makes the second visit work with
 * the network cut.
 */
test('the app opens and keeps working with the network offline', async ({ page, context }) => {
  await resetSession(page)
  await uploadPdf(page)

  // Let the worker install and take control, then reload so the page is served by it.
  await page.waitForTimeout(1500)
  await page.reload()
  await expect(page.locator('[data-cell]').first()).toBeVisible({ timeout: 15_000 })

  await context.setOffline(true)
  try {
    await page.reload()
    // The shell comes from the cache; the batch comes from IndexedDB. Neither needs a
    // network, and an error page here means the precache is not covering the shell.
    await expect(page.locator('[data-cell]').first()).toBeVisible({ timeout: 20_000 })
  } finally {
    await context.setOffline(false)
  }
})
