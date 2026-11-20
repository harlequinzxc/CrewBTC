import { BatchQueue } from './BatchQueue'
import type { IngestedDocument } from '../../types/document'
import type { PagePlacement } from './sheet-navigation'

/**
 * The Files queue, as a panel rather than a tab strip.
 *
 * There was one tab ("Files") on a rail with one item, above one component. That is a
 * navigation control for a navigation problem the app does not have, and it cost 36px of
 * vertical space plus a sky-blue underline to say nothing.
 */
export interface LeftPaneProps {
  readonly documents: readonly IngestedDocument[]
  readonly activeId: string | null
  readonly onSelectDocument: (id: string) => void
  readonly onAdd: () => void
  readonly onReRun: () => void
  readonly onClear: () => void
  readonly busy: boolean
  readonly placements: ReadonlyMap<string, ReadonlyMap<number, PagePlacement>>
  readonly onReveal: (document: IngestedDocument) => void
}

export function LeftPane(props: LeftPaneProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-panel">
      <BatchQueue
        documents={props.documents}
        activeId={props.activeId}
        onSelect={props.onSelectDocument}
        onAdd={props.onAdd}
        onReRun={props.onReRun}
        onClear={props.onClear}
        busy={props.busy}
        placements={props.placements}
        onReveal={props.onReveal}
      />
    </div>
  )
}
