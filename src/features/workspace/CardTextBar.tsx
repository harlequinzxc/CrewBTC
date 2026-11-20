import { Bold, Highlighter, Type } from 'lucide-react'
import { cn } from '../../lib/cn'
import { HIGHLIGHT_COLORS, REFERENCE_HIGHLIGHTS, TEXT_COLORS } from '../../types/card'
import type { TextStyle } from '../../types/card'

export interface CardTextBarProps {
  readonly zone: 'header' | 'body'
  /** The box's style, used when nothing is selected. */
  readonly style: TextStyle
  /**
   * Characters currently selected in the text box, or null when the caret is collapsed.
   * When a selection exists the controls style only that stretch; when it does not they
   * set the style for the whole box, which is what a card with one look wants.
   */
  readonly selection: { readonly start: number; readonly end: number } | null
  /** Effective style of the selection, or of the box when nothing is selected. */
  readonly active: TextStyle
  readonly onChange: (style: TextStyle) => void
}

const TextControls = [
  { color: TEXT_COLORS[0] ?? '#111827', label: 'Black' },
  { color: TEXT_COLORS[1] ?? '#b91c1c', label: 'Red' },
  { color: TEXT_COLORS[2] ?? '#15803d', label: 'Green' },
  { color: TEXT_COLORS[3] ?? '#1d4ed8', label: 'Blue' },
] as const

const HighlightControls = [
  { color: REFERENCE_HIGHLIGHTS.red, label: 'Red highlight' },
  { color: REFERENCE_HIGHLIGHTS.green, label: 'Green highlight' },
  { color: REFERENCE_HIGHLIGHTS.amber, label: 'Amber highlight' },
  { color: HIGHLIGHT_COLORS[2] ?? '#bfdbfe', label: 'Blue highlight' },
] as const

/** Keeps focus (and therefore the selection) in the text box while a control is used. */
const keepFocus = (event: React.PointerEvent): void => event.preventDefault()

/**
 * Bold, ink and highlighter for the text box being edited.
 *
 * The bar follows the selection: with characters selected it restyles only those and
 * says so, with the caret collapsed it restyles the whole box. Every button reports what
 * it acts on, because "Bold" on a selected word and "Bold" on a whole box are different
 * edits and the difference should never be a surprise.
 */
export function CardTextBar(props: CardTextBarProps) {
  const { style, zone, selection, active, onChange } = props
  const label = zone === 'header' ? 'top text' : 'bottom text'
  const styled = selection !== null ? 'selection' : 'whole box'

  return (
    <div
      data-testid="card-text-bar"
      className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </span>
      <span className="text-[10px] text-zinc-600">{styled}</span>

      <fieldset className="flex items-center gap-0.5 border-0 p-0">
        <legend className="sr-only">Text weight</legend>
        <button
          type="button"
          data-target="dense"
          aria-pressed={active.bold}
          aria-label={selection === null ? 'Bold' : 'Bold selection'}
          onPointerDown={keepFocus}
          onClick={() => onChange({ ...style, bold: !active.bold })}
          className={cn(
            'grid h-8 min-h-8 w-7 place-items-center rounded transition-colors duration-150 ease-out',
            'hover:bg-zinc-700 focus-visible:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-red-500',
            active.bold ? 'bg-zinc-700 text-zinc-50' : 'text-zinc-400',
          )}
        >
          <Bold aria-hidden className="size-3.5" />
        </button>
      </fieldset>

      <fieldset className="flex items-center gap-1 border-0 p-0">
        <legend className="sr-only">Text colour</legend>
        <Type aria-hidden className="size-3 shrink-0 text-zinc-500" />
        {TextControls.map(({ color, label: name }) => (
          <button
            key={color}
            type="button"
            data-target="dense"
            aria-label={`Text colour ${name}`}
            aria-pressed={active.color === color}
            onPointerDown={keepFocus}
            onClick={() => onChange({ ...style, color })}
            className={cn(
              'h-8 min-h-8 w-5 rounded border transition-colors duration-150 ease-out',
              'focus-visible:ring-2 focus-visible:ring-red-500',
              active.color === color
                ? 'border-zinc-50'
                : 'border-zinc-700 hover:border-zinc-500 focus-visible:border-zinc-300',
            )}
            style={{ background: color }}
          />
        ))}
      </fieldset>

      <fieldset className="flex items-center gap-1 border-0 p-0">
        <legend className="sr-only">Highlight</legend>
        <Highlighter aria-hidden className="size-3 shrink-0 text-zinc-500" />
        <button
          type="button"
          data-target="dense"
          aria-label="No highlight"
          aria-pressed={active.highlight === null}
          onPointerDown={keepFocus}
          onClick={() => onChange({ ...style, highlight: null })}
          className={cn(
            'grid h-8 min-h-8 w-5 place-items-center rounded border text-[10px] transition-colors duration-150 ease-out',
            'focus-visible:ring-2 focus-visible:ring-red-500',
            active.highlight === null
              ? 'border-zinc-50 text-zinc-200'
              : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 focus-visible:border-zinc-300',
          )}
        >
          off
        </button>
        {HighlightControls.map(({ color, label: name }) => (
          <button
            key={color}
            type="button"
            data-target="dense"
            aria-label={name}
            aria-pressed={active.highlight === color}
            onPointerDown={keepFocus}
            onClick={() => onChange({ ...style, highlight: color })}
            className={cn(
              'h-8 min-h-8 w-5 rounded border transition-colors duration-150 ease-out',
              'focus-visible:ring-2 focus-visible:ring-red-500',
              active.highlight === color
                ? 'border-zinc-50'
                : 'border-zinc-700 hover:border-zinc-500 focus-visible:border-zinc-300',
            )}
            style={{ background: color }}
          />
        ))}
      </fieldset>
    </div>
  )
}
