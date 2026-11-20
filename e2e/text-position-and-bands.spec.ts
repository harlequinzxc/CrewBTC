import { expect, test } from '@playwright/test'
import { inkShift, textZones, uploadPdf } from './fixtures'

test('the steps box keeps its slack below the words, not above them', async ({ page }) => {
  await uploadPdf(page)
  /*
    Measured against the *inside* of the box, because the line box is taller than the glyphs
    and starts slightly above the padding — so an absolute threshold is meaningless.

    With the text pinned to the top, the gap above the line is a rounding error and the gap
    below holds everything else; centring splits the difference and moves the line down by
    half the slack. Measured, both builds: above 0.36/2.09, below 9.42/7.69. The assertion
    is that above is under half the padding — true of the first, false of the second.
  */
  const measured = await page.evaluate(() => {
    const zone = [...document.querySelectorAll('button[aria-label^="Card text:"]')][1] as HTMLElement
    const line = zone.querySelector('span.pointer-events-none') as HTMLElement
    const box = zone.getBoundingClientRect()
    const glyphs = line.getBoundingClientRect()
    return { above: glyphs.top - box.top, below: box.bottom - glyphs.bottom }
  })
  // Under half the 3.17px padding, where a centred block sits at 2.09.
  expect(measured.above).toBeLessThan(1.6)
  // And the rest of the space is genuinely below it.
  expect(measured.below).toBeGreaterThan(measured.above + 5)
})

test('the card has square corners', async ({ page }) => {
  await uploadPdf(page)
  const radius = await page
    .locator('[data-cell]')
    .first()
    .evaluate((element) => getComputedStyle(element).borderRadius)
  expect(radius).toBe('0px')
})

test('the toolbar no longer says "whole box"', async ({ page }) => {
  await uploadPdf(page)
  const box = (await textZones(page).first().boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(250)

  const bar = page.getByTestId('card-text-bar')
  await expect(bar).toBeVisible()
  await expect(bar).not.toContainText('whole box')

  // A real selection still announces itself, because that is the case worth warning about.
  // It needs characters to select, so type some first — `Control+a` on an empty box
  // selects nothing and the bar correctly stays quiet.
  await page.keyboard.type('Kung Pao')
  await page.keyboard.press('Control+a')
  await page.waitForTimeout(150)
  await expect(bar).toContainText('selection')
})

test('the sparkles button copies this card’s margins to every card', async ({ page }) => {
  await uploadPdf(page)
  const cell = page.locator('[data-cell]').first()
  const box = (await cell.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.45)
  await page.waitForTimeout(250)

  // Drag the first divider well down, so the copied split is unmistakably not the default.
  const divider = page.locator('[data-divider="header"]').first()
  const db = (await divider.boundingBox())!
  await page.mouse.move(db.x + db.width / 2, db.y + db.height / 2)
  await page.mouse.down()
  await page.mouse.move(db.x + db.width / 2, db.y + db.height / 2 + 34, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(200)

  const headerHeight = async (index: number): Promise<number> => {
    const b = await textZones(page).nth(index).boundingBox()
    return b?.height ?? -1
  }
  const dragged = await headerHeight(0)
  const otherCardBefore = await headerHeight(2)
  expect(await textZones(page).count()).toBe(4)
  expect(Math.abs(dragged - otherCardBefore)).toBeGreaterThan(10)

  // The button lives inside the photo frame, so it appears only while that photo is being
  // adjusted — which is also the moment the decision is made. Adjust mode opens on a single
  // click: a double-click would be one click in and the second one straight back out.
  await expect(page.getByRole('button', { name: 'Use these margins for all cards' })).toHaveCount(0)
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.45)
  await page.waitForTimeout(300)

  // One click, not two: the button has to be reachable from the frame the user sees, and a
  // second gesture to reveal it was the thing this round removed.
  const sparkles = page.getByRole('button', { name: 'Use these margins for all cards' })
  await expect(sparkles).toHaveCount(1)

  // And that same click selected the card, or the margins could not be dragged at all.
  await expect(page.locator('[data-divider="header"]')).toHaveCount(1)
  await sparkles.click()
  await page.waitForTimeout(300)

  // The other card now has the dragged card's header height, within a rounding pixel.
  // Four zones exist (two cards × two boxes): 0/1 are card one, 2/3 are card two.
  expect(Math.abs((await headerHeight(2)) - dragged)).toBeLessThan(1)
})

test('the sparkles button is not there when nothing is being adjusted', async ({ page }) => {
  await uploadPdf(page)
  // Nothing selected, nothing editing: the frame is not active, so its button is absent.
  await expect(page.getByRole('button', { name: 'Use these margins for all cards' })).toHaveCount(0)
})

/**
 * The last of this round's promises: the words must not move when the box is clicked.
 *
 * Measured in pixels rather than from the DOM, because that is the only place the claim
 * means anything — the drawn line and the field are different elements whose rectangle tops
 * were never going to agree, since a drawn span's top is its line box and a textarea insets
 * its text by its own. Screenshotting both states and comparing the first row of real ink
 * checks the thing the user sees; the line was 3px low before this round.
 */
test('clicking a text box does not move the words', async ({ page }) => {
  await uploadPdf(page)

  for (const index of [0, 1]) {
    const { drawn, editing } = await inkShift(page, index)
    expect(drawn, `zone ${index} has no ink to measure`).toBeGreaterThanOrEqual(0)
    expect(editing, `zone ${index} moved its first line`).toBe(drawn)
  }
})
