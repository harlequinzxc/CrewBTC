import { useEffect, useRef } from 'react'
import { layoutBand } from '../../lib/export/text-band'
import type { TextStyle } from '../../types/edit'

export interface CardTextProps {
  readonly text: string
  /** Pixels per millimetre of the preview. */
  readonly scale: number
  readonly widthMm: number
  readonly bandMm: number
  readonly maxPt: number
  readonly className: string
  readonly style: TextStyle
  readonly editing: boolean
  /** Click on the words: the same gesture as clicking a text box in a slide editor. */
  readonly onBeginEdit: () => void
  readonly onChange: (text: string) => void
  readonly onEndEdit: () => void
}

/**
 * Header or footer copy, typeset at its real size and editable in place.
 *
 * Sizing comes from `layoutBand` — the very function the exporter uses — so the words
 * break onto the same lines on screen as they will on paper. Clicking the words puts a
 * caret in them; Escape, Enter, or clicking away commits.
 *
 * Below roughly 5 px the real size is unreadable, so the type is drawn at a legible
 * floor instead of becoming a smudge. Line breaks still match the print.
 */
export function CardText(props: CardTextProps) {
  const { text, scale, widthMm, bandMm, maxPt, className, style, editing } = props
  const fieldRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!editing) return
    const field = fieldRef.current
    if (field === null) return
    field.focus()
    field.select()
  }, [editing])

  if (text.trim() === '' && !editing) return null

  // Rough Helvetica advance; exact per-pixel metrics are unavailable before paint, and
  // a small over-estimate breaks lines slightly early rather than overflowing.
  const measure = (candidate: string, sizePt: number): number =>
    candidate.length * 0.5 * sizePt * (25.4 / 72)

  const layout = layoutBand(text, 0, widthMm, bandMm, maxPt, 1.18, measure, {
    paddingMm: 0.8,
  })

  const pxPerPt = scale * (25.4 / 72)
  const sizePx = Math.max(5, layout.sizePt * pxPerPt)
  const padding = 0.8 * scale

  // While editing, the raw text is shown in a textarea at the same size and position,
  // so nothing jumps: the caret appears exactly where the words were.
  if (editing) {
    return (
      <textarea
        ref={fieldRef}
        data-target="dense"
        value={text}
        onChange={(event) => props.onChange(event.target.value)}
        onBlur={props.onEndEdit}
        onKeyDown={(event) => {
          if (event.key === 'Escape' || (event.key === 'Enter' && !event.shiftKey)) {
            event.preventDefault()
            props.onEndEdit()
          }
        }}
        onPointerDown={(event) => event.stopPropagation()}
        aria-label="Edit card text"
        className="absolute inset-0 z-30 resize-none overflow-hidden rounded-sm border border-sky-400 bg-white/95 p-0 outline-none"
        style={{
          paddingLeft: `${padding}px`,
          paddingTop: `${padding}px`,
          fontSize: `${sizePx}px`,
          lineHeight: 1.18,
          color: style.color,
          backgroundColor: style.highlight ?? 'rgba(255,255,255,0.95)',
        }}
      />
    )
  }

  return (
    <button type="button" data-target="dense" onClick={(event) => {
        // Editing a band must not also reselect the whole cell.
        event.stopPropagation()
        props.onBeginEdit()
      }}
      title={text}
      aria-label={`Edit text: ${text.split('\n')[0] ?? ''}`}
      className={`${className} absolute inset-0 z-20 min-h-0 cursor-text overflow-hidden text-left hover:outline hover:outline-1 hover:outline-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500`}
      style={{
        paddingLeft: `${padding}px`,
        paddingTop: `${padding}px`,
        color: style.color,
        backgroundColor: style.highlight ?? undefined,
      }}
    >
      {layout.lines.map((line, index) => (
        <span
          key={`${index}-${line.text}`}
          className="block"
          style={{ fontSize: `${sizePx}px`, lineHeight: 1.18, whiteSpace: 'pre' }}
        >
          {line.text}
        </span>
      ))}
    </button>
  )
}
