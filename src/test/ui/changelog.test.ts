import { describe, expect, it } from 'vitest'
import { CHANGELOG } from '../../data/changelog'
import pkg from '../../../package.json'

/** The Markdown history drives the UI, and its newest entry must match the package. */
describe('release notes', () => {
  it('has entries', () => {
    expect(CHANGELOG.length).toBeGreaterThan(0)
  })

  it('starts with the version in package.json', () => {
    expect(CHANGELOG[0]?.version).toBe(pkg.version)
  })

  it('gives every release a version, an ISO date, a title and highlights', () => {
    for (const release of CHANGELOG) {
      expect(release.version).toMatch(/^\d+\.\d+\.\d+$/)
      expect(release.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(release.title.trim()).not.toBe('')
      expect(release.highlights.length).toBeGreaterThan(0)
      for (const highlight of release.highlights) {
        expect(highlight.trim()).not.toBe('')
      }
    }
  })

  it('never repeats a version', () => {
    const versions = CHANGELOG.map((release) => release.version)
    expect(new Set(versions).size).toBe(versions.length)
  })

  it('is ordered newest first', () => {
    const asNumbers = CHANGELOG.map((release) =>
      release.version.split('.').map((part) => Number.parseInt(part, 10)),
    )
    for (let index = 1; index < asNumbers.length; index += 1) {
      const previous = asNumbers[index - 1] as number[]
      const current = asNumbers[index] as number[]
      const [aMajor = 0, aMinor = 0, aPatch = 0] = previous
      const [bMajor = 0, bMinor = 0, bPatch = 0] = current
      const older = aMajor > bMajor ||
        (aMajor === bMajor && aMinor > bMinor) ||
        (aMajor === bMajor && aMinor === bMinor && aPatch > bPatch)
      expect(older).toBe(true)
    }
  })
})
