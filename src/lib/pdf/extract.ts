import type { PDFPageProxy } from 'pdfjs-dist'
import type { TextRegion } from '../../types/document'
import type { NormalisedBox } from '../../types/template'

interface RawItem {
  readonly str: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly fontSize: number
}

interface TextItemLike {
  readonly str?: unknown
  readonly transform?: unknown
  readonly width?: unknown
  readonly height?: unknown
}

export type PageOutcome =
  | { readonly ok: true; readonly regions: readonly TextRegion[] }
  | { readonly ok: false; readonly reason: string }

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

function readItems(items: readonly TextItemLike[], pageWidth: number, pageHeight: number): RawItem[] {
  const out: RawItem[] = []

  for (const item of items) {
    if (typeof item.str !== 'string' || item.str.trim() === '') continue
    const transform = item.transform
    if (!Array.isArray(transform) || transform.length < 6) continue

    const [a, b, c, d, e, f] = transform as number[]
    if (typeof e !== 'number' || typeof f !== 'number') continue

    const scaleX = typeof a === 'number' ? Math.hypot(a, b ?? 0) : 0
    const scaleY = typeof d === 'number' ? Math.hypot(c ?? 0, d) : 0
    const width = typeof item.width === 'number' ? item.width : 0
    const fontSize = scaleY > 0 ? scaleY : scaleX
    if (fontSize <= 0) continue

    // PDF space is bottom-left origin; normalise to a top-left origin box.
    out.push({
      str: item.str,
      x: e / pageWidth,
      y: clamp01(1 - f / pageHeight),
      width: clamp01(width / pageWidth),
      height: clamp01(fontSize / pageHeight),
      fontSize,
    })
  }

  return out
}

/**
 * Groups text items into lines (shared baseline, left-to-right) and lines into
 * blocks (vertical proximity, similar size). Deterministic and geometry-only —
 * no heuristics on wording, so consistently formatted PDFs parse consistently.
 */
function groupRegions(items: readonly RawItem[], pageHeight: number): TextRegion[] {
  if (items.length === 0) return []

  const lineTolerance = 0.004
  const sorted = [...items].sort((l, r) => l.y - r.y || l.x - r.x)
  const lines: RawItem[][] = []

  for (const item of sorted) {
    const line = lines[lines.length - 1]
    const last = line?.[line.length - 1]
    if (line !== undefined && last !== undefined && Math.abs(item.y - last.y) <= lineTolerance) {
      line.push(item)
    } else {
      lines.push([item])
    }
  }

  const blocks: RawItem[][] = []
  const blockGap = 0.012

  for (const line of lines) {
    const previous = blocks[blocks.length - 1]
    const previousLine = previous?.[0]
    const firstInLine = line[0]
    if (previous === undefined || previousLine === undefined || firstInLine === undefined) {
      blocks.push([...line])
      continue
    }

    const gap = firstInLine.y - previousLine.y
    const sizeDelta = Math.abs(firstInLine.fontSize - previousLine.fontSize)
    if (gap <= blockGap && sizeDelta <= previousLine.fontSize * 0.25) {
      previous.push(...line)
    } else {
      blocks.push([...line])
    }
  }

  return blocks.map((block, index) => {
    const text = block.map((item) => item.str).join(' ').replace(/\s+/g, ' ').trim()
    const x = Math.min(...block.map((item) => item.x))
    const y = Math.min(...block.map((item) => item.y))
    const right = Math.max(...block.map((item) => item.x + item.width))
    const bottom = Math.max(...block.map((item) => item.y + item.height))

    const box: NormalisedBox = {
      x: clamp01(x),
      y: clamp01(y),
      width: clamp01(right - x),
      height: clamp01(bottom - y),
    }

    const fontSize = Math.max(...block.map((item) => item.fontSize))
    const id = `block-${index}`

    return {
      id,
      text,
      box,
      fontSizeRatio: clamp01(fontSize / pageHeight),
    }
  })
}

export async function extractPageText(page: PDFPageProxy): Promise<PageOutcome> {
  try {
    const viewport = page.getViewport({ scale: 1 })
    if (viewport.width <= 0 || viewport.height <= 0) {
      return { ok: false, reason: 'Page has no dimensions' }
    }

    const content = await page.getTextContent()
    const items = readItems(content.items as readonly TextItemLike[], viewport.width, viewport.height)
    if (items.length === 0) return { ok: false, reason: 'No selectable text — the PDF may be a scan' }

    return { ok: true, regions: groupRegions(items, viewport.height) }
  } catch {
    return { ok: false, reason: 'Text could not be extracted from this page' }
  }
}
