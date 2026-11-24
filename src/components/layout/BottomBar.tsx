import { Maximize2, Minus, Plus, Undo2, Redo2 } from 'lucide-react'
import { MAX_ZOOM, MIN_ZOOM, zoomPercent } from '../../lib/zoom'

export interface BottomBarProps {
  readonly paper: { readonly widthMm: number; readonly heightMm: number }
  readonly sheetCount: number
  readonly scale: number
  readonly fitting: boolean
  readonly onStep: (direction: 1 | -1) => void
  readonly onFit: () => void
  readonly onUndo?: () => void
  readonly onRedo?: () => void
  readonly canUndo?: boolean
  readonly canRedo?: boolean
}

export function BottomBar({ paper, sheetCount, scale, fitting, onStep, onFit, onUndo, onRedo, canUndo, canRedo }: BottomBarProps) {
  const icon = 'inline-flex size-8 items-center justify-center rounded text-ink-secondary hover:bg-surface-active hover:text-ink-primary focus-visible:bg-surface-active focus-visible:text-ink-primary disabled:opacity-40'
  return <footer aria-label="Sheet status and zoom" className="relative flex h-9 shrink-0 items-center border-t border-hairline bg-surface-panel px-3 text-xs">
    <span className="tabular whitespace-nowrap text-ink-secondary">{paper.widthMm} × {paper.heightMm} mm · {sheetCount} {sheetCount === 1 ? 'sheet' : 'sheets'}</span>
    <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-0.5" aria-label="Sheet zoom">
      <button type="button" data-target="dense" aria-label="Zoom out" title="Zoom out" disabled={scale <= MIN_ZOOM + 1e-6} onClick={() => onStep(-1)} className={icon}><Minus aria-hidden className="size-3.5" /></button>
      <span aria-live="polite" aria-label={fitting ? 'Zoom level, fitted to width' : 'Zoom level'} title={fitting ? 'Fitted to the window width' : 'Set by hand'} className="tabular whitespace-nowrap px-1.5 text-ink-primary">{zoomPercent(scale)}%</span>
      <button type="button" data-target="dense" aria-label="Zoom in" title="Zoom in" disabled={scale >= MAX_ZOOM - 1e-6} onClick={() => onStep(1)} className={icon}><Plus aria-hidden className="size-3.5" /></button>
      <button type="button" data-target="dense" aria-label="Fit sheet to width" title="Fit sheet to width" onClick={onFit} className="ml-1 inline-flex h-8 items-center justify-center gap-1 rounded px-1.5 text-ink-secondary hover:bg-surface-active hover:text-ink-primary focus-visible:bg-surface-active focus-visible:text-ink-primary"><Maximize2 aria-hidden className="size-3" /><span>Fit</span></button>
    </div>
    <div className="ml-3 flex items-center gap-0.5" aria-label="Edit history">
      <button type="button" data-target="dense" aria-label="Undo edit" title="Undo edit (Ctrl/Cmd+Z)" disabled={!canUndo} onClick={onUndo} className={icon}><Undo2 aria-hidden className="size-4" /></button>
      <button type="button" data-target="dense" aria-label="Redo edit" title="Redo edit (Ctrl/Cmd+Shift+Z or Ctrl+Y)" disabled={!canRedo} onClick={onRedo} className={icon}><Redo2 aria-hidden className="size-4" /></button>
    </div>
  </footer>
}
