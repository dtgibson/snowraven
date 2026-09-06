// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { storage } from './storage'

afterEach(() => vi.unstubAllGlobals())

describe('WebStorage generic settings writes', () => {
  it('persists the raw boolean preference through the existing settings seam', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await storage.setSetting('disableEmbeddedMedia', true)

    expect(fetchMock).toHaveBeenCalledWith('/settings/disableEmbeddedMedia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'true',
    })
  })

  it('rejects a non-2xx save so Settings can roll back its displayed value', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })))
    await expect(storage.setSetting('disableEmbeddedMedia', true)).rejects.toThrow(/503/)
  })

  it('deletes through the same endpoint', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await storage.deleteSetting('exotic-provenance-v1')

    expect(fetchMock).toHaveBeenCalledWith('/settings/exotic-provenance-v1', { method: 'DELETE' })
  })

  it('rejects a non-2xx DELETE, so a clear cannot report a document it did not remove', async () => {
    // The same reasoning as the save above, on the path that matters most: a
    // swallowed non-2xx here left a derived document on disk while the clear
    // path reported a completed Clear (clear-means-clear).
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })))
    await expect(storage.deleteSetting('exotic-provenance-v1')).rejects.toThrow(/500/)
  })
})

// ml-export-hardening. `deleteSetting` gained the check above in v1.0.14; its two
// siblings on the FILE endpoints did not, and that is where it was doing the most
// damage. The backend has capped uploads at 50 MB all along and answers 413 over
// it, and 400 on a non-.csv name -- and `writeFile` discarded the response, so on
// web and Pi, THE ONLY PLATFORMS THAT EVER RAN THAT CAP, an over-cap upload
// reported success while the slot still held the old file (or nothing). The cap was
// not enforced end to end anywhere.
describe('WebStorage file writes report what the backend actually did', () => {
  const CSV = 'Submission ID,Common Name,Date\nS1,American Robin,2024-05-01\n'

  it('posts the file as multipart form data', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await storage.writeFile('ebird', CSV, 'MyEBirdData.csv')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/settings/files/ebird')
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
  })

  it('rejects the 413 the backend answers over its 50 MB cap', async () => {
    // THE ONE THAT WAS SWALLOWED. Settings' catch turns this into a visible upload
    // failure instead of a completed save over an unchanged slot.
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 413 })))
    await expect(storage.writeFile('ml', CSV, 'ML__2024_abc.csv')).rejects.toThrow(/413/)
  })

  it.each([400, 500, 503])('rejects a %i on a file save', async (status) => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status })))
    await expect(storage.writeFile('ebird', CSV, 'MyEBirdData.csv')).rejects.toThrow(String(status))
  })

  it('deletes through the file endpoint', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await storage.deleteFile('ml')

    expect(fetchMock).toHaveBeenCalledWith('/settings/files/ml', { method: 'DELETE' })
  })

  it.each([500, 503])('rejects a %i DELETE, so a clear cannot report a file it did not remove', async (status) => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status })))
    await expect(storage.deleteFile('ebird')).rejects.toThrow(String(status))
  })

  it('treats 404 on a delete as done, because it IS done', async () => {
    // The backend answers 404 when no file is stored, which is the state the caller
    // asked for. Raising it would put "Delete failed. Please try again." over a row
    // that is already empty and a button the user can no longer press -- the exact
    // message v1.0.14 removed from the clear path one method above this one.
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })))
    await expect(storage.deleteFile('ebird')).resolves.toBeUndefined()
  })
})
