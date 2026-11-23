import type { Project } from './project'

/** Compact on-disk version 4. Asset references are local to this project file. */
export function serializeProject(project: Project): string {
  const images: string[] = []
  const imageIds = new Map<string, number>()
  const pdfs: string[] = []
  const pdfIds = new Map<string, number>()
  const intern = (data: string, list: string[], ids: Map<string, number>): number => {
    const known = ids.get(data)
    if (known !== undefined) return known
    const id = list.length
    list.push(data); ids.set(data, id)
    return id
  }
  const sourceRefs: Record<string, number> = Object.create(null) as Record<string, number>
  for (const [id, data] of Object.entries(project.sources)) sourceRefs[id] = intern(data, pdfs, pdfIds)
  const { stations, activeStationId, savedAt } = project.snapshot
  const compact = {
    format: project.format, version: 4,
    snapshot: { version: project.snapshot.version, stations, activeStationId, savedAt },
    sheet: project.sheet, preferences: project.preferences, showCutMarks: project.showCutMarks,
    keywords: project.keywords, sources: sourceRefs, images, pdfs,
  }
  return JSON.stringify(compact, (key, value: unknown) => {
    if ((key === 'dataUrl' || key === 'pagePreviewUrl') && typeof value === 'string' && value.startsWith('data:image/')) {
      return { $image: intern(value, images, imageIds) }
    }
    return value
  })
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Expand references before the ordinary project validator runs; never trust an asset index. */
export function expandCompactProject(raw: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(raw.images) || !raw.images.every((item: unknown) => typeof item === 'string' && item.startsWith('data:image/')) ||
      !Array.isArray(raw.pdfs) || !raw.pdfs.every((item: unknown) => typeof item === 'string') ||
      !isRecord(raw.snapshot) || raw.snapshot.version !== 4 || !Array.isArray(raw.snapshot.stations) ||
      typeof raw.snapshot.activeStationId !== 'string' || !isRecord(raw.sources)) throw new Error('Invalid project assets.')
  const snapshot = raw.snapshot
  const images = raw.images as string[]
  const pdfs = raw.pdfs as string[]
  const visit = (value: unknown, key = ''): unknown => {
    if ((key === 'dataUrl' || key === 'pagePreviewUrl') && isRecord(value)) {
      const id = value.$image
      if (Object.keys(value).length !== 1 || !Number.isSafeInteger(id) || typeof id !== 'number' || id < 0 || id >= images.length) throw new Error('Invalid image reference.')
      return images[id]
    }
    if (Array.isArray(value)) return value.map((item) => visit(item))
    if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, visit(item, name)]))
    return value
  }
  const stations = visit(snapshot.stations)
  if (!Array.isArray(stations)) throw new Error('Invalid project stations.')
  const active = stations.find((station: unknown) => isRecord(station) && station.id === snapshot.activeStationId)
  if (!isRecord(active)) throw new Error('Invalid active station.')
  const sources: Record<string, string> = Object.create(null) as Record<string, string>
  for (const [id, value] of Object.entries(raw.sources)) {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value >= pdfs.length) throw new Error('Invalid PDF reference.')
    sources[id] = pdfs[value]!
  }
  return { ...raw, version: 3, snapshot: { ...snapshot, stations, documents: active.documents, cards: active.cards, activeId: active.activeId }, sources }
}
