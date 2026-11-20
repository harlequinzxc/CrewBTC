import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SheetBody } from '../features/workspace/SheetBody'
import { computeGrid } from '../lib/imposition/grid'
import { DEFAULT_SHEET } from '../types/imposition'
import { planSheets } from '../lib/imposition/sheet'
import type { PageRef } from '../lib/imposition/sheet'

/**
 * The canvas draws the sheet it is told to.
 *
 * `CardSheet` used to hard-code `sheets[0]`, so a twelve-card document with a thirteenth
 * page had a second sheet that existed in the export and nowhere on screen. The placements
 * prop is what fixes that: handing the body sheet 2's placements is what puts sheet 2's
 * pages on the paper.
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

const renderBody = (placements: ReturnType<typeof planSheets>[number]['placements']) =>
  render(
    <SheetBody
      grid={grid}
      scale={2}
      placements={placements}
      marks={[]}
      cards={{}}
      selectedCell={null}
      activeZone={null}
      editingCell={null}
      pictureKey={null}
      onDeselect={() => undefined}
      onSelectCell={() => undefined}
      onBeginTextEdit={() => undefined}
      onEndEdit={() => undefined}
      onSelectionChange={() => undefined}
      onTextChange={() => undefined}
      onStyleChange={() => undefined}
      onBeginPictureEdit={() => undefined}
      onEndPictureEdit={() => undefined}
      onImageChange={() => undefined}
      onBandsChange={() => undefined}
    />,
  )

describe('the sheet on the canvas', () => {
  const sheets = planSheets(pages(20), grid)

  it('fills a first sheet completely and starts the second', () => {
    expect(sheets).toHaveLength(2)
    expect(sheets[0]?.placements).toHaveLength(12)
    // Eight pages are left over for sheet 2, so four slots stay empty.
    expect(sheets[1]?.placements).toHaveLength(8)
    expect(sheets[1]?.emptyCells).toBe(4)
  })

  it('shows sheet 1 pages when given sheet 1', () => {
    const first = sheets[0]
    if (first === undefined) throw new Error('fixture needs a sheet')
    const { container } = renderBody(first.placements)

    const labels = [...container.querySelectorAll('[data-page]')].map((node) =>
      node.getAttribute('data-page'),
    )
    expect(labels[0]).toBe('dish.pdf#1')
    expect(labels).toHaveLength(12)
    expect(container.querySelectorAll('.group.absolute').length).toBe(0)
  })

  it('shows sheet 2 pages — a different set — when given sheet 2', () => {
    const second = sheets[1]
    if (second === undefined) throw new Error('fixture needs a second sheet')
    const { container } = renderBody(second.placements)

    const labels = [...container.querySelectorAll('[data-page]')].map((node) =>
      node.getAttribute('data-page'),
    )
    // Sheet 2 begins at page 13, not page 1: this is the whole point of the prop.
    expect(labels[0]).toBe('dish.pdf#13')
    expect(labels).toHaveLength(8)
    // Four cells have no page, so they are drawn as empty slots — quiet rules with their
    // numeral, which is how the sheet marks a free slot.
    expect(container.querySelectorAll('.group.absolute').length).toBe(4)
  })
})
