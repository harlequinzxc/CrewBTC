import { expect, test } from '@playwright/test'
import { uploadPdf } from './fixtures'

test('header zoom is centered and controls do not overlap at supported widths', async ({ page }) => {
  await uploadPdf(page)
  for (const width of [1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 768 })
    const zoom = (await page.getByLabel('Sheet zoom').boundingBox())!
    expect(Math.abs(zoom.x + zoom.width / 2 - width / 2)).toBeLessThan(1)
    const controls = page.locator('header button:visible')
    const boxes = await controls.evaluateAll((elements) => elements.map((element) => {
      const r = element.getBoundingClientRect()
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
    }))
    for (let i = 0; i < boxes.length; i++) {
      const a = boxes[i]!
      expect(a.left).toBeGreaterThanOrEqual(0)
      expect(a.right).toBeLessThanOrEqual(width)
      expect(a.top).toBeGreaterThanOrEqual(0)
      expect(a.bottom).toBeLessThanOrEqual(48)
      for (const b of boxes.slice(i + 1)) expect(Math.min(a.right, b.right) - Math.max(a.left, b.left)).toBeLessThanOrEqual(0)
    }
  }
})

test('station tabs rename inline with F2 and scroll without wrapping', async ({ page }) => {
  await uploadPdf(page)
  const first = page.getByRole('button', { name: 'Station 1', exact: true })
  await first.focus()
  await page.keyboard.press('F2')
  const rename = page.getByRole('textbox', { name: 'Rename Station 1' })
  await rename.fill('SIN')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'SIN', exact: true })).toBeFocused()
  await page.keyboard.press('F2')
  await page.getByRole('textbox', { name: 'Rename SIN' }).fill('cancelled')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'SIN', exact: true })).toBeVisible()
  for (let i = 0; i < 12; i++) {
    page.once('dialog', (dialog) => dialog.accept(`Station ${i + 2} long`))
    await page.getByRole('button', { name: 'New station' }).click()
  }
  const strip = page.getByLabel('Station workspaces')
  const dimensions = await strip.evaluate((node) => ({ height: node.clientHeight, width: node.clientWidth, scrollWidth: node.scrollWidth }))
  expect(dimensions.height).toBeLessThanOrEqual(36)
  expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.width)
  await expect(page.getByRole('button', { name: 'Station 13 long', exact: true })).toHaveAttribute('aria-current', 'page')
})
