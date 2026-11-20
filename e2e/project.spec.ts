import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { PDFDocument } from '@cantoo/pdf-lib'
import type { PDFArray } from '@cantoo/pdf-lib'
import { textZones, uploadPdf } from './fixtures'

test('project transfers edited cards, photo, settings and original PDF to a fresh browser', async ({ page, browser }) => {
  await uploadPdf(page)
  await expect(page.getByLabel('Save project')).toBeEnabled()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByLabel('Units').selectOption('cm')
  await page.getByRole('button', { name: 'Close settings' }).click()
  const box = (await page.locator('[data-cell]').first().boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.45)
  const divider = (await page.locator('[data-divider="header"]').first().boundingBox())!
  await page.mouse.move(divider.x + divider.width / 2, divider.y + divider.height / 2)
  await page.mouse.down()
  await page.mouse.move(divider.x + divider.width / 2, divider.y + divider.height / 2 + 25, { steps: 5 })
  await page.mouse.up()
  const topBand = await page.getByLabel('Top value').textContent()
  expect(topBand).not.toBe('0.73 cm')
  await page.getByLabel('Card number').first().selectOption('32')
  await textZones(page).first().click()
  await page.getByLabel('Edit card text').fill('PORTABLE EDIT')
  await page.keyboard.press('Escape')
  await page.getByLabel('Card corner label').first().fill('ABC')
  await page.getByLabel('All text size').fill('125')
  await page.getByLabel('All text size').press('Tab')
  await page.waitForTimeout(1000)
  await page.reload()
  await expect(page.getByLabel('Card corner label').first()).toHaveValue('ABC')
  await page.getByRole('switch', { name: 'Show cut guides' }).click()
  const pending = page.waitForEvent('download')
  await page.getByLabel('Save project').click()
  const download = await pending
  const bytes = await readFile(await download.path())
  const saved = JSON.parse(bytes.toString()) as { sources: Record<string, string> }
  expect(Object.keys(saved.sources)).toHaveLength(1)
  expect(Buffer.from(Object.values(saved.sources)[0]!, 'base64').toString('latin1').startsWith('%PDF-')).toBe(true)
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const fresh = await context.newPage()
  await fresh.goto('/')
  const chooser = fresh.waitForEvent('filechooser')
  await fresh.getByLabel('Open project').click()
  await (await chooser).setFiles({ name: 'saved.crewbtc', mimeType: 'application/json', buffer: bytes })
  await expect(fresh.getByText('Project opened', { exact: true })).toBeVisible()
  await expect(fresh.locator('[data-cell]').first()).toContainText('PORTABLE EDIT')
  await expect(fresh.getByLabel('Card corner label').first()).toHaveValue('ABC')
  await expect(fresh.getByLabel('All text size')).toHaveValue('125')
  await expect(fresh.getByLabel('Card number').first()).toHaveValue('32')
  await expect(fresh.getByRole('switch', { name: 'Show cut guides' })).toHaveAttribute('aria-checked', 'false')
  const restoredBox = (await fresh.locator('[data-cell]').first().boundingBox())!
  await fresh.mouse.click(restoredBox.x + restoredBox.width / 2, restoredBox.y + restoredBox.height * 0.45)
  await expect(fresh.getByLabel('Top value')).toHaveText(topBand!)
  await fresh.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(fresh.getByLabel('Units')).toHaveValue('cm')
  await fresh.getByRole('button', { name: 'Close settings' }).click()
  await expect(fresh.locator('[data-cell]').first().locator('img').first()).toBeVisible()
  await fresh.waitForTimeout(1000)
  await fresh.reload()
  await expect(fresh.locator('[data-cell]').first()).toContainText('PORTABLE EDIT')
  await expect(fresh.getByRole('switch', { name: 'Show cut guides' })).toHaveAttribute('aria-checked', 'false')
  await fresh.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(fresh.getByLabel('Units')).toHaveValue('cm')
  await fresh.getByRole('button', { name: 'Close settings' }).click()
  const exported = fresh.waitForEvent('download')
  await fresh.getByLabel('Export PDF').click()
  const pdf = await PDFDocument.load(await readFile(await (await exported).path()))
  const contents = pdf.getPages()[0]!.node.Contents() as unknown as PDFArray
  let content = ''
  for (let i = 0; i < contents.size(); i += 1) {
    const item = pdf.context.lookup(contents.get(i) as never) as { contents?: Uint8Array }
    if (item.contents === undefined) continue
    const stream = new DecompressionStream('deflate')
    const writer = stream.writable.getWriter()
    void writer.write(new Uint8Array(item.contents)); void writer.close()
    content += await new Response(stream.readable).text()
  }
  expect(content).toContain('<504F525441424C452045444954> Tj')
  expect(content).toContain('<414243> Tj')
  expect(content).toMatch(/\/[^\s]+ Do\b/)
  const again = fresh.waitForEvent('download')
  await fresh.getByLabel('Save project').click()
  const restored = JSON.parse((await readFile(await (await again).path())).toString()) as { sources: Record<string, string> }
  expect(Object.keys(restored.sources)).toHaveLength(1)
  await fresh.getByRole('button', { name: /re-run all files/i }).click()
  await expect(fresh.getByText(/PDF added/)).toBeVisible({ timeout: 30000 })
  await context.close()
})

test('invalid project does not replace the workspace', async ({ page }) => {
  await uploadPdf(page)
  const original = await page.locator('[data-cell]').first().textContent()
  const chooser = page.waitForEvent('filechooser')
  await page.getByLabel('Open project').click()
  await (await chooser).setFiles({ name: 'bad.crewbtc', mimeType: 'application/json', buffer: Buffer.from('{"format":"crewbtc-project","version":999}') })
  await expect(page.getByText('Could not open project')).toBeVisible()
  await expect(page.locator('[data-cell]').first()).toHaveText(original!)
})

test('cancelling project replacement leaves the current cards untouched', async ({ page }) => {
  await uploadPdf(page)
  await expect(page.getByLabel('Save project')).toBeEnabled()
  const pending = page.waitForEvent('download')
  await page.getByLabel('Save project').click()
  const bytes = await readFile(await (await pending).path())
  await textZones(page).first().click()
  await page.getByLabel('Edit card text').fill('CURRENT WORK')
  await page.keyboard.press('Escape')
  page.once('dialog', (dialog) => { void dialog.dismiss() })
  const chooser = page.waitForEvent('filechooser')
  await page.getByLabel('Open project').click()
  await (await chooser).setFiles({ name: 'saved.crewbtc', mimeType: 'application/json', buffer: bytes })
  await expect(page.locator('[data-cell]').first()).toContainText('CURRENT WORK')
  await expect(page.getByText('Project opened', { exact: true })).toHaveCount(0)
})

test('saving an older session warns when its original PDF is unavailable', async ({ page }) => {
  await uploadPdf(page)
  await expect(page.getByLabel('Save project')).toBeEnabled()
  await page.waitForTimeout(1000)
  await page.evaluate(async () => { await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('crewbtc-project-sources')
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  }) })
  await page.reload()
  await expect(page.getByLabel('Save project')).toBeEnabled()
  const pending = page.waitForEvent('download')
  await page.getByLabel('Save project').click()
  const data = JSON.parse((await readFile(await (await pending).path())).toString()) as { sources: Record<string, string> }
  expect(Object.keys(data.sources)).toHaveLength(0)
  await expect(page.getByText('Project saved without some original PDFs')).toBeVisible()
})

test('project controls stay reachable by keyboard at supported desktop widths', async ({ page }) => {
  for (const width of [1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    const open = page.getByLabel('Open project')
    const save = page.getByLabel('Save project')
    await expect(open).toBeVisible()
    await open.focus()
    await expect(open).toBeFocused()
    const box = (await open.boundingBox())!
    const saveBox = (await save.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(saveBox.x + saveBox.width).toBeLessThanOrEqual(width)
  }
})

test('replacing a project releases only the previous originals', async ({ page }) => {
  await uploadPdf(page)
  await expect(page.getByLabel('Save project')).toBeEnabled()
  const pending = page.waitForEvent('download')
  await page.getByLabel('Save project').click()
  const project = JSON.parse((await readFile(await (await pending).path())).toString()) as {
    snapshot: { documents: { id: string }[]; activeId: string | null }
    sources: Record<string, string>
  }
  const oldId = project.snapshot.documents[0]!.id
  const newId = 'replacement-document-id'
  project.snapshot.documents[0]!.id = newId
  project.snapshot.activeId = newId
  project.sources[newId] = project.sources[oldId]!
  delete project.sources[oldId]
  page.once('dialog', (dialog) => { void dialog.accept() })
  const chooser = page.waitForEvent('filechooser')
  await page.getByLabel('Open project').click()
  await (await chooser).setFiles({ name: 'replacement.crewbtc', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) })
  await expect(page.getByText('Project opened', { exact: true })).toBeVisible()
  const ids = () => page.evaluate(async () => {
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
  await expect.poll(ids, { timeout: 15000 }).not.toContain(oldId)
  expect(await ids()).toContain(newId)
})
