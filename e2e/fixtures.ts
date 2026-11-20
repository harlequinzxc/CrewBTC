import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * A PDF to upload.
 *
 * The picker is a real `<input type="file">`, so Playwright's `filechooser` drives it
 * natively — no application hook, and nothing test-only in the shipped bundle. The bytes
 * are a minimal, valid PDF header; what the parser finds in them does not matter to these
 * tests, which are about clicks, focus and layout rather than extraction.
 */
export const PDF_NAME = 'cards.pdf'

export function pdfFile(): { name: string; mimeType: string; buffer: Buffer } {
  return { name: PDF_NAME, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF\n') }
}

/** Wipe the restored session so every test starts from an empty workspace. */
export async function resetSession(page: Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase('crewbtc-session')
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
      request.onblocked = () => resolve()
    })
  })
  await page.reload()
}

export async function uploadPdf(page: Page): Promise<void> {
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: /add pdfs/i }).click()
  const picker = await chooser
  await picker.setFiles(pdfFile())
  // Ingest is real here, so this waits for the parser rather than for a stub.
  await expect(page.locator('[data-cell]').first()).toBeVisible({ timeout: 30_000 })
}

/** A stable handle on one of a card's text bands. */
export function textZones(page: Page) {
  return page.getByRole('button', { name: /card text:/i })
}
