import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { StyleSpecification } from 'maplibre-gl'
import type { PersistedStyle } from './storage'

// Mock the storage seam — persistedStyle.ts is pure logic over getStyleBlob/
// setStyleBlob, so we drive it through controllable stubs.
const getStyleBlob = vi.fn<(variant: string) => Promise<PersistedStyle | null>>()
const setStyleBlob = vi.fn<(variant: string, blob: PersistedStyle) => Promise<void>>()
vi.mock('./storage', () => ({
  storage: {
    getStyleBlob: (...a: [string]) => getStyleBlob(...a),
    setStyleBlob: (...a: [string, PersistedStyle]) => setStyleBlob(...a),
  },
}))

import {
  readPersistedStyle,
  persistStyle,
  revalidateStyleOnce,
  persistedStyleKey,
  __resetPersistedStyleCaches,
} from './persistedStyle'

const STYLE = { version: 8, name: 'x', sources: {}, layers: [] } as unknown as StyleSpecification

beforeEach(() => {
  __resetPersistedStyleCaches()
  getStyleBlob.mockReset()
  setStyleBlob.mockReset()
  setStyleBlob.mockResolvedValue(undefined)
})

describe('persistedStyleKey', () => {
  it('scopes the seam key by variant', () => {
    expect(persistedStyleKey('positron')).toBe('map-style-positron')
    expect(persistedStyleKey('liberty')).toBe('map-style-liberty')
  })
})

describe('readPersistedStyle', () => {
  it('coalesces N concurrent callers to ONE getStyleBlob read', async () => {
    let resolve!: (v: PersistedStyle | null) => void
    getStyleBlob.mockReturnValue(new Promise<PersistedStyle | null>(r => { resolve = r }))

    const blob: PersistedStyle = { variant: 'positron', style: STYLE, savedAt: 1 }
    const calls = [
      readPersistedStyle('positron'),
      readPersistedStyle('positron'),
      readPersistedStyle('positron'),
    ]
    resolve(blob)
    const results = await Promise.all(calls)

    expect(getStyleBlob).toHaveBeenCalledTimes(1)
    for (const r of results) expect(r).toBe(blob)
  })

  it('memoizes after settle — a later read does not hit the seam again', async () => {
    const blob: PersistedStyle = { variant: 'positron', style: STYLE, savedAt: 1 }
    getStyleBlob.mockResolvedValue(blob)

    expect(await readPersistedStyle('positron')).toBe(blob)
    expect(await readPersistedStyle('positron')).toBe(blob)
    expect(getStyleBlob).toHaveBeenCalledTimes(1)
  })

  it('memoizes a null (no persisted copy) without re-reading', async () => {
    getStyleBlob.mockResolvedValue(null)
    expect(await readPersistedStyle('positron')).toBeNull()
    expect(await readPersistedStyle('positron')).toBeNull()
    expect(getStyleBlob).toHaveBeenCalledTimes(1)
  })

  it('reads each variant independently (one read per key)', async () => {
    getStyleBlob.mockImplementation(async (v: string) =>
      ({ variant: v, style: STYLE, savedAt: 1 }))
    const a = await readPersistedStyle('positron')
    const b = await readPersistedStyle('liberty')
    expect(a?.variant).toBe('positron')
    expect(b?.variant).toBe('liberty')
    expect(getStyleBlob).toHaveBeenCalledTimes(2)
  })

  it('covers the shipped typed caller domain at domain+1 without retained growth', async () => {
    // VectorVariant is exactly positron | liberty; production SnowMap currently
    // calls only positron. Across that shipped call graph, a third call must be
    // a repeat. The underlying helpers accept string and are not structurally
    // bounded by this test.
    getStyleBlob.mockImplementation(async (v: string) =>
      ({ variant: v, style: STYLE, savedAt: 1 }))
    const requested = ['positron', 'liberty', 'positron'] as const
    const results = []
    for (const variant of requested) results.push(await readPersistedStyle(variant))

    expect(results.map(r => r?.variant)).toEqual(requested)
    expect(getStyleBlob.mock.calls.map(([variant]) => variant))
      .toEqual(['positron', 'liberty'])
  })

  it('resolves null when the seam read rejects (degrades, never throws)', async () => {
    getStyleBlob.mockRejectedValue(new Error('disk fail'))
    expect(await readPersistedStyle('positron')).toBeNull()
  })
})

describe('persistStyle', () => {
  it('writes a {variant, style, savedAt} blob through the seam', async () => {
    const before = Date.now()
    await persistStyle('positron', STYLE)
    const after = Date.now()

    expect(setStyleBlob).toHaveBeenCalledTimes(1)
    const [variant, blob] = setStyleBlob.mock.calls[0]
    expect(variant).toBe('positron')
    expect(blob.variant).toBe('positron')
    expect(blob.style).toBe(STYLE)
    expect(blob.savedAt).toBeGreaterThanOrEqual(before)
    expect(blob.savedAt).toBeLessThanOrEqual(after)
  })

  it('refreshes the in-session mem mirror (next read returns the just-persisted blob, no seam read)', async () => {
    await persistStyle('positron', STYLE)
    const read = await readPersistedStyle('positron')
    expect(read?.style).toBe(STYLE)
    expect(getStyleBlob).not.toHaveBeenCalled()
  })
})

describe('revalidateStyleOnce', () => {
  it('fires the fetch + persist exactly once per variant per session', async () => {
    const fresh = { version: 8, name: 'fresh', sources: {}, layers: [] } as unknown as StyleSpecification
    const fetchStyle = vi.fn(async () => fresh)

    revalidateStyleOnce('positron', fetchStyle)
    revalidateStyleOnce('positron', fetchStyle)
    revalidateStyleOnce('positron', fetchStyle)
    await Promise.resolve(); await Promise.resolve()

    expect(fetchStyle).toHaveBeenCalledTimes(1)
    expect(setStyleBlob).toHaveBeenCalledTimes(1)
    expect(setStyleBlob.mock.calls[0][1].style).toBe(fresh)
  })

  it('revalidates each variant independently', async () => {
    const fetchStyle = vi.fn(async () => STYLE)
    revalidateStyleOnce('positron', fetchStyle)
    revalidateStyleOnce('liberty', fetchStyle)
    await Promise.resolve(); await Promise.resolve()
    expect(fetchStyle).toHaveBeenCalledTimes(2)
  })

  it('swallows a failed fetch without persisting (leaves the persisted copy untouched)', async () => {
    const fetchStyle = vi.fn(async () => { throw new Error('offline') })
    revalidateStyleOnce('positron', fetchStyle)
    await Promise.resolve(); await Promise.resolve()
    expect(fetchStyle).toHaveBeenCalledTimes(1)
    expect(setStyleBlob).not.toHaveBeenCalled()
  })

  it('does not return the fresh style (no React state path)', () => {
    const fetchStyle = vi.fn(async () => STYLE)
    expect(revalidateStyleOnce('positron', fetchStyle)).toBeUndefined()
  })
})
