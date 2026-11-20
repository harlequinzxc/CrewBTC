import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { toPageRefs } from '../../lib/pdf/page-refs'
import { planSheets } from '../../lib/imposition/sheet'
import { pickFiles } from '../../lib/files/open-picker'
import { cardKey, clampBands, clampTextScale, defaultBands } from '../../types/card'
import type { Card } from '../../types/card'
import { useUpdateNotice } from './use-update-notice'
import { reloadPage } from './reload-page'
import { SettingsDialog } from '../settings/SettingsDialog'
import { computePageGeometry } from '../../lib/trim'
import { readSettings, requestPersistence, writeSettings } from '../../lib/storage/db'
import { DEFAULT_PAGE_SETTINGS } from '../../types/settings'
import type { PageSettings } from '../../types/settings'
import type { useToasts } from '../../components/ui/use-toasts'

/**
 * One screen: files, the sheet, and the inspector.
 *
 * There is no view state, no navigation, and no bottom drawer. Everything the app can do
 * is reachable from the top bar or from the thing it acts on, which is what lets the sheet
 * take the whole window between them.
 */
export interface WorkspaceScreenProps {
  readonly notify: ReturnType<typeof useToasts>['show']
}

export function WorkspaceScreen({ notify }: WorkspaceScreenProps) {
  const [settings, setSettings] = useState<PageSettings>(DEFAULT_PAGE_SETTINGS)
  const [includeBleed, setIncludeBleed] = useState(true)
  const [drawMarks, setDrawMarks] = useState(false)
  // Cut guides are on by default: the sheet is a cutting template as much as a preview.
  const [showCutMarks, setShowCutMarks] = useState(true)
  const [selectedCell, setSelectedCell] = useState<number | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

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

  const zoom = useSheetZoom(sheet.settings.sheetWidthMm, sheet.settings.sheetHeightMm)

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

  useSeedCards(cardStore, seeds, sheet.grid.cellHeightMm)

  const exporter = useCardExport({
    settings: sheet.settings,
    grid: sheet.grid,
    pages: pageRefs,
    drawCutMarks: showCutMarks,
    cards: cardStore.cards,
    notify,
  })

  useEffect(() => {
    void (async () => {
      const previous = await readSettings()
      if (previous !== null) setSettings(previous)
      await requestPersistence()
    })()
  }, [])

  const updateSettings = useCallback((next: PageSettings) => {
    setSettings(next)
    void writeSettings(next)
  }, [])

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

  const geometry = computePageGeometry(settings)

  // The inspector describes a card when one is selected and the document when it is not.
  const selectionKey = selectedCardKey(selectedCell, sheet.grid, pageRefs)
  const selectedCard = selectionKey === null ? null : (cardStore.cards[selectionKey] ?? null)

  const handleBands = useCallback(
    (bands: Parameters<typeof clampBands>[0]) => {
      if (selectionKey === null) return
      const card = cardStore.cards[selectionKey]
      if (card === undefined) return
      cardStore.setCard(selectionKey, { ...card, bands: clampBands(bands, sheet.grid.cellHeightMm) })
    },
    [selectionKey, cardStore, sheet.grid.cellHeightMm],
  )

  const handleTextScale = useCallback(
    (textScale: number) => {
      if (selectionKey === null) return
      const card = cardStore.cards[selectionKey]
      if (card === undefined) return
      cardStore.setCard(selectionKey, { ...card, textScale: clampTextScale(textScale) })
    },
    [selectionKey, cardStore],
  )

  const handleResetCard = useCallback(() => {
    if (selectionKey === null) return
    const card = cardStore.cards[selectionKey]
    if (card === undefined) return
    cardStore.setCard(selectionKey, {
      ...card,
      bands: clampBands(defaultBands(sheet.grid.cellHeightMm), sheet.grid.cellHeightMm),
      textScale: 1,
    })
  }, [selectionKey, cardStore, sheet.grid.cellHeightMm])

  const hasBatch = batch.documents.length > 0
  const sheetCount = planSheets(pageRefs, sheet.grid).length

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
          onSelectCell={setSelectedCell}
          onCardChange={(key, card: Card) => cardStore.setCard(key, card)}
          scale={zoom.scale}
          fitting={zoom.fitting}
          paneRef={zoom.paneRef}
        />

        <Inspector
          card={selectedCard}
          cellIndex={selectionKey === null ? null : selectedCell}
          cellHeightMm={sheet.grid.cellHeightMm}
          onBandsChange={handleBands}
          onTextScaleChange={handleTextScale}
          onResetCard={handleResetCard}
          sheet={sheet.settings}
          grid={sheet.grid}
          sheetErrors={sheet.errors}
          onSheetChange={sheet.update}
          onResetSheet={sheet.reset}
          showCutMarks={showCutMarks}
          onShowCutMarksChange={setShowCutMarks}
          page={settings}
          onPageChange={updateSettings}
          includeBleed={includeBleed}
          onIncludeBleedChange={setIncludeBleed}
          drawMarks={drawMarks}
          onDrawMarksChange={setDrawMarks}
          marksFit={geometry.marksFit}
          bleedMm={geometry.bleedMm}
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
