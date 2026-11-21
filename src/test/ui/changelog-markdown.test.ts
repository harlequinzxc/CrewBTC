import { describe, expect, it } from 'vitest'
import { parseReleaseNotes } from '../../data/changelog'

describe('Markdown release history', () => {
  const source = '# Project memory\n\n## Current state\n- Not a release note\n\n## Release history\n\n### 1.2.3 — 2026-11-19 — New capability\n- First note\n- Second note\n\n### 1.2.2 — 2026-11-18 — Fix\n- Earlier note\n'
  it('reads only the release history, preserving its order and text', () => {
    expect(parseReleaseNotes(source)).toEqual([
      { version: '1.2.3', date: '2026-11-19', title: 'New capability', highlights: ['First note', 'Second note'] },
      { version: '1.2.2', date: '2026-11-18', title: 'Fix', highlights: ['Earlier note'] },
    ])
  })
  it('rejects a missing section or malformed entries rather than silently hiding history', () => {
    expect(() => parseReleaseNotes('# No history')).toThrow()
    expect(() => parseReleaseNotes('## Release history\n\n### bad heading\n- note')).toThrow()
    expect(() => parseReleaseNotes('## Release history\n\n### 1.0.0 — 2026-11-19 — Missing highlights\n')).toThrow()
  })
})
