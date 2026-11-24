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
  for (const box of boxes) { expect(box!.width).toBe(24); expect(box!.height).toBe(24) }
  const files = (await page.getByRole('complementary', { name: 'Files' }).boundingBox())!
  const inspector = (await page.getByRole('complementary', { name: 'Inspector' }).boundingBox())!
  expect(Math.abs(boxes[0]!.x + boxes[0]!.width - (files.x + files.width))).toBeLessThan(1)
  expect(Math.abs(boxes[1]!.x - inspector.x)).toBeLessThan(1)
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
  const list = page.locator('ol').filter({ has: page.getByRole('button', { name: /sheet 1/i }) }).first()
  const listMetrics = await list.evaluate((node) => ({ height: node.clientHeight, scrollHeight: node.scrollHeight, top: node.scrollTop }))
  expect(listMetrics.scrollHeight).toBeLessThanOrEqual(listMetrics.height)
  await list.hover()
  await page.mouse.wheel(0, 200)
  expect(await list.evaluate((node) => node.scrollTop)).toBe(listMetrics.top)
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

test('all edge buttons are fully visible and hit-testable in both states', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 640 })
  await uploadPdf(page)
  await page.getByLabel('Cell width').fill('190')
  await page.getByLabel('Cell height').fill('200')
  async function assertHandle(name: RegExp) {
    const button = page.getByRole('button', { name })
    await expect(button).toBeVisible()
    const result = await button.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const points = [[r.left + 3, r.top + 3], [r.right - 3, r.top + 3], [r.left + 3, r.bottom - 3], [r.right - 3, r.bottom - 3], [r.left + r.width / 2, r.top + r.height / 2]]
      return { width: r.width, height: r.height, inViewport: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, points: points.map(([x, y]) => el.contains(document.elementFromPoint(x!, y!))) }
    })
    expect(result.width).toBe(24)
    expect(result.height).toBe(24)
    expect(result.inViewport).toBe(true)
    expect(result.points).toEqual([true, true, true, true, true])
  }
  for (const name of [/Collapse Files/, /Collapse inspector/, /Collapse sheet strip/]) await assertHandle(name)
  await page.getByRole('button', { name: 'Collapse Files' }).click()
  await page.getByRole('button', { name: 'Collapse inspector' }).click()
  await page.getByRole('button', { name: 'Collapse sheet strip' }).click()
  for (const name of [/Expand Files/, /Expand inspector/, /Expand sheet strip/]) await assertHandle(name)
})

test('station row does not vertically scroll, including when horizontally overflowing', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 640 })
  await uploadPdf(page)
  const row = page.getByLabel('Station workspaces')
  for (let i = 0; i < 12; i++) {
    page.once('dialog', (dialog) => dialog.accept(`Station ${i + 2} lengthy`))
    await page.getByRole('button', { name: 'New station' }).click()
  }
  const before = await row.evaluate((node) => ({ top: node.scrollTop, height: node.clientHeight, scrollHeight: node.scrollHeight, width: node.clientWidth, scrollWidth: node.scrollWidth, y: getComputedStyle(node).overflowY }))
  expect(before.y).toBe('hidden')
  expect(before.scrollWidth).toBeGreaterThan(before.width)
  expect(before.scrollHeight).toBeLessThanOrEqual(before.height)
  await row.hover()
  await page.mouse.wheel(0, 250)
  expect(await row.evaluate((node) => node.scrollTop)).toBe(before.top)
  await row.evaluate((node) => { node.scrollLeft = 0 })
  expect(await row.evaluate((node) => node.scrollLeft)).toBe(0)
  await row.evaluate((node) => { node.scrollLeft = node.scrollWidth })
  expect(await row.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0)
})
