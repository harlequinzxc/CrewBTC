import { Maximize2, Minus, PanelRightClose, PanelRightOpen, Plus, Settings2 } from 'lucide-react'
import { cn } from '../../lib/cn'
import { ExportControl } from './ExportControl'
import { CHANGELOG } from '../../data/changelog'

/** The shipped build, read from the changelog so the two cannot drift apart. */
const APP_VERSION = CHANGELOG[0]?.version ?? 'unknown'
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
  /** Whether the right rail is showing. It mirrors the Files rail: give the sheet width back. */
  readonly inspectorOpen: boolean
  readonly onToggleInspector: () => void
}

const iconButton = cn(
  'grid size-7 place-items-center rounded-md text-ink-secondary',
  'transition-colors duration-150 ease-out',
  'hover:bg-surface-active hover:text-ink-primary focus-visible:bg-surface-active focus-visible:text-ink-primary',
  'disabled:opacity-40 disabled:hover:bg-transparent disabled:focus-visible:bg-transparent',
)

export function TopBar(props: TopBarProps) {
  const { scale } = props
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
        {/*
          The version, quietly. It answers "am I actually running the build I think I am?"
          — a question this app forces on you, because it is a PWA and an update only takes
          over once the page has been reloaded into it. Muted and small: it is a fact, not
          a control.
        */}
        <span className="tabular text-[10px] leading-none text-ink-muted/70" aria-label={`Version ${APP_VERSION}`}>
          v{APP_VERSION}
        </span>
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
        {/* The real scale, always: a percentage is how you know you are zoomed in for
            detail. Labelled as fitted while it follows the window, so "283%" never reads
            as a scale the user chose. */}
        <span
          aria-live="polite"
          aria-label={props.fitting ? 'Zoom level, fitted to width' : 'Zoom level'}
          title={props.fitting ? 'Fitted to the window width' : 'Set by hand'}
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
        {/*
          A momentary action, not a toggle. There is deliberately no `aria-pressed` and no
          accent fill here: the app already *rests* in width-fit, so a permanently lit Fit
          was describing the default state while looking like a chosen one, and a user who
          clicked it had no way to tell whether anything had happened. The readout above
          says whether the scale is derived; this button only ever says "go back to it".
        */}
        <button
          type="button"
          data-target="dense"
          aria-label="Fit sheet to width"
          onClick={props.onFit}
          className={cn(iconButton, 'ml-1 w-auto gap-1 px-1.5')}
        >
          <Maximize2 aria-hidden className="size-3" />
          <span className="text-[11px]">Fit</span>
        </button>
      </div>

      <button
        type="button"
        data-target="dense"
        aria-label={props.inspectorOpen ? 'Hide inspector' : 'Show inspector'}
        aria-pressed={props.inspectorOpen}
        title={props.inspectorOpen ? 'Hide inspector' : 'Show inspector'}
        onClick={props.onToggleInspector}
        className={cn(iconButton, 'hidden lg:grid')}
      >
        {props.inspectorOpen ? (
          <PanelRightClose aria-hidden className="size-3.5" />
        ) : (
          <PanelRightOpen aria-hidden className="size-3.5" />
        )}
      </button>

      <button
        type="button"
        data-target="dense"
        aria-label="Settings"
        onClick={props.onOpenSettings}
        className={iconButton}
      >
        <Settings2 aria-hidden className="size-3.5" />
      </button>

      <ExportControl
        hasBatch={props.hasBatch}
        hasMoreThanOneSheet={props.hasMoreThanOneSheet}
        exporting={props.exporting}
        onExportCurrent={props.onExportCurrent}
        onExportAll={props.onExportAll}
      />
    </header>
  )
}
