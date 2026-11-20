import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IngestedDocument } from '../types/document'

/**
 * Clicking a card's text has to edit it — on the first click, and only one click.
 *
 * Three separate things were in the way, and none of them are visible from a component
 * test of `CardZoneText` alone:
 *
 * 1. `focus()` scrolled the canvas to reveal the field, moving the paper under the pointer.
 * 2. The formatting bar was in flow, so entering a text box shrank the canvas by 32px.
 * 3. Selecting a card mounts its band dividers, which are `z-10` and sit on the zone
 *    boundaries. On an unselected card they did not exist yet — the press mounted them
 *    under the pointer, so the *click* was delivered to a divider and never reached the
 *    text. The first click selected the card and did nothing else.
 *
 * Fixed by editing on pointer-down (before the dividers mount), floating the bar, and
 * focusing with `preventScroll`. These tests go through the real app because that is the
 * only layer where the ordering exists.
 */
const pickFiles = vi.fn()
vi.mock('../lib/files/open-picker', () => ({ pickFiles: () => pickFiles() as Promise<File[]> }))

const doc_ = {
  id: 'i0', fileName: 'cards.pdf', byteLength: 1, addedAt: '2026-11-19T00:00:00.000Z',
  status: 'parsed', metrics: { pageCount: 1, widthPt: 420, heightPt: 595 }, regions: [],
  pagePreviewUrl: null, copy: null,
  copies: { 1: { header: 'CHK-01 Kung Pao', footer: '• Plate' } },
  photoUrl: null, photos: {}, error: null,
} as IngestedDocument
vi.mock('../lib/pdf/ingest-batch', () => ({ ingestBatch: async () => [doc_] }))

import App from '../App'

const desktop = () => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1440 })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true, writable: true,
    value: (q: string) => ({ matches: q.includes('min-width: 64rem'), media: q, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }),
  })
}
beforeEach(() => { desktop(); pickFiles.mockResolvedValue([new File(['%PDF'], 'cards.pdf')]) })

describe('editing text for real', () => {
  it('clicking the text zone opens a textarea I can type in', async () => {
    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: /add pdfs/i })[0]!)
    const zone = await screen.findByRole('button', { name: /Card text: CHK-01/ })

    fireEvent.click(zone)

    const field = await screen.findByLabelText('Edit card text')
    expect(field).toBeInstanceOf(HTMLTextAreaElement)
    expect((field as HTMLTextAreaElement).value).toContain('CHK-01')

    // Now type — this is the part the user says does not work.
    fireEvent.change(field, { target: { value: 'CHK-02 Typed' } })
    expect((field as HTMLTextAreaElement).value).toBe('CHK-02 Typed')
    // And it reached the card, not just the field's own state.
    await waitFor(() =>
      expect(document.querySelector('[data-cell]')?.textContent).toContain('CHK-02 Typed'),
    )
  })

  it('one pointer-down on an UNSELECTED card’s text begins editing', async () => {
    // The reported bug. Selecting a card mounts the band dividers, which are `z-10` and sit
    // on the zone boundaries — so on the first press the dividers appeared under the
    // pointer and the following click landed on them instead of the text. Two clicks were
    // needed, and the second one was on something that had moved.
    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: /add pdfs/i })[0]!)
    const zone = await screen.findByRole('button', { name: /Card text: CHK-01/ })

    // Exactly one gesture, and it is a pointer-down — not the click that follows it.
    fireEvent.pointerDown(zone, { button: 0 })

    expect(await screen.findByLabelText('Edit card text')).toBeInTheDocument()
  })

  it('puts the caret at the end instead of selecting everything', async () => {
    // Selecting the whole box means the first keystroke wipes the dish name. Type one
    // character into "Kung Pao Chicken" and you get "X" — which looks exactly like the
    // text being uneditable, and was reported as such.
    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: /add pdfs/i })[0]!)
    const zone = await screen.findByRole('button', { name: /Card text: CHK-01/ })

    fireEvent.pointerDown(zone, { button: 0 })
    const field = (await screen.findByLabelText('Edit card text')) as HTMLTextAreaElement

    expect(field.selectionStart).toBe(field.value.length)
    expect(field.selectionEnd).toBe(field.value.length)
    expect(field.selectionStart).not.toBe(0)
  })

  it('keeps keyboard activation working, where there is no pointer at all', async () => {
    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: /add pdfs/i })[0]!)
    const zone = await screen.findByRole('button', { name: /Card text: CHK-01/ })
    zone.focus()
    fireEvent.click(zone)
    expect(await screen.findByLabelText('Edit card text')).toBeInTheDocument()
  })

  it('the textarea survives losing nothing on blur of the card underneath', async () => {
    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: /add pdfs/i })[0]!)
    const zone = await screen.findByRole('button', { name: /Card text: CHK-01/ })
    fireEvent.click(zone)
    const field = await screen.findByLabelText('Edit card text')

    // A stray pointerdown on the card beneath must not tear the field down mid-edit.
    fireEvent.pointerDown(field)
    expect(screen.queryByLabelText('Edit card text')).toBeInTheDocument()
  })
})
