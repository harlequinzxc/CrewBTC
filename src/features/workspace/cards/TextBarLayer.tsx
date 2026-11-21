import { CardTextBar } from './CardTextBar'
import type { TextStyle } from '../../../types/card'

/**
 * The floating strip that holds the formatting bar while a text box is being edited.
 *
 * Split out of `CardSheet` when that file reached its line budget, and it is the right
 * seam: the sheet knows which card and zone are being edited, this knows only how to turn
 * a chosen style into an edit on the current selection.
 */
export interface TextBarLayerProps {
  readonly zone: 'header' | 'body'
  readonly style: TextStyle
  readonly active: TextStyle
  readonly selection: { readonly start: number; readonly end: number } | null
  readonly onChange: (style: TextStyle) => void
  readonly onColor: (color: string) => void
}

export function TextBarLayer(props: TextBarLayerProps) {
  return (
    /*
      Floating, never in flow.

      In flow it cost 32px of the pane's height the moment you clicked into a text box —
      the canvas shrank, so everything below the fold moved up under the pointer. Editing
      text must not move the page. Floating leaves the canvas geometry untouched, and it
      sits over the top of the sheet rather than over the box being typed into.
    */
    <div className="absolute inset-x-0 top-0 z-20 flex h-8 items-center border-b border-hairline bg-surface-panel px-2 shadow-lg shadow-black/20">
      <CardTextBar
        zone={props.zone}
        style={props.style}
        selection={props.selection}
        active={props.active}
        onChange={props.onChange}
        onColor={props.onColor}
      />
    </div>
  )
}
