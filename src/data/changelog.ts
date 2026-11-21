import markdown from '../../CHANGELOG.md?release-notes'

export interface ReleaseNote {
  readonly version: string
  readonly date: string
  readonly title: string
  readonly highlights: readonly string[]
}

/** Parse the release section only; the preceding project ledger is not UI copy. */
export function parseReleaseNotes(source: string): readonly ReleaseNote[] {
  const marker = '## Release history'
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const start = lines.indexOf(marker)
  if (start < 0 || lines.indexOf(marker, start + 1) >= 0) throw new Error('Missing or duplicate release history')
  const releases: ReleaseNote[] = []
  let current: { version: string; date: string; title: string; highlights: string[] } | null = null
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === '') continue
    const heading = /^### (\d+\.\d+\.\d+) — (\d{4}-\d{2}-\d{2}) — (\S.*)$/.exec(line)
    if (heading !== null) {
      if (current !== null && current.highlights.length === 0) throw new Error('Release has no highlights')
      current = { version: heading[1]!, date: heading[2]!, title: heading[3]!, highlights: [] }
      releases.push(current)
    } else if (line.startsWith('- ') && line.slice(2).trim() !== '' && current !== null) {
      current.highlights.push(line.slice(2))
    } else {
      throw new Error('Malformed release history')
    }
  }
  if (current === null || current.highlights.length === 0) throw new Error('Release history is empty or incomplete')
  return releases
}

export const CHANGELOG: readonly ReleaseNote[] = parseReleaseNotes(markdown)
