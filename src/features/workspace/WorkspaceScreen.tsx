import { cardForStorage, numberedCards } from './numbered-cards'
import { useCallback, useMemo, useState } from 'react'
import { DEFAULT_TEXT_SCALE } from '../../types/card-typography'
import { TopBar } from '../../components/layout/TopBar'
import { Inspector } from './Inspector'
import { useBatch } from './use-batch'
import { useCards, useSeedCards } from './use-cards'
import { useCardSeeds } from './use-card-seeds'
import { CentrePane } from './CentrePane'
import { LeftPane } from './LeftPane'
import { useCardExport } from './use-card-export'
import { useSheet } from './use-sheet'
import { useSheetZoom } from './use-sheet-zoom'
import { selectedCardKey } from './selected-card'
import { useSheetNavigation } from './use-sheet-navigation'
import { useCardInspector } from './use-card-inspector'
import { SheetStripSlot } from './SheetStripSlot'
import { toPageRefs } from '../../lib/pdf/page-refs'
import { pickFiles } from '../../lib/files/open-picker'
import type { Card } from '../../types/card'
import { useUpdateNotice } from './use-update-notice'
import { useClickProbe } from './use-click-probe'
import { CHANGELOG } from '../../data/changelog'
import { usePageReveal } from './use-page-reveal'
import { useRestoredSession, useSaveSession } from './use-session-persistence'
import { useClearBatch } from './use-clear-batch'
import { reloadPage } from './reload-page'
import { SettingsDialog } from '../settings/SettingsDialog'
import { usePageSettings } from './use-page-settings'
import type { useToasts } from '../../components/ui/use-toasts'

/** One screen: files, the sheet, the inspector. No view state, no navigation rail. */
export interface WorkspaceScreenProps {
  readonly notify: ReturnType<typeof useToasts>['show']
}

export function WorkspaceScreen({ notify }: WorkspaceScreenProps) {
  const { settings, update: updateSettings } = usePageSettings()
  // Cut guides are on by default: the sheet is a cutting template as much as a preview.
  const [showCutMarks, setShowCutMarks] = useState(true)
  const [selectedCell, setSelectedCell] = useState<number | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  // The two optional rails. Both are open until the user says otherwise, and both are
  // remembered for the session only: this is a workspace, not a set of preferences.
  const [stripCollapsed, setStripCollapsed] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(true)

  useUpdateNotice(() => {
    notify({
      variant: 'info',
      title: 'New version ready',
      description: 'Reload to pick up the latest build. Unsaved cards are kept until you do.',
      undo: reloadPage,
      action: 'Reload',
    })
  })

  // `Shift+?` or the top-bar button reports what the next press lands on.
  const probe = useClickProbe(CHANGELOG[0]?.version ?? 'unknown')

  // Read before anything is constructed: the batch and the card store both take their
  // initial value from it, so the first paint already has the user's cards on their sheet.
  const session = useRestoredSession()

  const batch = useBatch({
    notify,
    restore: session.snapshot?.documents ?? null,
    restoreActiveId: session.snapshot?.activeId ?? null,
  })
  const sheet = useSheet()
  const cardStore = useCards(session.snapshot?.cards ?? null)
  const pageRefs = useMemo(() => toPageRefs(batch.documents), [batch.documents])
  const zoom = useSheetZoom(sheet.settings.sheetWidthMm)

  // Write-side: armed only once the read has finished, so an early frame cannot erase the
  // session it is about to load. See `use-session-persistence`.
  useSaveSession(session.restored && batch.hydrated, {
    documents: batch.documents,
    cards: cardStore.cards,
    activeId: batch.activeId,
  })

  const seeds = useCardSeeds(pageRefs, sheet.grid, batch.documents)
  useSeedCards(cardStore, seeds, sheet.grid.cellHeightMm)

  const visibleCards = useMemo(() => numberedCards(cardStore.cards, pageRefs, sheet.grid, sheet.settings.textScale ?? DEFAULT_TEXT_SCALE), [cardStore.cards, pageRefs, sheet.grid, sheet.settings.textScale])

  const exporter = useCardExport({
    settings: sheet.settings,
    grid: sheet.grid,
    pages: pageRefs,
    drawCutMarks: showCutMarks,
    cards: visibleCards,
    notify,
  })

  const toggleStrip = useCallback(() => setStripCollapsed((collapsed) => !collapsed), [])
  const toggleInspector = useCallback(() => setInspectorOpen((open) => !open), [])

  // Clearing is a transaction with an undo, so it lives in its own hook.
  const clearSelection = useCallback(() => setSelectedCell(null), [])
  const { clearAll } = useClearBatch({
    batch,
    store: cardStore,
    notify,
    clearSelection,
  })

  const handleAdd = useCallback(() => {
    void (async () => {
      const files = await pickFiles()
      if (files.length > 0) batch.addFiles(files)
    })()
  }, [batch])

  const hasBatch = batch.documents.length > 0

  // Which sheet is on screen, and every way to move it, in one place. The canvas and the
  // strip both read it, which is what keeps the highlight and the scroll from drifting.
  const {
    sheets,
    sheetIndex,
    selectionSheet,
    selectCell,
    goToSheet,
    setVisibleSheet,
    scrollTo,
    clearScrollTo,
  } = useSheetNavigation({
    pages: pageRefs,
    grid: sheet.grid,
    activeDocumentId: batch.activeId,
    setSelectedCell,
  })
  const sheetCount = sheets.length
  const reveal = usePageReveal(pageRefs, sheet.grid, selectCell, goToSheet)

  // The inspector describes a card when one is selected and the document when it is not.
  // Resolved against the sheet the *selection* came from, since every sheet is drawn.
  const selectionKey = selectedCardKey(
    selectedCell,
    sheet.grid,
    pageRefs,
    selectionSheet ?? 0,
  )
  const selectedCard = selectionKey === null ? null : (visibleCards[selectionKey] ?? null)

  const inspectorEdits = useCardInspector(cardStore, selectionKey, sheet.grid.cellHeightMm)

  return (
    <div className="flex h-[100svh] max-h-[100svh] w-full flex-col overflow-hidden bg-surface-canvas">
      <TopBar
        onProbe={probe.arm}
        paper={{ widthMm: sheet.settings.sheetWidthMm, heightMm: sheet.settings.sheetHeightMm }}
        sheetCount={sheetCount}
        scale={zoom.scale}
        fitting={zoom.fitting}
        onStep={zoom.step}
        onFit={zoom.fit}
        onOpenSettings={() => setSettingsOpen(true)}
        onExportCurrent={exporter.exportCurrent}
        onExportAll={exporter.exportAll}
        hasMoreThanOneSheet={exporter.hasMoreThanOneSheet}
        exporting={exporter.busy}
        hasBatch={hasBatch}
        inspectorOpen={inspectorOpen}
        onToggleInspector={toggleInspector}
      />

      <main className="flex min-h-0 flex-1">
        <aside
          aria-label="Files"
          className="hidden w-[220px] shrink-0 border-r border-hairline bg-surface-panel md:flex md:flex-col"
        >
          <LeftPane
            documents={batch.documents}
            activeId={batch.activeId}
            onSelectDocument={batch.select}
            onAdd={handleAdd}
            onReRun={batch.reRun}
            onClear={clearAll}
            busy={batch.busy}
            placements={reveal.placements}
            onReveal={reveal.onReveal}
          />
        </aside>

        <CentrePane
          documentsLoaded={hasBatch}
          busy={batch.busy}
          onFiles={batch.addFiles}
          sheet={sheet.settings}
          grid={sheet.grid}
          pages={pageRefs}
          showCutMarks={showCutMarks}
          cards={visibleCards}
          selectedCell={selectedCell}
          selectionSheet={selectionSheet}
          onSelectCell={selectCell}
          onCardChange={(key, card: Card) => cardStore.setCard(key, cardForStorage(card))}
          scale={zoom.scale}
          fitting={zoom.fitting}
          paneRef={zoom.paneRef}
          sheetIndex={sheetIndex}
          onVisibleSheetChange={setVisibleSheet}
          scrollTo={scrollTo}
          onScrollToHandled={clearScrollTo}
          strip={
            <SheetStripSlot
              sheets={sheets}
              sheet={sheet.settings}
              grid={sheet.grid}
              cards={visibleCards}
              activeIndex={sheetIndex}
              onSelectSheet={goToSheet}
              collapsed={stripCollapsed}
              onToggleCollapsed={toggleStrip}
            />
          }
        />

        <Inspector
          card={selectedCard}
          cellIndex={selectionKey === null ? null : selectedCell}
          cellHeightMm={sheet.grid.cellHeightMm}
          onBandsChange={inspectorEdits.onBandsChange}
          onTextScaleChange={inspectorEdits.onTextScaleChange}
          onResetCard={inspectorEdits.onResetCard}
          units={settings.units}
          sheet={sheet.settings}
          grid={sheet.grid}
          sheetErrors={sheet.errors}
          onSheetChange={sheet.update}
          onResetSheet={sheet.reset}
          showCutMarks={showCutMarks}
          onShowCutMarksChange={setShowCutMarks}
          open={inspectorOpen}
        />
      </main>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSettingsChange={updateSettings}
      />
    </div>
  )
}
