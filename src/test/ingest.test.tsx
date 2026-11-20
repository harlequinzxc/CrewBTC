import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import { isPdfFile, rejectedFiles, ingestFile } from '../lib/pdf/ingest'
import { describePdfError } from '../lib/pdf/client'

function makeFile(name: string, type: string, bytes = new Uint8Array([1, 2, 3])): File {
  return new File([bytes], name, { type })
}

describe('file acceptance', () => {
  it('accepts by MIME type or extension', () => {
    expect(isPdfFile(makeFile('a.pdf', 'application/pdf'))).toBe(true)
    expect(isPdfFile(makeFile('a.PDF', ''))).toBe(true)
    expect(isPdfFile(makeFile('a.png', 'image/png'))).toBe(false)
  })

  it('separates rejected files', () => {
    const files = [makeFile('ok.pdf', 'application/pdf'), makeFile('no.txt', 'text/plain')]
    expect(rejectedFiles(files)).toEqual(['no.txt'])
  })
})

describe('ingest failure handling', () => {
  it('reports a non-PDF without throwing', async () => {
    const document = await ingestFile(makeFile('notes.txt', 'text/plain'))
    expect(document.status).toBe('failed')
    expect(document.error).toBe('Not a PDF file')
  })

  it('reports an empty file', async () => {
    const document = await ingestFile(makeFile('empty.pdf', 'application/pdf', new Uint8Array()))
    expect(document.status).toBe('failed')
    expect(document.error).toBe('File is empty')
  })

  it('reports an unreadable PDF rather than crashing', async () => {
    const garbage = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10, 1, 2, 3, 4, 5])
    const document = await ingestFile(makeFile('broken.pdf', 'application/pdf', garbage))
    expect(document.status).toBe('failed')
    expect(document.error).not.toBeNull()
    expect(document.error).not.toContain('undefined')
  })

  it('emits a parsing update before settling', async () => {
    const onUpdate = vi.fn()
    await ingestFile(makeFile('x.txt', 'text/plain'), { onUpdate })
    expect(onUpdate).toHaveBeenCalled()
    expect(onUpdate.mock.calls[0]?.[0]).toMatchObject({ status: 'parsing' })
  })
})

describe('pdf error copy', () => {
  it('never leaks raw internals', () => {
    const named = new Error('boom')
    named.name = 'PasswordException'
    expect(describePdfError(named)).toBe('PDF is password protected')
    expect(describePdfError(new Error('some internal stack'))).toBe('PDF could not be read')
    expect(describePdfError('a string')).toBe('PDF could not be read')
  })
})
