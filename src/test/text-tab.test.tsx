import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { TextTab } from '../features/workspace/TextTab'
import { copyProgress } from '../features/workspace/copy-progress'
import type { PageRef } from '../lib/imposition/sheet'

/**
 * The Text tab is the whole copy workflow now: one paste-able box per page, ordered
 * the way the sheet places pages. These tests drive the real component with real
 * state, so a broken binding shows up as a lost keystroke rather than a missing prop.
 */
const pages: readonly PageRef[] = Array.from({ length: 4 }, (_unused, index) => ({
  documentId: 'cards.pdf',
  fileName: 'cards.pdf',
  pageNumber: index + 1,
  widthMm: 52,
  heightMm: 67,
}))

function Harness(props: { readonly initial?: Record<string, string> }) {
  const [texts, setTexts] = useState<Record<string, string>>(props.initial ?? {})
  const [selectedPage, setSelectedPage] = useState(0)

  return (
    <TextTab
      pages={pages}
      previews={{ 'cards.pdf#1': 'data:image/png;base64,x' }}
      texts={texts}
      selectedPage={selectedPage}
      onSelectPage={setSelectedPage}
      onChange={(index, text) => setTexts((current) => ({ ...current, [`${index}`]: text }))}
    />
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('one text box per page', () => {
  it('offers a single multi-line field, not one field per line', () => {
    render(<Harness />)
    const fields = screen.getAllByRole('textbox')
    // Exactly one editor for copy; the page list uses buttons, not inputs.
    expect(fields).toHaveLength(1)
  })

  it('keeps newlines, because the copy is pasted as a block', () => {
    render(<Harness />)
    const field = screen.getAllByRole('textbox')[0]!
    fireEvent.change(field, { target: { value: 'Line one\nLine two\nLine three' } })
    expect((field as HTMLTextAreaElement).value).toBe('Line one\nLine two\nLine three')
  })

  it('says which line becomes the header and which becomes the footer', () => {
    render(<Harness initial={{ '0': 'Header here' }} />)
    expect(screen.getByText(/Line 1 → header/)).toBeInTheDocument()
  })

  it('tells you when the card will print with no text at all', () => {
    render(<Harness />)
    expect(screen.getByText(/prints with just its picture/)).toBeInTheDocument()
  })
})

describe('moving between pages', () => {
  it('shows the page number the copy belongs to', () => {
    render(<Harness />)
    expect(screen.getByText(/Page 1 of cards\.pdf/)).toBeInTheDocument()
  })

  it('moves to the next page and back without losing either page’s copy', () => {
    render(<Harness />)
    const field = screen.getAllByRole('textbox')[0]!
    fireEvent.change(field, { target: { value: 'first page copy' } })

    fireEvent.click(screen.getByLabelText('Next page'))
    const second = screen.getAllByRole('textbox')[0] as HTMLTextAreaElement
    expect(second.value).toBe('')

    fireEvent.change(second, { target: { value: 'second page copy' } })
    fireEvent.click(screen.getByLabelText('Previous page'))
    expect((screen.getAllByRole('textbox')[0] as HTMLTextAreaElement).value).toBe('first page copy')
  })

  it('cannot move before the first page', () => {
    render(<Harness />)
    expect(screen.getByLabelText('Previous page')).toBeDisabled()
  })

  it('shows the miniature card with the header, picture and footer', () => {
    render(<Harness initial={{ '0': 'A title\nA footer' }} />)
    expect(screen.getByText('A title')).toBeInTheDocument()
    expect(screen.getByText('A footer')).toBeInTheDocument()
  })
})

describe('progress across a batch', () => {
  it('counts only pages with real copy', () => {
    expect(copyProgress(pages, { '0': 'yes', '1': '   ', '3': 'also yes' })).toBe('2/4')
  })

  it('counts nothing for an untouched batch', () => {
    expect(copyProgress(pages, {})).toBe('0/4')
  })

  it('says how many pages are done', () => {
    render(<Harness initial={{ '0': 'done' }} />)
    expect(screen.getByText('1 of 4 pages have copy')).toBeInTheDocument()
  })
})
