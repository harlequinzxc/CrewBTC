import { EMPTY_KEYWORDS, validKeywords } from '../../types/format-keywords'
import type { Keywords } from '../../types/format-keywords'
import { validate } from '../storage/snapshot'
import { validateSheet } from '../imposition/grid'
import type { WorkspaceSnapshot } from '../../types/persisted'
import type { SheetSettings } from '../../types/imposition'
import type { PageSettings } from '../../types/settings'

export interface Project {
  readonly format: 'crewbtc-project'
  readonly version: 2
  readonly snapshot: WorkspaceSnapshot
  readonly sheet: SheetSettings
  readonly preferences: PageSettings
  readonly showCutMarks: boolean
  readonly keywords: Keywords
  /** Base64 PDFs keyed by the corresponding document UUID. Missing entries are allowed. */
  readonly sources: Readonly<Record<string, string>>
}

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const photo = (v: unknown): boolean => v === null || (record(v) && typeof v.dataUrl === 'string' && v.dataUrl.startsWith('data:image/') && finite(v.widthPx) && v.widthPx > 0 && finite(v.heightPx) && v.heightPx > 0)
const style = (v: unknown): boolean => record(v) && typeof v.bold === 'boolean' && typeof v.color === 'string' && (v.highlight === null || typeof v.highlight === 'string') && (v.align === undefined || v.align === 'left' || v.align === 'center') && (v.uppercase === undefined || typeof v.uppercase === 'boolean')
const runs = (v: unknown): boolean => v === undefined || (Array.isArray(v) && v.every((r: unknown) => record(r) && finite(r.start) && finite(r.end) &&
  (r.bold === undefined || typeof r.bold === 'boolean') && (r.color === undefined || typeof r.color === 'string') &&
  (r.highlight === undefined || r.highlight === null || typeof r.highlight === 'string') &&
  (r.uppercase === undefined || typeof r.uppercase === 'boolean') && (r.align === undefined || r.align === 'left' || r.align === 'center')))
function card(v: unknown): boolean {
  if (!record(v) || !record(v.bands) || !record(v.imageTransform)) return false
  return typeof v.headerText === 'string' && typeof v.bodyText === 'string' && photo(v.photo) &&
    style(v.headerStyle) && style(v.bodyStyle) && runs(v.headerRuns) && runs(v.bodyRuns) &&
    finite(v.bands.headerMm) && finite(v.bands.footerMm) && finite(v.imageTransform.offsetXMm) &&
    finite(v.imageTransform.offsetYMm) && finite(v.imageTransform.scale) && v.imageTransform.scale > 0 &&
    (v.numberStart === undefined || finite(v.numberStart)) &&
    (v.cornerLabelStart === undefined || typeof v.cornerLabelStart === 'string') &&
    (v.cornerLabel === undefined || typeof v.cornerLabel === 'string') &&
    (v.textScale === undefined || finite(v.textScale)) &&
    (v.displayNumber === undefined || finite(v.displayNumber)) &&
    (v.displayCornerLabel === undefined || typeof v.displayCornerLabel === 'string') &&
    (v.cornerLabelMirrored === undefined || typeof v.cornerLabelMirrored === 'boolean')
}

/** Never replace the workspace until the entire file has been checked. */
export function parseProject(text: string): Project {
  const raw: unknown = JSON.parse(text)
  if (!record(raw) || raw.format !== 'crewbtc-project' || raw.version !== 1 && raw.version !== 2) throw new Error('Unsupported or invalid project file.')
  const snapshot = validate(raw.snapshot)
  if (snapshot === null || !record(snapshot.cards) || !Object.values(snapshot.cards).every(card)) throw new Error('Invalid project cards or documents.')
  if (!snapshot.documents.every((d) => typeof d.fileName === 'string' && typeof d.id === 'string' && typeof d.addedAt === 'string' && finite(d.byteLength) && ['parsed', 'failed'].includes(d.status) && record(d.copies) && record(d.photos) && (d.pagePreviewUrl === null || typeof d.pagePreviewUrl === 'string') && photo(d.photoUrl) && (d.error === null || typeof d.error === 'string') &&
    d.regions.every((r) => record(r) && typeof r.id === 'string' && typeof r.text === 'string' && finite(r.fontSizeRatio) && record(r.box) && finite(r.box.x) && finite(r.box.y) && finite(r.box.width) && finite(r.box.height)) &&
    (d.copy === null || (record(d.copy) && typeof d.copy.header === 'string' && typeof d.copy.footer === 'string')) &&
    (d.metrics === null || (record(d.metrics) && finite(d.metrics.pageCount) && Number.isInteger(d.metrics.pageCount) && d.metrics.pageCount >= 0 && d.metrics.pageCount <= 10000 && finite(d.metrics.widthPt) && finite(d.metrics.heightPt))) &&
    Object.values(d.photos).every(photo) && Object.values(d.copies).every((c) => record(c) && typeof c.header === 'string' && typeof c.footer === 'string'))) throw new Error('Invalid project documents.')
  if (!record(raw.sheet) || typeof raw.sheet.rotateCells !== 'boolean' || !validateSheet(raw.sheet as unknown as SheetSettings).ok || !finite(raw.sheet.textScale) || raw.sheet.textScale < 0.6 || raw.sheet.textScale > 2) throw new Error('Invalid project sheet settings.')
  if (!record(raw.preferences) || !['mm', 'cm', 'in'].includes(String(raw.preferences.units)) || typeof raw.showCutMarks !== 'boolean' || !record(raw.sources)) throw new Error('Invalid project settings or sources.')
  if (raw.version === 2 && !validKeywords(raw.keywords)) throw new Error('Invalid project formatting keywords.')
  const keywords = raw.version === 2 && validKeywords(raw.keywords) ? raw.keywords : EMPTY_KEYWORDS
  for (const [id, data] of Object.entries(raw.sources)) {
    if (!snapshot.documents.some((d) => d.id === id) || typeof data !== 'string') throw new Error('Invalid project source.')
    try { if (!atob(data).slice(0, 1024).includes('%PDF-')) throw new Error() } catch { throw new Error('Invalid PDF in project.') }
  }
  return { format: 'crewbtc-project', version: 2, snapshot, sheet: raw.sheet as unknown as SheetSettings, preferences: raw.preferences as unknown as PageSettings, showCutMarks: raw.showCutMarks, keywords, sources: raw.sources as Record<string, string> }
}

export function encodeSource(bytes: ArrayBuffer): string {
  const data = new Uint8Array(bytes)
  let binary = ''
  for (let i = 0; i < data.length; i += 0x8000) binary += String.fromCharCode(...data.subarray(i, i + 0x8000))
  return btoa(binary)
}

export function decodeSource(data: string): ArrayBuffer {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}
