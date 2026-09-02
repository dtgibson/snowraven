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
