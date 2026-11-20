import { expect, test } from '@playwright/test'
import { inkShift, textZones, uploadPdf } from './fixtures'

/**
 * Clicking into a text box must change nothing about it except the caret.
 *
 * The two states used to be built from different numbers: the drawn box took a Tailwind
 * `p-1` (4 px at any zoom) and a transparent background, while the field took a real
 * `0.8 mm` inset that scales with the sheet, a white surface and rounded corners. At 396%
 * those differ by under a pixel — enough to shift every line sideways the moment a caret
 * arrived, which is the jump this file exists to prevent. Reported as "the text jumps when
 * I click into it".
 *
 * These assertions are about computed style and geometry in a real browser: jsdom has
 * neither, so nothing here could be checked any other way.
 *
 * Padding is deliberately **not** compared. Matching it was the earlier proxy for "the type
 * does not move", and it was a good one while both boxes started their text at their padding
 * top — but a textarea's first line is a line box with leading above it while a positioned
 * span has none, so matching the padding left the glyphs one line-box apart. The field's top
 * padding now compensates for that, which means the paddings differ on purpose. The promise
 * is checked where it actually lives, in `text-position-and-bands.spec.ts`, by comparing the
 * first row of ink in both states.
 */

const STYLE_PROPS = ['font-size', 'font-weight', 'line-height', 'color', 'background-color', 'border-radius'] as const

test('the box looks the same before and after the caret arrives', async ({ page }) => {
  await uploadPdf(page)
  const styleOf = (selector: string): Promise<Record<string, string>> =>
    page.evaluate(
      ({ selector: sel, props }) => {
        const el = document.querySelector(sel) as HTMLElement | null
        if (el === null) return {}
        const cs = getComputedStyle(el)
        return Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)]))
      },
      { selector, props: STYLE_PROPS as unknown as string[] },
    )

  const drawn = await styleOf('button[aria-label^="Card text:"]')
  const box = await textZones(page).first().boundingBox()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.down()
  await page.mouse.up()
  await expect(page.getByLabel('Edit card text')).toBeFocused()
  const focused = await styleOf('textarea[aria-label="Edit card text"]')

  for (const prop of STYLE_PROPS) {
    expect({ prop, value: focused[prop] }).toEqual({ prop, value: drawn[prop] })
  }
})

test('the first line of type begins on the same row in both states', async ({ page }) => {
  await uploadPdf(page)

  /*
    The pixel the type starts on, in each state, measured from ink rather than from the box:
    the two elements are laid out differently on purpose, so only the glyphs' own position
    is meaningful. Not "close": the same row. A half-pixel is a visible wobble on a 1 mm
    glyph, and the drop this guards against was three whole pixels.
  */
  for (const index of [0, 1]) {
    const { drawn, editing } = await inkShift(page, index)
    expect(drawn, `zone ${index} has no ink`).toBeGreaterThanOrEqual(0)
    expect(editing, `zone ${index} shifted`).toBe(drawn)
  }
})

/**
 * The formatting bar must never sit on the top bar.
 *
 * It is absolutely positioned inside the canvas column, and for a long time that column
 * was not a positioned ancestor — so the bar resolved against the app root and appeared at
 * y=0, full window width, straight over the zoom controls and the Export button. Measured
 * at the time: bar y=0, banner y=0 height 48, Export y=8.
 *
 * A z-index bug looks like this and is not: no stacking change can fix an element that has
 * escaped its container. The assertion is about where it is, not what is on top.
 */
test('the formatting bar docks below the top bar, clear of Export', async ({ page }) => {
  await uploadPdf(page)
  const box = await textZones(page).first().boundingBox()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.down()
  await page.mouse.up()
  await expect(page.getByTestId('card-text-bar')).toBeVisible()

  const geo = await page.evaluate(() => {
    const bar = document.querySelector('[data-testid="card-text-bar"]')!.parentElement!
    const banner = document.querySelector('header')!.getBoundingClientRect()
    const exportButton = [...document.querySelectorAll('button')].find((b) =>
      /export/i.test(b.textContent ?? ''),
    )
    const barRect = bar.getBoundingClientRect()
    const exportRect = exportButton?.getBoundingClientRect()
    return {
      barTop: Math.round(barRect.top),
      barBottom: Math.round(barRect.bottom),
      barWidth: Math.round(barRect.width),
      bannerBottom: Math.round(banner.bottom),
      exportBottom: exportRect === undefined ? null : Math.round(exportRect.bottom),
      viewportWidth: window.innerWidth,
    }
  })

  // Starts at or below the bottom of the top bar: never overlapping it.
  expect(geo.barTop).toBeGreaterThanOrEqual(geo.bannerBottom)
  // And entirely below the Export button, which is the control it used to cover.
  if (geo.exportBottom !== null) expect(geo.barTop).toBeGreaterThanOrEqual(geo.exportBottom)
  // It belongs to the canvas column, not the window: full-width means it escaped.
  expect(geo.barWidth).toBeLessThan(geo.viewportWidth)
})
