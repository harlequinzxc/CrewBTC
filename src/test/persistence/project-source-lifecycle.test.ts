import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { putProjectSource, getProjectSource, retireProjectSources, cancelProjectRetirement, sweepProjectSources } from '../../lib/storage/project-sources'
import { writeSnapshot } from '../../lib/storage/snapshot'

const empty = () => writeSnapshot({ version: 3, documents: [], cards: {}, activeId: null, savedAt: 'now' })

describe('original PDF lifecycle', () => {
  it('reclaims retired originals after the undo window', async () => {
    await empty()
    await putProjectSource('removed-a', new Uint8Array([1]).buffer)
    await retireProjectSources(['removed-a'])
    expect(await getProjectSource('removed-a')).not.toBeNull()
    await sweepProjectSources(Date.now() + 60_000)
    expect(await getProjectSource('removed-a')).toBeNull()
  })
  it('preserves a restored original when Undo cancels retirement', async () => {
    await empty()
    await putProjectSource('undo-b', new Uint8Array([2]).buffer)
    await retireProjectSources(['undo-b'])
    await cancelProjectRetirement(['undo-b'])
    await sweepProjectSources(Date.now() + 60_000)
    expect(await getProjectSource('undo-b')).not.toBeNull()
  })
  it('keeps a retired source referenced by the saved workspace', async () => {
    await putProjectSource('active-c', new Uint8Array([3]).buffer)
    await retireProjectSources(['active-c'])
    await writeSnapshot({ version: 3, documents: [{ id: 'active-c', fileName: 'a.pdf', status: 'failed', copies: {}, photos: {}, regions: [] } as never], cards: {}, activeId: null, savedAt: 'now' })
    await sweepProjectSources(Date.now() + 60_000)
    expect(await getProjectSource('active-c')).not.toBeNull()
  })
})

describe('interrupted cleanup', () => {
  it('revisits a retired source once it is no longer in the snapshot', async () => {
    await putProjectSource('revisit-d', new Uint8Array([4]).buffer)
    await retireProjectSources(['revisit-d'])
    await writeSnapshot({ version: 3, documents: [{ id: 'revisit-d', fileName: 'a.pdf', status: 'failed', copies: {}, photos: {}, regions: [] } as never], cards: {}, activeId: null, savedAt: 'now' })
    await sweepProjectSources(Date.now() + 60_000)
    expect(await getProjectSource('revisit-d')).not.toBeNull()
    await empty()
    await sweepProjectSources(Date.now() + 60_000)
    expect(await getProjectSource('revisit-d')).toBeNull()
  })
})
