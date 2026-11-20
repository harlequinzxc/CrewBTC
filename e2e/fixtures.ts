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

/**
 * Build a one-page PDF with real text on it.
 *
 * `%PDF-1.4\n%%EOF` is not a parseable document, and the app says so ("0 parsed, 1 could
 * not be read") — which is the correct behaviour, and how this fixture was caught. The
 * offsets in the xref table have to be right, so the objects are laid out first and the
 * table computed from their real byte positions.
 */
export function pdfFile(): { name: string; mimeType: string; buffer: Buffer } {
  const page = (n: number): string =>
    'BT /F1 18 Tf 60 700 Td (CHK-0' + n + ' Dish ' + n + ') Tj ET\n' +
    'BT /F1 11 Tf 60 660 Td (Wok, garlic, chili) Tj ET'
  const contents = [page(1), page(2), page(3)]

  // Six objects followed by one per page: catalog, pages, font, then page/content pairs.
  const firstPageObject = 6
  const kids = contents.map((_, i) => `${firstPageObject + i * 2} 0 R`).join(' ')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${kids}] /Count ${contents.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>',
  ]
  contents.forEach((content, index) => {
    const pageObject = firstPageObject + index * 2
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 595] /Contents ${pageObject + 1} 0 R ` +
        '/Resources << /Font << /F1 3 0 R >> >> >>',
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    )
  })

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })

  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`

  return { name: PDF_NAME, mimeType: 'application/pdf', buffer: Buffer.from(pdf, 'latin1') }
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
  // Start from an empty workspace every time. Persistence is a feature, which makes it a
  // test hazard: a batch left in IndexedDB by the previous test is restored on load, and
  // "add PDFs" is then unreachable because the queue is already populated.
  await resetSession(page)
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
