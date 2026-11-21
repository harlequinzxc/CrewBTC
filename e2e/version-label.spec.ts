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
  const history = readFileSync('CHANGELOG.md', 'utf8').split('## Release history')[1] ?? ''
  const version = /^### (\d+\.\d+\.\d+) —/m.exec(history)?.[1]
  expect(version).toBeDefined()
  const expected = `v${version}`
  await expect(page.getByRole('banner').getByText(expected, { exact: true })).toBeVisible()
})
