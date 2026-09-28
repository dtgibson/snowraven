// @vitest-environment jsdom
// The live 30-day sweep controller (targets-tab QA-45, QA-46, QA-48, QA-66;
// schema.md 3.4).
//
// Driven through the REAL transport (the web adapter, since there is no Tauri
// here), the REAL shared eBird gate and the REAL day cache, with only `fetch`
// and the storage seam faked: the claims are about how many requests leave the
// page, how far apart their STARTS are (client observation, never a
// network-side timestamp, testing.md v0.5.92), and what is cached, so every
// layer between the hook and `fetch` has to be the shipped one.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const disk = vi.hoisted(() => ({ settings: new Map<string, unknown>(), dayObs: null as unknown }))
vi.mock('../storage', () => ({
  storage: {
    getSetting: async (k: string) => (disk.settings.has(k) ? structuredClone(disk.settings.get(k)) : null),
    setSetting: async (k: string, v: unknown) => { disk.settings.set(k, structuredClone(v)) },
    deleteSetting: async (k: string) => { disk.settings.delete(k) },
    // The day cache's own document (schema.md 3.2).
    getCountyDayObsStore: async () => (disk.dayObs === null ? null : structuredClone(disk.dayObs)),
    setCountyDayObsStore: async (doc: unknown) => { disk.dayObs = structuredClone(doc) },
    deleteCountyDayObsStore: async () => { disk.dayObs = null },
  },
}))

import { useCountyDaySweep } from './useCountyDaySweep'
import { _resetCountyDayObsCacheForTests, WRITE_DEBOUNCE_MS } from '../countyDayObsCache'
import { _resetEbirdGateForTests, ebirdGateState } from '../ebirdGate'
import { clearNetworkCache } from '../networkCache'
import { lastNDates } from './targetsDates'
import { transport } from '../transport'

const REGION = 'US-CA-001'
const NOW = new Date(2026, 8, 26, 10, 0, 0)

interface Call { url: string; at: number; date: string | null; path: string }
let calls: Call[] = []
/** Per-date override: a status to answer with instead of 200. */
let answer: (date: string) => { status: number; retryAfter?: string } = () => ({ status: 200 })

function installFetch() {
  calls = []
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const u = new URL(url, 'http://x')
    const date = u.searchParams.get('date')
    calls.push({ url, at: Date.now(), date, path: u.pathname })
    if (u.pathname === '/map/county-day-obs') {
      const a = answer(date ?? '')
      if (a.status !== 200) {
        return {
          ok: false, status: a.status,
          headers: { get: (n: string) => (n === 'Retry-After' ? a.retryAfter ?? null : null) },
          json: async () => ({ detail: 'x' }),
        }
      }
      return {
        ok: true, status: 200,
        json: async () => ({
          regionCode: REGION, date,
          species: [{ speciesCode: 'linspa', obsDt: `${date} 08:00`, locId: 'L123', locName: 'Arrowhead Marsh', lat: 37.75, lng: -122.2 }],
        }),
      }
    }
    return { ok: true, status: 200, json: async () => [] }
  }))
}

const sweepCalls = () => calls.filter(c => c.path === '/map/county-day-obs')

async function runUntil(pred: () => boolean, stepMs = 50, maxMs = 120_000) {
  for (let t = 0; t < maxMs && !pred(); t += stepMs) {
    await act(async () => { await vi.advanceTimersByTimeAsync(stepMs) })
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  vi.setSystemTime(NOW)
  disk.settings.clear()
  disk.dayObs = null
  _resetCountyDayObsCacheForTests()
  _resetEbirdGateForTests()
  clearNetworkCache()
  answer = () => ({ status: 200 })
  installFetch()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('cost (QA-46, QA-66, NFR-01)', () => {
  it('a first visit asks about 30 days, newest first, with starts at least 150 ms apart', async () => {
    const { result } = renderHook(() => useCountyDaySweep(REGION, true, true))
    await runUntil(() => result.current.status.kind === 'complete')
    const s = sweepCalls()
    expect(s).toHaveLength(30)
    expect(s.map(c => c.date)).toEqual(lastNDates(NOW.getTime()))
    for (let i = 1; i < s.length; i++) expect(s[i].at - s[i - 1].at).toBeGreaterThanOrEqual(150)
    expect(result.current.hasData).toBe(true)
    await act(async () => { await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS + 100) })   // the day cache's debounced write
    expect(disk.dayObs).not.toBeNull()
  })

  it('a same-day revisit asks at most about today', async () => {
    const first = renderHook(() => useCountyDaySweep(REGION, true, true))
    await runUntil(() => first.result.current.status.kind === 'complete')
    first.unmount()
    calls = []
    const again = renderHook(() => useCountyDaySweep(REGION, true, true))
    await runUntil(() => again.result.current.status.kind === 'complete')
    expect(sweepCalls().map(c => c.date)).toEqual([lastNDates(NOW.getTime())[0]])
    // And within the same mounted view, a retry of a complete pass asks nothing.
    // (The status is already `complete`, so wait a fixed stretch rather than
    // on the status, or the assertion would run before the retry's pass.)
    calls = []
    act(() => again.result.current.retry())
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(again.result.current.status.kind).toBe('complete')
    expect(sweepCalls()).toHaveLength(0)
  })

  it('the next day asks about the new today and the day that was today (1 or 2)', async () => {
    const first = renderHook(() => useCountyDaySweep(REGION, true, true))
    await runUntil(() => first.result.current.status.kind === 'complete')
    first.unmount()
    calls = []
    vi.setSystemTime(new Date(2026, 8, 27, 10, 0, 0))
    const next = renderHook(() => useCountyDaySweep(REGION, true, true))
    await runUntil(() => next.result.current.status.kind === 'complete')
    expect(sweepCalls().map(c => c.date)).toEqual(['2026-09-27', '2026-09-26'])
  })
})

describe('no key, offline (QA-45, NFR-07)', () => {
  it('without a key no request is made and the status says so', async () => {
    const { result } = renderHook(() => useCountyDaySweep(REGION, false, true))
    await runUntil(() => result.current.status.kind === 'no-key')
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(calls).toHaveLength(0)
    expect(result.current.hasData).toBe(false)
  })

  it('offline, it shows the cached days and asks nothing', async () => {
    const first = renderHook(() => useCountyDaySweep(REGION, true, true))
    await runUntil(() => first.result.current.status.kind === 'complete')
    first.unmount()
    calls = []
    const off = renderHook(() => useCountyDaySweep(REGION, true, false))
    await runUntil(() => off.result.current.status.kind === 'offline')
    expect(calls).toHaveLength(0)
    const status = off.result.current.status
    expect(status.kind === 'offline' && status.from !== null).toBe(true)
    expect(off.result.current.hasData).toBe(true)
  })

  it('offline with an empty cache has no live data', async () => {
    const off = renderHook(() => useCountyDaySweep(REGION, true, false))
    await runUntil(() => off.result.current.status.kind === 'offline')
    const status = off.result.current.status
    expect(status.kind === 'offline' && status.from === null).toBe(true)
    expect(off.result.current.hasData).toBe(false)
  })
})

describe('the shared gate and failed days (QA-48, FR-46)', () => {
  it('a 429 opens the ONE shared cooldown, the band says so, and a concurrent map lookup waits it out too', async () => {
    const dates = lastNDates(NOW.getTime())
    let tripped = false
    answer = d => {
      if (d === dates[2] && !tripped) { tripped = true; return { status: 429, retryAfter: '4' } }
      return { status: 200 }
    }
    const { result } = renderHook(() => useCountyDaySweep(REGION, true, true))
    await runUntil(() => ebirdGateState().cooldownUntil > Date.now())
    const cooldownEnd = ebirdGateState().cooldownUntil
    // A Map Explorer lookup issued now must not start before the cooldown ends.
    const mapCall = transport.get('/map/hotspots', { lat: '37.8', lng: '-122.2', dist: '5' })
    await runUntil(() => result.current.status.kind === 'cooldown')
    const s = result.current.status
    expect(s.kind === 'cooldown' && s.seconds >= 1 && s.seconds <= 4).toBe(true)
    await runUntil(() => result.current.status.kind === 'complete')
    await mapCall
    const hotspot = calls.find(c => c.path === '/map/hotspots')!
    expect(hotspot.at).toBeGreaterThanOrEqual(cooldownEnd)
    // The 429 day was retried by the gate and landed; nothing is missing.
    expect(new Set(sweepCalls().map(c => c.date)).size).toBe(30)
  })

  it('a day that still fails is left unchecked, never cached, and Retry asks only about it', async () => {
    const dates = lastNDates(NOW.getTime())
    answer = d => (d === dates[5] ? { status: 500 } : { status: 200 })
    const { result } = renderHook(() => useCountyDaySweep(REGION, true, true))
    await runUntil(() => result.current.status.kind === 'unanswered')
    const s = result.current.status
    expect(s.kind === 'unanswered' && s.failed === 1 && s.checked === 29).toBe(true)
    expect(result.current.days.get(dates[5])).toBe('failed')
    await act(async () => { await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS + 100) })   // let the debounced write land
    const stored = disk.dayObs as { entries: Record<string, unknown> }
    expect(Object.keys(stored.entries)).not.toContain(`${REGION}|${dates[5]}`)
    calls = []
    answer = () => ({ status: 200 })
    act(() => result.current.retry())
    await runUntil(() => result.current.status.kind === 'complete')
    expect(sweepCalls().map(c => c.date)).toEqual([dates[5]])
  })
})

describe('the status is a throttled snapshot (ui.md v0.5.87)', () => {
  it('the sweeping figure is not re-emitted once per day', async () => {
    const seen: string[] = []
    const { result } = renderHook(() => {
      const v = useCountyDaySweep(REGION, true, true)
      if (v.status.kind === 'sweeping') {
        const k = `${v.status.checked}`
        if (seen[seen.length - 1] !== k) seen.push(k)
      }
      return v
    })
    await runUntil(() => result.current.status.kind === 'complete')
    // 30 days at a 150 ms floor is ~4.5 s; a 1.5 s bound allows a handful of
    // distinct sweeping figures, never one per day.
    expect(seen.length).toBeGreaterThan(0)
    expect(seen.length).toBeLessThan(10)
  })
})
