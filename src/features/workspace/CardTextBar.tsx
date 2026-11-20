import { Bold, Eraser } from 'lucide-react'
import { cn } from '../../lib/cn'
import { DEFAULT_TEXT_STYLE } from '../../types/card'
import type { TextStyle } from '../../types/card'
import { CALLOUT_PRESETS, matchingPreset, presetStyle } from '../../types/callouts'

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

/** Keeps focus (and therefore the selection) in the text box while a control is used. */
const keepFocus = (event: React.PointerEvent): void => event.preventDefault()

/**
 * The callout presets, Bold, and a way back to plain text.
 *
 * It used to be four text swatches and five highlight swatches — nine controls, and each
 * tag on a card took two of them in the right order. Two presets replace the pair with one
 * click and, more to the point, with one meaning: CROCKERIES is what the dish is served in
 * and CONDIMENTS is what it is served with, and the colours exist to make that distinction
 * readable rather than to be chosen for its own sake.
 *
 * The bar follows the selection, and says which it will change. With characters selected a
 * preset restyles only those; with the caret collapsed it restyles the whole box. Every
 * button keeps the caret where it is, because a preset that deselects the word it was meant
 * for does nothing and cannot be retried without finding the word again.
 */
export function CardTextBar(props: CardTextBarProps) {
  const { style, zone, selection, active, onChange } = props
  const label = zone === 'header' ? 'top text' : 'bottom text'
  // Only a selection is announced. "whole box" was a quiet label for the ordinary state —
  // every box starts that way, so it said nothing and took room from the presets.
  const styled = selection !== null ? 'selection' : null
  const current = matchingPreset(active)

  const buttonClass =
    'flex h-6 min-h-6 items-center gap-1 rounded px-1.5 text-[10px] font-medium uppercase ' +
    'tracking-[0.04em] transition-colors duration-150 ease-out'

  return (
    <div data-testid="card-text-bar" className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-ink-secondary">
        {label}
      </span>
      {styled === null ? null : (
        <span className="text-[10px] text-ink-muted">{styled}</span>
      )}

      <fieldset className="flex items-center gap-1 border-0 p-0">
        <legend className="sr-only">Recipe callout</legend>
        {CALLOUT_PRESETS.map((preset) => {
          const on = current?.id === preset.id
          return (
            <button
              key={preset.id}
              type="button"
              data-target="dense"
              data-preset={preset.id}
              aria-pressed={on}
              aria-label={`${preset.label} callout`}
              title={preset.meaning}
              onPointerDown={keepFocus}
              // Clicking an active preset again clears it, so a mis-tag is one click to
              // undo and does not require finding the Eraser.
              onClick={() => onChange(on ? { ...style, highlight: null } : presetStyle(preset))}
              className={cn(
                buttonClass,
                'border',
                on
                  ? 'border-ink-primary ring-1 ring-ink-primary'
                  : 'border-hairline hover:border-hairline-strong focus-visible:border-ink-primary',
              )}
              style={{ background: preset.highlight, color: preset.color }}
            >
              {preset.label}
            </button>
          )
        })}
      </fieldset>

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
            'grid h-6 min-h-6 w-6 place-items-center rounded transition-colors duration-150 ease-out',
            'hover:bg-surface-active focus-visible:bg-surface-active',
            active.bold ? 'bg-surface-active text-ink-primary' : 'text-ink-secondary',
          )}
        >
          <Bold aria-hidden className="size-3.5" />
        </button>

        {/*
          Clear formatting, as a labelled button rather than the old `off` chip. The chip
          only cleared a highlight; this puts the box back to the default look — plain ink,
          no fill, no capitals, left aligned — which is what "revert to normal text" means
          once a preset can change weight, ink and case at once.
        */}
        <button
          type="button"
          data-target="dense"
          aria-label="Clear formatting"
          onPointerDown={keepFocus}
          onClick={() => onChange(DEFAULT_TEXT_STYLE)}
          className={cn(
            buttonClass,
            'text-ink-secondary hover:bg-surface-active focus-visible:bg-surface-active',
          )}
        >
          <Eraser aria-hidden className="size-3.5" />
          <span className="sr-only">Clear formatting</span>
        </button>
      </fieldset>
    </div>
  )
}
