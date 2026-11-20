import { expect, test } from '@playwright/test'
import { textZones, uploadPdf } from './fixtures'

/**
 * A text box must be exactly as tall as the band it represents.
 *
 * The target ladder in `index.css` forced `height: 32px` onto every element carrying
 * `[data-target='dense']`, and the sheet's text zones carried that attribute. A header
 * band at fit-to-width is about 24px, so the box overhung the photo below it by 8px — and
 * the photo, painted afterwards, took every click in that overhang. The bottom quarter of
 * every card's header was dead: a click there selected the card and did nothing else,
 * which reads exactly as "I cannot click into the text box".
 *
 * jsdom cannot see this: it has no layout, so `getComputedStyle().height` is a string it
 * was never asked to resolve, and there is no hit-testing at all. This is the assertion
 * that would have caught it, and it has to be made in a browser.
 */


test('a text box is exactly as tall as its band, not clamped to a control size', async ({
  page,
}) => {
  await uploadPdf(page)
  const zone = textZones(page).first()
  await expect(zone).toBeVisible()

  const geometry = await zone.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      // What the millimetre maths asked for, set inline by React.
      declared: Number.parseFloat((element as HTMLElement).style.height),
      // What the browser actually laid out.
      rendered: Number.parseFloat(style.height),
    }
  })

  expect(geometry.declared).toBeGreaterThan(0)
  // One pixel covers subpixel rounding; more than that means a rule overrode the geometry.
  expect(Math.abs(geometry.rendered - geometry.declared)).toBeLessThan(1)
})

test('every point inside a text band opens the editor', async ({ page }) => {
  await uploadPdf(page)
  const zone = textZones(page).first()
  const box = await zone.boundingBox()
  expect(box).not.toBeNull()
  const { x, y, width, height } = box!

  // Inside the band by construction, so every one of these must edit. Sampling the lower
  // third is the point: that is the part an overhanging neighbour used to steal.
  for (const fraction of [0.1, 0.35, 0.6, 0.9]) {
    await page.mouse.click(x + width / 2, y + height * fraction)
    const field = page.getByLabel('Edit card text')
    await expect(field, `a click at ${Math.round(fraction * 100)}% of the band must edit`).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(field).toBeHidden()
  }
})

test('the zones tile the card without overlapping', async ({ page }) => {
  await uploadPdf(page)
  const card = page.locator('[data-cell]').first()
  await expect(card).toBeVisible()

  // Walk down the card's centre line and record which zone owns each pixel. An overlap
  // shows up as a zone appearing, vanishing and reappearing.
  const owners = await card.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const seen: string[] = []
    for (let y = Math.ceil(rect.top); y < rect.bottom; y += 1) {
      const hit = document.elementFromPoint(rect.left + rect.width / 2, y)
      const label = hit?.closest('button')?.getAttribute('aria-label') ?? 'none'
      const owner = label.startsWith('Card text') ? 'text' : label.startsWith('Dish photo') ? 'photo' : 'other'
      if (seen[seen.length - 1] !== owner) seen.push(owner)
    }
    return seen
  })

  // Each zone appears exactly once, in visual order.
  expect(owners).toEqual(['text', 'photo', 'text'])
})
