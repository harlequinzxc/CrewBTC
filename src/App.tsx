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
import { BatchQueue } from './features/workspace/BatchQueue'
import { DropZone } from './features/workspace/DropZone'
import { Inspector } from './features/workspace/Inspector'
import { SheetPreview } from './features/workspace/SheetPreview'
import { SheetSettings } from './features/workspace/SheetSettings'
import { useBatch } from './features/workspace/use-batch'
import { useEdits } from './features/workspace/use-edits'
import { usePageText } from './features/workspace/use-page-text'
import { pageKey } from './lib/pdf/page-text-key'
import { sourceVersion } from './lib/export/doc-cache'
import { useExport } from './features/workspace/use-export'
import { useSheet } from './features/workspace/use-sheet'
import { toPageRefs } from './lib/pdf/page-refs'
import { planSheets } from './lib/imposition/sheet'
import { pickFiles } from './lib/files/open-picker'
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
  const pageRefs = useMemo(() => toPageRefs(batch.documents), [batch.documents])
  const editsApi = useEdits()

  // Extract text for the pages actually on screen; that is what makes them editable.
  const sheetPlans = useMemo(() => planSheets(pageRefs, sheet.grid), [pageRefs, sheet.grid])
  const visiblePages = useMemo(
    () =>
      (sheetPlans[0]?.placements ?? []).map((placement) => ({
        fileName: placement.documentId,
        pageNumber: placement.pageNumber,
      })),
    [sheetPlans],
  )
  const textSignature = visiblePages
    .map((page) => pageKey(page.fileName, page.pageNumber, sourceVersion(page.fileName)))
    .join('|')
  const blocksByPage = usePageText(visiblePages, textSignature)
  const exporter = useExport({
    settings: sheet.settings,
    grid: sheet.grid,
    pages: pageRefs,
    drawCutMarks: showCutMarks,
    edits: editsApi.edits,
    blocks: blocksByPage,
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
    editsApi.clear()
    setSelectedCell(null)
  }, [batch, editsApi])

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
            <div className="hidden w-[260px] shrink-0 border-r border-zinc-800 lg:block">
              {batch.documents.length === 0 ? (
                <div className="p-2">
                  <DropZone onFiles={batch.addFiles} disabled={batch.busy} />
                </div>
              ) : null}
              <BatchQueue
                documents={batch.documents}
                activeId={batch.activeId}
                onSelect={batch.select}
                onAdd={handleAdd}
                onReRun={batch.reRun}
                onClear={clearAll}
                busy={batch.busy}
              />
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-zinc-950">
              {batch.documents.length === 0 ? (
                <div className="grid min-h-0 flex-1 place-items-center overflow-hidden p-6">
                  <div className="w-full max-w-sm">
                    <DropZone onFiles={batch.addFiles} disabled={batch.busy} />
                    <Button
                      variant="primary"
                      fullWidth
                      className="mt-3"
                      onClick={handleAdd}
                      disabled={batch.busy}
                      loading={batch.busy}
                    >
                      Add PDFs
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <SheetPreview
                    settings={sheet.settings}
                    grid={sheet.grid}
                    pages={pageRefs}
                    showCutMarks={showCutMarks}
                    edits={editsApi.edits}
                    blocksByPage={blocksByPage}
                    selectedCell={selectedCell}
                    onSelectCell={setSelectedCell}
                    onTextChange={editsApi.setText}
                    onImageChange={editsApi.setImage}
                    onResetCell={editsApi.resetCell}
                  />
                </div>
              )}
            </div>

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
