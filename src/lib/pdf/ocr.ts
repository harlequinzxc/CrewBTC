import type { PDFPageProxy } from 'pdfjs-dist'
import { renderThumbnail } from './thumbnails'

/**
 * Reading text that PDF.js could not.
 *
 * Some recipe cards are scans: one image and no text layer at all. `getTextContent()`
 * returns nothing for them, which would leave both text boxes empty on upload. This
 * module renders the page and asks tesseract to read it.
 *
 * tesseract.js and its language data are several megabytes, so they are imported on
 * demand — a PDF with a real text layer never pays for them — and the language data is
 * fetched from a CDN rather than bundled. The cost of that choice is that OCR needs a
 * network connection the first time; the rest of the app does not.
 */

/** Tesseract only ever sees these two bands: the title and the instructions. */
const OCR_WIDTH_PX = 1400

export interface OcrResult {
  readonly headerText: string
  readonly bodyText: string
}

export const EMPTY_OCR: OcrResult = { headerText: '', bodyText: '' }

interface OcrWorker {
  recognize: (image: string) => Promise<{ data: { text: string } }>
  terminate: () => Promise<unknown>
}

/** Cached across pages: loading the language data twice is the slow part. */
let pending: Promise<OcrWorker> | null = null

async function getWorker(): Promise<OcrWorker> {
  if (pending !== null) return pending

  const loading = (async (): Promise<OcrWorker> => {
    const { createWorker } = await import('tesseract.js')
    // English only: other scripts need their own trained data, which is a deliberate
    // size decision rather than an oversight.
    return await createWorker('eng')
  })()

  pending = loading
  // A failed load must not poison every later page.
  loading.catch(() => {
    pending = null
  })

  return loading
}

/** Splits OCR text into a title block and instruction lines, one step per line. */
export function splitOcrText(raw: string): OcrResult {
  const lines = raw
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => /[\p{L}\p{N}]/u.test(line))

  if (lines.length === 0) return EMPTY_OCR
  if (lines.length === 1) return { headerText: lines[0] ?? '', bodyText: '' }

  // The title is short — a code and a name. Everything from the first line that reads
  // like an instruction onwards belongs to the steps.
  const stepAt = lines.findIndex((line) => /^(?:[•·▪◦*‣-]|\d{1,2}[.)])\s*/u.test(line))
  const splitAt = stepAt > 0 ? stepAt : Math.min(2, lines.length)

  return {
    headerText: lines.slice(0, splitAt).join('\n'),
    bodyText: lines.slice(splitAt).join('\n'),
  }
}

/**
 * Reads a page that has no text layer.
 *
 * Returns empty strings rather than throwing when OCR is unavailable — offline, blocked,
 * or the page cannot render. An empty box the user can type into is a better outcome
 * than a failed upload.
 */
export async function ocrPage(page: PDFPageProxy): Promise<OcrResult> {
  try {
    const image = await renderThumbnail(page, OCR_WIDTH_PX)
    if (image === null) return EMPTY_OCR

    const worker = await getWorker()
    const { data } = await worker.recognize(image)
    return splitOcrText(data.text)
  } catch {
    return EMPTY_OCR
  }
}
