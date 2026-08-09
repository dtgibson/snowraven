// @vitest-environment jsdom
//
// The Pin Share preference store (FR-32 to FR-37, QA-38/40/41). The point of the
// module-level store is that the snapshot is the DEFAULT from the very first
// render — never null, never a spinner — and that a change reaches every
// subscriber at once, including a share popup already open on another tab.
//
// Each case re-imports the module through vi.resetModules() so the module-level
// value and the once-per-session hydrate flag start clean.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'

const getSetting = vi.hoisted(() => vi.fn())
const setSetting = vi.hoisted(() => vi.fn())

vi.mock('./storage', () => ({ storage: { getSetting, setSetting } }))

type PrefModule = typeof import('./shareCopyPreference')

async function loadFresh(): Promise<PrefModule> {
  vi.resetModules()
  return import('./shareCopyPreference')
}

beforeEach(() => {
  getSetting.mockReset().mockResolvedValue(null)
  setSetting.mockReset().mockResolvedValue(undefined)
})
afterEach(() => { cleanup() })

describe('normalizeShareCopyMode (FR-35, QA-41)', () => {
  it('accepts only the exact coords-only literal', async () => {
    const { normalizeShareCopyMode } = await loadFresh()
    expect(normalizeShareCopyMode('coords-only')).toBe('coords-only')
  })

  it('treats absent, empty, malformed, and wrong-typed values as the default with no error', async () => {
    const { normalizeShareCopyMode, DEFAULT_SHARE_COPY_MODE } = await loadFresh()
    for (const raw of [null, undefined, '', 'nonsense', 'Coords-Only', 0, 1, true, {}, []]) {
      expect(normalizeShareCopyMode(raw)).toBe(DEFAULT_SHARE_COPY_MODE)
    }
  })
})

describe('useShareCopyMode hydration (FR-32 / FR-34, QA-38 / QA-40)', () => {
  it('the default is coords-and-links, under a stable storage key', async () => {
    const { DEFAULT_SHARE_COPY_MODE, SHARE_COPY_SETTING_KEY } = await loadFresh()
    expect(DEFAULT_SHARE_COPY_MODE).toBe('coords-and-links')
    expect(SHARE_COPY_SETTING_KEY).toBe('shareCopyMode')
  })

  it('renders the default on the FIRST render, before the stored read resolves', async () => {
    let release: (v: unknown) => void = () => {}
    getSetting.mockReturnValue(new Promise(r => { release = r }))
    const { useShareCopyMode } = await loadFresh()
    const { result } = renderHook(() => useShareCopyMode())
    // Never null, never a gate — the feature is fully usable right now.
    expect(result.current).toBe('coords-and-links')
    await act(async () => { release('coords-only') })
    expect(result.current).toBe('coords-only')
  })

  it('keeps the default when the stored read REJECTS (QA-40)', async () => {
    getSetting.mockRejectedValue(new Error('storage unavailable'))
    const { useShareCopyMode } = await loadFresh()
    const { result } = renderHook(() => useShareCopyMode())
    await act(async () => { await Promise.resolve() })
    expect(result.current).toBe('coords-and-links')
  })

  it('a malformed stored value hydrates to the default (QA-41)', async () => {
    getSetting.mockResolvedValue('nonsense')
    const { useShareCopyMode } = await loadFresh()
    const { result } = renderHook(() => useShareCopyMode())
    await act(async () => { await Promise.resolve() })
    expect(result.current).toBe('coords-and-links')
  })

  it('hydrates ONCE per session, not once per subscriber', async () => {
    const { useShareCopyMode } = await loadFresh()
    renderHook(() => useShareCopyMode())
    renderHook(() => useShareCopyMode())
    renderHook(() => useShareCopyMode())
    await act(async () => { await Promise.resolve() })
    expect(getSetting).toHaveBeenCalledTimes(1)
  })
})

describe('setShareCopyMode (FR-33 / FR-36 / FR-37)', () => {
  it('reaches EVERY subscriber immediately, including one in another subtree (FR-36)', async () => {
    const { useShareCopyMode, setShareCopyMode } = await loadFresh()
    const settingsRow = renderHook(() => useShareCopyMode())
    const openPopup = renderHook(() => useShareCopyMode())
    await act(async () => { await Promise.resolve() })

    act(() => { setShareCopyMode('coords-only') })

    expect(settingsRow.result.current).toBe('coords-only')
    expect(openPopup.result.current).toBe('coords-only')
  })

  it('persists through the storage seam under the stable key, with semantic values', async () => {
    const { setShareCopyMode, SHARE_COPY_SETTING_KEY } = await loadFresh()
    setShareCopyMode('coords-only')
    expect(setSetting).toHaveBeenCalledWith(SHARE_COPY_SETTING_KEY, 'coords-only')
    setShareCopyMode('coords-and-links')
    expect(setSetting).toHaveBeenCalledWith(SHARE_COPY_SETTING_KEY, 'coords-and-links')
  })

  it('a failed write leaves the in-session choice applied rather than throwing', async () => {
    setSetting.mockRejectedValue(new Error('disk full'))
    const { useShareCopyMode, setShareCopyMode } = await loadFresh()
    const { result } = renderHook(() => useShareCopyMode())
    await act(async () => { await Promise.resolve() })
    act(() => { setShareCopyMode('coords-only') })
    await act(async () => { await Promise.resolve() })
    expect(result.current).toBe('coords-only')
  })

  it('a choice made WHILE the stored read is in flight is not reverted by it', async () => {
    let release: (v: unknown) => void = () => {}
    getSetting.mockReturnValue(new Promise(r => { release = r }))
    const { useShareCopyMode, setShareCopyMode } = await loadFresh()
    const { result } = renderHook(() => useShareCopyMode())

    act(() => { setShareCopyMode('coords-only') })
    expect(result.current).toBe('coords-only')

    // The slow read comes back with the older stored value; the user's choice wins.
    await act(async () => { release('coords-and-links') })
    expect(result.current).toBe('coords-only')
  })
})
