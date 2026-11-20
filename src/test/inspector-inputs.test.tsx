import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NumberField } from '../components/ui/NumberField'
import { SizeField, SizePair } from '../features/workspace/inspector/fields'

/**
 * An inspector field has to look like something you can type into.
 *
 * Against the #131418 panel, the old 8%-white hairline on a #1A1C22 surface was
 * effectively invisible: three editable numbers read as three static labels, and the only
 * cue that they were fields was the caret you got after guessing. The surface now sits a
 * clear step above the panel behind a real border, and the border answers the pointer and
 * the keyboard so "this is editable" is visible before you commit to clicking it.
 */
const shell = (node: HTMLElement): HTMLElement => node.parentElement as HTMLElement

describe('inspector numeric fields', () => {
  it('sits on the raised input surface', () => {
    render(<NumberField label="Top" value={10} onChange={() => undefined} suffix="mm" />)
    expect(shell(screen.getByLabelText('Top')).className).toContain('bg-surface-raised')
  })

  it('carries a visible border at rest, not the panel hairline', () => {
    render(<NumberField label="Top" value={10} onChange={() => undefined} suffix="mm" />)
    const classes = shell(screen.getByLabelText('Top')).className
    expect(classes).toContain('border-hairline-strong')
    expect(classes).not.toContain('border-hairline ')
  })

  it('answers the pointer and the keyboard', () => {
    render(<NumberField label="Top" value={10} onChange={() => undefined} suffix="mm" />)
    const classes = shell(screen.getByLabelText('Top')).className
    expect(classes).toContain('hover:border-ink-muted')
    expect(classes).toContain('focus-within:border-accent')
  })

  it('does the same for the sheet size pair and the select', () => {
    render(
      <SizePair
        first={{ name: 'Cell width', value: 52, error: undefined, onChange: () => undefined }}
        second={{ name: 'Cell height', value: 67, error: undefined, onChange: () => undefined }}
      />,
    )
    expect(shell(screen.getByLabelText('Cell width')).className).toContain('border-hairline-strong')

    render(<SizeField name="Gutter" value={4} error={undefined} onChange={() => undefined} />)
    expect(shell(screen.getByLabelText('Gutter')).className).toContain('border-hairline-strong')
  })
})
