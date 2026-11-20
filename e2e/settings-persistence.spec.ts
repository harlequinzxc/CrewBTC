import { expect, test } from '@playwright/test'

test('unit preference survives reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByLabel('Units').selectOption('cm')
  await page.waitForTimeout(500)
  await page.reload()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.getByLabel('Units')).toHaveValue('cm')
})
