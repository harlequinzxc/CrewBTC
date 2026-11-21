import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SheetBody } from '../../features/workspace/sheet/SheetBody'
import { computeGrid } from '../../lib/imposition/grid'
import { DEFAULT_SHEET } from '../../types/imposition'
import { textEditGestureStub } from '../fixtures/gesture-stub'

/**
 * Empty cells are places, not missing things.
 *
 * A twelve-up sheet is usually part-filled, so the unfilled cells are on screen the whole
 * time. Drawn at `zinc-300` on white paper with a `zinc-400` numeral they read as a
 * to-do list — twelve loud dashed boxes and a row of numbers that look like errors. They
 * keep their numbers, because knowing which cell you are aiming at matters when you drag
 * a page in, but at rest they sit just above the paper and step up only under the pointer.
 */
const render_ = () =>
  render(
    <SheetBody gesture={textEditGestureStub}
      grid={computeGrid(DEFAULT_SHEET)}
      scale={2}
      placements={[]}
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

describe('empty cell slots', () => {
  it('numbers every cell so a drop target can be named', () => {
    const { container } = render_()
    const numerals = [...container.querySelectorAll('span.tabular')].map((node) => node.textContent)
    expect(numerals).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'])
  })

  it('rests quietly: a faint rule and a whisper of a numeral', () => {
    const { container } = render_()
    const numeric = container.querySelector('span.tabular') as HTMLElement
    // zinc-300 on white is the quietest step that is still legible; zinc-400 was not.
    expect(numeric.className).toContain('text-zinc-300')
    expect(numeric.className).not.toContain('text-zinc-400')

    const cell = numeric.parentElement as HTMLElement
    expect(cell.className).toContain('border-zinc-200/70')
    expect(cell.className).not.toContain('border-zinc-300')
  })

  it('steps up under the pointer, with a keyboard equivalent', () => {
    const { container } = render_()
    const cell = container.querySelector('span.tabular')?.parentElement as HTMLElement
    // Hover alone would hide the affordance from the keyboard, so focus-within moves with it.
    expect(cell.className).toContain('hover:border-zinc-400')
    expect(cell.className).toContain('focus-within:border-zinc-400')
    expect(cell.className).toContain('group')
  })
})
