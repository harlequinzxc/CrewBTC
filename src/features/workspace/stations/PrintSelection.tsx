import { useMemo, useState } from 'react'
import type { GridLayout, SheetSettings } from '../../../types/imposition'
import type { StationWorkspace } from '../../../types/station'
import type { ToastInput } from '../../../components/ui/use-toasts'
import { planSheets } from '../../../lib/imposition/sheet'
import { toPageRefs } from '../../../lib/pdf/page-refs'
import { writeCards } from '../../../lib/export/write-cards'
import { downloadBytes } from '../../../lib/export/download'
import { usePdfPreview } from '../preview/use-pdf-preview'
import { useModalMotion } from '../../../components/ui/use-modal-motion'
import { useSelection } from './use-selection'
import { packPrintSelection, printCandidates } from './print-selection'

interface Props {
  readonly open: boolean
  readonly stations: readonly StationWorkspace[]
  readonly grid: GridLayout
  readonly settings: SheetSettings
  readonly drawCutMarks: boolean
  readonly onClose: () => void
  readonly notify: (toast: ToastInput) => void
}
const button = 'min-h-8 rounded border border-hairline px-3 text-xs text-ink-primary hover:bg-surface-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50'

export function PrintSelection({ open, stations, grid, settings, drawCutMarks, onClose, notify }: Props) {
  const { ref, onAnimationEnd } = useModalMotion(open)
  const [sheet, setSheet] = useState(0)
  const [busy, setBusy] = useState(false)
  const candidates = useMemo(() => printCandidates(stations, grid, settings.textScale ?? 0.9), [stations, grid, settings.textScale])
  const selection = useSelection(useMemo(() => candidates.map((item) => item.id), [candidates]))
  const { chosen, toggle } = selection
  const selected = useMemo(() => candidates.filter((item) => chosen.has(item.id)), [candidates, chosen])
  const packed = useMemo(() => packPrintSelection(selected, grid), [selected, grid])
  const count = grid.cellCount > 0 ? Math.ceil(packed.pages.length / grid.cellCount) : 0
  const index = Math.min(sheet, Math.max(0, count - 1))
  const preview = usePdfPreview({ settings, grid, pages: packed.pages, cards: packed.cards, drawCutMarks }, index)
  const exportSelection = async () => {
    setBusy(true)
    try {
      const photos = Object.fromEntries(Object.entries(packed.cards).flatMap(([key, card]) => card.photo === null ? [] : [[key, card.photo]]))
      const result = await writeCards({ settings, grid, pages: packed.pages, cards: packed.cards, drawCutMarks, photos })
      if (!result.cardsDrawn || !result.bytes.length) throw new Error('No printable cards')
      downloadBytes(result.bytes, 'crewbtc-selection.pdf')
      notify(result.cardsSkipped ? { variant: 'warning', title: 'Export incomplete', description: `${result.cardsSkipped} cards could not be written completely.` } : { variant: 'success', title: 'Selection exported', description: `${selected.length} ${selected.length === 1 ? 'card' : 'cards'} on ${result.sheetCount} ${result.sheetCount === 1 ? 'sheet' : 'sheets'}.` })
    } catch { notify({ variant: 'error', title: 'Could not export selection', description: 'Check the cards and try again.' }) }
    finally { setBusy(false) }
  }
  return <dialog ref={ref} aria-label="Print selection" onAnimationEnd={onAnimationEnd} onCancel={(event) => { event.preventDefault(); onClose() }} className="m-auto max-h-[90svh] w-[min(1000px,95vw)] overflow-hidden rounded-xl border border-hairline bg-surface-panel p-0 text-ink-primary backdrop:bg-black/60 open:flex open:flex-col">
    <div data-dialog-focus tabIndex={-1} className="flex items-center gap-3 border-b border-hairline p-3"><h2 className="flex-1 text-sm font-semibold">Print selection</h2><button type="button" data-target="dense" onClick={onClose} className={button}>Close</button></div>
    <div className="flex min-h-0 flex-1 gap-3 overflow-hidden p-3">
      <div className="w-1/2 overflow-auto">
        <p className="mb-2 text-xs text-ink-secondary">Choose stations or cards. Shift-click selects a range; drag a card’s handle to select or deselect several. The original workspaces stay unchanged.</p>
        {stations.map((station) => {
          const group = candidates.filter((candidate) => candidate.stationId === station.id)
          const expected = planSheets(toPageRefs(station.documents), grid).reduce((sum, plan) => sum + plan.placements.length, 0)
          return <fieldset key={station.id} className="mb-3 border-b border-hairline pb-2"><legend className="text-xs font-semibold">{station.name}</legend>
            <label className="flex min-h-8 items-center gap-2 text-xs">
              <input className="text-base" type="checkbox" checked={group.length > 0 && group.every((item) => chosen.has(item.id))} disabled={!group.length} onChange={(event) => toggle(group.map((item) => item.id), event.target.checked)} /> Select all {station.name}</label>
            {group.map((item) => <div key={item.id} onPointerEnter={(event) => selection.enterDrag(item.id, event.buttons)} className="flex min-h-8 select-none items-center gap-1">
              <button type="button" data-target="dense" aria-label={`Drag to select ${item.card.headerText || item.page.fileName}, page ${item.page.pageNumber}`} aria-pressed={chosen.has(item.id)} onClick={(event) => { if (event.detail === 0) selection.select(item.id, !chosen.has(item.id), event.shiftKey) }} onPointerDown={(event) => { if (event.pointerType === 'mouse' && event.button === 0) { event.preventDefault(); selection.startDrag(item.id) } }} className="min-h-8 min-w-8 cursor-grab rounded text-ink-secondary hover:bg-surface-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">⋮⋮</button>
              <label className="flex min-h-8 flex-1 items-center gap-2 text-xs">
                <input data-print-card className="text-base" type="checkbox" checked={chosen.has(item.id)} onChange={(event) => selection.select(item.id, event.target.checked, 'shiftKey' in event.nativeEvent && event.nativeEvent.shiftKey === true)} />{item.card.headerText || item.page.fileName} · page {item.page.pageNumber}
              </label>
            </div>)}
            {expected > group.length ? <p className="text-xs text-ink-secondary">{expected - group.length} cards are not ready. Open this station to review them before printing.</p> : null}
            {group.length === 0 ? <p className="text-xs text-ink-secondary">No cards ready.</p> : null}
          </fieldset>
        })}
      </div>
      <div className="flex min-h-0 w-1/2 flex-col overflow-hidden">
        <div className="flex items-center gap-2 text-xs"><span className="flex-1">{selected.length} {selected.length === 1 ? 'card' : 'cards'} · {count} {count === 1 ? 'sheet' : 'sheets'}</span><button type="button" data-target="dense" className={button} disabled={index === 0} onClick={() => setSheet(index - 1)}>Previous</button><span>{count ? index + 1 : 0} / {count}</span><button type="button" data-target="dense" className={button} disabled={index + 1 >= count} onClick={() => setSheet(index + 1)}>Next</button></div>
        <output className="py-2 text-xs text-ink-secondary">{count ? preview.message : 'Select cards to preview.'}</output>
        <div className="min-h-0 flex-1 overflow-auto bg-surface-canvas p-2">{count && preview.image ? <img src={preview.image} alt={`Selected print PDF, sheet ${index + 1}`} className="mx-auto w-full bg-white" /> : null}</div>
      </div>
    </div>
    <div className="flex justify-end border-t border-hairline p-3"><button type="button" data-target="dense" className={button} disabled={!count || busy} aria-busy={busy} onClick={() => void exportSelection()}>Export selected PDF</button></div>
  </dialog>
}
