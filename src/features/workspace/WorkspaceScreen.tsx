import { useCallback, useMemo, useState } from 'react'
import { TopBar } from '../../components/layout/TopBar'
import { Inspector } from './Inspector'
import { useBatch } from './use-batch'
import { useCards, useSeedCards } from './use-cards'
import type { CardSeed } from './use-cards'
import { CentrePane } from './CentrePane'
import { LeftPane } from './LeftPane'
import { useCardExport } from './use-card-export'
import { useSheet } from './use-sheet'
import { useSheetZoom } from './use-sheet-zoom'
import { selectedCardKey } from './selected-card'
import { useSheetNavigation } from './use-sheet-navigation'
import { bandsInto, resetProportions, textScaleInto } from './card-edits'
import { SheetStripSlot } from './SheetStripSlot'
import { toPageRefs } from '../../lib/pdf/page-refs'
import { pickFiles } from '../../lib/files/open-picker'
import { cardKey } from '../../types/card'
import type { Card, CardBands } from '../../types/card'
import { useUpdateNotice } from './use-update-notice'
import { reloadPage } from './reload-page'
import { SettingsDialog } from '../settings/SettingsDialog'
import { usePageSettings } from './use-page-settings'
import type { useToasts } from '../../components/ui/use-toasts'

/**
 * One screen: files, the sheet, and the inspector.
 *
 * There is no view state and no navigation rail. Everything the app can do is reachable
 * from the top bar or from the thing it acts on, which is what lets the sheet take the
 * whole window between them. The sheet strip is the one exception, and only for documents
 * that span more than one page of cards: it is navigation for a set of pages, not for the
 * app.
 */
export interface WorkspaceScreenProps {
  readonly notify: ReturnType<typeof useToasts>['show']
}

export function WorkspaceScreen({ notify }: WorkspaceScreenProps) {
  const { settings, update: updateSettings } = usePageSettings()
  // Cut guides are on by default: the sheet is a cutting template as much as a preview.
  const [showCutMarks, setShowCutMarks] = useState(true)
  const [selectedCell, setSelectedCell] = useState<number | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [stripCollapsed, setStripCollapsed] = useState(false)

  useUpdateNotice(() => {
    notify({
      variant: 'info',
      title: 'New version ready',
      description: 'Reload to pick up the latest build. Unsaved cards are kept until you do.',
      undo: reloadPage,
      action: 'Reload',
    })
  })

  const batch = useBatch({ notify })
  const sheet = useSheet()
  const cardStore = useCards()
  const pageRefs = useMemo(() => toPageRefs(batch.documents), [batch.documents])

  const zoom = useSheetZoom(sheet.settings.sheetWidthMm)

  // One seed per placed page: what the upload read, ready to fill a fresh card.
  const seeds = useMemo<readonly CardSeed[]>(
    () =>
      pageRefs.map((page, index) => {
        // `documentId` on a PageRef is the *file name* (the exporter resolves source
        // bytes by it), not the internal id. Matching on `id` silently missed every
        // document, so every card was seeded empty — no photo, no text.
        const document = batch.documents.find((item) => item.fileName === page.documentId)
        const copy = document?.copies[page.pageNumber]
        return {
          key: cardKey(index, page.documentId, page.pageNumber),
          headerText: copy?.header ?? '',
          bodyText: copy?.footer ?? '',
          photo: document?.photos[page.pageNumber] ?? null,
        }
      }),
    [pageRefs, batch.documents],
  )

  useSeedCards(cardStore, seeds, sheet.grid.cellHeightMm, sheet.grid.cellWidthMm)

  const exporter = useCardExport({
    settings: sheet.settings,
    grid: sheet.grid,
    pages: pageRefs,
    drawCutMarks: showCutMarks,
    cards: cardStore.cards,
    notify,
  })

  const clearAll = useCallback(() => {
    batch.clear()
    cardStore.reset()
    setSelectedCell(null)
  }, [batch, cardStore])

  const handleAdd = useCallback(() => {
    void (async () => {
      const files = await pickFiles()
      if (files.length > 0) batch.addFiles(files)
    })()
  }, [batch])

  const hasBatch = batch.documents.length > 0

  // Which sheet is on the canvas, and every way to move it, in one place.
  const { sheets, sheetIndex, selectCell, goToSheet } = useSheetNavigation({
    pages: pageRefs,
    grid: sheet.grid,
    activeDocumentId: batch.activeId,
    setSelectedCell,
  })
  const sheetCount = sheets.length

  // The inspector describes a card when one is selected and the document when it is not.
  const selectionKey = selectedCardKey(selectedCell, sheet.grid, pageRefs, sheetIndex)
  const selectedCard = selectionKey === null ? null : (cardStore.cards[selectionKey] ?? null)

  // One lookup, three patches: the selected card, or nothing if the sheet has no card in
  // that cell. Repeating the guard in each handler is how they drift apart.
  const patchSelected = useCallback(
    (change: (card: Card) => Card) => {
      if (selectionKey === null) return
      const card = cardStore.cards[selectionKey]
      if (card === undefined) return
      cardStore.setCard(selectionKey, change(card))
    },
    [selectionKey, cardStore],
  )

  const { cellHeightMm } = sheet.grid
  const handleBands = useCallback(
    (bands: CardBands) => patchSelected((card) => bandsInto(card, bands, cellHeightMm)),
    [patchSelected, cellHeightMm],
  )
  const handleTextScale = useCallback(
    (textScale: number) => patchSelected((card) => textScaleInto(card, textScale)),
    [patchSelected],
  )
  const handleResetCard = useCallback(
    () => patchSelected((card) => resetProportions(card, cellHeightMm)),
    [patchSelected, cellHeightMm],
  )

  return (
    <div className="flex h-[100svh] max-h-[100svh] w-full flex-col overflow-hidden bg-surface-canvas">
      <TopBar
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
          cards={cardStore.cards}
          selectedCell={selectedCell}
          onSelectCell={selectCell}
          onCardChange={(key, card: Card) => cardStore.setCard(key, card)}
          scale={zoom.scale}
          fitting={zoom.fitting}
          paneRef={zoom.paneRef}
          sheetIndex={sheetIndex}
          sheets={sheets}
          renderStrip={(plans) => (
            <SheetStripSlot
              sheets={plans}
              sheet={sheet.settings}
              grid={sheet.grid}
              cards={cardStore.cards}
              activeIndex={sheetIndex}
              onSelectSheet={goToSheet}
              collapsed={stripCollapsed}
              onToggleCollapsed={() => setStripCollapsed((collapsed) => !collapsed)}
            />
          )}
        />

        <Inspector
          card={selectedCard}
          cellIndex={selectionKey === null ? null : selectedCell}
          cellHeightMm={sheet.grid.cellHeightMm}
          onBandsChange={handleBands}
          onTextScaleChange={handleTextScale}
          onResetCard={handleResetCard}
          units={settings.units}
          sheet={sheet.settings}
          grid={sheet.grid}
          sheetErrors={sheet.errors}
          onSheetChange={sheet.update}
          onResetSheet={sheet.reset}
          showCutMarks={showCutMarks}
          onShowCutMarksChange={setShowCutMarks}
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
