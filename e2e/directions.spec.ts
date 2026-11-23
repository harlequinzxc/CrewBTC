import { exportCurrent } from './fixtures'
import type { PDFArray } from '@cantoo/pdf-lib'
import { expect, test } from '@playwright/test'
import { textZones, uploadPdf } from './fixtures'

test('DIRECTIONS colours only the selected words, survives reload and prints red', async ({ page }) => {
  await uploadPdf(page)
  await textZones(page).nth(1).click()
  const field = page.getByLabel('Edit card text')
  await field.fill('Plate with rice')
  await field.press('Home')
  for (let i = 0; i < 5; i += 1) await field.press('Shift+ArrowRight')
  await expect(page.getByTestId('card-text-bar').getByText('selection')).toBeVisible()
  const button = page.getByRole('button', { name: 'DIRECTIONS' })
  await button.click()
  await button.click()
  await page.keyboard.press('Escape')
  const drawn = textZones(page).nth(1)
  await expect(drawn.locator('span span', { hasText: 'Plate' })).toHaveCSS('color', 'rgb(185, 28, 28)')
  await expect(drawn.locator('span span', { hasText: 'with' })).toHaveCSS('color', 'rgb(17, 24, 39)')
  await page.waitForTimeout(800)
  await page.reload()
  await expect(textZones(page).nth(1).locator('span span', { hasText: 'Plate' })).toHaveCSS('color', 'rgb(185, 28, 28)')

  const pending = page.waitForEvent('download')
  await exportCurrent(page)
  const download = await pending
  const { readFile } = await import('node:fs/promises')
  const { PDFDocument } = await import('@cantoo/pdf-lib')
  const doc = await PDFDocument.load(await readFile(await download.path()))
  const contents = doc.getPages()[0]!.node.Contents() as unknown as PDFArray
  let content = ''
  for (let i = 0; i < contents.size(); i += 1) {
    const item = doc.context.lookup(contents.get(i) as never) as { contents?: Uint8Array }
    if (item.contents === undefined) continue
    const stream = new DecompressionStream('deflate')
    const writer = stream.writable.getWriter()
    void writer.write(new Uint8Array(item.contents))
    void writer.close()
    content += await new Response(stream.readable).text()
  }
  // Assert red ink in the same text object as the selected word, not just anywhere in the PDF.
  expect(content).toMatch(/0\.72549\d*\s+0\.10980\d*\s+0\.10980\d*\s+rg[\s\S]*?<506C617465>\s*Tj/)
})

test('DIRECTIONS colours the active box and clear formatting restores the default', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await uploadPdf(page)
  await textZones(page).first().click()
  const field = page.getByLabel('Edit card text')
  await field.fill('Method')
  const bar = page.getByTestId('card-text-bar')
  const button = bar.getByRole('button', { name: 'DIRECTIONS' })
  await expect(button).toBeVisible()
  await button.click()
  await expect(field).toHaveCSS('color', 'rgb(185, 28, 28)')
  await expect(button).toHaveAttribute('aria-pressed', 'true')
  await bar.getByRole('button', { name: 'Clear formatting' }).click()
  await expect(field).toHaveCSS('color', 'rgb(17, 24, 39)')
})
