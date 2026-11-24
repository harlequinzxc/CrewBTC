import { CardTextBar } from './CardTextBar'
import { useFloatingTextBar } from './use-floating-text-bar'
import type { TextStyle } from '../../../types/card'

/**
 * The floating strip that holds the formatting bar while a text box is being edited.
 *
 * Split out of `CardSheet` when that file reached its line budget, and it is the right
 * seam: the sheet knows which card and zone are being edited, this knows only how to turn
 * a chosen style into an edit on the current selection.
 */
export interface TextBarLayerProps {
  readonly sheet: number
  readonly cell: number
  readonly zone: 'header' | 'body'
  readonly style: TextStyle
  readonly active: TextStyle
  readonly selection: { readonly start: number; readonly end: number } | null
  readonly onChange: (style: TextStyle) => void
  readonly onColor: (color: string) => void
}

export function TextBarLayer(props: TextBarLayerProps) {
  const ref = useFloatingTextBar(props.sheet, props.cell)
  return (
    <div ref={ref} data-testid="floating-text-pill" className="absolute z-20 w-max overflow-auto rounded-lg border border-hairline bg-[#131418] p-1 shadow-lg shadow-black/40" style={{ visibility: 'hidden' }}>
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
