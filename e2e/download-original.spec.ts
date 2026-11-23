import { projectAction } from './fixtures'
import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { pdfFile, uploadPdf } from './fixtures'

test('right-click downloads the exact original after reload; keyboard options work too', async ({ page }) => {
  await uploadPdf(page)
  await page.waitForTimeout(1000)
  await page.reload()
  const row = page.getByRole('button', { name: 'cards.pdf', exact: true })
  await expect(row).toBeVisible()
  await row.click({ button: 'right' })
  const download = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'Download original' }).click()
  const result = await download
  expect(result.suggestedFilename()).toBe('cards.pdf')
  expect(await readFile(await result.path())).toEqual(pdfFile().buffer)
  const options = page.getByRole('button', { name: 'Options for cards.pdf' })
  await options.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menuitem', { name: 'Download original' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(options).toBeFocused()
})

test('missing original explains why it cannot be downloaded', async ({ page }) => {
  await uploadPdf(page)
  const saved = page.waitForEvent('download')
  await projectAction(page, 'Save project')
  const project = JSON.parse((await readFile(await (await saved).path())).toString()) as { sources: Record<string, number> }
  project.sources = {}
  page.once('dialog', (dialog) => dialog.accept())
  const chooser = page.waitForEvent('filechooser')
  await projectAction(page, 'Open project')
  await (await chooser).setFiles({ name: 'no-source.crewbtc', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) })
  await expect(page.getByRole('button', { name: 'Options for cards.pdf' })).toBeVisible()
  // Clear this browser's original bytes as well as the imported project's references.
  await page.evaluate(async () => {
    const request = indexedDB.open('crewbtc-project-sources')
    await new Promise<void>((resolve, reject) => {
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction('sources', 'readwrite')
        tx.objectStore('sources').clear()
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onerror = () => reject(tx.error)
      }
    })
  })
  await page.waitForTimeout(1000)
  await page.reload()
  await page.getByRole('button', { name: 'Options for cards.pdf' }).click()
  await page.getByRole('menuitem', { name: 'Download original' }).click()
  await expect(page.getByRole('alert')).toContainText('Original PDF unavailable')
})
