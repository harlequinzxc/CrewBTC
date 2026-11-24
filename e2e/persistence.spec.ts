import { expectSaveEnabled, exportCurrent } from './fixtures'
import type { PDFArray } from '@cantoo/pdf-lib'
import { expect, test } from '@playwright/test'
import { textZones, uploadPdf } from './fixtures'

/**
 * A reload must not cost the user their work.
 *
 * This is the E2E shape of the persistence tests: the unit tests prove the store and the
 * restore path, and this proves the whole thing in a real browser, across a real reload,
 * with real IndexedDB — which is the only place the storage timing actually happens.
 */


test('a reload restores the batch and the cards', async ({ page }) => {
  await uploadPdf(page)
  const drawn = await page.locator('[data-cell]').count()

  // Wait for the debounced write, then do what a user does.
  await page.waitForTimeout(600)
  await page.reload()

  await expect(page.locator('[data-cell]').first()).toBeVisible({ timeout: 15_000 })
  expect(await page.locator('[data-cell]').count()).toBe(drawn)
})

test('a reload keeps a card edit', async ({ page }) => {
  await uploadPdf(page)
  const zone = textZones(page).first()
  await zone.click()
  const field = page.getByLabel('Edit card text')
  await field.fill('EDITED AFTER RELOAD')
  await page.keyboard.press('Escape')

  await page.waitForTimeout(600)
  await page.reload()

  await expect(page.locator('[data-cell]').first()).toContainText('EDITED AFTER RELOAD', {
    timeout: 15_000,
  })
})

test('clear all offers an undo that restores the batch', async ({ page }) => {
  await uploadPdf(page)
  const drawn = await page.locator('[data-cell]').count()

  await page.getByRole('button', { name: /clear all files/i }).click()
  await expect(page.locator('[data-cell]')).toHaveCount(0)

  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.locator('[data-cell]')).toHaveCount(drawn)
  const download = page.waitForEvent('download')
  await exportCurrent(page)
  await download
  await expect(page.getByText(`1 sheet, ${drawn} cards`, { exact: true })).toBeVisible()
})

test('export after reload contains the edited text, label, and photo', async ({ page }) => {
  await uploadPdf(page)
  await textZones(page).first().click()
  await page.getByLabel('Edit card text').fill('KEPT')
  await page.keyboard.press('Escape')
  await page.getByLabel('Card corner label').first().fill('ABC')
  await page.waitForTimeout(1000)
  await page.reload()
  await expect(page.locator('[data-cell]').first()).toBeVisible()
  await expect(page.locator('[data-cell]').first()).toContainText('KEPT')
  const pending = page.waitForEvent('download')
  await exportCurrent(page)
  const download = await pending
  const { readFile } = await import('node:fs/promises')
  const { PDFDocument } = await import('@cantoo/pdf-lib')
  const doc = await PDFDocument.load(await readFile(await download.path()))
  const contents = doc.getPages()[0]!.node.Contents() as unknown as PDFArray
  const streams: string[] = []
  for (let i = 0; i < contents.size(); i += 1) {
    const item = doc.context.lookup(contents.get(i) as never) as { contents?: Uint8Array }
    if (item.contents === undefined) continue
    const stream = new DecompressionStream('deflate')
    const writer = stream.writable.getWriter()
    void writer.write(new Uint8Array(item.contents))
    void writer.close()
    streams.push(await new Response(stream.readable).text())
  }
  const content = streams.join('\n')
  expect(content).toContain('<4B455054> Tj')
  expect(content).toContain('<414243> Tj')
  expect(content).toMatch(/\/[^\s]+ Do\b/)
})

test('clear undo keeps original PDF; a later clear releases it after the undo window', async ({ page }) => {
  await uploadPdf(page)
  await expectSaveEnabled(page)
  const sourceIds = () => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('crewbtc-project-sources')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const request = db.transaction('sources').objectStore('sources').getAllKeys()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    db.close()
    return keys.filter((key): key is string => typeof key === 'string')
  })
  const before = await sourceIds()
  expect(before.length).toBeGreaterThan(0)
  const id = before.at(-1)!
  await page.getByRole('button', { name: /clear all files/i }).click()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.locator('[data-cell]').first()).toBeVisible()
  await page.waitForTimeout(10_500)
  expect(await sourceIds()).toContain(id)
  await page.getByRole('button', { name: /clear all files/i }).click()
  await expect.poll(sourceIds, { timeout: 15000 }).not.toContain(id)
})
