import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SheetStrip } from '../features/workspace/SheetStrip'
import { SheetThumbnail } from '../features/workspace/SheetThumbnail'
import { Inspector } from '../features/workspace/Inspector'
import { computeGrid } from '../lib/imposition/grid'
import { planSheets } from '../lib/imposition/sheet'
import { DEFAULT_SHEET } from '../types/imposition'
import { cardKey } from '../types/card'
import type { Card } from '../types/card'
import type { PageRef, SheetPlan } from '../lib/imposition/sheet'

/**
 * The canvas chrome after the stack: miniatures that look like pages, a strip bound to
 * the scroll, and a rail that can be given back to the sheet.
 *
 * The failure they share is drift — a strip that highlights sheet 1 while the canvas shows
 * sheet 3 — so the strip is tested by *not* clicking anything and asserting it still
 * follows.
 */

const grid = computeGrid(DEFAULT_SHEET)

const pages = (count: number): PageRef[] =>
  Array.from({ length: count }, (_, index) => ({
    documentId: 'dish.pdf',
    fileName: 'dish.pdf',
    pageNumber: index + 1,
    widthMm: 210,
    heightMm: 297,
  }))

const keyFor = (placement: SheetPlan['placements'][number]) =>
  cardKey(placement.cellIndex, placement.documentId, placement.pageNumber)

describe('the thumbnail strip shows real miniatures', () => {
  const sheets = planSheets(pages(14), grid)

  it('greekes the card’s text into rules shaped by the words', () => {
    const first = sheets[0]
    if (first === undefined) throw new Error('fixture needs a sheet')
    const placement = first.placements[0]
    if (placement === undefined) throw new Error('fixture needs a placement')

    const card = {
      headerText: 'CHK-01 Kung Pao',
      bodyText: '• Plate • Garnish',
      photo: null,
      bands: { headerMm: 6, footerMm: 6 },
      headerStyle: { color: '#111111' },
      bodyStyle: { color: '#333333' },
    } as unknown as Card

    const { container } = render(
      <SheetThumbnail
        sheet={first}
        settings={DEFAULT_SHEET}
        grid={grid}
        cards={{ [keyFor(placement)]: card }}
        keyFor={keyFor}
        active={false}
        onSelect={() => undefined}
      />,
    )

    // A 6mm band at 64px of thumbnail is 3.7px tall, so no font size makes the name
    // readable — the band is greeked instead. What has to survive is the *shape*: rules
    // exist, and their widths follow the length of the words rather than being constant.
    const rules = [...container.querySelectorAll('span[style*="height: 1px"]')]
    expect(rules.length).toBeGreaterThan(0)

    // The heading is longer than the footer, so its widest rule is wider.
    const widths = rules.map((rule) => Number.parseFloat((rule as HTMLElement).style.width))
    expect(new Set(widths).size).toBeGreaterThan(1)
  })

  it('draws the dish photo at miniature scale', () => {
    const first = sheets[0]
    if (first === undefined) throw new Error('fixture needs a sheet')
    const placement = first.placements[0]
    if (placement === undefined) throw new Error('fixture needs a placement')

    const card = {
      headerText: 'CHK-01',
      bodyText: '',
      photo: { dataUrl: 'data:image/png;base64,DISH', widthPx: 360, heightPx: 300 },
      bands: { headerMm: 6, footerMm: 6 },
      headerStyle: { color: '#111111' },
      bodyStyle: { color: '#333333' },
    } as unknown as Card

    const { container } = render(
      <SheetThumbnail
        sheet={first}
        settings={DEFAULT_SHEET}
        grid={grid}
        cards={{ [keyFor(placement)]: card }}
        keyFor={keyFor}
        active={false}
        onSelect={() => undefined}
      />,
    )

    expect(container.querySelector('img')?.getAttribute('src')).toContain('DISH')
  })
})

describe('the strip and the canvas share one idea of the active sheet', () => {
  it('marks the sheet the scroll reported, not a stored one', () => {
    const strip = (activeIndex: number) => (
      <SheetStrip
        sheets={planSheets(pages(20), grid)}
        settings={DEFAULT_SHEET}
        grid={grid}
        cards={{}}
        keyFor={keyFor}
        activeIndex={activeIndex}
        onSelectSheet={() => undefined}
        collapsed={false}
        onToggleCollapsed={() => undefined}
      />
    )
    const { rerender } = render(strip(0))
    expect(screen.getByRole('button', { name: 'Sheet 1' })).toHaveAttribute('aria-current', 'true')

    // The canvas saying "you are on sheet 2" is the whole input; nothing is clicked.
    rerender(strip(1))
    expect(screen.getByRole('button', { name: 'Sheet 2' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'Sheet 1' })).not.toHaveAttribute('aria-current')
  })
})

describe('the inspector can be given back to the sheet', () => {
  const renderInspector = (open: boolean) =>
    render(
      <Inspector
        card={null}
        cellIndex={null}
        cellHeightMm={67}
        units="mm"
        onBandsChange={() => undefined}
        onTextScaleChange={() => undefined}
        onResetCard={() => undefined}
        sheet={DEFAULT_SHEET}
        grid={grid}
        sheetErrors={{}}
        onSheetChange={() => undefined}
        onResetSheet={() => undefined}
        showCutMarks
        onShowCutMarksChange={() => undefined}
        open={open}
      />,
    )

  it('is a complementary landmark when open', () => {
    renderInspector(true)
    expect(screen.getByRole('complementary', { name: 'Inspector' })).toBeInTheDocument()
  })

  it('leaves the accessibility tree when closed, but keeps its state', () => {
    // Closed is not unmounted. The rail is hidden — out of layout, out of the tab order,
    // and out of the accessibility tree — but it stays in the DOM, so reopening it puts
    // the sections back where the user left them instead of at the top. That is the same
    // bargain the narrow-window notice makes with the workspace.
    const { container } = renderInspector(false)
    expect(screen.queryByRole('complementary', { name: 'Inspector' })).not.toBeInTheDocument()

    const aside = container.querySelector('aside')
    expect(aside).not.toBeNull()
    expect(aside).toHaveAttribute('hidden')
    // Still in the DOM — the sections keep their state — but not rendered, so `visible`
    // is false and `hidden` is doing the work rather than a dead `display:none` class.
    expect(screen.queryByText('Sheet & print')).not.toBeVisible()
  })

  it('stays out of the layout below the breakpoint even when open', () => {
    // The toggle decides the session; the window decides the layout. A rail that is open
    // must still vanish under 1024px, or it squeezes a canvas that has nowhere to go.
    const { container } = renderInspector(true)
    const className = container.querySelector('aside')?.className ?? ''
    expect(className).toContain('hidden')
    expect(className).toContain('lg:flex')
  })

  it('is the opposite once reopened', () => {
    const { rerender } = renderInspector(false)
    rerender(
      <Inspector
        card={null}
        cellIndex={null}
        cellHeightMm={67}
        units="mm"
        onBandsChange={() => undefined}
        onTextScaleChange={() => undefined}
        onResetCard={() => undefined}
        sheet={DEFAULT_SHEET}
        grid={grid}
        sheetErrors={{}}
        onSheetChange={() => undefined}
        onResetSheet={() => undefined}
        showCutMarks
        onShowCutMarksChange={() => undefined}
        open
      />,
    )
    expect(screen.getByRole('complementary', { name: 'Inspector' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Inspector' })).not.toHaveAttribute('hidden')
  })
})
