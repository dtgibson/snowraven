// @vitest-environment jsdom
//
// The overlays preference hook (schema.md 1.3; FR-02 to FR-06; QA-02 to QA-06).
// The storage seam is mocked at the module boundary, the same seam the hook
// imports, so these rows assert exactly what reaches getSetting / setSetting.

import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getSetting, setSetting } = vi.hoisted(() => ({
  getSetting: vi.fn<(key: string) => Promise<unknown>>(),
  setSetting: vi.fn<(key: string, value: unknown) => Promise<void>>(),
}))
vi.mock('./storage', () => ({ storage: { getSetting, setSetting } }))

import { useCalendarOverlays } from './useCalendarOverlays'
import { CALENDAR_OVERLAYS_SETTING_KEY, CALENDAR_OVERLAYS_VERSION, DEFAULT_CALENDAR_OVERLAYS } from './calendarOverlays'

// The version marker every write carries (calendar-breeding-category-default).
const v = CALENDAR_OVERLAYS_VERSION

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e?: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

// Let the hydration promise chain (getSetting -> normalize -> catch -> apply)
// run to completion, then flush React.
async function settle() {
  await act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve() })
}

beforeEach(() => {
  getSetting.mockReset()
  setSetting.mockReset()
  getSetting.mockResolvedValue(null)
  setSetting.mockResolvedValue(undefined)
})
afterEach(cleanup)

describe('useCalendarOverlays', () => {
  it('starts at the default and hydrates with a pure read: one getSetting, zero writes (QA-02)', async () => {
    const { result } = renderHook(() => useCalendarOverlays())
    expect(result.current.overlays).toEqual(DEFAULT_CALENDAR_OVERLAYS)
    await settle()
    expect(getSetting).toHaveBeenCalledTimes(1)
    expect(getSetting).toHaveBeenCalledWith(CALENDAR_OVERLAYS_SETTING_KEY)
    expect(result.current.overlays).toEqual({ media: false, breeding: false, codes: 'category' })
    expect(setSetting).not.toHaveBeenCalled()
  })

  it('a stored value hydrates, and hydration writes nothing back (QA-03)', async () => {
    getSetting.mockResolvedValue({ media: true, breeding: false, codes: 'every' })
    const { result } = renderHook(() => useCalendarOverlays())
    await waitFor(() => expect(result.current.overlays.media).toBe(true))
    expect(setSetting).not.toHaveBeenCalled()
  })

  it('a change writes ONE value under ONE key carrying all three fields and the marker; re-mount reads it back (QA-03)', async () => {
    const { result, unmount } = renderHook(() => useCalendarOverlays())
    await settle()
    act(() => result.current.toggle('media'))
    await settle()
    expect(result.current.overlays).toEqual({ media: true, breeding: false, codes: 'category' })
    expect(setSetting).toHaveBeenCalledTimes(1)
    expect(setSetting).toHaveBeenCalledWith(CALENDAR_OVERLAYS_SETTING_KEY, { media: true, breeding: false, codes: 'category', v })
    unmount()

    const stored = setSetting.mock.calls[0][1]
    getSetting.mockResolvedValue(stored)
    setSetting.mockClear()
    const again = renderHook(() => useCalendarOverlays())
    await waitFor(() => expect(again.result.current.overlays).toEqual({ media: true, breeding: false, codes: 'category' }))
    expect(setSetting).not.toHaveBeenCalled()
  })

  it('setCodes writes all three fields and the marker, and is a no-op on the value already chosen', async () => {
    const { result } = renderHook(() => useCalendarOverlays())
    await settle()
    act(() => result.current.setCodes('category'))
    await settle()
    expect(setSetting).not.toHaveBeenCalled()
    act(() => result.current.setCodes('every'))
    await settle()
    expect(setSetting).toHaveBeenCalledTimes(1)
    expect(setSetting).toHaveBeenLastCalledWith(CALENDAR_OVERLAYS_SETTING_KEY, { media: false, breeding: false, codes: 'every', v })
    act(() => result.current.setCodes('every'))
    await settle()
    expect(setSetting).toHaveBeenCalledTimes(1)
  })

  // The non-vacuity row for the marker (calendar-breeding-category-default):
  // without it, a written Every code is indistinguishable from the 1.0.38 and
  // 1.0.39 default written through, and every relaunch would migrate it away.
  it('a deliberate Every code survives a remount: pressed, written with the marker, read back as Every code with no write', async () => {
    getSetting.mockResolvedValue({ media: false, breeding: true, codes: 'category', v })
    const { result, unmount } = renderHook(() => useCalendarOverlays())
    await waitFor(() => expect(result.current.overlays.breeding).toBe(true))
    act(() => result.current.setCodes('every'))
    await settle()
    expect(setSetting).toHaveBeenCalledTimes(1)
    const stored = setSetting.mock.calls[0][1]
    unmount()

    getSetting.mockResolvedValue(JSON.parse(JSON.stringify(stored)))
    setSetting.mockClear()
    const again = renderHook(() => useCalendarOverlays())
    await waitFor(() => expect(again.result.current.overlays).toEqual({ media: false, breeding: true, codes: 'every' }))
    await settle()
    expect(again.result.current.overlays.codes).toBe('every')
    expect(setSetting).not.toHaveBeenCalled()
  })

  it('two changes in one tick compose rather than clobber, and write in order', async () => {
    const { result } = renderHook(() => useCalendarOverlays())
    await settle()
    act(() => {
      result.current.toggle('media')
      result.current.toggle('breeding')
      result.current.setCodes('every')
    })
    await settle()
    expect(result.current.overlays).toEqual({ media: true, breeding: true, codes: 'every' })
    expect(setSetting.mock.calls.map(c => c[1])).toEqual([
      { media: true, breeding: false, codes: 'category', v },
      { media: true, breeding: true, codes: 'category', v },
      { media: true, breeding: true, codes: 'every', v },
    ])
  })

  it('writes are serialized: a second write is not issued until the first settles', async () => {
    const first = deferred<void>()
    setSetting.mockImplementationOnce(() => first.promise)
    const { result } = renderHook(() => useCalendarOverlays())
    await settle()
    act(() => { result.current.toggle('media'); result.current.toggle('breeding') })
    await settle()
    expect(setSetting).toHaveBeenCalledTimes(1)
    await act(async () => { first.resolve(); await Promise.resolve() })
    await settle()
    expect(setSetting).toHaveBeenCalledTimes(2)
    expect(setSetting.mock.calls[1][1]).toEqual({ media: true, breeding: true, codes: 'category', v })
  })

  it('a change made before hydration resolves wins over the stored value (FR-05, QA-05)', async () => {
    const slow = deferred<unknown>()
    getSetting.mockReturnValue(slow.promise)
    const { result } = renderHook(() => useCalendarOverlays())
    act(() => result.current.toggle('media'))
    await act(async () => { slow.resolve({ media: false, breeding: false, codes: 'every' }); await Promise.resolve() })
    await settle()
    expect(result.current.overlays.media).toBe(true)
  })

  it('a failed write keeps the in-session choice, throws nothing, and the next change writes again (FR-06, QA-06)', async () => {
    setSetting.mockRejectedValue(new Error('disk full'))
    const { result } = renderHook(() => useCalendarOverlays())
    await settle()
    act(() => result.current.toggle('breeding'))
    await settle()
    expect(result.current.overlays.breeding).toBe(true)
    expect(setSetting).toHaveBeenCalledTimes(1)
    act(() => result.current.toggle('media'))
    await settle()
    expect(setSetting).toHaveBeenCalledTimes(2)
    expect(result.current.overlays).toEqual({ media: true, breeding: true, codes: 'category' })
  })

  it('a rejecting read hydrates as the default with nothing thrown (FR-04, QA-04)', async () => {
    getSetting.mockRejectedValue(new Error('unreadable'))
    const { result } = renderHook(() => useCalendarOverlays())
    await settle()
    expect(result.current.overlays).toEqual(DEFAULT_CALENDAR_OVERLAYS)
    expect(setSetting).not.toHaveBeenCalled()
  })

  it.each([
    ['null', null, { media: false, breeding: false, codes: 'category' }],
    ['a string', 'yes', { media: false, breeding: false, codes: 'category' }],
    ['a number', 42, { media: false, breeding: false, codes: 'category' }],
    ['an array', [], { media: false, breeding: false, codes: 'category' }],
    ['a stringly boolean', { media: 'true' }, { media: false, breeding: false, codes: 'category' }],
    ['a numeric boolean beside a real one', { media: 1, breeding: true }, { media: false, breeding: true, codes: 'category' }],
    ['an unrecognised codes value', { breeding: true, codes: 'both' }, { media: false, breeding: true, codes: 'category' }],
    ['a non-string codes value', { codes: 1 }, { media: false, breeding: false, codes: 'category' }],
    ['a valid category choice', { breeding: true, codes: 'category' }, { media: false, breeding: true, codes: 'category' }],
    // The read-time migration (calendar-breeding-category-default): a 1.0.38 or
    // 1.0.39 document has no marker, so its Every code reads as the old default
    // written through; the other fields are kept, and nothing is written back.
    ['a 1.0.38 Every code with Breeding on', { media: false, breeding: true, codes: 'every' }, { media: false, breeding: true, codes: 'category' }],
    ['a 1.0.38 Every code with both on', { media: true, breeding: true, codes: 'every' }, { media: true, breeding: true, codes: 'category' }],
    ['a 1.0.38 copy of the whole old default', { media: false, breeding: false, codes: 'every' }, { media: false, breeding: false, codes: 'category' }],
    ['a 1.0.38 By category', { media: true, breeding: true, codes: 'category' }, { media: true, breeding: true, codes: 'category' }],
    ['a marked By category', { media: false, breeding: true, codes: 'category', v }, { media: false, breeding: true, codes: 'category' }],
    ['a marked Every code', { media: false, breeding: true, codes: 'every', v }, { media: false, breeding: true, codes: 'every' }],
    ['a stringly marker', { breeding: true, codes: 'every', v: String(v) }, { media: false, breeding: true, codes: 'category' }],
    ['a later marker', { breeding: true, codes: 'every', v: v + 1 }, { media: false, breeding: true, codes: 'category' }],
    ['an inherited marker', Object.assign(Object.create({ v }), { breeding: true, codes: 'every' }), { media: false, breeding: true, codes: 'category' }],
  ])('hydrating %s gives the per-field result (QA-04)', async (_label, raw, expected) => {
    getSetting.mockResolvedValue(raw)
    const { result } = renderHook(() => useCalendarOverlays())
    await settle()
    expect(result.current.overlays).toEqual(expected)
    expect(setSetting).not.toHaveBeenCalled()
  })
})
