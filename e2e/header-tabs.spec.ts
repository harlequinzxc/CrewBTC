import { expect, test } from '@playwright/test'
import { uploadPdf } from './fixtures'

test('bottom zoom is centered and header controls do not overlap at supported widths', async ({ page }) => {
  await uploadPdf(page)
  for (const width of [1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 768 })
    const footer = (await page.getByLabel('Sheet status and zoom').boundingBox())!
    expect(footer.y + footer.height).toBe(768)
    const zoom = (await page.getByLabel('Sheet zoom').boundingBox())!
    const history = (await page.getByLabel('Edit history').boundingBox())!
    expect(history.x + history.width).toBeLessThanOrEqual(zoom.x)
    expect(zoom.y).toBeGreaterThanOrEqual(footer.y)
    expect(Math.abs(zoom.x + zoom.width / 2 - width / 2)).toBeLessThan(1)
    const controls = page.locator('header button:visible')
    const boxes = await controls.evaluateAll((elements) => elements.map((element) => {
      const r = element.getBoundingClientRect()
      return { name: element.getAttribute('aria-label') || element.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom }
    }))
    for (let i = 0; i < boxes.length; i++) {
      const a = boxes[i]!
      expect(a.left).toBeGreaterThanOrEqual(0)
      expect(a.right).toBeLessThanOrEqual(width)
      expect(a.top).toBeGreaterThanOrEqual(0)
      expect(a.bottom).toBeLessThanOrEqual(48)
      expect(Math.abs((a.top + a.bottom) / 2 - 23.5)).toBeLessThanOrEqual(1)
      for (const b of boxes.slice(i + 1)) expect(Math.min(a.right, b.right) - Math.max(a.left, b.left), `${a.name} overlaps ${b.name} at ${width}px`).toBeLessThanOrEqual(0)
    }
  }
})

test('station tabs rename inline by double-click and scroll without wrapping', async ({ page }) => {
  await uploadPdf(page)
  const first = page.getByRole('button', { name: 'Station 1', exact: true })
  await first.dblclick()
  const rename = page.getByRole('textbox', { name: 'Rename Station 1' })
  await rename.fill('SIN')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'SIN', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'SIN', exact: true }).dblclick()
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

test('station renaming keeps neighboring tabs and plus aligned without extra accent borders', async ({ page }) => {
  await uploadPdf(page)
  await page.getByRole('button', { name: 'Station 1', exact: true }).dblclick()
  await page.getByRole('textbox', { name: 'Rename Station 1' }).fill('SIN')
  await page.keyboard.press('Enter')
  for (const name of ['ABCMP', 'AC']) {
    page.once('dialog', (dialog) => dialog.accept(name))
    await page.getByRole('button', { name: 'New station' }).click()
  }
  const middle = page.getByRole('button', { name: 'ABCMP', exact: true })
  await middle.click()
  await expect(page.getByRole('textbox', { name: 'Rename ABCMP' })).toHaveCount(0)
  const before = await middle.boundingBox()
  const sin = await page.getByRole('button', { name: 'SIN', exact: true }).boundingBox()
  const ac = await page.getByRole('button', { name: 'AC', exact: true }).boundingBox()
  const plus = await page.getByRole('button', { name: 'New station' }).boundingBox()
  expect(Math.abs((before!.y + before!.height / 2) - (plus!.y + plus!.height / 2))).toBeLessThanOrEqual(1)
  await middle.dblclick()
  const input = page.getByRole('textbox', { name: 'Rename ABCMP' })
  const metrics = await input.evaluate((el: HTMLInputElement) => {
    const style = getComputedStyle(el)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    return { left: el.scrollLeft, available: el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight), text: ctx.measureText(el.value).width, selection: [el.selectionStart, el.selectionEnd] }
  })
  expect(metrics.left).toBe(0)
  expect(metrics.selection).toEqual([0, 5])
  expect(metrics.available).toBeGreaterThanOrEqual(metrics.text + 6)
  const editing = await input.boundingBox()
  expect(editing!.width).toBeCloseTo(before!.width, 0)
  expect(await page.getByRole('button', { name: 'SIN', exact: true }).boundingBox()).toEqual(sin)
  expect(await page.getByRole('button', { name: 'AC', exact: true }).boundingBox()).toEqual(ac)
  expect(await page.getByRole('button', { name: 'New station' }).boundingBox()).toEqual(plus)
  const styles = await input.evaluate((node) => {
    const field = getComputedStyle(node)
    const wrapper = getComputedStyle(node.parentElement!)
    return { fontSize: field.fontSize, fontWeight: field.fontWeight, outline: field.outlineStyle, left: field.borderLeftColor, right: field.borderRightColor, bottomWidth: wrapper.borderBottomWidth }
  })
  expect(styles).toMatchObject({ fontSize: '16px', fontWeight: '600', outline: 'none', bottomWidth: '2px' })
  expect(styles.left).toBe(styles.right)
  expect(styles.left).toContain('/ 0.2')
  await input.fill('I')
  const short = (await input.boundingBox())!
  await input.fill('WWWWWWWWWWWWWWWWWWWW')
  const long = (await input.boundingBox())!
  expect(short.width).toBeLessThan(editing!.width)
  expect(long.width).toBeGreaterThan(160)
  expect(long.y).toBe(short.y)
  await input.fill('ABCMP')
  expect((await input.boundingBox())!.width).toBeCloseTo(editing!.width, 0)
  await input.blur()
  expect(await middle.boundingBox()).toEqual(before)
})

test('opening a long station name shows its first character', async ({ page }) => {
  await uploadPdf(page)
  const name = 'ABCMP wide station 2026'
  page.once('dialog', (dialog) => dialog.accept(name))
  await page.getByRole('button', { name: 'New station' }).click()
  await page.getByRole('button', { name, exact: true }).dblclick()
  const input = page.getByRole('textbox', { name: `Rename ${name}` })
  await expect(input).toHaveValue(name)
  await expect.poll(() => input.evaluate((el: HTMLInputElement) => el.scrollLeft)).toBe(0)
  const field = await input.evaluate((el: HTMLInputElement) => ({ available: el.clientWidth, content: el.scrollWidth, start: el.selectionStart, end: el.selectionEnd }))
  expect(field.content).toBeLessThanOrEqual(field.available)
  expect(field.start).toBe(0)
  expect(field.end).toBe(name.length)
})

test('header icons and labels share a single centered row without clipping', async ({ page }) => {
  await uploadPdf(page)
  for (const width of [1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 768 })
    for (const name of ['Fit sheet to width', 'New project', 'Open project', 'Save project', 'Settings', 'Preview PDF', 'Export PDF']) {
      const button = page.getByRole('button', { name, exact: true })
      const bounds = await button.evaluate((el) => {
        const outer = el.getBoundingClientRect()
        const icon = el.querySelector('svg')!.getBoundingClientRect()
        const text = el.querySelector('span')!.getBoundingClientRect()
        return { display: getComputedStyle(el).display, height: outer.height, outerTop: outer.top, outerBottom: outer.bottom, iconLeft: icon.left, iconRight: icon.right, iconTop: icon.top, iconBottom: icon.bottom, textLeft: text.left, textTop: text.top, textBottom: text.bottom }
      })
      expect(['flex', 'inline-flex']).toContain(bounds.display)
      expect(bounds.height).toBeGreaterThanOrEqual(28)
      expect(bounds.height).toBeLessThanOrEqual(32)
      expect(bounds.iconRight).toBeLessThanOrEqual(bounds.textLeft)
      expect(Math.abs((bounds.iconTop + bounds.iconBottom) / 2 - (bounds.textTop + bounds.textBottom) / 2)).toBeLessThanOrEqual(1)
      expect(bounds.iconTop).toBeGreaterThanOrEqual(bounds.outerTop)
      expect(bounds.iconBottom).toBeLessThanOrEqual(bounds.outerBottom)
      expect(bounds.textTop).toBeGreaterThanOrEqual(bounds.outerTop)
      expect(bounds.textBottom).toBeLessThanOrEqual(bounds.outerBottom)
    }
    for (const name of ['Zoom in', 'Zoom out', 'Settings', 'Collapse inspector']) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('title', name)
    }
  }
})
