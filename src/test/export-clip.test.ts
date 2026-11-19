/**
 * @vitest-environment node
 *
 * Proof that a moved or zoomed picture cannot escape its band.
 *
 * The earlier version of this check asserted only that a file was produced, which was
 * true whether or not anything was clipped — worthless. This one rasterises the output
 * and counts dark pixels outside the picture band, so removing the clip fails the test.
 */
import { describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib'
import { createCanvas } from '@napi-rs/canvas'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { writeSheets } from '../lib/export/write-sheet'
import { computeGrid } from '../lib/imposition/grid'
import { DEFAULT_SHEET } from '../types/imposition'
import type { PageRef } from '../lib/imposition/sheet'

interface RenderedPage {
  readonly getViewport: (options: { scale: number }) => { readonly width: number; readonly height: number }
  readonly render: (params: Record<string, unknown>) => { readonly promise: Promise<void> }
}

const worker = pdfjs as unknown as {
  getDocument: (src: Record<string, unknown>) => {
    promise: Promise<{ getPage: (n: number) => Promise<RenderedPage>; destroy: () => Promise<void> }>
    destroy: () => Promise<void>
  }
  GlobalWorkerOptions: { workerSrc: string }
}
worker.GlobalWorkerOptions.workerSrc =
  '/home/user/CrewBTC/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'

/** A card whose top 10% is solid black — easy to spot if it leaks upward. */
async function makeStripePdf(): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const page = doc.addPage([147.4, 190.2])
  page.drawRectangle({ x: 0, y: 190.2 - 19, width: 147.4, height: 19, color: rgb(0, 0, 0) })
  page.drawText('X', { x: 10, y: 10, size: 8, font, color: rgb(0, 0, 0) })
  const bytes = await doc.save()
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}

async function darkPixelsOutsidePictureBand(pdf: Uint8Array): Promise<number> {
  const task = worker.getDocument({
    data: new Uint8Array(pdf),
    useWorkerFetch: false,
    standardFontDataUrl: '/home/user/CrewBTC/public/pdfjs/standard_fonts/',
  })
  const doc = await task.promise
  const page = await doc.getPage(1)
  const viewport = page.getViewport({ scale: 2 }) // 2 px per point
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvas, canvasContext: context, viewport }).promise

  // A PDF page is sized in points. Assuming 2 px per mm made every band boundary
  // land in the wrong place, so the check compared the header against the paper.
  const perMm = viewport.height / 297
  // With the default sheet the first cell starts at 4 mm, the header is 11 mm tall,
  // and the footer is the last 6 mm of the 67 mm card.
  const cellTop = 4 * perMm
  const headerBottom = (4 + DEFAULT_SHEET.headerMm) * perMm
  const cardBottom = (4 + DEFAULT_SHEET.cellHeightMm) * perMm
  const footerTop = cardBottom - DEFAULT_SHEET.footerMm * perMm
  const left = 4 * perMm
  const right = (4 + DEFAULT_SHEET.cellWidthMm) * perMm

  const isDark = (x: number, y: number): boolean =>
    context.getImageData(Math.round(x), Math.round(y), 1, 1).data[0]! < 100

  let dark = 0
  for (let x = left; x < right; x += 2) {
    for (let y = cellTop; y < headerBottom - 1; y += 2) if (isDark(x, y)) dark += 1
    for (let y = footerTop + 1; y < cardBottom; y += 2) if (isDark(x, y)) dark += 1
  }

  await task.destroy()
  return dark
}

describe('a framed picture stays inside its band', () => {
  it('leaves no ink in the header or footer, even zoomed and shoved', async () => {
    const source = await makeStripePdf()
    const pages: readonly PageRef[] = [
      { documentId: 'cards.pdf', fileName: 'cards.pdf', pageNumber: 1, widthMm: 52, heightMm: 67 },
    ]

    const result = await writeSheets({
      settings: DEFAULT_SHEET,
      grid: computeGrid(DEFAULT_SHEET),
      pages,
      sources: new Map([['cards.pdf', source]]),
      drawCutMarks: false,
      // Cover-fit at 100% puts the stripe across the image's top 10%, which sits at
      // the very top of the 44 mm picture band. Lifting the image 6 mm moves the
      // stripe to y 4.2 .. -2.5 mm — inside the header band and above the paper
      // edge. Without a clip it prints there; with one it cannot.
      images: { '0|cards.pdf|1': { offsetXMm: 18, offsetYMm: -6, scale: 1 } },
    })

    expect(result.pagesPlaced).toBe(1)
    expect(await darkPixelsOutsidePictureBand(result.bytes)).toBe(0)
  })
})
