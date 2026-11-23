import { exportCurrent } from './fixtures'
import type { PDFArray } from '@cantoo/pdf-lib'
import { expect, test } from '@playwright/test'
import { uploadPdf } from './fixtures'

test('review jumps to an affected card and current export writes its sheet', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 768 })
  await uploadPdf(page)
  await page.getByLabel('Cell width').fill('190')
  await page.getByLabel('Cell height').fill('200')
  await expect(page.getByText('210 × 297 mm · 2 sheets')).toBeVisible()
  await expect(page.getByRole('button', { name: /Review \d+/ })).toBeVisible({ timeout: 30000 })
  await page.getByRole('button', { name: /Review \d+/ }).click()
  const review = page.locator('#batch-review')
  const second = review.getByRole('button', { name: /Sheet 2, card 1/ })
  await second.click()
  await expect(page.locator('[data-sheet="2"]')).toHaveAttribute('data-sheet-active', 'true')
  const card = page.locator('[data-sheet="2"] [data-cell="0"]')
  await card.getByRole('button', { name: /card text:/i }).first().click()
  await page.getByLabel('Edit card text').fill('SECOND SHEET UNIQUE')
  await page.keyboard.press('Escape')
  const pending = page.waitForEvent('download')
  await exportCurrent(page)
  const download = await pending
  expect(download.suggestedFilename()).toBe('crewbtc-sheet-2.pdf')
  const { readFile } = await import('node:fs/promises')
  const { PDFDocument } = await import('@cantoo/pdf-lib')
  const doc = await PDFDocument.load(await readFile(await download.path()))
  expect(doc.getPageCount()).toBe(1)
  const contents = doc.getPages()[0]!.node.Contents() as unknown as PDFArray
  let text = ''
  for (let i = 0; i < contents.size(); i += 1) {
    const stream = doc.context.lookup(contents.get(i) as never) as { contents?: Uint8Array }
    if (!stream.contents) continue
    const unzip = new DecompressionStream('deflate')
    const writer = unzip.writable.getWriter()
    void writer.write(new Uint8Array(stream.contents)); void writer.close()
    text += await new Response(unzip.readable).text()
  }
  expect(text).toContain('5345434F4E44')
})

test('preview expands and returns with Escape', async ({ page }) => {
  await uploadPdf(page)
  await page.getByRole('button', { name: 'Preview PDF' }).click()
  const preview = page.getByRole('complementary', { name: 'PDF preview' })
  await preview.getByRole('button', { name: 'Full screen' }).click()
  await expect(preview.getByRole('button', { name: 'Exit full screen' })).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(preview.getByRole('button', { name: 'Full screen' })).toBeVisible()
})

test('review and export remain reachable at 1024 pixels', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await uploadPdf(page)
  const review = page.getByRole('button', { name: /Review \d+/ })
  await expect(review).toBeVisible({ timeout: 30000 })
  await review.click()
  await expect(page.locator('#batch-review')).toBeFocused()
  const exportButton = page.getByRole('button', { name: 'Export PDF' })
  const box = await exportButton.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x + box!.width).toBeLessThanOrEqual(1024)
})
