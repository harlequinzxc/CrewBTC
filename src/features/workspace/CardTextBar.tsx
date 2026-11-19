import { Bold, Highlighter, Type } from 'lucide-react'
import { cn } from '../../lib/cn'
import { HIGHLIGHT_COLORS, TEXT_COLORS } from '../../types/card'
import type { TextStyle } from '../../types/card'

export interface CardTextBarProps {
  readonly style: TextStyle
  readonly zone: 'header' | 'body'
  readonly onChange: (style: TextStyle) => void
}

/**
 * Bold, ink and highlighter for the text box being edited.
 *
 * Applies to the whole box rather than to a selection: a card's header is a dish code
 * and a name, its body is the steps, and one look per box is what a printed recipe
 * card actually wants. The bar says which box it is acting on, because the card has
 * two and it is otherwise easy to style the wrong one.
 */
export function CardTextBar(props: CardTextBarProps) {
  const { style, zone, onChange } = props
  const label = zone === 'header' ? 'top text' : 'bottom text'

  return (
    <div
      data-testid="card-text-bar"
      className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </span>

      <fieldset className="flex items-center gap-0.5 border-0 p-0">
        <legend className="sr-only">Text weight</legend>
        <button
          type="button"
          data-target="dense"
          aria-pressed={style.bold}
          aria-label="Bold"
          onClick={() => onChange({ ...style, bold: !style.bold })}
          className={cn(
            'grid h-8 min-h-8 w-7 place-items-center rounded transition-colors duration-150 ease-out',
            'hover:bg-zinc-700 focus-visible:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-red-500',
            style.bold ? 'bg-zinc-700 text-zinc-50' : 'text-zinc-400',
          )}
        >
          <Bold aria-hidden className="size-3.5" />
        </button>
      </fieldset>

      <fieldset className="flex items-center gap-1 border-0 p-0">
        <legend className="sr-only">Text colour</legend>
        <Type aria-hidden className="size-3 shrink-0 text-zinc-500" />
        {TEXT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            data-target="dense"
            aria-label={`Text colour ${color}`}
            aria-pressed={style.color === color}
            onClick={() => onChange({ ...style, color })}
            className={cn(
              'h-8 min-h-8 w-5 rounded border transition-colors duration-150 ease-out',
              'focus-visible:ring-2 focus-visible:ring-red-500',
              style.color === color
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
          aria-pressed={style.highlight === null}
          onClick={() => onChange({ ...style, highlight: null })}
          className={cn(
            'grid h-8 min-h-8 w-5 place-items-center rounded border text-[10px] transition-colors duration-150 ease-out',
            'focus-visible:ring-2 focus-visible:ring-red-500',
            style.highlight === null
              ? 'border-zinc-50 text-zinc-200'
              : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 focus-visible:border-zinc-300',
          )}
        >
          off
        </button>
        {HIGHLIGHT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            data-target="dense"
            aria-label={`Highlight ${color}`}
            aria-pressed={style.highlight === color}
            onClick={() => onChange({ ...style, highlight: color })}
            className={cn(
              'h-8 min-h-8 w-5 rounded border transition-colors duration-150 ease-out',
              'focus-visible:ring-2 focus-visible:ring-red-500',
              style.highlight === color
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
