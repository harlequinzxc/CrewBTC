import { cn } from '../../lib/cn'
import { HIGHLIGHT_SWATCHES, TEXT_SWATCHES } from '../../types/edit'
import type { TextStyle } from '../../types/edit'

export interface TextStyleBarProps {
  readonly band: 'header' | 'footer'
  readonly style: TextStyle
  readonly onChange: (style: TextStyle) => void
}

/**
 * Colour and highlight for the band being typed into.
 *
 * Deliberately small: two rows of swatches, no colour wheel, no picker dialog. A menu is
 * one more thing to dismiss in the middle of typing, and card text is a choice between a
 * handful of inks. Highlight is set per band, which matches how the text is stored.
 */
export function TextStyleBar(props: TextStyleBarProps) {
  const { style, band } = props

  return (
    <div className="flex items-center gap-3 border-t border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs">
      <span className="w-12 shrink-0 text-zinc-500">{band === 'header' ? 'Header' : 'Footer'}</span>

      <fieldset className="flex items-center gap-1">
        <legend className="sr-only">Text colour</legend>
        <span className="pr-1 text-zinc-500">Ink</span>
        {TEXT_SWATCHES.map((colour) => (
          <button
            key={colour}
            type="button"
            data-target="dense"
            aria-label={`Text colour ${colour}`}
            aria-pressed={style.color === colour}
            onClick={() => props.onChange({ ...style, color: colour })}
            className={cn(
              'min-h-8 rounded border px-1.5',
              style.color === colour
                ? 'border-sky-400 ring-1 ring-sky-400'
                : 'border-zinc-700 hover:border-zinc-500 focus-visible:border-zinc-400',
            )}
          >
            <span className="block size-3 rounded-sm" style={{ backgroundColor: colour }} />
          </button>
        ))}
      </fieldset>

      <fieldset className="flex items-center gap-1">
        <legend className="sr-only">Highlight</legend>
        <span className="pr-1 text-zinc-500">Highlight</span>
        {HIGHLIGHT_SWATCHES.map((colour) => (
          <button
            key={colour}
            type="button"
            data-target="dense"
            aria-label={`Highlight ${colour}`}
            aria-pressed={style.highlight === colour}
            onClick={() =>
              props.onChange({ ...style, highlight: style.highlight === colour ? null : colour })
            }
            className={cn(
              'min-h-8 rounded border px-1.5',
              style.highlight === colour
                ? 'border-sky-400 ring-1 ring-sky-400'
                : 'border-zinc-700 hover:border-zinc-500 focus-visible:border-zinc-400',
            )}
          >
            <span className="block size-3 rounded-sm" style={{ backgroundColor: colour }} />
          </button>
        ))}
        <button
          type="button"
          data-target="dense"
          onClick={() => props.onChange({ ...style, highlight: null })}
          disabled={style.highlight === null}
          className="min-h-8 rounded border border-zinc-700 px-1.5 text-[11px] text-zinc-300 hover:border-zinc-500 focus-visible:border-zinc-400 disabled:opacity-40"
        >
          None
        </button>
      </fieldset>
    </div>
  )
}
