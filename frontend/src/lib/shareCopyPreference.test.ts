// @vitest-environment jsdom
//
// The Pin Share preference store (FR-32 to FR-37, QA-38/40/41). The point of the
// module-level store is that the snapshot is the DEFAULT from the very first
// render — never null, never a spinner — and that a change reaches every
// subscriber at once, including a share popup already open on another tab.
//
// The migration half is the defect risk of this change: the stored value widened
// from a v0.5.80 string literal to a {coords, google, apple} object under the
// SAME key, so the normalizer has to recognise both literals rather than letting
// them fall through to the default.
//
// Each case re-imports the module through vi.resetModules() so the module-level
// value and the once-per-session hydrate flag start clean.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'

const getSetting = vi.hoisted(() => vi.fn())
const setSetting = vi.hoisted(() => vi.fn())

vi.mock('./storage', () => ({ storage: { getSetting, setSetting } }))

type PrefModule = typeof import('./shareCopyPreference')

const ALL_ON = { coords: true, google: true, apple: true }
const COORDS_ONLY = { coords: true, google: false, apple: false }
const ALL_OFF = { coords: false, google: false, apple: false }

async function loadFresh(): Promise<PrefModule> {
  vi.resetModules()
  return import('./shareCopyPreference')
}

beforeEach(() => {
  getSetting.mockReset().mockResolvedValue(null)
  setSetting.mockReset().mockResolvedValue(undefined)
})
afterEach(() => { cleanup() })

describe('migrating the v0.5.80 stored literals (the defect this change could ship)', () => {
  it('maps the "coords-only" literal to coordinates ON and both links OFF', async () => {
    // THE test. Without an explicit branch for this literal it falls through to
    // the default, and a user who deliberately chose "Copy coordinates only"
    // silently starts copying two links again on first launch after upgrading.
    // Delete the 'coords-only' entry from LEGACY and only this case fails.
    const { normalizeShareCopySelection } = await loadFresh()
    expect(normalizeShareCopySelection('coords-only')).toEqual(COORDS_ONLY)
  })

  it('maps the "coords-and-links" literal to all three ON', async () => {
    // It coincides with the default today, so a fall-through would pass by
    // accident. Asserted as its own branch so it survives a default change.
    const { normalizeShareCopySelection } = await loadFresh()
    expect(normalizeShareCopySelection('coords-and-links')).toEqual(ALL_ON)
  })

  it('hydrates an UPGRADING profile through the store, not just the pure function', async () => {
    // End to end: the stored literal is what storage actually returns on the
    // first launch after the upgrade.
    getSetting.mockResolvedValue('coords-only')
    const { useShareCopySelection } = await loadFresh()
    const { result } = renderHook(() => useShareCopySelection())
    await act(async () => { await Promise.resolve() })
    expect(result.current).toEqual(COORDS_ONLY)
  })

  it('treats an ABSENT value as all three on, the superset', async () => {
    const { normalizeShareCopySelection } = await loadFresh()
    expect(normalizeShareCopySelection(null)).toEqual(ALL_ON)
    expect(normalizeShareCopySelection(undefined)).toEqual(ALL_ON)
  })

  it('treats a MALFORMED value as all three on, with no error', async () => {
    // A failed read must never silently REMOVE something the person was copying,
    // so every unrecognised shape lands on the superset.
    const { normalizeShareCopySelection } = await loadFresh()
    for (const raw of ['', 'nonsense', 'Coords-Only', 0, 1, true, [], ['coords'], NaN]) {
      expect(normalizeShareCopySelection(raw)).toEqual(ALL_ON)
    }
  })

  it('does not mistake an INHERITED Object.prototype member for a legacy literal', async () => {
    // The legacy table is an ordinary object literal, so a bare `LEGACY[raw]`
    // resolves these eight strings to a truthy inherited member, takes the
    // legacy arm, and spreads a function or an object to {} — every switch off,
    // rather than the default this contract promises. It failed closed and
    // polluted nothing, so it was never a crash or an escalation; it was the
    // stated behaviour and the real behaviour disagreeing. Object.hasOwn is
    // what makes the lookup allowlist driven.
    const { normalizeShareCopySelection } = await loadFresh()
    const INHERITED = [
      'constructor', '__proto__', 'toString', 'valueOf',
      'hasOwnProperty', 'isPrototypeOf', 'toLocaleString', 'propertyIsEnumerable',
    ]
    for (const raw of INHERITED) {
      expect(normalizeShareCopySelection(raw)).toEqual(ALL_ON)
    }
  })

  it('pollutes nothing, whatever it is handed', async () => {
    // The other half of the same corpus: reading these strings (and an object
    // carrying them as KEYS) must not touch Object.prototype. The object branch
    // is inert by construction — it writes only the fixed SHARE_PARTS keys onto
    // a fresh object — and this holds that property down.
    const { normalizeShareCopySelection } = await loadFresh()
    const probe = () => (Object.prototype as unknown as Record<string, unknown>).polluted

    normalizeShareCopySelection('__proto__')
    normalizeShareCopySelection({ __proto__: { polluted: true } })
    normalizeShareCopySelection(JSON.parse('{"__proto__":{"polluted":true},"coords":false}'))
    normalizeShareCopySelection({ constructor: { prototype: { polluted: true } } })

    expect(probe()).toBeUndefined()
    // …and a stored object carrying a hostile key still yields a clean selection.
    expect(normalizeShareCopySelection(JSON.parse('{"__proto__":{"polluted":true},"coords":false}')))
      .toEqual({ coords: false, google: true, apple: true })
    expect(probe()).toBeUndefined()
  })

  it('round-trips a written object, including every switch OFF', async () => {
    // All-off is a legitimate stored state, not a malformed one. Rejects a
    // normalizer that treats a falsy-looking object as absent.
    const { normalizeShareCopySelection } = await loadFresh()
    expect(normalizeShareCopySelection(ALL_OFF)).toEqual(ALL_OFF)
    expect(normalizeShareCopySelection({ coords: false, google: true, apple: false }))
      .toEqual({ coords: false, google: true, apple: false })
  })

  it('reads a PARTIAL object per key, defaulting only the fields it lacks', async () => {
    // Keeps what a partially written object did record rather than discarding
    // the whole thing, and ignores junk in a single field.
    const { normalizeShareCopySelection } = await loadFresh()
    expect(normalizeShareCopySelection({ coords: false })).toEqual({ coords: false, google: true, apple: true })
    expect(normalizeShareCopySelection({ google: 'yes', apple: false }))
      .toEqual({ coords: true, google: true, apple: false })
    expect(normalizeShareCopySelection({})).toEqual(ALL_ON)
  })

  it('never returns the shared default OBJECT, so a caller cannot mutate the default', async () => {
    const { normalizeShareCopySelection, DEFAULT_SHARE_COPY_SELECTION } = await loadFresh()
    expect(normalizeShareCopySelection(null)).not.toBe(DEFAULT_SHARE_COPY_SELECTION)
  })
})

describe('useShareCopySelection hydration (FR-32 / FR-34, QA-38 / QA-40)', () => {
  it('defaults to all three on, under the UNCHANGED storage key', async () => {
    // The key must not move: it is the one key the legacy literals live under.
    const { DEFAULT_SHARE_COPY_SELECTION, SHARE_COPY_SETTING_KEY } = await loadFresh()
    expect(DEFAULT_SHARE_COPY_SELECTION).toEqual(ALL_ON)
    expect(SHARE_COPY_SETTING_KEY).toBe('shareCopyMode')
  })

  it('renders the default on the FIRST render, before the stored read resolves', async () => {
    let release: (v: unknown) => void = () => {}
    getSetting.mockReturnValue(new Promise(r => { release = r }))
    const { useShareCopySelection } = await loadFresh()
    const { result } = renderHook(() => useShareCopySelection())
    // Never null, never a gate — the feature is fully usable right now.
    expect(result.current).toEqual(ALL_ON)
    await act(async () => { release(COORDS_ONLY) })
    expect(result.current).toEqual(COORDS_ONLY)
  })

  it('returns a STABLE reference while the selection is unchanged', async () => {
    // useSyncExternalStore requires it: a fresh object per getSnapshot call
    // loops React forever. Rejects `getSnapshot = () => ({...current})`.
    const { useShareCopySelection } = await loadFresh()
    const { result, rerender } = renderHook(() => useShareCopySelection())
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })

  it('does not emit when the stored value MATCHES the current one by value', async () => {
    // The store holds an object now, so an identity comparison would report
    // every hydrate as a change and re-render every map.
    getSetting.mockResolvedValue({ ...ALL_ON })
    const { useShareCopySelection } = await loadFresh()
    const { result } = renderHook(() => useShareCopySelection())
    const first = result.current
    await act(async () => { await Promise.resolve() })
    expect(result.current).toBe(first)
  })

  it('keeps the default when the stored read REJECTS (QA-40)', async () => {
    getSetting.mockRejectedValue(new Error('storage unavailable'))
    const { useShareCopySelection } = await loadFresh()
    const { result } = renderHook(() => useShareCopySelection())
    await act(async () => { await Promise.resolve() })
    expect(result.current).toEqual(ALL_ON)
  })

  it('a malformed stored value hydrates to the default (QA-41)', async () => {
    getSetting.mockResolvedValue('nonsense')
    const { useShareCopySelection } = await loadFresh()
    const { result } = renderHook(() => useShareCopySelection())
    await act(async () => { await Promise.resolve() })
    expect(result.current).toEqual(ALL_ON)
  })

  it('hydrates ONCE per session, not once per subscriber', async () => {
    const { useShareCopySelection } = await loadFresh()
    renderHook(() => useShareCopySelection())
    renderHook(() => useShareCopySelection())
    renderHook(() => useShareCopySelection())
    await act(async () => { await Promise.resolve() })
    expect(getSetting).toHaveBeenCalledTimes(1)
  })
})

describe('setShareCopySelection (FR-33 / FR-36 / FR-37)', () => {
  it('reaches EVERY subscriber immediately, including one in another subtree (FR-36)', async () => {
    const { useShareCopySelection, setShareCopySelection } = await loadFresh()
    const settingsRow = renderHook(() => useShareCopySelection())
    const openPopup = renderHook(() => useShareCopySelection())
    await act(async () => { await Promise.resolve() })

    act(() => { setShareCopySelection(COORDS_ONLY) })

    expect(settingsRow.result.current).toEqual(COORDS_ONLY)
    expect(openPopup.result.current).toEqual(COORDS_ONLY)
  })

  it('persists the OBJECT through the storage seam under the stable key', async () => {
    const { setShareCopySelection, SHARE_COPY_SETTING_KEY } = await loadFresh()
    setShareCopySelection(COORDS_ONLY)
    expect(setSetting).toHaveBeenCalledWith(SHARE_COPY_SETTING_KEY, COORDS_ONLY)
    setShareCopySelection(ALL_OFF)
    expect(setSetting).toHaveBeenCalledWith(SHARE_COPY_SETTING_KEY, ALL_OFF)
  })

  it('persists all three OFF rather than treating it as "nothing to save"', async () => {
    const { useShareCopySelection, setShareCopySelection, SHARE_COPY_SETTING_KEY } = await loadFresh()
    const { result } = renderHook(() => useShareCopySelection())
    await act(async () => { await Promise.resolve() })
    act(() => { setShareCopySelection(ALL_OFF) })
    expect(result.current).toEqual(ALL_OFF)
    expect(setSetting).toHaveBeenCalledWith(SHARE_COPY_SETTING_KEY, ALL_OFF)
  })

  it('a failed write leaves the in-session choice applied rather than throwing', async () => {
    setSetting.mockRejectedValue(new Error('disk full'))
    const { useShareCopySelection, setShareCopySelection } = await loadFresh()
    const { result } = renderHook(() => useShareCopySelection())
    await act(async () => { await Promise.resolve() })
    act(() => { setShareCopySelection(COORDS_ONLY) })
    await act(async () => { await Promise.resolve() })
    expect(result.current).toEqual(COORDS_ONLY)
  })

  it('a choice made WHILE the stored read is in flight is not reverted by it', async () => {
    let release: (v: unknown) => void = () => {}
    getSetting.mockReturnValue(new Promise(r => { release = r }))
    const { useShareCopySelection, setShareCopySelection } = await loadFresh()
    const { result } = renderHook(() => useShareCopySelection())

    act(() => { setShareCopySelection(COORDS_ONLY) })
    expect(result.current).toEqual(COORDS_ONLY)

    // The slow read comes back with the older stored value; the user's choice wins.
    await act(async () => { release('coords-and-links') })
    expect(result.current).toEqual(COORDS_ONLY)
  })
})

describe('toggleShareCopyPart', () => {
  it('flips ONLY the named part and returns the resulting selection', async () => {
    // The return value is what the Settings row announces from, so a second
    // expression of the same flip cannot drift from the one that took effect.
    const { useShareCopySelection, toggleShareCopyPart } = await loadFresh()
    const { result } = renderHook(() => useShareCopySelection())
    await act(async () => { await Promise.resolve() })

    let returned: unknown
    act(() => { returned = toggleShareCopyPart('google') })
    expect(returned).toEqual({ coords: true, google: false, apple: true })
    expect(result.current).toEqual({ coords: true, google: false, apple: true })

    act(() => { returned = toggleShareCopyPart('google') })
    expect(returned).toEqual(ALL_ON)
    expect(result.current).toEqual(ALL_ON)
  })

  it('can reach all three off, and back', async () => {
    const { useShareCopySelection, toggleShareCopyPart } = await loadFresh()
    const { result } = renderHook(() => useShareCopySelection())
    await act(async () => { await Promise.resolve() })

    act(() => { toggleShareCopyPart('coords'); toggleShareCopyPart('google'); toggleShareCopyPart('apple') })
    expect(result.current).toEqual(ALL_OFF)

    act(() => { toggleShareCopyPart('apple') })
    expect(result.current).toEqual({ coords: false, google: false, apple: true })
  })
})
