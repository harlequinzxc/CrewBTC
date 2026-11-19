import { DropZone } from './DropZone'
import { SheetPreview } from './SheetPreview'
import { Button } from '../../components/ui/Button'
import type { PageRef } from '../../lib/imposition/sheet'
import type { GridLayout, SheetSettings } from '../../types/imposition'
import type { ImageTransform } from '../../types/edit'

export interface CentrePaneProps {
  readonly documentsLoaded: boolean
  readonly busy: boolean
  readonly onFiles: (files: readonly File[]) => void
  readonly onAdd: () => void
  readonly sheet: SheetSettings
  readonly grid: GridLayout
  readonly pages: readonly PageRef[]
  readonly showCutMarks: boolean
  readonly texts: Readonly<Record<string, string>>
  readonly images: Readonly<Record<string, ImageTransform>>
  readonly selectedCell: number | null
  readonly onSelectCell: (cellIndex: number | null) => void
  readonly onImageChange: (index: number, image: ImageTransform) => void
  readonly onResetImage: (index: number) => void
}

/** The sheet, or the drop target when there is nothing to show yet. */
export function CentrePane(props: CentrePaneProps) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-zinc-950">
      {!props.documentsLoaded ? (
        <div className="grid min-h-0 flex-1 place-items-center overflow-hidden p-6">
          <div className="w-full max-w-sm">
            <DropZone onFiles={props.onFiles} disabled={props.busy} />
            <Button
              variant="primary"
              fullWidth
              className="mt-3"
              onClick={props.onAdd}
              disabled={props.busy}
              loading={props.busy}
            >
              Add PDFs
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <SheetPreview
            settings={props.sheet}
            grid={props.grid}
            pages={props.pages}
            showCutMarks={props.showCutMarks}
            texts={props.texts}
            images={props.images}
            selectedCell={props.selectedCell}
            onSelectCell={props.onSelectCell}
            onImageChange={props.onImageChange}
            onResetImage={props.onResetImage}
          />
        </div>
      )}
    </div>
  )
}
