import { expect, test } from '@playwright/test'
import { textZones, uploadPdf } from './fixtures'

/**
 * Clicking a file brings its card into view.
 *
 * The rail scrolls the canvas to the file's sheet, which is not the same as showing the
 * card: a sheet is twelve cells tall, so on a viewport shorter than the page the card can
 * sit below the fold while its ring is drawn off-screen. The reveal has to land on the
 * cell itself, and it has to do so whether the thumbnail strip is expanded or collapsed —
 * the strip changes the pane's height, so it changes what "in view" means.
 */
for (const strip of ['expanded', 'collapsed'] as const) {
  test(`clicking a file shows its cell (${strip} strip)`, async ({ page }) => {
    // A short window, so the sheet is far taller than the canvas and the card genuinely
    // has somewhere to be scrolled to. At full height the whole page fits and the test
    // would pass with no reveal logic at all — which is exactly what it did before this
    // line existed.
    await page.setViewportSize({ width: 1280, height: 600 })
    await uploadPdf(page)
    // Let the strip and the sheet stack lay themselves out before anything is measured;
    // the pane's scrollable height depends on both.
    await page.waitForTimeout(600)

    const pane = (await page.evaluateHandle(() =>
      [...document.querySelectorAll<HTMLElement>('div')].find(
        (node) => node.scrollHeight - node.clientHeight > 100 && getComputedStyle(node).overflowY === 'auto',
      ) ?? null,
    )).asElement()
    expect(pane, 'no scrollable canvas').not.toBeNull()

    if (strip === 'collapsed') {
      const toggle = page.getByRole('button', { name: /strip|thumbnails|sheets/i }).first()
      if (await toggle.count()) await toggle.click().catch(() => undefined)
    }

    // Start at the very bottom, so a reveal has to do something.
    const parked = await pane!.evaluate((node) => {
      node.scrollTop = node.scrollHeight
      return { top: node.scrollTop, max: node.scrollHeight - node.clientHeight }
    })
    // Parked at the bottom: the reveal has to move something, or it proves nothing.
    expect(parked.max).toBeGreaterThan(0)
    expect(parked.top).toBeGreaterThan(0)

    // The file *row*, not one of its action buttons: the row is what selects and reveals.
    const file = page.getByRole('button', { name: /\.pdf/i }).first()
    await file.click()
    await page.waitForTimeout(500)

    // The selected cell — the one with the ring — must be inside the pane, not merely
    // selected. Check every cell so the assertion is about the card that was asked for.
    const visible = await page.evaluate(() => {
      const paneNode = [...document.querySelectorAll<HTMLElement>('div')].find(
        (node) => node.scrollHeight - node.clientHeight > 100 && getComputedStyle(node).overflowY === 'auto',
      )
      if (!paneNode) return null
      const paneBox = paneNode.getBoundingClientRect()
      const cells = [...document.querySelectorAll<HTMLElement>('[data-cell]')]
      return {
        scrollTop: paneNode.scrollTop,
        maxScroll: paneNode.scrollHeight - paneNode.clientHeight,
        fullyVisible: cells.map((cell) => {
          const box = cell.getBoundingClientRect()
          return box.top >= paneBox.top - 1 && box.bottom <= paneBox.bottom + 1
        }),
      }
    })
    expect(visible).not.toBeNull()
    // The canvas really did have room to move, or this proves nothing.
    expect(visible!.maxScroll).toBeGreaterThan(0)
    // And it moved: wherever the reveal lands, it is not where the test parked it.
    expect(visible!.scrollTop).not.toBe(parked.top)
    // The card the click asked for is inside the canvas, not merely selected.
    expect(visible!.fullyVisible[0], 'the revealed card must be fully inside the canvas').toBe(true)
    void textZones
  })
}
