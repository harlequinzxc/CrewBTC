import { beforeEach, describe, expect, it } from 'vitest'
import { keepSource, releaseAll, sourceVersion } from '../lib/export/doc-cache'
import { thumbnailKey } from '../lib/pdf/thumbnails'

/**
 * The cell-artwork tests mock `thumbnailKey`, which proves the hook discards stale
 * renders *if* the key changes. This file tests the real key, so the two together
 * cover the whole path from "bytes replaced" to "old artwork is gone".
 */
beforeEach(() => {
  releaseAll()
})

describe('thumbnail key identity', () => {
  it('changes when the same file name holds new bytes', () => {
    keepSource('cards.pdf', new ArrayBuffer(8))
    const before = thumbnailKey('cards.pdf', 1)

    keepSource('cards.pdf', new ArrayBuffer(16))
    const after = thumbnailKey('cards.pdf', 1)

    expect(after).not.toBe(before)
  })

  it('stays the same when nothing changes, so pages are not re-rendered', () => {
    keepSource('cards.pdf', new ArrayBuffer(8))
    expect(thumbnailKey('cards.pdf', 3)).toBe(thumbnailKey('cards.pdf', 3))
  })

  it('separates pages of the same file', () => {
    keepSource('cards.pdf', new ArrayBuffer(8))
    expect(thumbnailKey('cards.pdf', 1)).not.toBe(thumbnailKey('cards.pdf', 2))
  })

  it('separates files that share a page number', () => {
    keepSource('a.pdf', new ArrayBuffer(8))
    keepSource('b.pdf', new ArrayBuffer(8))
    expect(thumbnailKey('a.pdf', 1)).not.toBe(thumbnailKey('b.pdf', 1))
  })

  it('forgets a released file, so its artwork cannot outlive it', () => {
    keepSource('cards.pdf', new ArrayBuffer(8))
    expect(sourceVersion('cards.pdf')).toBeGreaterThan(0)

    releaseAll()
    expect(sourceVersion('cards.pdf')).toBe(0)
    // A fresh upload must not collide with the key issued before the clear.
    const beforeClear = 'cards.pdf#1#1'
    keepSource('cards.pdf', new ArrayBuffer(8))
    expect(thumbnailKey('cards.pdf', 1)).not.toBe(beforeClear)
  })
})
