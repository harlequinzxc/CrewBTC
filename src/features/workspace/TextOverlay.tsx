import { useEffect, useRef } from 'react'
import { cn } from '../../lib/cn'
import type { TextBoxMm } from '../../types/edit'

interface TextOverlayProps {
  readonly box: TextBoxMm
  readonly value: string
  readonly edited: boolean
  readonly scale: number
  readonly sizePt: number
  readonly editing: boolean
  readonly zoomed: boolean
  readonly onBegin: () => void
  readonly onChange: (text: string) => void
  readonly onEnd: () => void
}

/**
 * A text block on the sheet. Below ~12 px on screen the real text is unreadable, so it
 * is shown as a subtle bar instead of illegible mush — clicking still opens the field.
 */
export function TextOverlay(props: TextOverlayProps) {
  const { box, scale, editing } = props
  const fieldRef = useRef<HTMLTextAreaElement>(null)

  // Focused on mount rather than via autoFocus: the user asked to edit this block, so
  // the caret belongs here, but the attribute also fires on page load in some browsers.
  useEffect(() => {
    if (editing) fieldRef.current?.focus()
  }, [editing])
  const width = Math.max(2, box.widthMm * scale)
  const height = Math.max(2, box.heightMm * scale)

  // A readable on-screen size is a UI concern; it must not distort the geometry above.
  const screenSize = Math.max(6, Math.min(14, props.sizePt * (scale * 25.4) / 72))
  const shrunk = !props.zoomed && !editing

  const style: React.CSSProperties = {
    left: `${box.xMm * scale}px`,
    top: `${box.yMm * scale}px`,
    width: `${width}px`,
    height: `${height}px`,
  }

  if (editing) {
    return (
      <textarea
        ref={fieldRef}
        value={props.value}
        style={style}
        onChange={(event) => props.onChange(event.target.value)}
        onBlur={props.onEnd}
        onKeyDown={(event) => {
          if (event.key === 'Escape' || (event.key === 'Enter' && !event.shiftKey)) {
            event.preventDefault()
            props.onEnd()
          }
        }}
        className="absolute z-30 resize-none rounded-sm border border-sky-400 bg-white/95 p-0.5 text-zinc-900 shadow-lg outline-none"
        aria-label="Edit text"
      />
    )
  }

  return (
    <button type="button" data-target="dense"
      onClick={props.onBegin}
      style={style}
      title={props.value}
      className={cn(
        'absolute z-20 overflow-hidden rounded-sm text-left leading-tight',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500',
        props.edited
          ? 'bg-amber-200/70 outline outline-1 outline-amber-500'
          : 'bg-white/0 hover:bg-sky-100/60 focus-visible:bg-sky-100/60',
        shrunk ? 'text-transparent' : 'text-zinc-900',
      )}
    >
      {shrunk ? (
        <span aria-hidden="true" className="block size-full bg-zinc-400/40" />
      ) : (
        <span style={{ fontSize: `${screenSize}px` }}>{props.value}</span>
      )}
      <span className="sr-only">{props.value}</span>
    </button>
  )
}
