import { useCallback, useState } from 'react'
import type { StationWorkspace } from '../../../types/station'
import type { PageSettings } from '../../../types/settings'
import type { SheetSettings } from '../../../types/imposition'
import type { ToastInput } from '../../../components/ui/use-toasts'
import { SNAPSHOT_VERSION } from '../../../types/persisted'
import { pickFiles } from '../../../lib/files/open-picker'
import { getProjectSource, putProjectSource, retireProjectSources, cancelProjectRetirement } from '../../../lib/storage/project-sources'
import { keepSource, releaseAll } from '../../../lib/export/doc-cache'
import { releaseProxies } from '../../../lib/pdf/proxy-cache'
import { serializeProject } from '../../../lib/project/project-assets'
import { decodeSource, encodeSource, parseProject } from '../../../lib/project/project'
import type { Project } from '../../../lib/project/project'
import type { Keywords } from '../../../types/format-keywords'

interface Options {
  readonly stations: readonly StationWorkspace[]
  readonly activeStationId: string
  readonly sheet: SheetSettings
  readonly preferences: PageSettings
  readonly showCutMarks: boolean
  readonly keywords: Keywords
  readonly apply: (project: Project) => void
  readonly notify: (toast: ToastInput) => void
}

export function useProject({ stations, activeStationId, sheet, preferences, showCutMarks, keywords, apply, notify }: Options) {
  const documents = stations.flatMap((station) => station.documents)
  const active = stations.find((station) => station.id === activeStationId)!
  const [busy, setBusy] = useState(false)
  const save = useCallback(() => {
    void (async () => {
      setBusy(true)
      try {
        const sources: Record<string, string> = {}
        for (const doc of documents) {
          const bytes = await getProjectSource(doc.id)
          if (bytes !== null && new TextDecoder('latin1').decode(bytes.slice(0, 1024)).includes('%PDF-')) sources[doc.id] = encodeSource(bytes)
        }
        const project: Project = { format: 'crewbtc-project', version: 3, snapshot: { version: SNAPSHOT_VERSION, documents: active.documents, cards: active.cards, activeId: active.activeId, stations, activeStationId, savedAt: new Date().toISOString() }, sheet, preferences, showCutMarks, keywords, sources }
        const json = serializeProject(project)
        parseProject(json) // Never download a project this version cannot reopen.
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'crewbtc-project.crewbtc'
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
        const missing = documents.length - Object.keys(sources).length
        notify(missing > 0
          ? { variant: 'warning', title: 'Project saved without some original PDFs', description: `${missing} original ${missing === 1 ? 'PDF was' : 'PDFs were'} unavailable. Cards and photos are saved, but re-running extraction will require the original files.` }
          : { variant: 'success', title: 'Project saved', description: 'Cards, photos, settings and original PDFs are included.' })
      } catch {
        notify({ variant: 'error', title: 'Could not save project', description: 'Check the sheet settings and try again.' })
      } finally { setBusy(false) }
    })()
  }, [stations, activeStationId, active, documents, sheet, preferences, showCutMarks, keywords, notify])

  const open = useCallback(() => {
    void (async () => {
      const [file] = await pickFiles('.crewbtc,application/json')
      if (file === undefined) return
      setBusy(true)
      try {
        const project = parseProject(await file.text())
        if ((documents.length > 0 || stations.length > 1 || stations.some((station) => station.name !== 'Station 1')) && !window.confirm('Opening a project replaces the current workspace. Save your current project first if you want to keep it. Continue?')) return
        await cancelProjectRetirement(project.snapshot.stations.flatMap((station) => station.documents.map((doc) => doc.id))).catch(() => undefined)
        const decoded = Object.entries(project.sources).map(([id, data]) => [id, decodeSource(data)] as const)
        const persisted = await Promise.all(decoded.map(async ([id, bytes]) => {
          try { await putProjectSource(id, bytes); return true } catch { return false }
        }))
        releaseAll()
        releaseProxies()
        for (const [id, bytes] of decoded) {
          const doc = project.snapshot.stations.flatMap((station) => station.documents).find((item) => item.id === id)
          if (doc !== undefined) keepSource(doc.fileName, bytes)
        }
        apply(project)
        const retained = new Set(project.snapshot.stations.flatMap((station) => station.documents.map((doc) => doc.id)))
        void retireProjectSources(documents.filter((doc) => !retained.has(doc.id)).map((doc) => doc.id)).catch(() => undefined)
        const missing = project.snapshot.stations.reduce((count, station) => count + station.documents.length, 0) - decoded.length
        if (missing > 0 || persisted.includes(false)) {
          notify({ variant: 'warning', title: 'Project opened with missing originals', description: 'Cards are editable, but some original PDFs may need to be added again for re-running or saving a complete project.' })
        } else {
          notify({ variant: 'success', title: 'Project opened', description: 'Your cards and settings are ready.' })
        }
      } catch {
        notify({ variant: 'error', title: 'Could not open project', description: 'The file is damaged or is not a supported CrewBTC project. Your current workspace was not changed.' })
      } finally { setBusy(false) }
    })()
  }, [stations, documents, apply, notify])
  return { save, open, busy }
}
