import { expect, test } from '@playwright/test'
import { uploadPdf } from './fixtures'

/**
 * "Re-run all files" on a restored batch.
 *
 * The batch is a saved session: parsed results, cards on the sheet, every file listed on
 * the left. What is *not* saved is the upload — the snapshot deliberately stores results
 * rather than PDFs, because re-parsing cannot reproduce band heights, swapped photos or
 * framing. So in a new session the bytes are gone while the files are visibly present.
 *
 * The old message in that state was "Nothing to re-run — Add PDFs first", next to a list of
 * added PDFs, which is both wrong and unactionable. This pins the honest answer.
 */
test('re-run explains itself on a restored batch instead of denying the files exist', async ({
  page,
}) => {
  await uploadPdf(page)
  await page.waitForTimeout(1500)
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
