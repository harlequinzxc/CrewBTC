import { expect, test } from '@playwright/test'
import { uploadPdf } from './fixtures'

/** Older sessions can lack original PDFs; explain rather than silently dropping files. */
test('re-run explains itself on a restored batch instead of denying the files exist', async ({
  page,
}) => {
  await uploadPdf(page)
  await expect(page.getByLabel('Save project')).toBeEnabled()
  await page.waitForTimeout(1000)
  // Simulate an older session created before original uploads were retained.
  await page.evaluate(async () => { await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('crewbtc-project-sources')
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  }) })
  await page.reload()

  const rows = page.getByRole('button', { name: /^re-run .+\.pdf$/i })
  await expect(rows.first()).toBeVisible({ timeout: 15_000 })
  const listed = await rows.count()

  await page.getByRole('button', { name: /re-run all files/i }).click()

  const toasts = page.locator('[role="status"], [role="alert"]')
  // Never "nothing to re-run" while the queue is full.
  await expect(toasts.filter({ hasText: /nothing to re-run/i })).toHaveCount(0)
  // And whatever it says must be actionable: the original files have to be added again.
  await expect(toasts.filter({ hasText: /add them again|no longer held/i }).first()).toBeVisible()

  // The batch and its cards are untouched either way: re-running is a read, not a reset.
  await expect(rows).toHaveCount(listed)
  await expect(page.locator('[data-cell]').first()).toBeVisible()
})
