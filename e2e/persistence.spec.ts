import { expect, test } from '@playwright/test'
import { resetSession, textZones, uploadPdf } from './fixtures'

/**
 * A reload must not cost the user their work.
 *
 * This is the E2E shape of the persistence tests: the unit tests prove the store and the
 * restore path, and this proves the whole thing in a real browser, across a real reload,
 * with real IndexedDB — which is the only place the storage timing actually happens.
 */

test.beforeEach(async ({ page }) => {
  await resetSession(page)
})

test('a reload restores the batch and the cards', async ({ page }) => {
  await uploadPdf(page)
  const drawn = await page.locator('[data-cell]').count()

  // Wait for the debounced write, then do what a user does.
  await page.waitForTimeout(600)
  await page.reload()

  await expect(page.locator('[data-cell]').first()).toBeVisible({ timeout: 15_000 })
  expect(await page.locator('[data-cell]').count()).toBe(drawn)
})

test('a reload keeps a card edit', async ({ page }) => {
  await uploadPdf(page)
  const zone = textZones(page).first()
  await zone.click()
  const field = page.getByLabel('Edit card text')
  await field.fill('EDITED AFTER RELOAD')
  await page.keyboard.press('Escape')

  await page.waitForTimeout(600)
  await page.reload()

  await expect(page.locator('[data-cell]').first()).toContainText('EDITED AFTER RELOAD', {
    timeout: 15_000,
  })
})

test('clear all offers an undo that restores the batch', async ({ page }) => {
  await uploadPdf(page)
  const drawn = await page.locator('[data-cell]').count()

  await page.getByRole('button', { name: /clear all files/i }).click()
  await expect(page.locator('[data-cell]')).toHaveCount(0)

  await page.getByRole('button', { name: /undo/i }).click()
  await expect(page.locator('[data-cell]')).toHaveCount(drawn)
})
