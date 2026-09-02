// The COMPOSED seam, end to end (clear-means-clear). The two guards this pairs
// each prove one half against a mock of the other: `transport.test.ts` mocks the
// replay store and pins only that `getReplayable` passes its pre-request
// generation, and the `replay` row of `WRITE_RACES` in `clearDerived.test.ts`
// hand-rolls the transport's shape to prove the store refuses. Neither runs the
// real pair, so a change that keeps both halves individually green while they
// stop fitting together would pass both.
//
// Here nothing between the call site and the disk is faked: the real
// `CachedTransport`, the real `replayStore`, the real `purgeDerivedOnClear`.
// Only the two ends are doubles — the storage seam (the disk) and `fetch` (the
// network) — and the call is the exact one `App.tsx lookupBacklogWeather`
// makes for each row of the Weather Backlog: `/weather/<encoded submission id>`
// through `transport.getReplayable`.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ReplayStore } from './storage'

const disk = vi.hoisted(() => ({
  settings: {} as Record<string, unknown>,
  replay: null as ReplayStore | null,
}))

vi.mock('./storage', () => ({
  storage: {
    async getSetting<T>(key: string): Promise<T | null> {
      return (disk.settings[key] as T) ?? null
    },
    async setSetting<T>(key: string, value: T): Promise<void> {
      disk.settings[key] = JSON.parse(JSON.stringify(value)) as unknown
    },
    async deleteSetting(key: string): Promise<void> {
      delete disk.settings[key]
    },
    async getReplayStore(): Promise<ReplayStore | null> {
      return disk.replay === null ? null : (JSON.parse(JSON.stringify(disk.replay)) as ReplayStore)
    },
    async setReplayStore(store: ReplayStore): Promise<void> {
      disk.replay = JSON.parse(JSON.stringify(store)) as ReplayStore
    },
  },
}))

import { transport } from './transport'
import { purgeDerivedOnClear } from './clearDerived'
import * as replay from './replayStore'

const T = Date.parse('2026-09-01T12:00:00.000Z')
// A checklist id out of the loaded backup, and a place the user typed. The
// Backlog encodes the id into the path exactly as this does.
const BACKLOG_ID = 'S1000009'
const BACKLOG_PATH = `/weather/${encodeURIComponent(BACKLOG_ID)}`
const BACKLOG_KEY = replay.replayKey(BACKLOG_PATH)
const COORD_KEY = replay.replayKey('/weather/at', { lat: '37', lng: '-122' })

const replayKeysOnDisk = (): string[] => Object.keys(disk.replay?.entries ?? {}).sort()

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

/** A `fetch` the test lands by hand, so a Clear can be fired mid-request. */
function gatedFetch<T>(gate: Promise<T>): void {
  vi.stubGlobal('fetch', vi.fn(async () => {
    const body = await gate
    return { ok: true, json: () => Promise.resolve(body) }
  }))
}

beforeEach(() => {
  replay._resetReplayStoreForTests()
  disk.settings = {}
  // The session state at Clear: one coordinate forecast the user looked up,
  // already replayed to disk.
  disk.replay = {
    version: 1,
    entries: { [COORD_KEY]: { data: { formatted: '61F, clear' }, loadedAt: T, bytes: 24 } },
    order: [COORD_KEY],
  }
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('the Weather Backlog / Clear seam, end to end', () => {
  it('a lookup already in flight when Clear lands is answered but never persisted', async () => {
    vi.useFakeTimers()
    await replay.get(COORD_KEY) // hydrate the mirror, as a live session has

    const gate = deferred<{ formatted: string }>()
    gatedFetch(gate.promise)

    // The Backlog fires a row's lookup. The Weather tab stays mounted under
    // display:none, so this runs whatever tab the user is looking at.
    const inFlight = transport.getReplayable<{ formatted: string }>(BACKLOG_PATH)
    await Promise.resolve()

    // The user presses Clear in Settings while it is outstanding.
    await purgeDerivedOnClear('ebird')
    expect(replayKeysOnDisk()).toEqual([COORD_KEY])

    // The answer lands afterwards, for a checklist id from the deleted export.
    gate.resolve({ formatted: '52F, rain' })
    const result = await inFlight
    await vi.advanceTimersByTimeAsync(1_000)

    // The caller still gets its answer — refusing the WRITE is not refusing the
    // read, and the row the user is looking at must not go blank.
    expect(result).toEqual({ data: { formatted: '52F, rain' }, replayedAt: null })
    // Nothing of the cleared export reached the disk or the mirror, and the
    // typed-place forecast is untouched.
    expect(replayKeysOnDisk()).toEqual([COORD_KEY])
    expect(await replay.get(BACKLOG_KEY)).toBeNull()
    expect(replay._getReplayStoreWorkStatsForTests().puts).toBe(0)
  })

  it('a lookup that STARTS after the Clear persists normally', async () => {
    // The other half of the guarantee, and the reason the refusal is keyed to a
    // generation rather than to "a purge has happened": clear, re-upload, look
    // up a checklist again — all in one session — and replay must work. A guard
    // that over-refuses would leave the user with no offline copy until relaunch.
    vi.useFakeTimers()
    await replay.get(COORD_KEY)

    await purgeDerivedOnClear('ebird')

    const gate = deferred<{ formatted: string }>()
    gatedFetch(gate.promise)
    const later = transport.getReplayable<{ formatted: string }>(BACKLOG_PATH)
    await Promise.resolve()
    gate.resolve({ formatted: '48F, fog' })
    await later
    await vi.advanceTimersByTimeAsync(1_000)

    expect(replayKeysOnDisk()).toEqual([BACKLOG_KEY, COORD_KEY].sort())
    expect((await replay.get(BACKLOG_KEY))?.data).toEqual({ formatted: '48F, fog' })
  })
})
