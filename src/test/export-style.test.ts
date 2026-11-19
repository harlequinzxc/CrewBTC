import {
  PDFArray,
  PDFDocument,
  PDFDocument as PDFLibDocument,
  PDFName,
  PDFRawStream,
  decodePDFRawStream,
  StandardFonts,
  rgb,
} from '@cantoo/pdf-lib'
import { describe, expect, it } from 'vitest'
import { writeSheets } from '../lib/export/write-sheet'
import { computeGrid } from '../lib/imposition/grid'
import { DEFAULT_SHEET } from '../types/imposition'
import type { PageRef } from '../lib/imposition/sheet'
import type { CellText } from '../types/edit'

/**
 * Colour and highlight are a promise the preview makes on screen. If the export ignored
 * them, the screen would be lying; these tests read the bytes back to check it does not.
 */
const grid = computeGrid(DEFAULT_SHEET)

const pages: readonly PageRef[] = [
  { documentId: 'doc-a', fileName: 'a.pdf', pageNumber: 1, widthMm: 64, heightMm: 90 },
]

async function sourceBytes(): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([181, 255])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  page.drawText('Dish', { x: 10, y: 200, size: 12, font, color: rgb(0, 0, 0) })
  const bytes = await doc.save()
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}

/**
 * Decoded content stream, so assertions run against real PDF operators.
 * `Contents` is an array of streams once a sheet has both a background and artwork, so
 * all of them are concatenated rather than just the first.
 */
async function contentOf(bytes: Uint8Array): Promise<string> {
  const doc = await PDFLibDocument.load(bytes)
  const contents = doc.context.lookup(doc.getPages()[0]?.node.get(PDFName.of('Contents')))
  
  const readOne = (value: unknown): string => {
    // `lookup` is typed by the union of every PDF object, so narrow at runtime only.
    const stream: unknown = doc.context.lookup(value as never)
    if (!(stream instanceof PDFRawStream)) return ''

    // Output streams are Flate-compressed; decode them before looking for operators.
    return new TextDecoder('latin1').decode(decodePDFRawStream(stream).decode())
  }

  if (contents instanceof PDFArray) {
    return contents.asArray().map(readOne).join('\n')
  }
  return readOne(contents)
}

const texts = {
  '0|doc-a|1': { documentId: 'doc-a', pageNumber: 1, text: 'Dish name' } satisfies CellText,
}

async function exportWith(
  styles?: Readonly<Record<string, { color: string; highlight: string | null }>>,
): Promise<string> {
  const result = await writeSheets({
    settings: DEFAULT_SHEET,
    grid,
    pages,
    sources: new Map([['doc-a', await sourceBytes()]]),
    drawCutMarks: false,
    texts,
    ...(styles === undefined ? {} : { styles }),
  })
  return contentOf(result.bytes)
}

describe('text style reaches the exported page', () => {
  it('writes the chosen ink colour for the header', async () => {
    const content = await exportWith({ '0|header': { color: '#b91c1c', highlight: null } })
    // #b91c1c is 185/255, 28/255, 28/255.
    expect(content).toMatch(/0\.72549\d*\s+0\.10980\d*\s+0\.10980\d*\s+rg/)
  })

  it('paints a highlight behind the text when one is chosen', async () => {
    const plain = await exportWith()
    const highlighted = await exportWith({
      '0|header': { color: '#111827', highlight: '#fde68a' },
    })
    // #fde68a is 253/255, 230/255, 138/255.
    expect(highlighted).toMatch(/0\.99215\d*\s+0\.90196\d*\s+0\.54117\d*\s+rg/)
    expect(plain).not.toMatch(/0\.99215\d*\s+0\.90196\d*\s+0\.54117\d*\s+rg/)
  })

  it('differs from the plain export, so the style is not silently dropped', async () => {
    expect(await exportWith({ '0|header': { color: '#1d4ed8', highlight: null } })).not.toBe(
      await exportWith(),
    )
  })

  it('falls back to the default ink for a malformed colour instead of throwing', async () => {
    // A bad hex must not reach the PDF writer; the header still renders in the default
    // ink, and the export still succeeds.
    const content = await exportWith({ '0|header': { color: 'not-a-colour', highlight: null } })
    expect(content.length).toBeGreaterThan(0)
    expect(content).toMatch(/BT/) // a text object was still drawn
    expect(content).not.toContain('Bad colour')
  })
})
