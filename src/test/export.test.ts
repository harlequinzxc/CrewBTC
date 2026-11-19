/**
 * @vitest-environment node
 *
 * Proves the exporter end to end: a real PDF goes in, a real sheet PDF comes out,
 * and the output is re-parsed to confirm the sheet count, page count, and physical
 * page size. No assertion here relies on looking at bytes by eye.
 */
import { describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib'
import { createCanvas } from '@napi-rs/canvas'
import { writeSheets } from '../lib/export/write-sheet'
import { computeGrid } from '../lib/imposition/grid'
import { DEFAULT_SHEET } from '../types/imposition'
import type { PageRef } from '../lib/imposition/sheet'

async function makeSourcePdf(pages: number, label: string): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 0; i < pages; i += 1) {
    const page = doc.addPage([147.4, 190.2]) // 52 x 67 mm — exactly one cell
    page.drawText(`${label} page ${i + 1}`, { x: 12, y: 150, size: 12, font, color: rgb(0, 0, 0) })
  }
  const bytes = await doc.save()
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}

function refsFor(fileName: string, documentId: string, count: number): PageRef[] {
  return Array.from({ length: count }, (_unused, index) => ({
    documentId,
    fileName,
    pageNumber: index + 1,
    widthMm: 52,
    heightMm: 67,
  }))
}

/** One 8x8 PNG, reused wherever a card needs a dish photo. */
function tinyPng(): string {
  const canvas = createCanvas(8, 8)
  const context = canvas.getContext('2d')
  context.fillStyle = '#8e44ad'
  context.fillRect(0, 0, 8, 8)
  return `data:image/png;base64,${canvas.toBuffer('image/png').toString('base64')}`
}

/**
 * A photo for every placed page, keyed `cellIndex|documentId|pageNumber`.
 *
 * Cell indexes restart on each sheet (0-8, then 0-8 again), which is the shape the
 * exporter actually asks for. Keying by flat page index happened to work for one sheet
 * and silently dropped the picture for every page after the ninth.
 */
function photosForPages(pages: readonly PageRef[], perSheet = 9): Record<string, string> {
  const png = tinyPng()
  const out: Record<string, string> = {}
  pages.forEach((page, index) => {
    out[`${index % perSheet}|${page.documentId}|${page.pageNumber}`] = png
  })
  return out
}

const grid = computeGrid(DEFAULT_SHEET)

describe('sheet writer', () => {
  it('produces one A4 output page per sheet of 9', async () => {
    const sources = new Map([['doc-a', await makeSourcePdf(9, 'A')]])
    const pages = refsFor('a.pdf', 'doc-a', 9)

    const result = await writeSheets({
      settings: DEFAULT_SHEET,
      grid,
      pages,
      sources,
      photos: photosForPages(pages),
      drawCutMarks: true,
    })

    expect(result.sheetCount).toBe(1)
    expect(result.pagesPlaced).toBe(9)
    expect(result.pagesSkipped).toBe(0)
    expect(result.bytes.byteLength).toBeGreaterThan(0)

    // Re-parse the output: this is the real proof, not a byte count.
    const out = await PDFDocument.load(result.bytes)
    expect(out.getPageCount()).toBe(1)
    const page = out.getPage(0)
    const { width, height } = page.getSize()
    expect(width).toBeCloseTo(595.28, 1) // 210 mm
    expect(height).toBeCloseTo(841.89, 1) // 297 mm
  })

  it('emits three sheets for 25 pages, with the last only partially filled', async () => {
    const sources = new Map([['doc-b', await makeSourcePdf(25, 'B')]])
    const pages = refsFor('b.pdf', 'doc-b', 25)

    const result = await writeSheets({
      settings: DEFAULT_SHEET,
      grid,
      pages,
      sources,
      photos: photosForPages(pages),
      drawCutMarks: false,
    })

    expect(result.sheetCount).toBe(3)
    expect(result.pagesPlaced).toBe(25)
    const out = await PDFDocument.load(result.bytes)
    expect(out.getPageCount()).toBe(3)
  })

  it('honours a custom sheet size and cell count', async () => {
    const custom = {
      ...DEFAULT_SHEET,
      sheetWidthMm: 148,
      sheetHeightMm: 210,
      cellWidthMm: 52,
      cellHeightMm: 67,
      gutterMm: 4,
      marginMm: 4,
    }
    const customGrid = computeGrid(custom)
    // A5 usable area is 140 x 202 mm; 3 columns need 164 mm and 3 rows need 209 mm,
    // so the true maximum is 2 x 2. Asserted from measurement, not assumption.
    expect(customGrid.cellCount).toBe(4)

    const sources = new Map([['doc-c', await makeSourcePdf(4, 'C')]])
    const result = await writeSheets({
      settings: custom,
      grid: customGrid,
      pages: refsFor('c.pdf', 'doc-c', 4),
      sources,
      photos: photosForPages(refsFor('c.pdf', 'doc-c', 4), customGrid.cellCount),
      drawCutMarks: true,
    })

    expect(result.sheetCount).toBe(1)
    expect(result.pagesPlaced).toBe(4)
    const out = await PDFDocument.load(result.bytes)
    const { width, height } = out.getPage(0).getSize()
    expect(width).toBeCloseTo(419.53, 1) // 148 mm
    expect(height).toBeCloseTo(595.28, 1) // 210 mm
  })

  it('skips pages whose source bytes are missing instead of inventing content', async () => {
    const sources = new Map([['doc-d', await makeSourcePdf(3, 'D')]])
    const pages: PageRef[] = [
      ...refsFor('d.pdf', 'doc-d', 3),
      ...refsFor('ghost.pdf', 'missing', 2),
    ]

    const result = await writeSheets({
      settings: DEFAULT_SHEET,
      grid,
      pages,
      sources,
      photos: photosForPages(pages),
      drawCutMarks: false,
    })

    expect(result.pagesPlaced).toBe(3)
    expect(result.pagesSkipped).toBe(2)
  })

  it('survives an empty batch without producing a broken file', async () => {
    const result = await writeSheets({
      settings: DEFAULT_SHEET,
      grid,
      pages: [],
      sources: new Map(),
      drawCutMarks: false,
    })
    expect(result.sheetCount).toBe(0)
    expect(result.pagesPlaced).toBe(0)
    // No blank page is fabricated: an empty batch yields no bytes at all.
    expect(result.bytes.byteLength).toBe(0)
  })

  it('does not carry the source page’s printed text into the output', async () => {
    // Cards used to embed the whole page, so its printed title arrived with it. The
    // picture band now holds the extracted photo only, so source text must be absent.
    const pages = refsFor('e.pdf', 'doc-e', 1)
    const result = await writeSheets({
      settings: DEFAULT_SHEET,
      grid,
      pages: [{ documentId: 'doc-e', fileName: 'e.pdf', pageNumber: 1, widthMm: 64, heightMm: 90 }],
      sources: new Map([['doc-e', await makeSourcePdf(1, 'VECTOR')]]),
      photos: photosForPages(pages),
      drawCutMarks: false,
      texts: {
        '0|doc-e|1': { documentId: 'doc-e', pageNumber: 1, text: 'Dish name\n• Step' },
      },
    })

    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const task = pdfjs.getDocument({
      data: new Uint8Array(result.bytes),
      useWorkerFetch: false,
      standardFontDataUrl: 'public/pdfjs/standard_fonts/',
    })
    const doc = await task.promise
    const page = await doc.getPage(1)
    const content = await page.getTextContent()
    const text = content.items.map((item) => ('str' in item ? String(item.str) : '')).join(' ')

    // Our own card copy is live text...
    expect(text).toContain('Dish name')
    // ...and the source page's printed label is not carried along with it.
    expect(text).not.toContain('VECTOR')
    await task.destroy()
  })
})
