import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Download, Maximize2, Minus, Plus, Settings2 } from 'lucide-react'
import { cn } from '../../lib/cn'
import { APP_NAME } from '../../config/brand'
import { MAX_ZOOM, MIN_ZOOM, zoomPercent } from '../../lib/zoom'

/**
 * The only chrome above the sheet: identity, zoom, and the two things you came to do.
 *
 * One bar, 48px, no navigation rail beside it — the app has one screen, and a rail to
 * switch between "the thing" and "settings" cost 260px of the width the sheet needed.
 * Settings is a dialog behind the gear; export is a single control whose second option
 * lives in a menu rather than beside it as a second identical button.
 */

export interface TopBarProps {
  readonly paper: { readonly widthMm: number; readonly heightMm: number }
  readonly sheetCount: number
  readonly scale: number
  readonly fitting: boolean
  readonly onStep: (direction: 1 | -1) => void
  readonly onFit: () => void
  readonly onOpenSettings: () => void
  readonly onExportCurrent: () => void
  readonly onExportAll: () => void
  /** False when there is only one sheet, so "all sheets" would do the same thing. */
  readonly hasMoreThanOneSheet: boolean
  readonly exporting: boolean
  readonly hasBatch: boolean
}

const iconButton = cn(
  'grid size-7 place-items-center rounded-md text-ink-secondary',
  'transition-colors duration-150 ease-out',
  'hover:bg-surface-active hover:text-ink-primary focus-visible:bg-surface-active focus-visible:text-ink-primary',
  'disabled:opacity-40 disabled:hover:bg-transparent disabled:focus-visible:bg-transparent',
)

export function TopBar(props: TopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { scale } = props

  // A click anywhere else closes the sheet menu, and Escape does the same.
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (event: PointerEvent): void => {
      if (menuRef.current !== null && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  // The paper and how many of it. The grid arithmetic lives in the inspector, beside the
  // numbers that produce it, so neither place repeats the other.
  const summary = `${props.paper.widthMm} × ${props.paper.heightMm} mm · ${props.sheetCount} ${
    props.sheetCount === 1 ? 'sheet' : 'sheets'
  }`

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-hairline bg-surface-panel px-3">
      {/* The real app mark, not a stand-in letter: it is the same artwork as the favicon
          and the installed icon, so the tab, the dock and the window agree. */}
      <div className="flex shrink-0 items-center gap-2">
        <img
          src="/favicon.svg"
          alt=""
          width={20}
          height={20}
          aria-hidden="true"
          className="size-5 shrink-0 rounded-[5px]"
        />
        <span className="text-[13px] font-medium tracking-tight text-ink-primary">{APP_NAME}</span>
      </div>

      <div className="ml-2 flex items-center gap-2 border-l border-hairline pl-3">
        <span className="tabular text-[11px] text-ink-muted">{summary}</span>
      </div>

      {/* Zoom sits dead centre: it is the control you reach for most while laying out. */}
      <div className="mx-auto flex items-center gap-0.5" aria-label="Sheet zoom">
        <button
          type="button"
          data-target="dense"
          aria-label="Zoom out"
          disabled={scale <= MIN_ZOOM + 1e-6}
          onClick={() => props.onStep(-1)}
          className={iconButton}
        >
          <Minus aria-hidden className="size-3.5" />
        </button>
        {/*
          The real scale, always — a percentage is how you know whether you are zoomed in
          for detail or looking at the whole page. In Fit mode it is the *result* of the
          fit, labelled as such, so "283%" never reads as a scale the user chose.
        */}
        <span
          aria-live="polite"
          aria-label={props.fitting ? 'Zoom level, fitted' : 'Zoom level'}
          title={props.fitting ? 'Fitted to the window' : 'Set by hand'}
          className={cn(
            'tabular h-6 whitespace-nowrap rounded px-1.5 text-center text-[12px] leading-6',
            props.fitting ? 'text-ink-secondary' : 'text-ink-primary',
          )}
        >
          {zoomPercent(scale)}%
        </span>
        <button
          type="button"
          data-target="dense"
          aria-label="Zoom in"
          disabled={scale >= MAX_ZOOM - 1e-6}
          onClick={() => props.onStep(1)}
          className={iconButton}
        >
          <Plus aria-hidden className="size-3.5" />
        </button>
        <button
          type="button"
          data-target="dense"
          aria-label="Fit to window"
          aria-pressed={props.fitting}
          onClick={props.onFit}
          className={cn(
            iconButton,
            'ml-1 w-auto gap-1 px-1.5',
            // Active state on Fit itself, so the mode is readable at a glance: a
            // highlighted Fit button means the percentage beside it is derived, not chosen.
            props.fitting && 'bg-accent/15 text-accent-bright',
            props.fitting && 'hover:bg-accent/20 hover:text-accent-bright focus-visible:bg-accent/20 focus-visible:text-accent-bright',
          )}
        >
          <Maximize2 aria-hidden className="size-3" />
          <span className="text-[11px]">Fit</span>
        </button>
      </div>

      <button
        type="button"
        data-target="dense"
        aria-label="Settings"
        onClick={props.onOpenSettings}
        className={iconButton}
      >
        <Settings2 aria-hidden className="size-3.5" />
      </button>

      <div ref={menuRef} className="relative flex shrink-0">
        <button
          type="button"
          data-target="dense"
          aria-label="Export PDF"
          disabled={!props.hasBatch || props.exporting}
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
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          disabled={!props.hasBatch || props.exporting}
          onClick={() => setMenuOpen((open) => !open)}
          className={cn(
            'grid h-7 w-6 place-items-center rounded-r-md border-l border-black/25 bg-accent-solid text-white',
            'transition-colors duration-150 ease-out',
            'hover:bg-accent-bright focus-visible:bg-accent-bright',
            'disabled:opacity-40 disabled:hover:bg-accent-solid disabled:focus-visible:bg-accent-solid',
          )}
        >
          <ChevronDown aria-hidden className="size-3" />
        </button>

        {menuOpen ? (
          <div
            role="menu"
            className="absolute right-0 top-8 z-20 w-52 overflow-hidden rounded-lg border border-hairline bg-surface-raised shadow-xl shadow-black/50"
          >
            <button
              type="button"
              role="menuitem"
              data-target="dense"
              onClick={() => {
                setMenuOpen(false)
                props.onExportCurrent()
              }}
              className="block min-h-7 w-full px-3 py-2 text-left text-[12px] text-ink-primary hover:bg-surface-active focus-visible:bg-surface-active"
            >
              This sheet
            </button>
            {/* Shown only when it would produce something different. A menu item that
                duplicates the button above it is the thing this redesign removed. */}
            {props.hasMoreThanOneSheet ? (
              <button
                type="button"
                role="menuitem"
                data-target="dense"
                onClick={() => {
                  setMenuOpen(false)
                  props.onExportAll()
                }}
                className="block min-h-7 w-full px-3 py-2 text-left text-[12px] text-ink-primary hover:bg-surface-active focus-visible:bg-surface-active"
              >
                All sheets
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  )
}
