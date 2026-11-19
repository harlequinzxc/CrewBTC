import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppShell } from './components/layout/AppShell'
import { DesktopOnlyNotice } from './components/layout/DesktopOnlyNotice'
import { SidebarNav } from './components/layout/SidebarNav'
import type { ViewId } from './components/layout/SidebarNav'
import { MotionProvider } from './features/settings/MotionProvider'
import { SettingsView } from './features/settings/SettingsView'
import { BatchQueue } from './features/workspace/BatchQueue'
import type { QueueItem } from './features/workspace/BatchQueue'
import { Inspector } from './features/workspace/Inspector'
import { PrintCanvas } from './features/workspace/PrintCanvas'
import { readSettings, requestPersistence, writeSettings } from './lib/storage/db'
import { DEFAULT_PAGE_SETTINGS } from './types/settings'
import type { PageSettings } from './types/settings'

export default function App() {
  return (
    <MotionProvider>
      <div className="lg:hidden">
        <DesktopOnlyNotice />
      </div>
      <div className="hidden lg:block">
        <Workspace />
      </div>
    </MotionProvider>
  )
}

function Workspace() {
  const [view, setView] = useState<ViewId>('workspace')
  const [items] = useState<readonly QueueItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [settings, setSettings] = useState<PageSettings>(DEFAULT_PAGE_SETTINGS)
  const [zoom, setZoom] = useState(1)
  const [includeBleed, setIncludeBleed] = useState(true)
  const [drawMarks, setDrawMarks] = useState(false)

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

  const header = useMemo(
    () => (
      <>
        <h1 className="text-sm font-medium text-zinc-200">
          {view === 'workspace' ? 'Workspace' : 'Settings'}
        </h1>
        <span className="tabular ml-auto text-xs text-zinc-500">
          {items.length === 0 ? 'No batch loaded' : `${items.length} PDFs`}
        </span>
      </>
    ),
    [view, items.length],
  )

  return (
    <AppShell sidebar={<SidebarNav active={view} onSelect={setView} />} header={header}>
      {view === 'settings' ? (
        <SettingsView settings={settings} onSettingsChange={updateSettings} />
      ) : (
        <div className="flex min-h-0 flex-1">
          <div className="hidden w-[260px] shrink-0 border-r border-zinc-800 lg:block">
            <BatchQueue
              items={items}
              activeId={activeId}
              onSelect={setActiveId}
              onAdd={() => undefined}
              onReRun={() => undefined}
              onClear={() => setActiveId(null)}
              busy={false}
            />
          </div>
          <PrintCanvas
            settings={settings}
            zoom={zoom}
            onZoomChange={setZoom}
            hasSelection={items.length > 0}
            showGuides
          />
          <Inspector
            settings={settings}
            onSettingsChange={updateSettings}
            includeBleed={includeBleed}
            onIncludeBleedChange={setIncludeBleed}
            drawMarks={drawMarks}
            onDrawMarksChange={setDrawMarks}
            hasBatch={items.length > 0}
          />
        </div>
      )}
    </AppShell>
  )
}
