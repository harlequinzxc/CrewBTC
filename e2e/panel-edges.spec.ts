import { expect, test } from '@playwright/test'
import { uploadPdf } from './fixtures'

test('edge handles share geometry, collapse and restore without losing cards', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await uploadPdf(page)
  await page.getByLabel('Cell width').fill('190')
  await page.getByLabel('Cell height').fill('200')
  const left = page.getByRole('button', { name: 'Collapse Files' })
  const right = page.getByRole('button', { name: 'Collapse inspector' })
  const bottom = page.getByRole('button', { name: 'Collapse sheet strip' })
  await expect(bottom).toBeVisible()
  const boxes = await Promise.all([left.boundingBox(), right.boundingBox(), bottom.boundingBox()])
  for (const box of boxes) { expect(box!.width).toBe(32); expect(box!.height).toBe(32) }
  const files = (await page.getByRole('complementary', { name: 'Files' }).boundingBox())!
  const inspector = (await page.getByRole('complementary', { name: 'Inspector' }).boundingBox())!
  expect(Math.abs(boxes[0]!.x + boxes[0]!.width / 2 - (files.x + files.width))).toBeLessThan(1)
  expect(Math.abs(boxes[1]!.x + boxes[1]!.width / 2 - inspector.x)).toBeLessThan(1)
  const cards = await page.locator('[data-cell]').count()
  await left.click()
  await expect(page.getByRole('complementary', { name: 'Files' })).toBeHidden()
  const leftClosed = page.getByRole('button', { name: 'Expand Files' })
  expect((await leftClosed.boundingBox())!.x).toBe(0)
  await right.click()
  await expect(page.getByRole('complementary', { name: 'Inspector' })).toBeHidden()
  const rightClosed = page.getByRole('button', { name: 'Expand inspector' })
  const rightBox = (await rightClosed.boundingBox())!
  expect(rightBox.x + rightBox.width).toBe(1280)
  await bottom.click()
  await expect(page.getByRole('button', { name: /Expand sheet strip/ })).toBeVisible()
  await leftClosed.click()
  await rightClosed.click()
  await page.getByRole('button', { name: /Expand sheet strip/ }).click()
  await expect(page.getByRole('complementary', { name: 'Files' })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Inspector' })).toBeVisible()
  await expect(page.locator('[data-cell]')).toHaveCount(cards)
  await expect(bottom).toBeVisible()
  const overflow = await page.locator('ol').filter({ has: page.getByRole('button', { name: /sheet 1/i }) }).first().evaluate((node) => getComputedStyle(node).overflowY)
  expect(overflow).toBe('hidden')
})

test('print status does not respond to hover or click', async ({ page }) => {
  await uploadPdf(page)
  const status = page.getByTitle('Print review status; details are in the inspector')
  await expect(status).toHaveText(/Ready for export|\d+ issues?/, { timeout: 30000 })
  const before = await status.evaluate((node) => getComputedStyle(node).backgroundColor)
  await status.hover()
  expect(await status.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(before)
  await status.click()
  await expect(page.locator('#batch-review')).not.toBeFocused()
  await expect(status).toHaveJSProperty('tagName', 'OUTPUT')
})
