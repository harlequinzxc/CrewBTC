import { useMemo } from 'react'
import { Type } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { PageRef } from '../../lib/imposition/sheet'

export interface TextTabProps {
  readonly pages: readonly PageRef[]
  /** One preview per source page, keyed `file#page`, shown beside the field. */
  readonly previews: Readonly<Record<string, string>>
  readonly texts: Readonly<Record<string, string>>
  readonly selectedPage: number
  readonly onSelectPage: (index: number) => void
  readonly onChange: (index: number, text: string) => void
}

/**
 * The Text tab: every page in the batch listed on the left, one big paste-able box on
 * the right. Deliberately one field per page rather than a row per extracted line —
 * pasting a whole block of copy is the actual job, and splitting it into fields made
 * that job harder.
 *
 * What goes on the card is decided by the first line: a header, then the footer, with
 * the picture between them. The hint says so, so the behaviour is legible rather than
 * something you discover on paper.
 */
export function TextTab(props: TextTabProps) {
  const { pages, selectedPage } = props
  const current = pages[selectedPage]

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-zinc-800 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Text</h2>
        <p className="mt-1 text-[11px] leading-snug text-zinc-500">
          One box per page. Paste your copy; the first line becomes the header and the
          rest becomes the footer. The picture sits between them.
        </p>
      </div>

      {current === undefined ? (
        <p className="px-3 py-4 text-xs text-zinc-500">Add PDFs to start writing copy.</p>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-2">
            <div className="flex items-center gap-2">
              <button type="button" data-target="dense"
                onClick={() => props.onSelectPage(Math.max(0, selectedPage - 1))}
                disabled={selectedPage === 0}
                aria-label="Previous page"
                className="min-h-8 rounded border border-zinc-700 px-2 text-xs text-zinc-300 hover:bg-zinc-800 focus-visible:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500 disabled:opacity-40"
              >
                ←
              </button>
              <span className="tabular min-w-0 flex-1 truncate text-xs text-zinc-300">
                Page {current.pageNumber} of {current.fileName}
              </span>
              <button type="button" data-target="dense"
                onClick={() =>
                  props.onSelectPage(Math.min(pages.length - 1, selectedPage + 1))
                }
                disabled={selectedPage >= pages.length - 1}
                aria-label="Next page"
                className="min-h-8 rounded border border-zinc-700 px-2 text-xs text-zinc-300 hover:bg-zinc-800 focus-visible:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500 disabled:opacity-40"
              >
                →
              </button>
            </div>

            <CardSketch
              text={props.texts[`${selectedPage}`] ?? ''}
              preview={props.previews[`${current.fileName}#${current.pageNumber}`]}
            />

            <label htmlFor="cell-copy" className="text-xs font-medium text-zinc-300">
              Copy for this page
            </label>
            <textarea
              id="cell-copy"
              value={props.texts[`${selectedPage}`] ?? ''}
              onChange={(event) => props.onChange(selectedPage, event.target.value)}
              rows={9}
              placeholder={'Limited Edition\nHand-numbered, 2026'}
              className="w-full resize-y rounded border border-zinc-700 bg-zinc-950 p-2 text-base leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-600 focus-visible:border-sky-400"
            />
            <p className="text-[11px] text-zinc-500">
              {(props.texts[`${selectedPage}`] ?? '').trim() === ''
                ? 'No text yet — the card prints with just its picture.'
                : 'Line 1 → header · everything after → footer.'}
            </p>
          </div>

          <PageList
            pages={pages}
            texts={props.texts}
            selectedPage={selectedPage}
            onSelectPage={props.onSelectPage}
          />
        </>
      )}
    </div>
  )
}

/**
 * A miniature of the card, split the way the sheet splits it, so the relationship
 * between the box you are typing in and the bands on paper is visible while typing.
 */
function CardSketch({ text, preview }: { readonly text: string; readonly preview: string | undefined }) {
  const lines = text.split('\n').map((line) => line.trim())
  const headerIndex = lines.findIndex((line) => line !== '')
  const header = headerIndex === -1 ? '' : (lines[headerIndex] ?? '')
  const footer = headerIndex === -1 ? '' : lines.slice(headerIndex + 1).filter((line) => line !== '').join(' · ')

  return (
    <div className="flex gap-2 rounded border border-zinc-800 bg-zinc-900/60 p-2" aria-hidden="true">
      <div className="flex w-16 shrink-0 flex-col overflow-hidden rounded bg-white ring-1 ring-black/30">
        <div className="flex h-4 items-center overflow-hidden bg-white px-1 text-[6px] font-medium leading-none text-zinc-900">
          <span className="truncate">{header}</span>
        </div>
        <div className="relative h-12 overflow-hidden bg-zinc-200">
          {preview === undefined ? null : (
            <img src={preview} alt="" className="size-full object-cover" />
          )}
        </div>
        <div className="flex h-3.5 items-center overflow-hidden bg-white px-1 text-[5px] leading-none text-zinc-600">
          <span className="truncate">{footer}</span>
        </div>
      </div>
      <p className="self-center text-[11px] leading-snug text-zinc-500">
        Header on top, picture in the middle, footer at the bottom. Nothing is left blank
        on the card.
      </p>
    </div>
  )
}

/** Which pages already have copy, so a long batch can be checked at a glance. */
function PageList(props: {
  readonly pages: readonly PageRef[]
  readonly texts: Readonly<Record<string, string>>
  readonly selectedPage: number
  readonly onSelectPage: (index: number) => void
}) {
  const filled = useMemo(
    () => props.pages.filter((_page, index) => (props.texts[`${index}`] ?? '').trim() !== '').length,
    [props.pages, props.texts],
  )

  return (
    <div className="shrink-0 border-t border-zinc-800">
      <div className="flex items-center justify-between px-3 py-1.5 text-[11px] text-zinc-500">
        <span>
          {filled} of {props.pages.length} pages have copy
        </span>
        <Type aria-hidden="true" strokeWidth={2} className="size-3.5" />
      </div>
      <ul className="max-h-32 overflow-y-auto px-1.5 pb-1.5">
        {props.pages.map((page, index) => {
          const hasText = (props.texts[`${index}`] ?? '').trim() !== ''
          const isCurrent = index === props.selectedPage
          return (
            <li key={`${page.fileName}-${page.pageNumber}`}>
              <button type="button" data-target="dense"
                onClick={() => props.onSelectPage(index)}
                aria-current={isCurrent ? 'true' : undefined}
                className={cn(
                  'flex min-h-8 w-full items-center gap-2 rounded px-2 text-left text-xs',
                  isCurrent ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 focus-visible:bg-zinc-800',
                )}
              >
                <span className="tabular w-8 shrink-0 text-zinc-500">{page.pageNumber}</span>
                <span className="truncate">{page.fileName}</span>
                <span
                  className={cn(
                    'ml-auto size-1.5 shrink-0 rounded-full',
                    hasText ? 'bg-emerald-400' : 'bg-zinc-700',
                  )}
                  aria-label={hasText ? 'has copy' : 'no copy'}
                />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
