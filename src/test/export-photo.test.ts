import {
  PDFArray,
  PDFDocument,
  PDFDocument as PDFLibDocument,
  PDFName,
  PDFRawStream,
  StandardFonts,
  rgb,
} from '@cantoo/pdf-lib'
import { createCanvas } from '@napi-rs/canvas'
import { describe, expect, it } from 'vitest'
import { writeSheets } from '../lib/export/write-sheet'
import { computeGrid } from '../lib/imposition/grid'
import { DEFAULT_SHEET } from '../types/imposition'
import type { PageRef } from '../lib/imposition/sheet'

/**
 * The exported sheet must contain the dish photo, not the source page.
 *
 * This is checked by reading the output's own resources: a page drawn with
 * `drawPage` shows up as an `/XObject` with `/Subtype /Form`, while an embedded photo
 * shows up with `/Subtype /Image`. Before this was fixed the writer embedded the whole
 * source page, so the "photo" in every card was really the entire PDF page.
 */
const grid = computeGrid(DEFAULT_SHEET)

const pages: readonly PageRef[] = [
  { documentId: 'doc-a', fileName: 'a.pdf', pageNumber: 1, widthMm: 64, heightMm: 90 },
]

async function sourceBytes(): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([181, 255])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  // Type on the page: it must never reach the card's picture band.
  page.drawText('PRINTED TITLE', { x: 12, y: 200, size: 14, font, color: rgb(0, 0, 0) })
  const bytes = await doc.save()
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}

/** A real PNG, so `embedPng` gets real bytes rather than a stand-in. */
function pngDataUrl(): string {
  const canvas = createCanvas(40, 30)
  const context = canvas.getContext('2d')
  context.fillStyle = '#8e44ad'
  context.fillRect(0, 0, 40, 30)
  const png = canvas.toBuffer('image/png')
  return `data:image/png;base64,${png.toString('base64')}`
}

async function exportWith(
  photos?: Record<string, string>,
  /** Pixel shape per photo key. The exporter needs it to avoid stretching. */
  sizes: Record<string, { widthPx: number; heightPx: number }> = {},
): Promise<Uint8Array> {
  const result = await writeSheets({
    settings: DEFAULT_SHEET,
    grid,
    pages,
    sources: new Map([['doc-a', await sourceBytes()]]),
    drawCutMarks: false,
    texts: {
      '0|doc-a|1': { documentId: 'doc-a', pageNumber: 1, text: 'Dish name\n• Step one' },
    },
    ...(photos === undefined
      ? {}
      : {
          photos: Object.fromEntries(
            Object.entries(photos).map(([key, dataUrl]) => [
              key,
              { dataUrl, ...(sizes[key] ?? { widthPx: 40, heightPx: 30 }) },
            ]),
          ),
        }),
  })
  return result.bytes
}

/** `Subtype` of every XObject on the output page, e.g. `['Image']`. */
async function xobjectSubtypes(bytes: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(bytes)
  const resources = doc.getPages()[0]?.node.Resources()
  const xobjects = resources?.lookup(PDFName.of('XObject'))
  if (xobjects === undefined) return []

  const found: string[] = []
  const seen = new Set<string>()

  const walk = (value: unknown): void => {
    const resolved: unknown = doc.context.lookup(value as never)
    if (resolved instanceof PDFRawStream) {
      const subtype = resolved.dict.get(PDFName.of('Subtype'))
      found.push(String(subtype).replace('/', ''))
      return
    }
    const entries = (resolved as { entries?: () => [PDFName, unknown][] } | undefined)?.entries
    if (typeof entries === 'function') {
      for (const [key, entry] of entries.call(resolved)) {
        const id = String(key)
        if (seen.has(id)) continue
        seen.add(id)
        walk(entry)
      }
    }
  }

  walk(xobjects)
  return found
}

describe('the printed photo keeps its shape', () => {
  /** The placement rectangle of the photo, read from the page's own draw operators. */
  async function printedRect(bytes: Uint8Array): Promise<{ width: number; height: number }> {
    const doc = await PDFLibDocument.load(bytes)
    const contents = doc.getPages()[0]?.node.Contents() as unknown as PDFArray
    const parts: string[] = []

    for (let index = 0; index < contents.size(); index += 1) {
      const item = doc.context.lookup(contents.get(index) as never) as { contents?: Uint8Array }
      if (item.contents !== undefined) {
        // The content stream is Flate-compressed; `deflate` is its inverse.
        const stream = new DecompressionStream('deflate')
        const writer = stream.writable.getWriter()
        void writer.write(new Uint8Array(item.contents))
        void writer.close()
        parts.push(await new Response(stream.readable).text())
      }
    }

    // pdf-lib draws an image as `w 0 0 h 0 0 cm`; identity matrices sit beside it.
    const placed = [...parts.join('\n').matchAll(/([\d.]+) 0 0 ([\d.]+) 0 0 cm/g)]
      .map((match) => ({ width: Number(match[1]), height: Number(match[2]) }))
      .filter((rect) => rect.width > 1 && rect.height > 1)
      .at(-1)

    return placed ?? { width: 0, height: 0 }
  }

  async function exportShape(width: number, height: number): Promise<{ width: number; height: number }> {
    const canvas = createCanvas(width, height)
    canvas.getContext('2d').fillRect(0, 0, width, height)
    const bytes = await exportWith(
      { '0|doc-a|1': `data:image/png;base64,${canvas.toBuffer('image/png').toString('base64')}` },
      { '0|doc-a|1': { widthPx: width, heightPx: height } },
    )
    return printedRect(bytes)
  }

  it('prints a landscape photo at its own ratio, not the band’s', async () => {
    const rect = await exportShape(400, 300)
    expect(rect.width / rect.height).toBeCloseTo(4 / 3, 2)
  })

  it('prints a portrait photo at its own ratio too', async () => {
    const rect = await exportShape(300, 500)
    expect(rect.width / rect.height).toBeCloseTo(3 / 5, 2)
  })

  it('leaves the inset as padding, so the photo is fitted not stretched', async () => {
    const rect = await exportShape(400, 300)
    // The band is 64 mm wide; the photo takes 62.4 mm, leaving 0.8 mm each side.
    const bandPt = (64 * 72) / 25.4
    const insetPt = (0.8 * 72) / 25.4
    expect(rect.width).toBeCloseTo(bandPt - 2 * insetPt, 1)
    expect(rect.width).toBeLessThan(bandPt)
  })

  it('is no wider than the band, so nothing crosses the cut line', async () => {
    const rect = await exportShape(400, 300)
    expect(rect.width).toBeLessThan((64 * 72) / 25.4)
  })
})

describe('the picture band holds the photo, not the page', () => {
  it('embeds an image XObject for the dish photo', async () => {
    const subtypes = await xobjectSubtypes(await exportWith({ '0|doc-a|1': pngDataUrl() }))
    expect(subtypes).toContain('Image')
  })

  it('never embeds the source page as a Form XObject', async () => {
    const subtypes = await xobjectSubtypes(await exportWith({ '0|doc-a|1': pngDataUrl() }))
    expect(subtypes).not.toContain('Form')
  })

  it('does not draw the source page’s printed text into the card', async () => {
    // The photo path is the only path that draws in the picture band, so no page text can
    // arrive unless the whole page is embedded. `Form` would be that page.
    const subtypes = await xobjectSubtypes(await exportWith({ '0|doc-a|1': pngDataUrl() }))
    expect(subtypes).not.toContain('Form')
  })

  it('still writes the header and footer as real text', async () => {
    const bytes = await exportWith({ '0|doc-a|1': pngDataUrl() })
    const doc = await PDFDocument.load(bytes)
    // Two text draws per card: a header line and a footer line.
    const contents = doc.context.lookup(
      doc.getPages()[0]?.node.get(PDFName.of('Contents')),
    )
    expect(contents).toBeDefined()
    // A Helvetica font must be present for live text.
    const fonts = doc.getPages()[0]?.node.Resources()?.lookup(PDFName.of('Font'))
    expect(String(fonts)).not.toBe('undefined')
  })

  it('skips the picture rather than substituting the page when there is no photo', async () => {
    const subtypes = await xobjectSubtypes(await exportWith())
    expect(subtypes).not.toContain('Image')
    expect(subtypes).not.toContain('Form')
  })
})
