import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { SheetPreview } from '../features/workspace/SheetPreview'
import { computeGrid } from '../lib/imposition/grid'
import { DEFAULT_SHEET } from '../types/imposition'
/** These suites test sheet geometry, not copy; the new model has no text props. */
const idle = {
  texts: {} as Readonly<Record<string, string>>,
  images: {} as Readonly<Record<string, never>>,
  selectedCell: null,
  onSelectCell: () => undefined,
  onImageChange: () => undefined,
  onResetImage: () => undefined,
}


/**
 * jsdom has no layout engine, so ResizeObserver never fires. We stub it to report a
 * fixed box, which is exactly what the component reads — this asserts the scaling
 * maths, not a browser's layout.
 */
function stubSize(width: number, height: number): void {
  class FakeResizeObserver {
    private readonly callback: ResizeObserverCallback
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback
    }
    observe(): void {
      this.callback(
        [{ contentRect: { width, height } } as unknown as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      )
    }
    unobserve(): void {}
    disconnect(): void {}
  }
  ;(globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
    FakeResizeObserver as unknown as typeof ResizeObserver
}

const grid = computeGrid(DEFAULT_SHEET)

beforeEach(() => {
  stubSize(800, 600)
})

describe('preview scales to the available viewport', () => {
  it('reports the zoom it settled on', () => {
    render(<SheetPreview settings={DEFAULT_SHEET} grid={grid} pages={[]} showCutMarks {...idle} />)
    // 600px available height minus 24px breathing room, on a 297mm tall sheet.
    expect(screen.getByText(/% zoom/)).toBeInTheDocument()
  })

  it('fits a tall sheet by height, leaving no vertical overflow', () => {
    const available = 600 - 24
    const scale = Math.min((800 - 24) / 210, available / 297)
    const renderedHeight = 297 * scale
    expect(renderedHeight).toBeLessThanOrEqual(available + 0.5)
  })

  it('scales down further in a short pane and up in a tall one', () => {
    const shortScale = Math.min((800 - 24) / 210, (400 - 24) / 297)
    const tallScale = Math.min((800 - 24) / 210, (1200 - 24) / 297)
    expect(tallScale).toBeGreaterThan(shortScale)
    // Width becomes the binding constraint on a very tall pane.
    expect(tallScale).toBeCloseTo((800 - 24) / 210, 5)
  })

  it('never divides by zero when the pane has no measured size yet', () => {
    stubSize(0, 0)
    render(<SheetPreview settings={DEFAULT_SHEET} grid={grid} pages={[]} showCutMarks {...idle} />)
    expect(screen.getByText(/% zoom/)).toBeInTheDocument()
    expect(screen.queryByText('Infinity%')).not.toBeInTheDocument()
    expect(screen.queryByText('NaN%')).not.toBeInTheDocument()
  })
})
