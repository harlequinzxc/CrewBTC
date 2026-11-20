import { cn } from '../../lib/cn'
import type { IngestedDocument } from '../../types/document'
import type { PageRef } from '../../lib/imposition/sheet'
import { BatchQueue } from './BatchQueue'
import { DropZone } from './DropZone'

export type LeftTab = 'files'

export interface LeftPaneProps {
  readonly tab: LeftTab
  readonly onTabChange: (tab: LeftTab) => void
  readonly documents: readonly IngestedDocument[]
  readonly activeId: string | null
  readonly onSelectDocument: (id: string) => void
  readonly onAdd: () => void
  /** Files from the drop target, which may be a different count than the picker. */
  readonly onFiles: (files: readonly File[]) => void
  readonly onReRun: () => void
  readonly onClear: () => void
  readonly busy: boolean
  readonly pages: readonly PageRef[]
  readonly previews: Readonly<Record<string, string>>
  readonly selectedPage: number
  readonly onSelectPage: (index: number) => void
}

const TABS: readonly { readonly id: LeftTab; readonly label: string }[] = [
  { id: 'files', label: 'Files' },
]

/**
 * Left pane, as two tabs rather than two panes. The batch queue and the copy editor
 * are both "what am I working on", so they share the slot instead of stealing width
 * from the sheet — which is the thing you actually need to see.
 */
export function LeftPane(props: LeftPaneProps) {

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-950">
      <div role="tablist" aria-label="Workspace pane" className="flex h-9 shrink-0 border-b border-zinc-800">
        {TABS.map((tab) => {
          const isCurrent = props.tab === tab.id
          return (
            <button type="button" data-target="dense"
              key={tab.id}
              role="tab"
              aria-selected={isCurrent}
              onClick={() => props.onTabChange(tab.id)}
              className={cn(
                'flex min-h-8 flex-1 items-center justify-center gap-1.5 border-b-2 px-2 text-xs',
                isCurrent
                  ? 'border-sky-500 text-zinc-100'
                  : 'border-transparent text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200 focus-visible:bg-zinc-900 focus-visible:text-zinc-200',
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {props.tab === 'files' ? (
          <>
            {props.documents.length === 0 ? (
              <div className="p-2">
                <DropZone onFiles={props.onFiles} disabled={props.busy} />
              </div>
            ) : null}
            <div className="min-h-0 flex-1">
              <BatchQueue
                documents={props.documents}
                activeId={props.activeId}
                onSelect={props.onSelectDocument}
                onAdd={props.onAdd}
                onReRun={props.onReRun}
                onClear={props.onClear}
                busy={props.busy}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
