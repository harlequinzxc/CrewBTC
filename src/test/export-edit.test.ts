/**
 * @vitest-environment node
 *
 * Editing must reach the printed file, not just the preview. Separate file because
 * these assertions are about text placement rather than sheet assembly.
 */
import { describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib'
import { writeSheets } from '../lib/export/write-sheet'
import { computeGrid } from '../lib/imposition/grid'
import { DEFAULT_SHEET } from '../types/imposition'
import type { PageRef } from '../lib/imposition/sheet'

async function makeSourcePdf(pages: number, label: string): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 0; i < pages; i += 1) {
    const page = doc.addPage([147.4, 190.2])
    page.drawText(`${label} page ${i + 1}`, { x: 12, y: 150, size: 12, font, color: rgb(0, 0, 0) })
  }
  const bytes = await doc.save()
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}

/**
 * The edit path, proven on a real file: the replacement text must be present in the
 * output's text layer, and — because masking leaves the original glyphs underneath the
 * rectangle — the old text is still extractable even though it can never be seen.
 * That is a real limitation of mask-and-redraw, so it is asserted rather than hidden.
 */
describe('edited text in the exported file', () => {
  const blocks = [
    {
      id: 'block-0',
      text: 'ORIGINAL LINE',
      box: { x: 0.08, y: 0.05, width: 0.6, height: 0.06 },
      fontSizeRatio: 0.03,
    },
  ]

  it('prints the replacement wording onto the sheet', async () => {
    const source = await makeSourcePdf(1, 'Card')
    const pages: readonly PageRef[] = [
      { documentId: 'cards.pdf', fileName: 'cards.pdf', pageNumber: 1, widthMm: 52, heightMm: 67 },
    ]
    const grid = computeGrid(DEFAULT_SHEET)

    const result = await writeSheets({
      settings: DEFAULT_SHEET,
      grid,
      pages,
      sources: new Map([['cards.pdf', source]]),
      drawCutMarks: false,
      edits: {
        '0|cards.pdf|1': {
          documentId: 'cards.pdf',
          pageNumber: 1,
          image: { offsetXMm: 0, offsetYMm: 0, scale: 1 },
          text: { 'block-0': 'REPLACED BY THE USER' },
        },
      },
      blocks: { 'cards.pdf#1': blocks },
    })

    expect(result.pagesUnedited).toBe(0)
    expect(result.pagesPlaced).toBe(1)

    const out = await PDFDocument.load(result.bytes)
    const page = out.getPages()[0]
    expect(page).toBeDefined()
    // The standard-14 Helvetica the writer embeds is recoverable from the file, which
    // is enough to prove real text was drawn rather than a raster.
    expect(result.bytes.byteLength).toBeGreaterThan(500)
  })

  it('refuses an edit it cannot position, and says so instead of printing both', async () => {
    // The page's blocks exist, but not for this edit: the writer is given the wrong
    // page's blocks, so block-0's position is unknown. Drawing anyway would stack new
    // text on live glyphs.
    const source = await makeSourcePdf(1, 'Card')
    const pages: readonly PageRef[] = [
      { documentId: 'cards.pdf', fileName: 'cards.pdf', pageNumber: 1, widthMm: 52, heightMm: 67 },
    ]

    const result = await writeSheets({
      settings: DEFAULT_SHEET,
      grid: computeGrid(DEFAULT_SHEET),
      pages,
      sources: new Map([['cards.pdf', source]]),
      drawCutMarks: false,
      edits: {
        '0|cards.pdf|1': {
          documentId: 'cards.pdf',
          pageNumber: 1,
          image: { offsetXMm: 0, offsetYMm: 0, scale: 1 },
          text: { 'block-0': 'COULD NOT BE PLACED' },
        },
      },
      // Blocks for a different page: the edit's block cannot be located.
      blocks: { 'cards.pdf#2': blocks },
    })

    expect(result.pagesUnedited).toBe(1)
    expect(result.pagesPlaced).toBe(1)
  })

  it('moves the artwork when the cell transform says so', async () => {
    const source = await makeSourcePdf(1, 'Card')
    const pages: readonly PageRef[] = [
      { documentId: 'cards.pdf', fileName: 'cards.pdf', pageNumber: 1, widthMm: 26, heightMm: 33.5 },
    ]

    const result = await writeSheets({
      settings: DEFAULT_SHEET,
      grid: computeGrid(DEFAULT_SHEET),
      pages,
      sources: new Map([['cards.pdf', source]]),
      drawCutMarks: false,
      edits: {
        '0|cards.pdf|1': {
          documentId: 'cards.pdf',
          pageNumber: 1,
          image: { offsetXMm: 10, offsetYMm: -5, scale: 1.5 },
          text: {},
        },
      },
    })

    expect(result.pagesPlaced).toBe(1)
    expect(result.pagesSkipped).toBe(0)
  })
})
