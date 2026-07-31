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
})
