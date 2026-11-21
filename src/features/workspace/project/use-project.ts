import { useCallback, useState } from 'react'
import type { Card } from '../../../types/card'
import type { IngestedDocument } from '../../../types/document'
import type { PageSettings } from '../../../types/settings'
import type { SheetSettings } from '../../../types/imposition'
import type { ToastInput } from '../../../components/ui/use-toasts'
import { SNAPSHOT_VERSION } from '../../../types/persisted'
import { pickFiles } from '../../../lib/files/open-picker'
import { getProjectSource, putProjectSource, retireProjectSources, cancelProjectRetirement } from '../../../lib/storage/project-sources'
import { keepSource, releaseAll } from '../../../lib/export/doc-cache'
import { releaseProxies } from '../../../lib/pdf/proxy-cache'
import { decodeSource, encodeSource, parseProject } from '../../../lib/project/project'
import type { Project } from '../../../lib/project/project'

interface Options {
  readonly documents: readonly IngestedDocument[]
  readonly cards: Readonly<Record<string, Card>>
  readonly activeId: string | null
  readonly sheet: SheetSettings
  readonly preferences: PageSettings
  readonly showCutMarks: boolean
  readonly apply: (project: Project) => void
  readonly notify: (toast: ToastInput) => void
}

export function useProject({ documents, cards, activeId, sheet, preferences, showCutMarks, apply, notify }: Options) {
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
        const project: Project = { format: 'crewbtc-project', version: 1, snapshot: { version: SNAPSHOT_VERSION, documents, cards, activeId, savedAt: new Date().toISOString() }, sheet, preferences, showCutMarks, sources }
        const json = JSON.stringify(project)
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
  }, [documents, cards, activeId, sheet, preferences, showCutMarks, notify])

  const open = useCallback(() => {
    void (async () => {
      const [file] = await pickFiles('.crewbtc,application/json')
      if (file === undefined) return
      setBusy(true)
      try {
        const project = parseProject(await file.text())
        if (documents.length > 0 && !window.confirm('Opening a project replaces the current workspace. Save your current project first if you want to keep it. Continue?')) return
        await cancelProjectRetirement(project.snapshot.documents.map((doc) => doc.id)).catch(() => undefined)
        const decoded = Object.entries(project.sources).map(([id, data]) => [id, decodeSource(data)] as const)
        const persisted = await Promise.all(decoded.map(async ([id, bytes]) => {
          try { await putProjectSource(id, bytes); return true } catch { return false }
        }))
        releaseAll()
        releaseProxies()
        for (const [id, bytes] of decoded) {
          const doc = project.snapshot.documents.find((item) => item.id === id)
          if (doc !== undefined) keepSource(doc.fileName, bytes)
        }
        apply(project)
        const retained = new Set(project.snapshot.documents.map((doc) => doc.id))
        void retireProjectSources(documents.filter((doc) => !retained.has(doc.id)).map((doc) => doc.id)).catch(() => undefined)
        const missing = project.snapshot.documents.length - decoded.length
        if (missing > 0 || persisted.includes(false)) {
          notify({ variant: 'warning', title: 'Project opened with missing originals', description: 'Cards are editable, but some original PDFs may need to be added again for re-running or saving a complete project.' })
        } else {
          notify({ variant: 'success', title: 'Project opened', description: 'Your cards and settings are ready.' })
        }
      } catch {
        notify({ variant: 'error', title: 'Could not open project', description: 'The file is damaged or is not a supported CrewBTC project. Your current workspace was not changed.' })
      } finally { setBusy(false) }
    })()
  }, [documents, apply, notify])
  return { save, open, busy }
}
