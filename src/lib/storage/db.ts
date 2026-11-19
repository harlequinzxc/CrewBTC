import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { TemplatePreset } from '../../types/template'
import type { PageSettings } from '../../types/settings'

export const DB_NAME = 'print-studio'
export const SCHEMA_VERSION = 1

export interface SettingsRecord {
  readonly id: 'page'
  readonly settings: PageSettings
  readonly updatedAt: string
}

export interface BatchRecord {
  readonly id: string
  readonly name: string
  readonly createdAt: string
  readonly sourceBytes: ArrayBuffer
  readonly byteLength: number
}

export interface UiStateRecord {
  readonly id: 'workspace'
  readonly activeFileId: string | null
  readonly updatedAt: string
}

interface PrintStudioSchema extends DBSchema {
  settings: { key: string; value: SettingsRecord }
  templates: { key: string; value: TemplatePreset }
  batches: { key: string; value: BatchRecord }
  ui: { key: string; value: UiStateRecord }
}

export type Database = IDBPDatabase<PrintStudioSchema>

let connection: Promise<Database> | null = null

/** One connection for the app. Migrations are one-way and versioned (§5A). */
export function getDb(): Promise<Database> {
  connection ??= openDatabase()
  return connection
}

async function openDatabase(): Promise<Database> {
  return openDB<PrintStudioSchema>(DB_NAME, SCHEMA_VERSION, {
    upgrade(db, fromVersion) {
      // Each step is additive and never rewrites history in place.
      if (fromVersion < 1) {
        db.createObjectStore('settings', { keyPath: 'id' })
        db.createObjectStore('templates', { keyPath: 'id' })
        db.createObjectStore('batches', { keyPath: 'id' })
        db.createObjectStore('ui', { keyPath: 'id' })
      }
    },
  })
}

export async function readSettings(): Promise<PageSettings | null> {
  const db = await getDb()
  const record = await db.get('settings', 'page')
  return record?.settings ?? null
}

export async function writeSettings(settings: PageSettings): Promise<void> {
  const db = await getDb()
  const record: SettingsRecord = { id: 'page', settings, updatedAt: new Date().toISOString() }
  await db.put('settings', record, 'page')
}

export async function requestPersistence(): Promise<boolean> {
  if (typeof navigator.storage?.persist !== 'function') return false
  try {
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
