import { expect, test } from '@playwright/test'
import { uploadPdf } from './fixtures'

for (const source of ['system', 'setting'] as const) {
  test(`side rails and fitted sheet update together with reduced motion from ${source}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    if (source === 'system') await page.emulateMedia({ reducedMotion: 'reduce' })
    else await page.addInitScript(() => localStorage.setItem('ps.reduced-motion', 'on'))
    await uploadPdf(page)
    await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true')
    const initial = (await page.locator('[data-cell]').first().boundingBox())!.width
    for (const [name, expectedX, expanded] of [
      ['Collapse Files', 0, false], ['Expand Files', 220, true],
      ['Collapse inspector', 1266, false], ['Expand inspector', 1006, true],
    ] as const) {
      const frames = await page.getByRole('button', { name, exact: true }).evaluate(async (button) => {
        const rows: { x: number; width: number; expanded: string | null }[] = []
        ;(button as HTMLElement).click()
        for (let i = 0; i < 5; i += 1) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
          rows.push({ x: button.getBoundingClientRect().x, width: document.querySelector('[data-cell]')!.getBoundingClientRect().width, expanded: button.getAttribute('aria-expanded') })
        }
        return rows
      })
      for (const frame of frames) {
        expect(frame.x).toBe(expectedX)
        expect(frame.expanded).toBe(String(expanded))
        expect(frame.width).toBeCloseTo(frames[0]!.width, 2)
      }
      if (expanded) expect(frames[0]!.width).toBeCloseTo(initial, 2)
      else expect(frames[0]!.width).toBeGreaterThan(initial)
    }
  })
}
