import releases from './changelog.json'

export interface ReleaseNote {
  readonly version: string
  readonly date: string
  readonly title: string
  readonly highlights: readonly string[]
}

/**
 * Single source of truth for release notes, kept in sync with `package.json` (§9).
 *
 * The entries live in `changelog.json` rather than a TypeScript literal on purpose: this
 * data grows with every release and never shrinks, while `max-lines` (250) is a rule
 * about keeping *code* readable. Trimming release history to satisfy a lint rule would
 * destroy the one thing a changelog exists to provide, so the data moved out and the
 * module stayed a thin typed wrapper.
 */
export const CHANGELOG: readonly ReleaseNote[] = releases
