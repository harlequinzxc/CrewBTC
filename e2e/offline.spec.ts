import { expect, test } from '@playwright/test'
import { uploadPdf } from './fixtures'

/**
 * §8A requires one end-to-end path covering the primary task **plus an offline reload**.
 *
 * An installed app has no address bar to refresh from, so "works offline" is not a bonus:
 * it is the whole reason this is a local-first tool. The service worker must have precached
 * the shell by the time the batch is loaded, which is what makes the second visit work with
 * the network cut. Nothing else in the suite proves the precache is complete.
 */

// The only spec that needs the worker: the whole point is that a worker serves the shell
// with no network. Everywhere else it is blocked, so a run cannot be answered from a cache
// left behind by a previous build.
test.use({ serviceWorkers: 'allow' })

test('the app opens and keeps working with the network offline', async ({ page, context }) => {
  await uploadPdf(page)

  // Wait for the worker to control the page, then reload so the shell is served by it.
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null), {
      timeout: 20_000,
    })
    .toContain('sw.js')

  // Let the debounced snapshot write land before reloading. Reloading the instant the
  // worker takes control can beat the write, and then the reload legitimately restores an
  // empty session — a test racing the app, not a bug in it.
  await page.waitForTimeout(1200)
  await page.reload()
  await expect(page.locator('[data-cell]').first()).toBeVisible({ timeout: 15_000 })

  await context.setOffline(true)
  try {
    await page.reload()

    // The shell comes from the precache; the batch comes from IndexedDB. An error page here
    // means the precache is not covering the shell, which would make the installed app
    // useless the moment the network drops.
    await expect(page).toHaveTitle('CrewBTC', { timeout: 20_000 })
    await expect(page.locator('[data-cell]').first()).toBeVisible({ timeout: 20_000 })
  } finally {
    await context.setOffline(false)
  }
})
