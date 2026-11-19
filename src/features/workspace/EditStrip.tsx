import { Check, RotateCcw, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import type { Placement } from '../../lib/imposition/sheet'
import type { EditTarget, PageEdit } from '../../types/edit'
import type { TextRegion } from '../../types/document'

export interface EditStripProps {
  readonly placement: Placement
  readonly blocks: readonly TextRegion[]
  readonly edit: PageEdit
  readonly onTextChange: (target: EditTarget, text: string) => void
  readonly onResetCell: () => void
  readonly onClose: () => void
}

/**
 * A single-row editor for the selected cell, so editing never covers the sheet.
 * Every block is listed with its current text; clearing a field removes the override
 * and restores the original, which is the only reset that makes sense per block.
 */
export function EditStrip(props: EditStripProps) {
  const { placement, blocks, edit } = props

  const overrideCount = Object.keys(edit.text).length
  const artChanged =
    edit.image.offsetXMm !== 0 || edit.image.offsetYMm !== 0 || edit.image.scale !== 1

  return (
    <div className="flex h-9 shrink-0 items-stretch border-t border-zinc-700 bg-zinc-900 text-xs">
      <div className="flex shrink-0 items-center gap-2 border-r border-zinc-800 px-3">
        <span className="tabular whitespace-nowrap font-medium text-zinc-200">
          Cell {placement.cellIndex + 1}
        </span>
        <span className="tabular whitespace-nowrap text-zinc-500">
          {placement.pageNumber} · {Math.round(edit.image.scale * 100)}%
        </span>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-2">
        {blocks.length === 0 ? (
          <span className="whitespace-nowrap px-1 text-zinc-500">
            No text on this page — move or zoom the artwork with the buttons in the cell.
          </span>
        ) : (
          blocks.map((block, index) => {
            const edited = edit.text[block.id] !== undefined
            return (
              <label
                key={block.id}
                className="flex shrink-0 items-center gap-1.5"
                title={`Block ${index + 1}`}
              >
                <span
                  className={`tabular w-4 text-right ${edited ? 'text-amber-400' : 'text-zinc-500'}`}
                >
                  {index + 1}
                </span>
                <input
                  value={edit.text[block.id] ?? block.text}
                  onChange={(event) =>
                    props.onTextChange(
                      {
                        kind: 'text',
                        cellIndex: placement.cellIndex,
                        blockId: block.id,
                        documentId: placement.documentId,
                        pageNumber: placement.pageNumber,
                      },
                      event.target.value,
                    )
                  }
                  aria-label={`Cell ${placement.cellIndex + 1} text block ${index + 1}`}
                  className="w-40 rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-zinc-100 outline-none focus-visible:border-sky-400"
                />
                {edited ? (
                  <span className="text-amber-400" aria-label="Edited">
                    <Check aria-hidden="true" strokeWidth={2} className="size-3" />
                  </span>
                ) : null}
              </label>
            )
          })
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 px-2">
        <span className="tabular whitespace-nowrap text-zinc-500">
          {overrideCount} text{artChanged ? ' · art moved' : ''}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={props.onResetCell}
          disabled={overrideCount === 0 && !artChanged}
        >
          <RotateCcw aria-hidden="true" strokeWidth={2} className="size-3.5" />
          Reset
        </Button>
        <button type="button" data-target="dense"
          onClick={props.onClose}
          aria-label="Done editing this cell"
          className="grid min-h-8 min-w-8 place-items-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 focus-visible:bg-zinc-800 focus-visible:text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
        >
          <X aria-hidden="true" strokeWidth={2} className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
