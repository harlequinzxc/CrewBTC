import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

/** Only ship the UI release history, not the engineering ledger above it. */
export function releaseNotesPlugin(): Plugin {
  const file = resolve(process.cwd(), 'CHANGELOG.md')
  return {
    name: 'crewbtc-release-notes',
    enforce: 'pre',
    load(id) {
      if (id !== `${file}?release-notes`) return null
      this.addWatchFile(file)
      const source = readFileSync(file, 'utf8')
      const marker = '## Release history'
      const start = source.indexOf(`\n${marker}\n`)
      if (start < 0) throw new Error('CHANGELOG.md is missing its release history')
      return `export default ${JSON.stringify(source.slice(start + 1))}`
    },
  }
}
