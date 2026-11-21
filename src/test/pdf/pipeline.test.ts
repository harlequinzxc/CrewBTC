/**
 * @vitest-environment node
 *
 * End-to-end extraction against a real generated PDF. jsdom cannot start the PDF.js
 * worker, so this runs under Node with PDF.js's `legacy` build — the same
 * `extractPageText` grouping and normalisation code the browser uses. The browser
 * path itself is verified separately; see the README's limitations section.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib'

type PdfDocumentProxy = Awaited<ReturnType<typeof loadProxy>>
type ExtractPageText = typeof import('../../lib/pdf/extract')['extractPageText']

async function loadProxy(): Promise<import('pdfjs-dist').PDFDocumentProxy> {
  throw new Error('assigned at runtime')
}

let loaded: Awaited<ReturnType<typeof import('pdfjs-dist')['getDocument']>['promise']>
let extractPageText: ExtractPageText
let bytes: Uint8Array
export type { PdfDocumentProxy }

beforeAll(async () => {
  const doc = await PDFDocument.create()
  const page = doc.addPage([595.28, 841.89])
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const body = await doc.embedFont(StandardFonts.Helvetica)

  page.drawText('CrewBTC Limited Edition', { x: 60, y: 760, size: 28, font: bold, color: rgb(0, 0, 0) })
  page.drawText('Series 02 - Obsidian', { x: 60, y: 720, size: 16, font: body })
  page.drawText('SKU-4471-BLK', { x: 60, y: 90, size: 10, font: body })
  bytes = await doc.save()

  // Node-side PDF.js: no worker/CSP, same page + text APIs.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    standardFontDataUrl: './node_modules/pdfjs-dist/standard_fonts/',
    useWorkerFetch: false,
  })
  loaded = await task.promise

  const mod = await import('../../lib/pdf/extract')
  extractPageText = mod.extractPageText
})

describe('real PDF through the extraction engine', () => {
  it('reads the expected page count and size', () => {
    expect(loaded.numPages).toBe(1)
  })

  it('groups text into regions and finds the title and SKU', async () => {
    const page = await loaded.getPage(1)
    const outcome = await extractPageText(page as never)

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return

    const allText = outcome.regions.map((region) => region.text).join(' | ')
    expect(allText).toContain('CrewBTC Limited Edition')
    expect(allText).toContain('SKU-4471-BLK')
    expect(outcome.regions.length).toBeGreaterThan(0)
  })

  it('normalises every box into 0..1 and orders title above footer', async () => {
    const page = await loaded.getPage(1)
    const outcome = await extractPageText(page as never)
    if (!outcome.ok) throw new Error(`extraction failed: ${outcome.reason}`)

    for (const region of outcome.regions) {
      expect(region.box.x).toBeGreaterThanOrEqual(0)
      expect(region.box.y).toBeGreaterThanOrEqual(0)
      expect(region.box.x + region.box.width).toBeLessThanOrEqual(1.0000001)
      expect(region.box.y + region.box.height).toBeLessThanOrEqual(1.0000001)
    }

    const title = outcome.regions.find((r) => r.text.includes('Limited Edition'))
    const footer = outcome.regions.find((r) => r.text.includes('SKU-4471'))
    expect(title?.box.y).toBeLessThan(footer?.box.y ?? 1)
  })

  it('gives the title a larger font ratio than the footer', async () => {
    const page = await loaded.getPage(1)
    const outcome = await extractPageText(page as never)
    if (!outcome.ok) throw new Error(outcome.reason)
    const title = outcome.regions.find((r) => r.text.includes('Limited Edition'))
    const footer = outcome.regions.find((r) => r.text.includes('SKU-4471'))
    expect(title?.fontSizeRatio ?? 0).toBeGreaterThan(footer?.fontSizeRatio ?? 0)
  })
})
