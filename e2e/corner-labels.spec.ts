import { expect, test } from '@playwright/test'
import { uploadPdf, textZones } from './fixtures'

test('numbering wraps, label edits survive reload, and sheet text size affects both cards', async ({ page }) => {
  await uploadPdf(page)
  const numbers = page.getByLabel('Card number')
  await expect(numbers).toHaveCount(2)
  await numbers.first().selectOption('40')
  await expect(numbers.nth(1)).toHaveValue('1')
  const labels = page.getByLabel('Card corner label')
  await expect(page.getByLabel('All text size')).toHaveValue('90')
  await labels.first().fill('AB123')
  await expect(labels.nth(1)).toHaveValue('AB123')
  await labels.nth(1).fill('REST')
  await expect(labels.first()).toHaveValue('AB123')
  const before = await textZones(page).nth(1).locator('span').first().evaluate((el) => getComputedStyle(el).fontSize)
  const size = page.getByLabel('All text size')
  await size.fill('150')
  await size.press('Tab')
  await expect.poll(() => textZones(page).nth(1).locator('span').first().evaluate((el) => getComputedStyle(el).fontSize)).not.toBe(before)
  await page.waitForTimeout(1000)
  await page.reload()
  await expect(page.getByLabel('Card number').first()).toHaveValue('40')
  await expect(page.getByLabel('Card number').nth(1)).toHaveValue('1')
  await expect(page.getByLabel('Card corner label').first()).toHaveValue('AB123')
  await expect(page.getByLabel('Card corner label').nth(1)).toHaveValue('REST')
  await page.getByLabel('Card corner label').first().fill('')
  await expect(page.getByLabel('Card corner label').nth(1)).toHaveValue('REST')
  await expect(page.getByLabel('All text size')).toHaveValue('150')
})

test('background removal uses a real browser image and supports sensitivity and undo', async ({ page }) => {
  await uploadPdf(page)
  await page.waitForTimeout(1000)
  const original = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 80; canvas.height = 80
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#eeeeee'; ctx.fillRect(0, 0, 80, 80)
    ctx.fillStyle = '#bd2222'; ctx.fillRect(20, 20, 40, 40)
    const dataUrl = canvas.toDataURL('image/png')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('crewbtc-session')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('workspace', 'readwrite')
      const store = tx.objectStore('workspace')
      const request = store.get('current')
      request.onsuccess = () => {
        const snapshot = request.result
        const key = Object.keys(snapshot.cards)[0]!
        snapshot.cards[key].photo = { dataUrl, widthPx: 80, heightPx: 80 }
        store.put(snapshot, 'current')
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
    return dataUrl
  })
  await page.reload()
  const image = page.locator('[data-image]').first()
  await expect(image.locator('img')).toHaveAttribute('src', original)
  await image.click()
  await page.getByLabel('Adjust background removal sensitivity').click()
  await page.getByRole('slider', { name: 'Background removal sensitivity' }).fill('20')
  await page.getByLabel('Remove the background').click()
  await expect(page.getByLabel('Put the original photo back')).toBeVisible()
  const alpha = await image.locator('img').evaluate(async (element: HTMLImageElement) => {
    await element.decode()
    const canvas = document.createElement('canvas')
    canvas.width = 80; canvas.height = 80
    const context = canvas.getContext('2d')!
    context.drawImage(element, 0, 0, 80, 80)
    return [context.getImageData(0, 0, 1, 1).data[3], context.getImageData(40, 40, 1, 1).data[3]]
  })
  expect(alpha).toEqual([0, 255])
  await page.getByLabel('Put the original photo back').click()
  await expect(image.locator('img')).toHaveAttribute('src', original)
})

test('all card text uses one size and font, and both corner boxes grow with it', async ({ page }) => {
  await uploadPdf(page)
  const inspect = async () => page.locator('[data-cell]').first().evaluate((cell) => {
    const header = cell.querySelector('button[aria-label^="Card text:"]') as HTMLElement
    const body = cell.querySelectorAll('button[aria-label^="Card text:"]')[1] as HTMLElement
    const number = cell.querySelector('[aria-label="Card number"]') as HTMLElement
    const label = cell.querySelector('[aria-label="Card corner label"]') as HTMLElement
    const props = (el: HTMLElement) => ({ size: parseFloat(getComputedStyle(el).fontSize), font: getComputedStyle(el).fontFamily, weight: getComputedStyle(el).fontWeight, align: getComputedStyle(el).textAlign, height: el.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(el).lineHeight) })
    return { header: props(header), body: props(body), number: props(number), label: props(label) }
  })
  for (const percent of ['100', '150', '200']) {
    const size = page.getByLabel('All text size')
    await size.fill(percent)
    await size.press('Tab')
    const data = await inspect()
    for (const part of [data.body, data.number, data.label]) {
      expect(part.size).toBeCloseTo(data.header.size, 2)
      expect(part.font).toBe(data.header.font)
      expect(part.weight).toBe(data.header.weight)
    }
    expect(data.number.align).toBe('center')
    expect(data.label.align).toBe('center')
    expect(data.number.height).toBeCloseTo(data.label.height, 2)
    expect(data.number.height).toBeGreaterThan(data.number.lineHeight)
  }
})

test('a corner field remains editable after editing text on the same card', async ({ page }) => {
  await uploadPdf(page)
  await textZones(page).first().click()
  await expect(page.getByLabel('Edit card text')).toHaveCount(1)
  const label = page.getByLabel('Card corner label').first()
  await label.click()
  await expect(label).toBeFocused()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.type('AB')
  await expect(label).toHaveValue('AB')
})

test('a later corner label starts a new run without changing earlier cards', async ({ page }) => {
  const { PDFDocument, StandardFonts } = await import('@cantoo/pdf-lib')
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 0; i < 4; i += 1) doc.addPage([420, 595]).drawText(`DISH ${i + 1}`, { x: 50, y: 520, font, size: 18 })
  const buffer = Buffer.from(await doc.save())
  const { resetSession } = await import('./fixtures')
  await resetSession(page)
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: /add pdfs/i }).click()
  await (await chooser).setFiles({ name: 'four.pdf', mimeType: 'application/pdf', buffer })
  const labels = page.getByLabel('Card corner label')
  await expect(labels).toHaveCount(4, { timeout: 30_000 })
  await labels.nth(0).fill('TEST')
  for (let i = 0; i < 4; i += 1) await expect(labels.nth(i)).toHaveValue('TEST')
  await labels.nth(2).fill('REST')
  for (let i = 0; i < 4; i += 1) await expect(labels.nth(i)).toHaveValue(i < 2 ? 'TEST' : 'REST')
  await page.waitForTimeout(1000)
  await page.reload()
  for (let i = 0; i < 4; i += 1) await expect(labels.nth(i)).toHaveValue(i < 2 ? 'TEST' : 'REST')
})

test('selected card readouts follow the divider and sheet text size', async ({ page }) => {
  await uploadPdf(page)
  await page.locator('[data-image]').first().click()
  await expect(page.getByRole('heading', { name: 'Card 1' })).toBeVisible()
  const top = page.getByLabel('Top value')
  const bottom = page.getByLabel('Bottom value')
  const text = page.getByLabel('Text value')
  await expect(top).toHaveText('8.56 mm')
  await expect(bottom).toHaveText('35.45 mm')
  await expect(text).toHaveText('90%')
  const before = await top.textContent()
  const divider = page.locator('[data-divider="header"]').first()
  const box = (await divider.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 20, { steps: 5 })
  await page.mouse.up()
  await expect(top).not.toHaveText(before!)
  await page.getByLabel('All text size').fill('120')
  await expect(text).toHaveText('120%')
})
