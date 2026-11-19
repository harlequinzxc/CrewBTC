/**
 * Schema v1 — the initial IndexedDB shape. Documented here so the upgrade path is
 * reviewable in one place, and tested in `0001-init.test.ts` against a v0 database.
 */
export const V1_STORES = ['settings', 'templates', 'batches', 'ui'] as const

export type V1StoreName = (typeof V1_STORES)[number]
