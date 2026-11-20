import { useEffect, useRef } from 'react'
import { layoutBand } from '../../lib/export/text-band'
import type { TextStyle } from '../../types/card'

export interface CardZoneTextProps {
  readonly text: string
  /** Pixels per millimetre of the preview. */
  readonly scale: number
  readonly widthMm: number
  readonly heightMm: number
  readonly style: TextStyle
  readonly editing: boolean
  readonly maxPt: number
  readonly placeholder: string
  /** Rendered at this size when the real type would be too small to read. */
  readonly floorPx: number
  readonly onBeginEdit: () => void
  readonly onChange: (text: string) => void
  readonly onEndEdit: () => void
  readonly onStyle: (style: TextStyle) => void
}

/** Approximate width of a character at a given size, used for on-screen wrapping only. */
const measure = (text: string, sizePt: number): number => text.length * sizePt * 0.5 * (25.4 / 72)

/**
 * One text zone of a card: typeset at its true size, editable in place.
 *
 * The line breaking on screen comes from `layoutBand` — the same function the exporter
 * uses — so words wrap onto the same lines on the sheet as on paper. Below a legibility
 * floor the type is drawn larger rather than as a smudge; the breaks still match.
 */
export function CardZoneText(props: CardZoneTextProps) {
  const { text, scale, widthMm, heightMm, style, editing } = props
  const fieldRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!editing) return
    const field = fieldRef.current
    if (field === null) return
    field.focus()
    field.select()
  }, [editing])

  const layout = layoutBand(
    text === '' ? props.placeholder : text,
    heightMm,
    widthMm,
    heightMm,
    9,
    1.25,
    measure,
  )
  const realPx = layout.sizePt * scale * (25.4 / 72)
  const fontSize = Math.max(props.floorPx, realPx)
  const lineHeight = fontSize * 1.25

  // Placeholder copy is greyed so an empty box reads as empty rather than as content.
  const ink = text === '' ? '#9ca3af' : style.color
  const highlight = style.highlight ?? 'transparent'

  if (editing) {
    return (
      <textarea
        ref={fieldRef}
        value={text}
        onChange={(event) => props.onChange(event.target.value)}
        onBlur={props.onEndEdit}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            props.onEndEdit()
          }
          // Enter makes a new line; only the sheet's own shortcuts are swallowed.
          event.stopPropagation()
        }}
        onPointerDown={(event) => event.stopPropagation()}
        className="absolute inset-0 size-full resize-none rounded-sm border-0 bg-white/95 p-1 outline outline-2 outline-sky-500"
        style={{ fontSize, lineHeight: `${lineHeight}px`, color: style.color, fontWeight: style.bold ? 700 : 400 }}
        aria-label="Edit card text"
      />
    )
  }

  return (
    <button
      type="button"
      data-target="dense"
      onClick={(event) => {
        event.stopPropagation()
        props.onBeginEdit()
      }}
      className="absolute inset-0 block size-full min-h-8 cursor-text overflow-hidden border-0 bg-transparent p-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
      style={{ fontSize, lineHeight: `${lineHeight}px`, color: ink, fontWeight: style.bold ? 700 : 400 }}
      aria-label={`Card text: ${text === '' ? props.placeholder : text}`}
    >
      {layout.lines.map((line, index) => (
        <span
          key={`${index}-${line.text}`}
          className="block whitespace-pre"
          style={{ background: highlight }}
        >
          {line.text === '' ? '\u00a0' : line.text}
        </span>
      ))}
    </button>
  )
}
