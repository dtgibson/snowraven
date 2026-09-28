// @vitest-environment jsdom
// Where distances are measured from (targets-tab FR-51, FR-51a; design-spec 2a):
// the four choices, the Default Location read through its shape guard and
// re-read on change, session-only state that the storage seam never sees, and
// a late device position that cannot overwrite a newer choice.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, cleanup, waitFor } from '@testing-library/react'

const H = vi.hoisted(() => ({
  saved: null as unknown,
  locate: vi.fn(),
  /** Every storage method this hook touches, by name, with its first argument. */
  calls: [] as Array<[string, unknown]>,
}))
vi.mock('../storage', () => ({
  storage: new Proxy({}, {
    get: (_t, method: string) => async (...args: unknown[]) => {
      H.calls.push([method, args[0]])
      if (method === 'getSetting' && args[0] === 'map-defaults') return H.saved
      return null
    },
  }),
}))
vi.mock('../location', async importOriginal => ({
  ...(await importOriginal<typeof import('../location')>()),
  getCurrentLocation: () => H.locate(),
}))

import { useDistanceAnchor } from './useDistanceAnchor'
import { notifyMapDefaultsChanged } from '../mapDefaultsChanged'

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

beforeEach(() => {
  H.saved = { lat: 37.8044, lng: -122.2712, dist: 10 }
  H.locate.mockReset()
  H.calls = []
})
afterEach(cleanup)

async function mounted() {
  const r = renderHook(() => useDistanceAnchor())
  await waitFor(() => expect(r.result.current.hasDefault).toBe(H.saved !== null))
  return r
}

describe('the four choices', () => {
  it('starts on the Default Location, read through the shape guard', async () => {
    const { result } = await mounted()
    expect(result.current.kind).toBe('default')
    expect(result.current.anchor).toEqual({ lat: 37.8044, lng: -122.2712 })
    expect(result.current.name).toBeNull()
  })

  it('with no usable Default Location there is no anchor', async () => {
    H.saved = { lat: 'x', lng: 1 }
    const { result } = renderHook(() => useDistanceAnchor())
    await waitFor(() => expect(H.calls.length).toBeGreaterThan(0))
    expect(result.current.kind).toBeNull()
    expect(result.current.anchor).toBeNull()
    expect(result.current.hasDefault).toBe(false)
  })

  it('a searched place and a listed place carry their names; the Default Location comes back', async () => {
    const { result } = await mounted()
    act(() => result.current.choosePlace('search', 'Livermore', 37.68, -121.77))
    expect(result.current).toMatchObject({ kind: 'search', name: 'Livermore', anchor: { lat: 37.68, lng: -121.77 } })
    act(() => result.current.choosePlace('place', 'Arrowhead Marsh', 37.74, -122.2))
    expect(result.current).toMatchObject({ kind: 'place', name: 'Arrowhead Marsh', anchor: { lat: 37.74, lng: -122.2 } })
    act(() => result.current.chooseDefault())
    expect(result.current).toMatchObject({ kind: 'default', name: null, anchor: { lat: 37.8044, lng: -122.2712 } })
  })

  it('My location: success measures from the device; failure keeps the previous anchor and says why', async () => {
    const { result } = await mounted()
    act(() => result.current.choosePlace('place', 'Arrowhead Marsh', 37.74, -122.2))
    H.locate.mockRejectedValueOnce({ code: 'permission-denied' })
    let ok: boolean | undefined
    await act(async () => { ok = await result.current.chooseDevice() })
    expect(ok).toBe(false)
    expect(result.current.kind).toBe('place')
    expect(result.current.error).toBeTruthy()
    const seq = result.current.errorSeq
    H.locate.mockResolvedValueOnce({ lat: 1, lng: 2 })
    await act(async () => { ok = await result.current.chooseDevice() })
    expect(ok).toBe(true)
    expect(result.current).toMatchObject({ kind: 'device', anchor: { lat: 1, lng: 2 }, error: null, locating: false })
    expect(seq).toBeGreaterThan(0)
  })

  it('the Default Location is re-read when Settings changes it, and a cleared one leaves no anchor', async () => {
    const { result } = await mounted()
    H.saved = null
    act(() => notifyMapDefaultsChanged())
    await waitFor(() => expect(result.current.kind).toBeNull())
    expect(result.current.hasDefault).toBe(false)
  })
})

describe('a late device position only ends its own request', () => {
  it('a locate that lands after another choice is dropped, and does not clear the new state', async () => {
    const { result } = await mounted()
    const gate = deferred<{ lat: number; lng: number }>()
    H.locate.mockReturnValueOnce(gate.promise)
    let pending!: Promise<boolean>
    act(() => { pending = result.current.chooseDevice() })
    expect(result.current.locating).toBe(true)
    act(() => result.current.choosePlace('place', 'Arrowhead Marsh', 37.74, -122.2))
    expect(result.current.locating).toBe(false)
    await act(async () => { gate.resolve({ lat: 1, lng: 2 }); await pending })
    await expect(pending).resolves.toBe(false)
    expect(result.current).toMatchObject({ kind: 'place', name: 'Arrowhead Marsh' })
  })

  it('an older locate cannot end a NEWER one that is still running', async () => {
    const { result } = await mounted()
    const older = deferred<{ lat: number; lng: number }>()
    const newer = deferred<{ lat: number; lng: number }>()
    H.locate.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
    let a!: Promise<boolean>
    let b!: Promise<boolean>
    act(() => { a = result.current.chooseDevice() })
    act(() => { b = result.current.chooseDevice() })
    await act(async () => { older.resolve({ lat: 9, lng: 9 }); await a })
    // The newer request is still running: it still reads as locating, and the
    // older answer did not become the anchor.
    expect(result.current.locating).toBe(true)
    expect(result.current.kind).toBe('default')
    await act(async () => { newer.resolve({ lat: 1, lng: 2 }); await b })
    expect(result.current).toMatchObject({ kind: 'device', anchor: { lat: 1, lng: 2 }, locating: false })
  })
})

describe('session-only: the storage seam never sees the choice', () => {
  it('every choice leaves the seam with exactly one read, and a remount starts on the Default Location', async () => {
    const { result, unmount } = await mounted()
    H.locate.mockResolvedValueOnce({ lat: 37.123456, lng: -122.654321 })
    await act(async () => { await result.current.chooseDevice() })
    act(() => result.current.choosePlace('search', 'Livermore', 37.68, -121.77))
    act(() => result.current.choosePlace('place', 'Arrowhead Marsh', 37.74, -122.2))
    act(() => result.current.chooseDefault())
    expect(H.calls).toEqual([['getSetting', 'map-defaults']])
    act(() => result.current.choosePlace('place', 'Arrowhead Marsh', 37.74, -122.2))
    unmount()
    const again = await mounted()
    expect(again.result.current.kind).toBe('default')
    expect(H.calls.every(([m]) => m === 'getSetting')).toBe(true)
  })
})
