import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppShell } from './components/layout/AppShell'
import { DesktopOnlyNotice } from './components/layout/DesktopOnlyNotice'
import { SidebarNav } from './components/layout/SidebarNav'
import type { ViewId } from './components/layout/SidebarNav'
import { Button } from './components/ui/Button'
import { ToastHub } from './components/ui/ToastHub'
import { useToasts } from './components/ui/use-toasts'
import { MotionProvider } from './features/settings/MotionProvider'
import { SettingsView } from './features/settings/SettingsView'
import { Inspector } from './features/workspace/Inspector'
import { SheetSettings } from './features/workspace/SheetSettings'
import { useBatch } from './features/workspace/use-batch'
import { useCards, useSeedCards } from './features/workspace/use-cards'
import type { CardSeed } from './features/workspace/use-cards'
import { CentrePane } from './features/workspace/CentrePane'
import { LeftPane } from './features/workspace/LeftPane'
import type { LeftTab } from './features/workspace/LeftPane'
import { useCardExport } from './features/workspace/use-card-export'
import { useSheet } from './features/workspace/use-sheet'
import { toPageRefs } from './lib/pdf/page-refs'
import { pickFiles } from './lib/files/open-picker'
import { cardKey } from './types/card'
import type { Card } from './types/card'
import { DESKTOP_QUERY, useMediaQuery } from './lib/use-media-query'
import { readSettings, requestPersistence, writeSettings } from './lib/storage/db'
import { DEFAULT_PAGE_SETTINGS } from './types/settings'
import type { PageSettings } from './types/settings'

export default function App() {
  return (
    <MotionProvider>
      <DesktopGate />
    </MotionProvider>
  )
}

/** Desktop-only by decision (README §4 override). Chosen in JS rather than media
 *  classes so the same branch holds in tests and in a browser. */
function DesktopGate() {
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  return isDesktop ? <Workspace /> : <DesktopOnlyNotice />
}

function Workspace() {
  const [view, setView] = useState<ViewId>('workspace')
  const [settings, setSettings] = useState<PageSettings>(DEFAULT_PAGE_SETTINGS)
  const [includeBleed, setIncludeBleed] = useState(true)
  const [drawMarks, setDrawMarks] = useState(false)

  const toasts = useToasts()
  const notify = toasts.show
  const batch = useBatch({ notify })
  const sheet = useSheet()
  const [showCutMarks, setShowCutMarks] = useState(true)
  const [selectedCell, setSelectedCell] = useState<number | null>(null)
  const [leftTab, setLeftTab] = useState<LeftTab>('files')
  const [selectedPage, setSelectedPage] = useState(0)
  const pageRefs = useMemo(() => toPageRefs(batch.documents), [batch.documents])
  const cardStore = useCards()

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

  // A page's scan fills its card once, and never overwrites an edit afterwards.
  useSeedCards(cardStore, seeds, sheet.grid.cellHeightMm)

  // One preview per page, for the sketch beside the copy box.
  const previews = useMemo(() => {
    const out: Record<string, string> = {}
    for (const document of batch.documents) {
      if (document.pagePreviewUrl === null) continue
      out[`${document.fileName}#1`] = document.pagePreviewUrl
    }
    return out
  }, [batch.documents])

  // A page beyond the end of a shrinking batch must not strand the copy editor.
  const safePage = Math.min(selectedPage, Math.max(0, pageRefs.length - 1))

  // Fill every card's bands from its page as soon as the page is parsed, so an upload
  // never lands in an empty editor. Edits are never overwritten.
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
      const stored = await readSettings()
      if (stored !== null) setSettings(stored)
      await requestPersistence()
    })()
  }, [])

  const updateSettings = useCallback((next: PageSettings) => {
    setSettings(next)
    void writeSettings(next)
  }, [])

  // Clearing the batch must not leave edits or a selection pointing at documents
  // that no longer exist, so the reset happens with the clear rather than after it.
  const clearAll = useCallback(() => {
    batch.clear()
    cardStore.reset()
    setSelectedCell(null)
    setSelectedPage(0)
  }, [batch, cardStore])

  const handlePageSelect = useCallback(
    (index: number) => {
      setSelectedPage(index)
      // Selecting a page should show that page's card, not whichever cell was last
      // touched: one page maps to one cell index on the first sheet.
      setSelectedCell(index)
    },
    [],
  )

  const handleAdd = useCallback(() => {
    void (async () => {
      const files = await pickFiles()
      if (files.length > 0) batch.addFiles(files)
    })()
  }, [batch])

  const header = useMemo(
    () => (
      <>
        <h1 className="text-sm font-medium text-zinc-200">
          {view === 'workspace' ? 'Workspace' : 'Settings'}
        </h1>
        <span className="tabular ml-auto text-xs text-zinc-500">
          {batch.documents.length === 0
            ? 'No batch loaded'
            : `${batch.documents.length} ${batch.documents.length === 1 ? 'PDF' : 'PDFs'}`}
        </span>
        <Button size="sm" variant="primary" onClick={handleAdd} disabled={batch.busy}>
          Add PDFs
        </Button>
      </>
    ),
    [view, batch.documents.length, batch.busy, handleAdd],
  )

  return (
    <>
      <AppShell sidebar={<SidebarNav active={view} onSelect={setView} />} header={header}>
        {view === 'settings' ? (
          <SettingsView settings={settings} onSettingsChange={updateSettings} />
        ) : (
          <div className="flex min-h-0 flex-1">
            <div className="hidden w-[300px] shrink-0 border-r border-zinc-800 lg:block">
              <LeftPane
                tab={leftTab}
                onTabChange={setLeftTab}
                documents={batch.documents}
                activeId={batch.activeId}
                onSelectDocument={batch.select}
                onAdd={handleAdd}
                onFiles={batch.addFiles}
                onReRun={batch.reRun}
                onClear={clearAll}
                busy={batch.busy}
                pages={pageRefs}
                previews={previews}
                selectedPage={safePage}
                onSelectPage={handlePageSelect}
              />
            </div>

            <CentrePane
              documentsLoaded={batch.documents.length > 0}
              busy={batch.busy}
              onFiles={batch.addFiles}
              onAdd={handleAdd}
              sheet={sheet.settings}
              grid={sheet.grid}
              pages={pageRefs}
              showCutMarks={showCutMarks}
              cards={cardStore.cards}
              selectedCell={selectedCell}
              onSelectCell={setSelectedCell}
              onCardChange={(key, card: Card) => cardStore.setCard(key, card)}
            />

            <Inspector
              settings={settings}
              onSettingsChange={updateSettings}
              includeBleed={includeBleed}
              onIncludeBleedChange={setIncludeBleed}
              drawMarks={drawMarks}
              onDrawMarksChange={setDrawMarks}
              sheetPanel={
                <SheetSettings
                  settings={sheet.settings}
                  grid={sheet.grid}
                  errors={sheet.errors}
                  onChange={sheet.update}
                  onReset={sheet.reset}
                  showCutMarks={showCutMarks}
                  onShowCutMarksChange={setShowCutMarks}
                />
              }
              hasBatch={batch.documents.length > 0}
              onExport={exporter.exportAll}
              exporting={exporter.busy}
            />
          </div>
        )}
      </AppShell>
      <ToastHub api={toasts} />
    </>
  )
}
