import { CircleCheck, Eye, FilePlus2, FolderOpen, Save, Settings, TriangleAlert } from 'lucide-react'
import { cn } from '../../lib/cn'
import { ExportControl } from './ExportControl'
import { CHANGELOG } from '../../data/changelog'
import { APP_NAME } from '../../config/brand'

const APP_VERSION = CHANGELOG[0]?.version ?? 'unknown'
export interface TopBarProps {
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
  readonly hasMoreThanOneSheet: boolean
  readonly exporting: boolean
  readonly hasBatch: boolean
  readonly hasPrintableCards?: boolean
  readonly reviewStatus?: 'checking' | 'error' | 'ready'
  readonly issueCount?: number
  readonly previewOpen?: boolean
  readonly onTogglePreview?: () => void
}

const baseButton = 'inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded px-1.5 text-xs hover:bg-surface-active focus-visible:bg-surface-active disabled:opacity-40'
const button = `${baseButton} text-ink-secondary hover:text-ink-primary focus-visible:text-ink-primary`
export function TopBar(props: TopBarProps) {
  const canCheck = props.hasBatch && (props.hasPrintableCards ?? true)
  const checking = props.reviewStatus === 'checking'
  const error = props.reviewStatus === 'error'
  const count = props.issueCount ?? 0
  const label = !canCheck ? 'No cards' : checking ? 'Checking…' : error ? 'Check unavailable' : count === 0 ? 'Ready for export' : `${count} ${count === 1 ? 'issue' : 'issues'}`
  return <header className="flex h-12 shrink-0 items-center gap-2 border-b border-hairline bg-surface-panel px-3 text-xs">
    <div className="flex shrink-0 items-center gap-2 text-ink-primary">
      <img src="/favicon.svg" alt="" width={20} height={20} aria-hidden="true" className="size-5 shrink-0 rounded-[5px]" />
      <span className="font-medium tracking-tight">{APP_NAME}</span>
      <span className="tabular text-ink-muted" aria-label={`Version ${APP_VERSION}`}>v{APP_VERSION}</span>
    </div>
    <div className="flex shrink-0 items-center gap-0.5 border-l border-hairline pl-2">
      <button type="button" data-target="dense" aria-label="New project" title="New project" aria-busy={props.projectBusy} disabled={props.projectBusy} onClick={props.onNewProject} className={button}><FilePlus2 aria-hidden className="size-4" /><span>New</span></button>
      <button type="button" data-target="dense" aria-label="Open project" title="Open editable project" aria-busy={props.projectBusy} disabled={props.projectBusy} onClick={props.onOpenProject} className={button}><FolderOpen aria-hidden className="size-4" /><span>Open</span></button>
      <button type="button" data-target="dense" aria-label="Save project" title="Save editable project" aria-busy={props.projectBusy} disabled={props.projectBusy || !(props.hasProject ?? props.hasBatch)} onClick={props.onSaveProject} className={button}><Save aria-hidden className="size-4" /><span>Save</span></button>
    </div>
    <div className="ml-auto flex shrink-0 items-center gap-1">
      <output title="Print review status; details are in the inspector" className={cn('inline-flex h-8 items-center gap-1 px-1.5 text-xs', !canCheck || checking || error ? 'text-ink-secondary' : count === 0 ? 'text-emerald-400' : 'text-amber-400')}>
        {canCheck && !checking && !error ? count === 0 ? <CircleCheck aria-hidden className="size-4" /> : <TriangleAlert aria-hidden className="size-4" /> : null}<span>{label}</span>
      </output>
      <button type="button" data-target="dense" aria-label="Settings" title="Settings" onClick={props.onOpenSettings} className={button}><Settings aria-hidden className="size-4" /><span>Settings</span></button>
      <button id="pdf-preview-toggle" type="button" data-target="dense" aria-label="Preview PDF" title="Preview the generated PDF" aria-pressed={props.previewOpen ?? false} disabled={!props.hasBatch} onClick={props.onTogglePreview} className={cn(button, props.previewOpen && 'bg-surface-active text-ink-primary')}><Eye aria-hidden className="size-4" /><span>Preview</span></button>
      <ExportControl hasBatch={props.hasBatch} hasMoreThanOneSheet={props.hasMoreThanOneSheet} exporting={props.exporting || (props.projectBusy ?? false)} hasProjectCards={props.anyProjectCards ?? props.hasBatch} onCustomSelection={props.onPrintSelection} onExportCurrent={props.onExportCurrent} onExportAll={props.onExportAll} />
    </div>
  </header>
}
