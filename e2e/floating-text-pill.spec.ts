import { expect, test } from '@playwright/test'
import { textZones, uploadPdf } from './fixtures'

async function geometry(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const pane = document.querySelector<HTMLElement>('[data-testid="sheet-pane"]')!
    const bar = document.querySelector<HTMLElement>('[data-testid="floating-text-pill"]')!
    const card = document.querySelector<HTMLElement>('[data-sheet="1"] [data-cell="0"]')!
    const p = pane.getBoundingClientRect(), b = bar.getBoundingClientRect(), c = card.getBoundingClientRect()
    return { left: b.left - p.left, top: b.top - p.top, right: p.left + pane.clientWidth - b.right, bottom: p.top + pane.clientHeight - b.bottom, cardTop: c.top, cardBottom: c.bottom, barTop: b.top, barBottom: b.bottom, width: b.width, paneWidth: pane.clientWidth }
  })
}

async function expectContained(page: import('@playwright/test').Page) {
  await expect.poll(async () => {
    const g = await geometry(page)
    return Math.min(g.left, g.top, g.right, g.bottom)
  }).toBeGreaterThanOrEqual(0)
  const bar = page.getByTestId('floating-text-pill')
  await expect(bar).toBeVisible()
  await expect(bar.getByRole('button', { name: 'CROCKERIES callout' })).toBeVisible()
}

test('pill anchors above or flips below the active card and stays inside the preview', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await uploadPdf(page)
  await textZones(page).first().click()
  await expectContained(page)
  const initial = await geometry(page)
  expect(initial.width).toBeLessThan(initial.paneWidth)
  expect(initial.barBottom).toBeLessThanOrEqual(initial.cardTop)
  const pane = page.getByTestId('sheet-pane')
  await pane.evaluate((el) => { el.scrollTop = 50 })
  await expect.poll(async () => (await geometry(page)).barTop - (await geometry(page)).cardBottom).toBeGreaterThanOrEqual(0)
  await expectContained(page)
  await page.getByRole('button', { name: 'CROCKERIES callout' }).click()
  await expect(page.getByRole('button', { name: 'CROCKERIES callout' })).toHaveAttribute('aria-pressed', 'true')
})

test('pill follows scroll, zoom and panel resizing without crossing the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 640 })
  await uploadPdf(page)
  await textZones(page).first().click()
  await expectContained(page)
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expectContained(page)
  const pane = page.getByTestId('sheet-pane')
  await pane.evaluate((el) => { el.scrollTop = 100; el.scrollLeft = 200 })
  await expectContained(page)
  await page.getByRole('button', { name: 'Collapse Files' }).click()
  await expectContained(page)
  await page.getByRole('button', { name: 'Collapse inspector' }).click()
  await expectContained(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await expectContained(page)
})
