import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

/**
 * The build number belongs on screen, quietly.
 *
 * This is a PWA: an update only takes over once the page has been loaded into the new
 * worker, so "which build am I running?" is a question the app forces on its user. Answering
 * it with a version beside the wordmark costs one muted word and removes the guesswork —
 * including the guesswork of whether the fix you were told about is actually running.
 *
 * Read from the changelog rather than passed as a constant, so a release cannot bump one and
 * forget the other.
 */
test('the top bar names the build', async ({ page }) => {
  await page.goto('/')
  // Read the source of truth directly: importing the TS module would drag the app's
  // runtime into the test runner for one string.
  const releases = JSON.parse(readFileSync('src/data/changelog.json', 'utf8')) as { version: string }[]
  const expected = `v${releases[0]?.version ?? 'unknown'}`
  await expect(page.getByRole('banner').getByText(expected, { exact: true })).toBeVisible()
})
