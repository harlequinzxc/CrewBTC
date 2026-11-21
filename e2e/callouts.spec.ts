import { expect, test } from '@playwright/test'
import { textZones, uploadPdf } from './fixtures'

/**
 * The round's user-visible promises, checked in a real browser.
 *
 * Each one is a symptom somebody reported rather than an implementation detail: a card
 * that never looked selected, a hint that vanished on click, a second click that undid the
 * first, and two presets that must tag a plating callout in one click and print that way.
 *
 * Every step presses the card *without* opening a text box first where the point is
 * selection, because opening a text box is exactly the path that used to swallow it.
 */

/** Press the photo: a card press that carries its page identity and opens no editor. */
async function selectCard(page: Parameters<typeof uploadPdf>[0]): Promise<void> {
  const box = (await page.locator('[data-cell]').first().boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.45)
  await page.waitForTimeout(300)
}

test('pressing a card shows it is selected, and reveals the band dividers', async ({ page }) => {
  await uploadPdf(page)
  await selectCard(page)

  // The regression: v1.8.2 dropped the page identity on the way to the selection, so no
  // card could ever render as selected and the dividers — which mount only on the selected
  // card — never existed. Resizing the photo was therefore impossible to reach.
  await expect(page.locator('[data-cell]').first()).toHaveClass(/outline-accent/)
  await expect(page.locator('[data-divider]')).toHaveCount(2)
})

test('dragging a divider resizes the photo band', async ({ page }) => {
  await uploadPdf(page)
  await selectCard(page)

  const pictureHeight = () =>
    page.evaluate(() => {
      const zones = [...document.querySelectorAll('button[aria-label^="Card text:"]')].slice(0, 2)
      const header = zones[0]!.getBoundingClientRect()
      const footer = zones[1]!.getBoundingClientRect()
      return footer.top - header.bottom
    })

  const before = await pictureHeight()
  const divider = page.locator('[data-divider="header"]').first()
  const box = (await divider.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 40, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(200)

  const after = await pictureHeight()
  // Dragging the first divider down takes height from the photo, not from the footer.
  expect(after).toBeLessThan(before - 20)
})

test('clicking an empty bottom box keeps its hint, in the same place', async ({ page }) => {
  await uploadPdf(page)
  const footer = textZones(page).nth(1)
  const box = (await footer.boundingBox())!

  const hint = await page.evaluate(() => {
    const zone = document.querySelectorAll('button[aria-label^="Card text:"]')[1] as HTMLElement
    return { text: zone.textContent, left: (zone.querySelector('span.pointer-events-none') as HTMLElement).style.left }
  })
  expect(hint.text).toBe('Plating steps')

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.up()
  await page.waitForTimeout(300)

  // The field had no placeholder at all before this round, so the box went blank on click.
  const field = page.getByLabel('Edit card text')
  await expect(field).toHaveAttribute('placeholder', 'Plating steps')
  const state = await field.evaluate((element) => {
    const style = getComputedStyle(element)
    const placeholder = getComputedStyle(element, '::placeholder')
    return {
      align: style.textAlign,
      placeholderAlign: placeholder.textAlign,
      placeholderWeight: placeholder.fontWeight,
      placeholderOpacity: placeholder.opacity,
    }
  })
  expect(state.align).toBe('left')
  expect(state.placeholderAlign).toBe('left')
  // Bold and fully opaque: the hint is drawn, not a 50%-alpha browser default.
  expect(state.placeholderWeight).toBe('700')
  expect(state.placeholderOpacity).toBe('1')
  // The hint starts at the field's own padding, not a Tailwind step: 0.8 mm at 396%.
  expect(Number.parseFloat(hint.left)).toBeCloseTo(3.17, 1)
})

test('the top box is centred and bold before anything is typed', async ({ page }) => {
  await uploadPdf(page)
  const header = textZones(page).first()
  const state = await header.evaluate((element) => {
    const style = getComputedStyle(element)
    const line = element.querySelector('span.pointer-events-none') as HTMLElement
    return {
      weight: style.fontWeight,
      color: style.color,
      lineLeft: Number.parseFloat(line.style.left),
      width: element.getBoundingClientRect().width,
    }
  })
  expect(state.weight).toBe('700')
  expect(state.color).toBe('rgb(17, 24, 39)')
  // Centred: the line starts further in than the 0.8 mm padding alone would put it.
  expect(state.lineLeft).toBeGreaterThan(3.2)
  expect(state.lineLeft).toBeLessThan(state.width / 2)
})

test('CROCKERIES tags a callout in one click and keeps the typed text', async ({ page }) => {
  await uploadPdf(page)
  const box = (await textZones(page).first().boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.keyboard.press('Control+a')
  await page.keyboard.type('kung pao chicken')
  await page.waitForTimeout(150)

  await page.getByRole('button', { name: 'CROCKERIES callout' }).click()
  await page.waitForTimeout(200)

  const tagged = await page.getByLabel('Edit card text').evaluate((element) => {
    const field = element as HTMLTextAreaElement
    const style = getComputedStyle(field)
    return {
      stored: field.value,
      transform: style.textTransform,
      color: style.color,
      background: style.backgroundColor,
    }
  })
  // Capitals are drawn, not stored: the field still holds what was typed.
  expect(tagged.stored).toBe('kung pao chicken')
  expect(tagged.transform).toBe('uppercase')
  expect(tagged.color).toBe('rgb(255, 255, 255)')
  expect(tagged.background).toBe('rgb(185, 28, 28)')
})

test('CONDIMENTS tags a callout and survives losing the caret', async ({ page }) => {
  await uploadPdf(page)
  const box = (await textZones(page).nth(1).boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.keyboard.press('Control+a')
  await page.keyboard.type('soy and vinegar')
  await page.waitForTimeout(150)

  await page.getByRole('button', { name: 'CONDIMENTS callout' }).click()
  await page.waitForTimeout(200)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // The drawn box must carry the same fill and ink, or the tag disappears on deselect.
  const drawn = await textZones(page).nth(1).evaluate((element) => {
    const style = getComputedStyle(element)
    return { text: element.textContent, background: style.backgroundColor, color: style.color }
  })
  expect(drawn.text).toBe('soy and vinegar')
  expect(drawn.background).toBe('rgb(134, 239, 172)')
  expect(drawn.color).toBe('rgb(17, 24, 39)')
})

test('the presets are one click, and the old swatch clutter is gone', async ({ page }) => {
  await uploadPdf(page)
  const box = (await textZones(page).first().boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(200)

  const bar = page.getByTestId('card-text-bar')
  await expect(bar).toBeVisible()
  // The three callout controls, Bold, and Clear formatting.
  await expect(bar.getByRole('button')).toHaveCount(5)
  await expect(bar.getByRole('button', { name: 'Bold' })).toBeVisible()
  await expect(bar.getByRole('button', { name: 'Clear formatting' })).toBeVisible()
  // The nine swatches that used to be here are gone, not merely hidden.
  await expect(bar.getByRole('button', { name: /colour|highlight/i })).toHaveCount(0)

  // Clear formatting puts the box back to the default look.
  await page.getByRole('button', { name: 'CROCKERIES callout' }).click()
  await page.waitForTimeout(150)
  await page.getByRole('button', { name: 'Clear formatting' }).click()
  await page.waitForTimeout(150)
  const cleared = await page.getByLabel('Edit card text').evaluate((element) => {
    const style = getComputedStyle(element)
    return { transform: style.textTransform, color: style.color, weight: style.fontWeight }
  })
  expect(cleared.transform).toBe('none')
  expect(cleared.color).toBe('rgb(17, 24, 39)')
  expect(cleared.weight).toBe('700')
})

test('the bar is reachable and usable by keyboard alone', async ({ page }) => {
  await uploadPdf(page)
  const box = (await textZones(page).first().boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.keyboard.press('Control+a')
  await page.keyboard.type('kung pao')
  await page.waitForTimeout(200)

  // Tab out of the field and into the bar. Before the fix the field's blur handler took
  // focus straight back, so the bar could be reached by pointer only.
  // One Tab, because the field sends it to the bar deliberately rather than walking
  // forwards into the next card's zone.
  await page.keyboard.press('Tab')
  await page.waitForTimeout(200)
  const landed = await page.evaluate(
    () => (document.activeElement as HTMLElement | null)?.getAttribute('aria-label') ?? '',
  )
  expect(landed).toBe('CROCKERIES callout')

  // Activate it with the keyboard: the tag must apply without a pointer ever moving.
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  const tagged = await page.getByLabel('Edit card text').evaluate((element) => {
    const field = element as HTMLTextAreaElement
    return { transform: getComputedStyle(field).textTransform, stored: field.value }
  })
  expect(tagged.transform).toBe('uppercase')
  expect(tagged.stored).toBe('kung pao')
})

test('a press on the canvas still ends the edit', async ({ page }) => {
  await uploadPdf(page)
  const box = (await textZones(page).first().boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(250)
  await expect(page.getByLabel('Edit card text')).toBeVisible()

  // The one place focus is allowed to leave the field must not become a way to get stuck.
  await page.mouse.click(box.x - 60, 700)
  await page.waitForTimeout(400)
  await expect(page.getByLabel('Edit card text')).toBeHidden()
})
