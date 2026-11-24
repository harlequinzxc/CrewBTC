import { Eye, Maximize2, Minus, PanelRightClose, PanelRightOpen, Plus, Settings2 } from 'lucide-react'
import { cn } from '../../lib/cn'
import { ExportControl } from './ExportControl'
import { ProjectMenu } from './ProjectMenu'
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
  /** Starts the click probe; see `use-click-probe`. Absent in tests that do not need it. */
  readonly onProbe?: () => void
  readonly onFit: () => void
  readonly onOpenSettings: () => void
  readonly onNewProject?: () => void
  readonly onPrintSelection?: () => void
  readonly anyProjectCards?: boolean
  readonly hasProject?: boolean
  readonly onSaveProject?: () => void
  readonly onOpenProject?: () => void
  readonly projectBusy?: boolean
  readonly onExportCurrent: () => void
  readonly onExportAll: () => void
  /** False when there is only one sheet, so "all sheets" would do the same thing. */
  readonly hasMoreThanOneSheet: boolean
  readonly exporting: boolean
  readonly hasBatch: boolean
  readonly reviewLabel?: string
  readonly onReview?: () => void
  readonly previewOpen?: boolean
  readonly onTogglePreview?: () => void
  /** Whether the right rail is showing. It mirrors the Files rail: give the sheet width back. */
  readonly inspectorOpen: boolean
  readonly onToggleInspector: () => void
}

const iconButton = cn(
  'inline-flex size-8 items-center justify-center rounded-md text-ink-secondary',
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
    <header className="relative flex h-12 shrink-0 items-center gap-3 border-b border-hairline bg-surface-panel px-3">
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
        {/*
          Starts the click probe. Small, quiet, and deliberately here: it is the answer to
          "I clicked the text and nothing happened", and asking the user to find a keyboard
          shortcut is one assumption too many when the shortcut is the thing under suspicion.
        */}
        <button
          type="button"
          data-target="dense"
          aria-label="Check what a click lands on"
          title="Check what a click lands on"
          onClick={() => props.onProbe?.()}
          className="grid size-5 place-items-center rounded text-ink-muted/60 transition-colors duration-150 ease-out hover:text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3 fill-none stroke-current stroke-[1.4]">
            <circle cx="7" cy="7" r="4.2" />
            <path d="M10.2 10.2 14 14" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="ml-2 flex items-center gap-2 border-l border-hairline pl-3">
        <span className="tabular text-[11px] text-ink-muted">{summary}</span>
      </div>

      <ProjectMenu busy={props.projectBusy ?? false} hasProject={props.hasProject ?? props.hasBatch} onNew={props.onNewProject} onOpen={props.onOpenProject} onSave={props.onSaveProject} />
      {/* Zoom sits dead centre: it is the control you reach for most while laying out. */}
      <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-0.5" aria-label="Sheet zoom">
        <button
          type="button"
          data-target="dense"
          aria-label="Zoom out"
          title="Zoom out"
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
          title="Zoom in"
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
          title="Fit sheet to width"
          onClick={props.onFit}
          className={cn(iconButton, 'ml-1 w-auto gap-1 px-1.5')}
        >
          <Maximize2 aria-hidden className="size-3" />
          <span className="text-[11px]">Fit</span>
        </button>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
      {props.hasBatch && props.reviewLabel !== undefined ? <button type="button" data-target="dense" title="Review print issues" onClick={props.onReview} className="min-h-8 shrink-0 rounded border border-hairline px-2 text-xs text-ink-primary hover:bg-surface-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">{props.reviewLabel}</button> : null}
      <button
        type="button"
        data-target="dense"
        aria-label={props.inspectorOpen ? 'Hide inspector' : 'Show inspector'}
        aria-pressed={props.inspectorOpen}
        title={props.inspectorOpen ? 'Hide inspector' : 'Show inspector'}
        onClick={props.onToggleInspector}
        className={cn(iconButton, 'hidden lg:inline-flex')}
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
        title="Settings"
        onClick={props.onOpenSettings}
        className={iconButton}
      >
        <Settings2 aria-hidden className="size-3.5" />
      </button>

      <button id="pdf-preview-toggle" type="button" data-target="dense" aria-label="Preview PDF" title="Preview the generated PDF" aria-pressed={props.previewOpen ?? false} disabled={!props.hasBatch} onClick={props.onTogglePreview} className={cn(iconButton, 'w-auto gap-1 px-1.5', props.previewOpen && 'bg-surface-active text-ink-primary')}>
        <Eye aria-hidden className="size-4" /><span className="text-[11px]">Preview</span>
      </button>
      <ExportControl
        hasBatch={props.hasBatch}
        hasMoreThanOneSheet={props.hasMoreThanOneSheet}
        exporting={props.exporting || (props.projectBusy ?? false)}
        hasProjectCards={props.anyProjectCards ?? props.hasBatch}
        onCustomSelection={props.onPrintSelection}
        onExportCurrent={props.onExportCurrent}
        onExportAll={props.onExportAll}
      />
      </div>
    </header>
  )
}
