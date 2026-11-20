/**
 * Schema v1 — the initial IndexedDB shape. Documented here so the upgrade path is
 * reviewable in one place, and tested in `0001-init.test.ts` against a v0 database.
 *
 * `batches` is listed because v1 created it, and an already-installed database still has
 * it. It was never written to: the session lives in its own database (`lib/storage/
 * snapshot.ts`) because putting it here would mean an `onupgradeneeded` step — the one
 * unrecoverable place in IndexedDB — for a feature that shares no records with these
 * stores. New databases no longer create it; the old one is inert, and dropping it would
 * cost a version bump to reclaim nothing.
 */
export const V1_STORES = ['settings', 'templates', 'batches', 'ui'] as const

export type V1StoreName = (typeof V1_STORES)[number]
