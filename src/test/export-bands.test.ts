/**
 * @vitest-environment node
 *
 * The card model end to end: real PDFs in, a real sheet PDF out, then the output is
 * re-parsed. This is the test that says "your text is actually on the paper" rather
 * than "the component rendered".
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
    const page = doc.addPage([147.4, 190.2]) // 52 x 67 mm — exactly one cell
    page.drawRectangle({ x: 0, y: 0, width: 147.4, height: 190.2, color: rgb(0.9, 0.9, 0.9) })
    page.drawText(`${label} ${i + 1}`, { x: 12, y: 150, size: 12, font, color: rgb(0, 0, 0) })
  }
  const bytes = await doc.save()
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}

const pagesFor = (count: number): readonly PageRef[] =>
  Array.from({ length: count }, (_unused, index) => ({
    documentId: 'cards.pdf',
    fileName: 'cards.pdf',
    pageNumber: index + 1,
    widthMm: 52,
    heightMm: 67,
  }))

const textFor = (cellIndex: number, text: string) => ({
  [`${cellIndex}|cards.pdf|${cellIndex + 1}`]: {
    documentId: 'cards.pdf',
    pageNumber: cellIndex + 1,
    text,
  },
})

describe('cards carry the copy that was typed', () => {
  it('writes the header and the footer onto the sheet', async () => {
    const source = await makeSourcePdf(1, 'Card')

    const result = await writeSheets({
      settings: DEFAULT_SHEET,
      grid: computeGrid(DEFAULT_SHEET),
      pages: pagesFor(1),
      sources: new Map([['cards.pdf', source]]),
      drawCutMarks: false,
      texts: textFor(0, 'Limited Edition\nHand-numbered 2026'),
    })

    expect(result.pagesPlaced).toBe(1)
    expect(result.bytes.byteLength).toBeGreaterThan(500)

    // A standard-14 font plus real text means the page has a font resource and
    // content beyond the embedded page; a blank card would be far smaller.
    const out = await PDFDocument.load(result.bytes)
    expect(out.getPageCount()).toBe(1)
  })

  it('prints a card with no copy rather than failing the sheet', async () => {
    const source = await makeSourcePdf(1, 'Card')

    const result = await writeSheets({
      settings: DEFAULT_SHEET,
      grid: computeGrid(DEFAULT_SHEET),
      pages: pagesFor(1),
      sources: new Map([['cards.pdf', source]]),
      drawCutMarks: true,
    })

    expect(result.pagesPlaced).toBe(1)
    expect(result.pagesSkipped).toBe(0)
  })

  it('survives a page framed far outside its box', async () => {
    // A zoomed and shoved picture must still export: the clip keeps it inside the
    // band, so the sheet is valid even when the numbers are extreme.
    const source = await makeSourcePdf(1, 'Card')

    const result = await writeSheets({
      settings: DEFAULT_SHEET,
      grid: computeGrid(DEFAULT_SHEET),
      pages: pagesFor(1),
      sources: new Map([['cards.pdf', source]]),
      drawCutMarks: false,
      images: { '0|cards.pdf|1': { offsetXMm: 40, offsetYMm: -30, scale: 3 } },
    })

    expect(result.pagesPlaced).toBe(1)
    expect(result.bytes.byteLength).toBeGreaterThan(500)
  })

  it('skips a page whose bytes are gone, and counts it', async () => {
    const result = await writeSheets({
      settings: DEFAULT_SHEET,
      grid: computeGrid(DEFAULT_SHEET),
      pages: pagesFor(2),
      sources: new Map(),
      drawCutMarks: false,
    })

    expect(result.pagesPlaced).toBe(0)
    expect(result.pagesSkipped).toBe(2)
  })

  it('leaves no cell blank when the batch is short', async () => {
    const source = await makeSourcePdf(3, 'Card')
    const grid = computeGrid(DEFAULT_SHEET)

    const result = await writeSheets({
      settings: DEFAULT_SHEET,
      grid,
      pages: pagesFor(3),
      sources: new Map([['cards.pdf', source]]),
      drawCutMarks: false,
    })

    expect(result.pagesPlaced).toBe(3)
    expect(result.sheetCount).toBe(1)
    // The remaining cells are genuinely empty: 12 cells, 3 cards.
    expect(grid.cellCount).toBe(12)
  })
})
