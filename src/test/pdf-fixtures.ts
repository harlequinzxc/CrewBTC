import { createCanvas, type Canvas } from '@napi-rs/canvas'
import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PDFDocumentProxy } from 'pdfjs-dist'

/**
 * Real PDFs and a real PDF.js, for tests about what the library actually does.
 *
 * Fakes were the reason two photo bugs reached the app: a fake worker resolves image data
 * synchronously, while a real one delivers it later. These fixtures keep the tests honest.
 */

const pdfjsAny = pdfjs as unknown as {
  getDocument: (options: Record<string, unknown>) => {
    promise: Promise<PDFDocumentProxy>
    destroy: () => Promise<void>
  }
}

/** `@napi-rs/canvas` is not a DOM; PDF.js needs telling where to draw. */
export function canvasFactory(): unknown {
  return {
    create(width: number, height: number) {
      const canvas: Canvas = createCanvas(Math.max(1, width), Math.max(1, height))
      return { canvas, context: canvas.getContext('2d') }
    },
    reset(target: { canvas: Canvas }, width: number, height: number) {
      target.canvas.width = Math.max(1, width)
      target.canvas.height = Math.max(1, height)
    },
    destroy(target: { canvas: Canvas }) {
      target.canvas.width = 0
      target.canvas.height = 0
    },
  }
}

/** `toDataURL` is a browser API the Node canvas lacks. */
export function installDataUrl(target: Canvas): void {
  Object.assign(target, {
    toDataURL: (type = 'image/png') =>
      `data:${type};base64,${target.toBuffer('image/png').toString('base64')}`,
  })
}

/**
 * jsdom already provides `document`, so its `createElement` is patched rather than
 * replaced. The canvas it returns must be a real rasteriser: PDF.js draws the crop into it.
 */
export function installDocument(): void {
  const jsdomDocument = (globalThis as unknown as { document: Document }).document
  jsdomDocument.createElement = ((tag: string) => {
    if (tag !== 'canvas') return createCanvas(1, 1) as unknown as HTMLElement
    const canvas = createCanvas(1, 1)
    installDataUrl(canvas)
    return canvas as unknown as HTMLElement
  }) as typeof jsdomDocument.createElement
}

export interface BuildOptions {
  readonly withEmbeddedImage?: boolean
  readonly withText?: boolean
  readonly pages?: number
}

/** A recipe card: title on top, photo in the middle, steps at the bottom. */
export async function buildPdf(options: BuildOptions = {}): Promise<Uint8Array> {
  const { withEmbeddedImage = true, withText = true, pages = 1 } = options

  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)

  for (let index = 0; index < pages; index += 1) {
    const page = doc.addPage([420, 595])

    if (withText) {
      page.drawText(`DISH ${index + 1}`, { x: 45, y: 560, size: 16, font, color: rgb(0, 0, 0) })
      page.drawText('1. Grill it', { x: 48, y: 40, size: 9, font, color: rgb(0, 0, 0) })
      page.drawText('2. Plate it', { x: 48, y: 26, size: 9, font, color: rgb(0, 0, 0) })
    }

    if (withEmbeddedImage) {
      const art = createCanvas(360, 300)
      const context = art.getContext('2d')
      // A different plate on every page, so "each page got its own" is checkable.
      const plates = ['#8e44ad', '#16a085', '#c0392b', '#2c3e50']
      context.fillStyle = plates[index % plates.length] ?? '#8e44ad'
      context.fillRect(0, 0, 360, 300)
      context.fillStyle = '#f1c40f'
      context.beginPath()
      context.arc(180, 150, 90, 0, Math.PI * 2)
      context.fill()

      page.drawImage(await doc.embedJpg(art.toBuffer('image/jpeg')), {
        x: 30,
        y: 140,
        width: 360,
        height: 300,
      })
    }
  }

  return new Uint8Array(await doc.save())
}

/** The entire card as one JPEG: title, photo and steps all pixels, no text layer. */
export async function buildFlatCard(): Promise<Uint8Array> {
  const card = createCanvas(420, 595)
  const context = card.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, 420, 595)
  context.fillStyle = '#111111'
  context.fillRect(40, 30, 240, 26)
  context.fillStyle = '#c0392b'
  context.fillRect(30, 150, 360, 300)
  context.fillStyle = '#111111'
  context.fillRect(48, 520, 200, 14)
  context.fillRect(48, 545, 200, 14)

  const doc = await PDFDocument.create()
  const page = doc.addPage([420, 595])
  page.drawImage(await doc.embedJpg(card.toBuffer('image/jpeg')), {
    x: 0,
    y: 0,
    width: 420,
    height: 595,
  })
  return new Uint8Array(await doc.save())
}

export async function open(bytes: Uint8Array): Promise<{
  doc: PDFDocumentProxy
  destroy: () => Promise<void>
}> {
  const task = pdfjsAny.getDocument({
    data: bytes.slice(),
    useWorkerFetch: false,
    canvasFactory: canvasFactory(),
    standardFontDataUrl: 'public/pdfjs/standard_fonts/',
  })
  return { doc: await task.promise, destroy: () => task.destroy() }
}

/** Width and height straight out of the PNG's IHDR chunk, without a PNG decoder. */
export function pngSize(dataUrl: string): { width: number; height: number } | null {
  const binary = atob(dataUrl.split(',')[1] ?? '')
  if (binary.length < 24) return null
  const word = (offset: number): number =>
    ((binary.charCodeAt(offset) << 24) |
      (binary.charCodeAt(offset + 1) << 16) |
      (binary.charCodeAt(offset + 2) << 8) |
      binary.charCodeAt(offset + 3)) >>>
    0
  return { width: word(16), height: word(20) }
}
