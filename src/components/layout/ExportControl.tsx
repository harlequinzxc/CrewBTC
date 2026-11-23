import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Download } from 'lucide-react'
import { cn } from '../../lib/cn'

/**
 * Export, as one control with sheet and custom-selection options.
 *
 * A split button rather than two identical buttons side by side: "Export" does the thing
 * you meant 95% of the time, and "all sheets" is the qualifier behind the chevron. The
 * menu item for one sheet is always there and the one for all sheets only appears when
 * there is more than one, so nothing in the menu does what the button beside it does.
 *
 * Split out of `TopBar` so the bar stays a layout: identity, zoom, and the actions that
 * live at its edges.
 */
export interface ExportControlProps {
  readonly hasBatch: boolean
  readonly hasMoreThanOneSheet: boolean
  readonly exporting: boolean
  readonly onExportCurrent: () => void
  readonly onExportAll: () => void
  readonly hasProjectCards?: boolean
  readonly onCustomSelection?: (() => void) | undefined
}

const item = cn(
  'block min-h-7 w-full px-3 py-2 text-left text-[12px] text-ink-primary',
  'hover:bg-surface-active focus-visible:bg-surface-active',
)

export function ExportControl(props: ExportControlProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  // A click anywhere else closes the menu, and Escape does the same.
  useEffect(() => {
    if (!open) return
    const onDown = (event: PointerEvent): void => {
      if (root.current !== null && !root.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const disabled = !props.hasBatch || props.exporting
  const menuDisabled = (!props.hasBatch && !props.hasProjectCards) || props.exporting

  return (
    <div ref={root} className="relative flex shrink-0">
      <button
        type="button"
        data-target="dense"
        aria-label="Export PDF"
        disabled={disabled}
        onClick={props.onExportCurrent}
        className={cn(
          'flex h-7 items-center gap-1.5 rounded-l-md bg-accent-solid pl-2.5 pr-2 text-[12px] font-medium text-white',
          'transition-colors duration-150 ease-out',
          'hover:bg-accent-bright focus-visible:bg-accent-bright',
          'disabled:opacity-40 disabled:hover:bg-accent-solid disabled:focus-visible:bg-accent-solid',
        )}
      >
        <Download aria-hidden className="size-3.5" />
        Export
      </button>
      <button
        type="button"
        data-target="dense"
        aria-label="Export options"
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={menuDisabled}
        onClick={() => setOpen((was) => !was)}
        className={cn(
          'grid h-7 w-6 place-items-center rounded-r-md border-l border-black/25 bg-accent-solid text-white',
          'transition-colors duration-150 ease-out',
          'hover:bg-accent-bright focus-visible:bg-accent-bright',
          'disabled:opacity-40 disabled:hover:bg-accent-solid disabled:focus-visible:bg-accent-solid',
        )}
      >
        <ChevronDown aria-hidden className="size-3" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-8 z-20 w-52 overflow-hidden rounded-lg border border-hairline bg-surface-raised shadow-xl shadow-black/50"
        >
          <button
            type="button"
            role="menuitem"
            data-target="dense"
            disabled={disabled}
            onClick={() => {
              setOpen(false)
              props.onExportCurrent()
            }}
            className={item}
          >
            This sheet
          </button>
          {/* Only when it would do something different. */}
          {props.hasMoreThanOneSheet ? (
            <button
              type="button"
              role="menuitem"
              data-target="dense"
              onClick={() => {
                setOpen(false)
                props.onExportAll()
              }}
              className={item}
            >
              All sheets
            </button>
          ) : null}
          {props.onCustomSelection === undefined ? null : (
            <button type="button" role="menuitem" data-target="dense" disabled={!props.hasProjectCards} onClick={() => { setOpen(false); props.onCustomSelection?.() }} className={item}>
              Custom selection
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}
