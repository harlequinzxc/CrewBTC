import { cardForStorage, numberedCards } from './cards/numbered-cards'
import { useCallback, useMemo, useState } from 'react'
import { DEFAULT_TEXT_SCALE } from '../../types/card-typography'
import { TopBar } from '../../components/layout/TopBar'
import { EdgeHandle } from '../../components/ui/EdgeHandle'
import { BottomBar } from '../../components/layout/BottomBar'
import { Inspector } from './Inspector'
import { useBatch } from './files/use-batch'
import { useCards, useSeedCards } from './cards/use-cards'
import { useCardSeeds } from './cards/use-card-seeds'
import { CentrePane } from './CentrePane'
import { LeftPane } from './files/LeftPane'
import { useCardExport } from './sheet/use-card-export'
import { useSheet } from './sheet/use-sheet'
import { useSheetZoom } from './sheet/use-sheet-zoom'
import { selectedCardKey } from './sheet/selected-card'
import { useSheetNavigation } from './sheet/use-sheet-navigation'
import { SheetStripSlot } from './sheet/SheetStripSlot'
import { toPageRefs } from '../../lib/pdf/page-refs'
import { pickFiles } from '../../lib/files/open-picker'
import type { Card } from '../../types/card'
import { useUpdateNotice } from './use-update-notice'
import { useClickProbe } from './use-click-probe'
import { CHANGELOG } from '../../data/changelog'
import { usePageReveal } from './sheet/use-page-reveal'
import { useRestoredSession, useSaveSession } from './project/use-session-persistence'
import { useClearBatch } from './files/use-clear-batch'
import { reloadPage } from './reload-page'
import { SettingsDialog } from '../settings/SettingsDialog'
import { usePageSettings } from './project/use-page-settings'
import { useProject } from './project/use-project'
import { useCutGuides } from './sheet/use-cut-guides'
import { useKeywords } from './project/use-keywords'
import { useAutoFormat } from './cards/use-auto-format'
import { useReview } from './review/use-review'
import { jumpToReviewIssue } from './review/use-review-jump'
import { useCardDefaults } from './cards/use-card-defaults'
import { remapStationCards } from './stations/rebase-cards'
import { useSharedSheet } from './stations/use-shared-sheet'
import { useStations } from './stations/use-stations'
import { StationTabs } from './stations/StationTabs'
import { PrintSelection } from './stations/PrintSelection'
import { emptyStation } from '../../types/station'
import { retireProjectSources } from '../../lib/storage/project-sources'
import { releaseAll } from '../../lib/export/doc-cache'
import { releaseProxies } from '../../lib/pdf/proxy-cache'
import { PdfPreview } from './preview/PdfPreview'
import type { Project } from '../../lib/project/project'
import type { useToasts } from '../../components/ui/use-toasts'
/** One screen: files, the sheet, the inspector. No view state, no navigation rail. */
export interface WorkspaceScreenProps {
  readonly notify: ReturnType<typeof useToasts>['show']
}
export function WorkspaceScreen({ notify }: WorkspaceScreenProps) {
  const { settings, update: updateSettings } = usePageSettings()
  const [showCutMarks, setShowCutMarks] = useCutGuides()
  const [keywords, setKeywords] = useKeywords()
  const [selectedCell, setSelectedCell] = useState<number | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false); const [stripCollapsed, setStripCollapsed] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(true); const [filesOpen, setFilesOpen] = useState(true)
  const [previewOpen, setPreviewOpen] = useState(false); const [printing, setPrinting] = useState(false)
  useUpdateNotice(() => {
    notify({
      variant: 'info',
      title: 'New version ready',
      description: 'Reload to pick up the latest build. Unsaved cards are kept until you do.',
      undo: reloadPage,
      action: 'Reload',
    })
  })
  const probe = useClickProbe(CHANGELOG[0]?.version ?? 'unknown')
  const session = useRestoredSession()
  const batch = useBatch({
    notify,
    restore: session.snapshot?.documents ?? null,
    restoreActiveId: session.snapshot?.activeId ?? null,
  })
  const sheet = useSheet()
  const cardStore = useCards(session.snapshot?.cards ?? null)
  const stationState = useStations(session.snapshot, batch, cardStore)
  const sharedSheet = useSharedSheet(sheet, stationState)
  const pageRefs = useMemo(() => toPageRefs(batch.documents), [batch.documents])
  const zoom = useSheetZoom(sheet.settings.sheetWidthMm)
  useSaveSession(session.restored && batch.hydrated, {
    documents: batch.documents,
    cards: cardStore.cards,
    activeId: batch.activeId, stations: stationState.stations, activeStationId: stationState.activeId,
  })
  const cardDefaults = useCardDefaults()
  const seeds = useCardSeeds(pageRefs, sheet.grid, batch.documents)
  useSeedCards(cardStore, seeds, sheet.grid.cellHeightMm, cardDefaults.bands, stationState.stations.find((station) => station.id === stationState.activeId)?.name)
  const autoFormat = useAutoFormat(cardStore, seeds, keywords, notify)
  const visibleCards = useMemo(() => numberedCards(cardStore.cards, pageRefs, sheet.grid, sheet.settings.textScale ?? DEFAULT_TEXT_SCALE), [cardStore.cards, pageRefs, sheet.grid, sheet.settings.textScale])
  const toggleStrip = useCallback(() => setStripCollapsed((collapsed) => !collapsed), [])
  const toggleInspector = useCallback(() => setInspectorOpen((open) => !open), [])
  const clearSelection = useCallback(() => setSelectedCell(null), [])
  const { clearAll } = useClearBatch({
    batch,
    store: cardStore,
    notify,
    clearSelection, stationId: stationState.activeId,
  })
  const handleAdd = useCallback(() => {
    void (async () => {
      const files = await pickFiles()
      if (files.length > 0) batch.addFiles(files)
    })()
  }, [batch])
  const applyProject = useCallback((project: Project) => {
    stationState.replace(project.snapshot.stations, project.snapshot.activeStationId)
    sharedSheet.applied(project.sheet); sheet.update(project.sheet)
    updateSettings(project.preferences)
    setShowCutMarks(project.showCutMarks)
    setKeywords(project.keywords)
    setSelectedCell(null)
  }, [stationState, sheet, sharedSheet, updateSettings, setShowCutMarks, setKeywords])
  const project = useProject({ stations: stationState.stations, activeStationId: stationState.activeId, sheet: sheet.settings, preferences: settings, showCutMarks, keywords, apply: applyProject, notify })
  const hasBatch = batch.documents.length > 0
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
  const review = useReview(sheets, sheet.grid, visibleCards)
  const exporter = useCardExport({
    settings: sheet.settings,
    grid: sheet.grid,
    pages: pageRefs,
    drawCutMarks: showCutMarks,
    cards: visibleCards,
    sheetIndex,
    notify,
  })
  const reveal = usePageReveal(pageRefs, sheet.grid, selectCell, goToSheet)
  const selectionKey = selectedCardKey(
    selectedCell,
    sheet.grid,
    pageRefs,
    selectionSheet ?? 0,
  )
  const selectedCard = selectionKey === null ? null : (visibleCards[selectionKey] ?? null)
  return (
    <div className="flex h-[100svh] max-h-[100svh] w-full flex-col overflow-hidden bg-surface-canvas">
      <TopBar
        onOpenSettings={() => setSettingsOpen(true)}
        onNewProject={() => { if (!window.confirm('Start a new project? Save your current project first if you want to keep it.')) return; void retireProjectSources(stationState.stations.flatMap((station) => station.documents.map((doc) => doc.id))).catch(() => undefined); releaseAll(); releaseProxies(); const id = crypto.randomUUID(); stationState.replace([emptyStation(id, 'Station 1')], id); setSelectedCell(null); setPreviewOpen(false) }}
        onPrintSelection={() => setPrinting(true)} anyProjectCards={stationState.stations.some((station) => station.documents.length > 0)} hasProject={stationState.stations.length > 1 || stationState.stations.some((station) => station.documents.length > 0 || station.name !== 'Station 1')}
        onSaveProject={project.save}
        onOpenProject={project.open}
        projectBusy={project.busy || batch.busy || !session.restored}
        onExportCurrent={exporter.exportCurrent}
        onExportAll={exporter.exportAll}
        hasMoreThanOneSheet={exporter.hasMoreThanOneSheet}
        exporting={exporter.busy}
        hasBatch={hasBatch}
        reviewStatus={review.status} issueCount={review.issues.length} hasPrintableCards={sheetCount > 0}
        previewOpen={previewOpen}
        onTogglePreview={() => setPreviewOpen((open) => !open)}
      />
      <StationTabs stations={stationState.stations} activeId={stationState.activeId} busy={batch.busy || project.busy || !session.restored} onSwitch={(id) => { stationState.switchTo(id); setSelectedCell(null); setPreviewOpen(false) }} onAdd={(name) => { stationState.add(name); setSelectedCell(null); setPreviewOpen(false) }} onRename={stationState.rename} />
      <main className="relative flex min-h-0 flex-1">
        <div className="relative flex shrink-0">
        <aside
          aria-label="Files" hidden={!filesOpen}
          className={filesOpen ? 'hidden w-[220px] shrink-0 border-r border-hairline bg-surface-panel md:flex md:flex-col' : 'hidden'}
        >
          <LeftPane
            documents={batch.documents} activeId={batch.activeId}
            onPages={(id, pages) => { const updated = stationState.stations.map((station) => station.id !== stationState.activeId ? station : remapStationCards(station, station.documents.map((doc) => doc.id === id ? { ...doc, includedPages: pages } : doc), sheet.grid, sheet.grid)); stationState.replace(updated, stationState.activeId); setSelectedCell(null) }}
            onSelectDocument={batch.select}
            onAdd={handleAdd} onReRun={batch.reRun}
            onClear={() => { setPreviewOpen(false); clearAll() }} busy={batch.busy}
            placements={reveal.placements} onReveal={reveal.onReveal}
          />
        </aside>
        <EdgeHandle label={filesOpen ? 'Collapse Files' : 'Expand Files'} expanded={filesOpen} direction={filesOpen ? 'left' : 'right'} onClick={() => setFilesOpen((open) => !open)} className={filesOpen ? 'absolute right-0 top-1/2 z-40 -translate-y-1/2' : 'absolute left-0 top-1/2 z-40 -translate-y-1/2'} />
        </div>
        <CentrePane
          documentsLoaded={hasBatch} busy={batch.busy}
          onFiles={batch.addFiles} sheet={sheet.settings} grid={sheet.grid} pages={pageRefs}
          showCutMarks={showCutMarks}
          cards={visibleCards}
          selectedCell={selectedCell}
          selectionSheet={selectionSheet}
          onSelectCell={selectCell} onCardChange={(key, card: Card) => cardStore.setCard(key, cardForStorage(card))}
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
        {previewOpen && hasBatch && sheetCount > 0 ? <PdfPreview sheetCount={sheetCount} initialSheet={sheetIndex} onClose={() => setPreviewOpen(false)} settings={sheet.settings} grid={sheet.grid} pages={pageRefs} drawCutMarks={showCutMarks} cards={visibleCards} /> : null}
        <div className="relative flex shrink-0">
        <EdgeHandle label={inspectorOpen ? 'Collapse inspector' : 'Expand inspector'} expanded={inspectorOpen} direction={inspectorOpen ? 'right' : 'left'} onClick={toggleInspector} className={inspectorOpen ? 'absolute left-0 top-1/2 z-40 -translate-y-1/2' : 'absolute right-0 top-1/2 z-40 -translate-y-1/2'} />
        <Inspector
          card={selectedCard}
          cellIndex={selectionKey === null ? null : selectedCell}
          units={settings.units}
          sheet={sheet.settings}
          grid={sheet.grid}
          sheetErrors={sheet.errors}
          onSheetChange={sharedSheet.update} onResetSheet={sharedSheet.reset}
          showCutMarks={showCutMarks}
          onShowCutMarksChange={setShowCutMarks} keywords={keywords}
          onKeywordsChange={setKeywords} onAutomate={autoFormat.apply}
          onRemoveFormatting={autoFormat.remove} canAutomate={autoFormat.available}
          review={hasBatch ? { ...review, onJump: (issue) => jumpToReviewIssue(issue, goToSheet, selectCell) } : undefined}
          defaultBands={cardDefaults.bands} onSaveDefaults={cardDefaults.save} onResetDefaults={cardDefaults.reset}
          busy={batch.busy || project.busy}
          open={inspectorOpen}
        />
        </div>
      </main>
      <BottomBar paper={{ widthMm: sheet.settings.sheetWidthMm, heightMm: sheet.settings.sheetHeightMm }} sheetCount={sheetCount} scale={zoom.scale} fitting={zoom.fitting} onStep={zoom.step} onFit={zoom.fit} />
      {printing ? <PrintSelection stations={stationState.stations} grid={sheet.grid} settings={sheet.settings} drawCutMarks={showCutMarks} onClose={() => setPrinting(false)} notify={notify} /> : null}
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onProbe={() => { setSettingsOpen(false); probe.arm() }}
        settings={settings}
        onSettingsChange={updateSettings}
      />
    </div>
  )
}