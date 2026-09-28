// The durable per-(county, day) store (targets-tab, schema.md section 3,
// amended 2026-09-27; FR-44, QA-46). Every bound and every refusal is asserted
// as WORK DONE through the store's own counters, never as elapsed time
// (testing.md), and every "nothing was written" claim reads that the write path
// never RAN (`puts`), not only that the observable outcome is clean (testing.md
// v1.0.14, rule 1).
//
// The seam mock carries ONLY the three own-document methods plus
// `deleteSetting` (for the legacy key): a regression that reached for
// `getSetting` / `setSetting` again would throw here rather than pass.
/// <reference types="node" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const disk = vi.hoisted(() => ({
  doc: undefined as unknown,
  getStore: vi.fn(),
  setStore: vi.fn(),
  deleteStore: vi.fn(),
  deleteSetting: vi.fn(),
  /** Every seam call on the day document, in the order the seam SAW it. */
  log: [] as string[],
  /** When set, `deleteSetting` bypasses the spy. A vitest spy attaches its own
   *  `.then` to a returned promise to record the settled result, which marks a
   *  rejection HANDLED, so a "the rejection is swallowed" row driven through
   *  the spy passes whether or not the module swallows it. */
  rawDeleteSetting: null as null | ((k: string) => Promise<void>),
}))
vi.mock('./storage', () => ({
  storage: {
    getCountyDayObsStore: () => disk.getStore(),
    setCountyDayObsStore: (doc: unknown) => disk.setStore(doc),
    deleteCountyDayObsStore: () => disk.deleteStore(),
    deleteSetting: (k: string) => (disk.rawDeleteSetting ? disk.rawDeleteSetting(k) : disk.deleteSetting(k)),
  },
}))

import {
  LEGACY_DAY_OBS_SETTING_KEY, WRITE_DEBOUNCE_MS, dayObsKey, dedupedFetch, loadAll, purgeCountyDayObsStore,
  setDayObsMaxBytes, setDayObsMaxEntries,
  _getCountyDayObsCacheWorkStatsForTests as stats, _resetCountyDayObsCacheForTests,
} from './countyDayObsCache'
import * as dayObsModule from './countyDayObsCache'
import type { DayObsPayload, DayRecord } from './countyDayObsReduce'

// The budgets AS DECLARED, read at import time before any reset runs: the
// test reset seam restores its own copy of each number, so a default that
// drifted would be overwritten before any row could read it. The row below
// compares the two declarations to each other as well as to the schema.
const DECLARED = { entries: dayObsModule.DAY_OBS_MAX_ENTRIES, bytes: dayObsModule.DAY_OBS_MAX_BYTES }

const R = 'US-CA-001'
const R2 = 'US-CA-013'

function record(date: string, over: Partial<DayRecord> = {}): DayRecord {
  return { speciesCode: 'linspa', obsDt: `${date} 08:00`, locId: 'L1', locName: 'Marsh', lat: 37.7, lng: -122.2, ...over }
}
function payload(date: string, species: unknown[] = [record(date)], regionCode = R): DayObsPayload {
  return { regionCode, date, species: species as DayRecord[] }
}
function entry(date: string, over: Record<string, unknown> = {}) {
  const species = [record(date)]
  return { fetchedAt: 1, complete: true, bytes: JSON.stringify(species).length, species, ...over }
}
function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

beforeEach(() => {
  disk.doc = undefined
  disk.log = []
  disk.getStore.mockReset().mockImplementation(async () => disk.doc ?? null)
  disk.setStore.mockReset().mockImplementation(async (v: unknown) => {
    disk.log.push('set')
    disk.doc = JSON.parse(JSON.stringify(v))
  })
  disk.deleteStore.mockReset().mockImplementation(async () => {
    disk.log.push('delete')
    disk.doc = undefined
  })
  disk.deleteSetting.mockReset().mockImplementation(async () => undefined)
  disk.rawDeleteSetting = null
  _resetCountyDayObsCacheForTests()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('load-path validation (a malformed entry is dropped, never thrown on)', () => {
  it('keeps only well-shaped keys naming real days whose entries pass the record validator', async () => {
    const good = entry('2026-09-01')
    disk.doc = JSON.parse(JSON.stringify({
      version: 2,
      order: [
        dayObsKey(R, '2026-09-01'),            // good
        dayObsKey(R, '2026-09-02'),            // a record from another day
        dayObsKey(R, '2026-02-30'),            // not a real day
        'US-CA-001|2026-09-03\n',              // trailing newline in the key
        dayObsKey('us-ca-001', '2026-09-04'),  // bad region
        dayObsKey(R, '2026-09-05'),            // complete is not a boolean
        dayObsKey(R, '2026-09-06'),            // a duplicate species code
        dayObsKey(R, '2026-09-07'),            // missing entry
        dayObsKey(R, '2026-09-01'),            // duplicate order key
      ],
      entries: {
        [dayObsKey(R, '2026-09-01')]: good,
        [dayObsKey(R, '2026-09-02')]: entry('2026-09-01'),
        [dayObsKey(R, '2026-02-30')]: entry('2026-02-30'),
        'US-CA-001|2026-09-03\n': entry('2026-09-03'),
        [dayObsKey('us-ca-001', '2026-09-04')]: entry('2026-09-04'),
        [dayObsKey(R, '2026-09-05')]: entry('2026-09-05', { complete: 'yes' }),
        [dayObsKey(R, '2026-09-06')]: entry('2026-09-06', { species: [record('2026-09-06'), record('2026-09-06')] }),
      },
    }))
    const all = await loadAll()
    expect([...all.keys()]).toEqual([dayObsKey(R, '2026-09-01')])
    expect(all.get(dayObsKey(R, '2026-09-01'))!.species).toEqual(good.species)
  })

  it('a __proto__ probe written with JSON.parse creates no entry and changes no prototype', async () => {
    disk.doc = JSON.parse(`{"version":2,"order":["__proto__","constructor"],"entries":{"__proto__":${JSON.stringify(entry('2026-09-01'))},"constructor":{}}}`)
    const all = await loadAll()
    expect(all.size).toBe(0)
    expect(Object.getPrototypeOf({})).toBe(Object.prototype)
  })

  it('an absent, non-object or wrong-version document reads as empty (version 1, the settings-document shape, included)', async () => {
    const v1 = { version: 1, order: [dayObsKey(R, '2026-09-01')], entries: { [dayObsKey(R, '2026-09-01')]: entry('2026-09-01') } }
    for (const doc of [null, 'x', 7, { version: 3, entries: {}, order: [] }, { version: 2 }, v1]) {
      _resetCountyDayObsCacheForTests()
      disk.doc = doc
      expect((await loadAll()).size).toBe(0)
    }
  })

  it('bytes is recomputed on load, never trusted (a negative figure cannot corrupt the budget)', async () => {
    disk.doc = { version: 2, order: [dayObsKey(R, '2026-09-01')], entries: { [dayObsKey(R, '2026-09-01')]: entry('2026-09-01', { bytes: 5 }) } }
    const e = (await loadAll()).get(dayObsKey(R, '2026-09-01'))!
    expect(e.bytes).toBe(JSON.stringify(e.species).length)
    _resetCountyDayObsCacheForTests()
    disk.doc = { version: 2, order: [dayObsKey(R, '2026-09-01')], entries: { [dayObsKey(R, '2026-09-01')]: entry('2026-09-01', { bytes: -1 }) } }
    expect((await loadAll()).size).toBe(0)
  })
})

describe('the write chokepoint validates, it does not merely construct', () => {
  it('drops an invalid record on its own, dedupes, and hands the caller the sanitized entry', async () => {
    const d = '2026-09-01'
    const res = await dedupedFetch(R, d, async () => payload(d, [
      record(d),
      record(d, { speciesCode: 'Bad Code' }),
      record(d, { obsDt: '2026-09-02 08:00' }),
      record(d, { speciesCode: 'sora', lat: 1, lng: null }),
      record(d, { obsDt: `${d} 11:00`, locName: 'Later' }),
      { ...record(d, { speciesCode: 'sora' }), extra: 'field' },
    ]))
    expect(res.fromNetwork).toBe(true)
    expect(res.entry.species).toEqual([
      record(d, { obsDt: `${d} 11:00`, locName: 'Later' }),
      record(d, { speciesCode: 'sora' }),
    ])
    expect(Object.keys(res.entry.species[1]).sort()).toEqual(['lat', 'lng', 'locId', 'locName', 'obsDt', 'speciesCode'])
    // What the caller received is exactly what is stored.
    expect((await loadAll()).get(dayObsKey(R, d))).toBe(res.entry)
  })

  it('a payload for another county or day is refused as the 502 shape and nothing is written', async () => {
    for (const bad of [payload('2026-09-02'), payload('2026-09-01', [], 'US-CA-013'), null]) {
      await expect(dedupedFetch(R, '2026-09-01', async () => bad as DayObsPayload))
        .rejects.toMatchObject({ status: 502 })
    }
    expect(stats().puts).toBe(0)
    expect((await loadAll()).size).toBe(0)
  })

  it('an invalid region or date never reaches the loader', async () => {
    const loader = vi.fn(async () => payload('2026-09-01'))
    await expect(dedupedFetch('US-CA-٠١٢', '2026-09-01', loader)).rejects.toMatchObject({ status: 422 })
    await expect(dedupedFetch(R, '2026-02-30', loader)).rejects.toMatchObject({ status: 422 })
    expect(loader).not.toHaveBeenCalled()
  })
})

describe('complete replaces a TTL, decided at write time', () => {
  it('a day fetched while it is today is incomplete; fetched after midnight it is complete', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(new Date(2026, 8, 1, 23, 59, 59))
    const first = await dedupedFetch(R, '2026-09-01', async () => payload('2026-09-01'))
    expect(first.entry.complete).toBe(false)
    vi.setSystemTime(new Date(2026, 8, 2, 0, 0, 1))
    // Incomplete: always re-asked when called.
    const second = await dedupedFetch(R, '2026-09-01', async () => payload('2026-09-01'))
    expect(second.fromNetwork).toBe(true)
    expect(second.entry.complete).toBe(true)
    expect(stats().loaderCalls).toBe(2)
  })

  it('a complete hit makes no loader call', async () => {
    const loader = vi.fn(async () => payload('2020-01-01'))
    await dedupedFetch(R, '2020-01-01', loader)
    const again = await dedupedFetch(R, '2020-01-01', loader)
    expect(again.fromNetwork).toBe(false)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('concurrent calls for one key share one loader call', async () => {
    const gate = deferred<DayObsPayload>()
    const loader = vi.fn(() => gate.promise)
    const a = dedupedFetch(R, '2020-01-02', loader)
    const b = dedupedFetch(R, '2020-01-02', loader)
    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(1))
    gate.resolve(payload('2020-01-02'))
    const [ra, rb] = await Promise.all([a, b])
    expect(ra.entry).toBe(rb.entry)
    expect(loader).toHaveBeenCalledTimes(1)
  })
})

describe('errors are never cached', () => {
  it.each([
    ['a 429', Object.assign(new Error('limited'), { status: 429 })],
    ['a 500', Object.assign(new Error('boom'), { status: 500 })],
  ])('%s rejects, writes nothing, and the next call asks again', async (_l, err) => {
    const loader = vi.fn().mockRejectedValueOnce(err).mockResolvedValue(payload('2020-01-03'))
    await expect(dedupedFetch(R, '2020-01-03', loader)).rejects.toBe(err)
    expect(stats().puts).toBe(0)
    expect((await loadAll()).size).toBe(0)
    await expect(dedupedFetch(R, '2020-01-03', loader)).resolves.toMatchObject({ fromNetwork: true })
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('offline with a prior entry serves it stale; offline with none rethrows', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(new Date(2026, 8, 1, 10, 0, 0))
    const today = '2026-09-01'
    const first = await dedupedFetch(R, today, async () => payload(today))
    const offline = new TypeError('Failed to fetch')
    const stale = await dedupedFetch(R, today, () => Promise.reject(offline))
    expect(stale).toEqual({ entry: first.entry, fromNetwork: false })
    await expect(dedupedFetch(R, '2026-08-31', () => Promise.reject(offline))).rejects.toBe(offline)
  })
})

// Every eviction row runs on a fixed clock so the sweep window is known:
// today is 2026-09-20, so the window's oldest date is 2026-08-22.
const NOW = new Date(2026, 8, 20, 10, 0, 0)
function at(minutes: number): void {
  vi.setSystemTime(NOW.getTime() + minutes * 60_000)
}
async function put(region: string, date: string): Promise<void> {
  await dedupedFetch(region, date, async () => payload(date, [record(date)], region))
}
const keys = async () => [...(await loadAll()).keys()]

describe('eviction is the comparator, measured at capacity+1 as WORK DONE', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    at(0)
  })

  it('capacity+1 evicts exactly one: the oldest-visited county\'s smallest date, and the new key survives', async () => {
    // A was visited first, B second. B's dates are the SMALLER ones, so a rule
    // that ignored county recency would take B|09-09; insertion FIFO would
    // take A|09-12. The comparator takes A's smallest, A|09-11.
    setDayObsMaxEntries(4)
    at(1); await put(R, '2026-09-12'); await put(R, '2026-09-11')
    at(5); await put(R2, '2026-09-10'); await put(R2, '2026-09-09')
    expect(stats().evictions).toBe(0)
    at(6); await put(R2, '2026-09-08')
    expect(stats().evictions).toBe(1)
    expect(stats().puts).toBe(5)
    const held = await keys()
    expect(held).not.toContain(dayObsKey(R, '2026-09-11'))
    expect(held).toContain(dayObsKey(R, '2026-09-12'))
    expect(held).toContain(dayObsKey(R2, '2026-09-09'))
    expect(held).toContain(dayObsKey(R2, '2026-09-08'))
    // Re-asking a held COMPLETE day costs no loader call and no eviction.
    await put(R2, '2026-09-08')
    expect(stats().evictions).toBe(1)
    expect(stats().loaderCalls).toBe(5)
  })

  it('the same order binds at the payload budget', async () => {
    const one = JSON.stringify([record('2026-09-12')]).length
    setDayObsMaxBytes(one * 4 + 1)
    at(1); await put(R, '2026-09-12'); await put(R, '2026-09-11')
    at(5); await put(R2, '2026-09-10'); await put(R2, '2026-09-09')
    expect(stats().evictions).toBe(0)
    at(6); await put(R2, '2026-09-08')
    expect(stats().evictions).toBe(1)
    expect(await keys()).not.toContain(dayObsKey(R, '2026-09-11'))
    expect(await keys()).toContain(dayObsKey(R2, '2026-09-08'))
  })

  it('a day outside the sweep window goes first, whatever its county\'s recency', async () => {
    // A holds an out-of-window day AND is the most recently visited county;
    // B is older but all in the window. Without rule 1 the victim is B|09-09.
    setDayObsMaxEntries(3)
    at(1); await put(R2, '2026-09-10'); await put(R2, '2026-09-09')
    at(5); await put(R, '2026-08-01')
    at(6); await put(R, '2026-09-15')
    expect(stats().evictions).toBe(1)
    expect(await keys()).toEqual([dayObsKey(R2, '2026-09-10'), dayObsKey(R2, '2026-09-09'), dayObsKey(R, '2026-09-15')])
  })

  it('a re-fetched today (moved to the tail of order) is not the victim, and neither is yesterday', async () => {
    // Insertion FIFO, after today moves to the tail, would take 09-19.
    setDayObsMaxEntries(3)
    at(1); await put(R, '2026-09-20'); await put(R, '2026-09-19'); await put(R, '2026-09-18')
    at(30); await put(R, '2026-09-20')     // incomplete: re-asked, moved to the tail
    expect(stats().evictions).toBe(0)
    at(31); await put(R, '2026-09-17')
    expect(stats().evictions).toBe(1)
    const held = await keys()
    expect(held).toEqual([dayObsKey(R, '2026-09-19'), dayObsKey(R, '2026-09-20'), dayObsKey(R, '2026-09-17')])
  })

  it('a sole oversized newest entry survives, and the next one replaces it', async () => {
    const big = (d: string) => payload(d, Array.from({ length: 40 }, (_, i) => record(d, { speciesCode: `sp${i}` })))
    setDayObsMaxBytes(5)
    await dedupedFetch(R, '2026-09-10', async () => big('2026-09-10'))
    expect(await keys()).toEqual([dayObsKey(R, '2026-09-10')])
    expect(stats().evictions).toBe(0)
    await dedupedFetch(R, '2026-09-11', async () => big('2026-09-11'))
    expect(await keys()).toEqual([dayObsKey(R, '2026-09-11')])
    expect(stats().evictions).toBe(1)
  })

  it('load-time admission stops at the entry cap, in order sequence, before any eviction runs', async () => {
    const dates = ['2026-09-15', '2026-09-14', '2026-09-13', '2026-09-12', '2026-09-11']
    const entries: Record<string, unknown> = {}
    for (const d of dates) entries[dayObsKey(R, d)] = entry(d)
    disk.doc = { version: 2, order: dates.map(d => dayObsKey(R, d)), entries }
    setDayObsMaxEntries(3)
    expect(await keys()).toEqual(dates.slice(0, 3).map(d => dayObsKey(R, d)))
    // Admission, not eviction: the victim scan never ran.
    expect(stats().evictions).toBe(0)
  })

  it('a document over the byte budget on load is drained by the same comparator', async () => {
    const dates = ['2026-09-15', '2026-09-14', '2026-09-13']
    const entries: Record<string, unknown> = {}
    for (const d of dates) entries[dayObsKey(R, d)] = entry(d)
    disk.doc = { version: 2, order: dates.map(d => dayObsKey(R, d)), entries }
    setDayObsMaxBytes(JSON.stringify([record('2026-09-15')]).length * 2)
    expect(await keys()).toEqual([dayObsKey(R, '2026-09-15'), dayObsKey(R, '2026-09-14')])
    expect(stats().evictions).toBe(1)
  })
})

describe('the document: its own seam methods, version 2, one flush per debounce window', () => {
  it('the defaults are the amended budgets and a one-second debounce', () => {
    expect(DECLARED).toEqual({ entries: 3_000, bytes: 10_000_000 })
    // The reset seam restores exactly the declared numbers, not its own.
    setDayObsMaxEntries(1)
    setDayObsMaxBytes(1)
    _resetCountyDayObsCacheForTests()
    expect({ entries: dayObsModule.DAY_OBS_MAX_ENTRIES, bytes: dayObsModule.DAY_OBS_MAX_BYTES }).toEqual(DECLARED)
    expect(WRITE_DEBOUNCE_MS).toBe(1_000)
  })

  it('the whole document is written once per debounce window, as version 2, through setCountyDayObsStore', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await dedupedFetch(R, '2020-04-01', async () => payload('2020-04-01'))
    await dedupedFetch(R, '2020-04-02', async () => payload('2020-04-02'))
    await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS - 1)
    expect(disk.setStore).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2)
    expect(disk.setStore).toHaveBeenCalledTimes(1)
    const doc = disk.doc as { version: number; order: string[] }
    expect(doc.version).toBe(2)
    expect(doc.order).toEqual([dayObsKey(R, '2020-04-01'), dayObsKey(R, '2020-04-02')])
    expect(stats().writeFlushes).toBe(1)
  })
})

describe('the ordered writer (schema.md 3.6)', () => {
  it('two flushes and a purge reach the seam in call order, the delete LAST, even when the first write settles late', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const first = deferred<void>()
    disk.setStore.mockImplementationOnce(async (v: unknown) => {
      disk.log.push('set')
      await first.promise
      disk.doc = JSON.parse(JSON.stringify(v))
    })
    await dedupedFetch(R, '2020-06-01', async () => payload('2020-06-01'))
    await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS)       // flush 1: in the seam, parked
    await dedupedFetch(R, '2020-06-02', async () => payload('2020-06-02'))
    await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS)       // flush 2: queued behind it
    const purged = purgeCountyDayObsStore()                     // the delete: queued behind both
    await Promise.resolve()
    // Nothing overtakes the parked write: the next link is not even CALLED.
    expect(disk.log).toEqual(['set'])
    first.resolve()
    await purged
    expect(disk.log).toEqual(['set', 'set', 'delete'])
    // The Clear is what is left on disk, not the late pre-purge document.
    expect(disk.doc).toBeUndefined()
  })

  it('a rejected flush does not block the next link', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    disk.setStore.mockImplementationOnce(async () => { disk.log.push('set'); throw new Error('EIO (injected)') })
    await dedupedFetch(R, '2020-06-03', async () => payload('2020-06-03'))
    await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS)
    await dedupedFetch(R, '2020-06-04', async () => payload('2020-06-04'))
    await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS)
    expect(disk.log).toEqual(['set', 'set'])
    expect((disk.doc as { order: string[] }).order).toEqual([dayObsKey(R, '2020-06-03'), dayObsKey(R, '2020-06-04')])
  })

  it('the purge deletes the document and never writes one', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await dedupedFetch(R, '2020-06-05', async () => payload('2020-06-05'))
    await purgeCountyDayObsStore()
    await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS * 2)
    expect(disk.deleteStore).toHaveBeenCalledTimes(1)
    expect(disk.setStore).not.toHaveBeenCalled()
    // The one settings delete in the session is the legacy key, from the load.
    expect(disk.deleteSetting.mock.calls).toEqual([[LEGACY_DAY_OBS_SETTING_KEY]])
  })

  it('a failed delete rejects the purge (clearDerived collects it)', async () => {
    disk.deleteStore.mockImplementationOnce(async () => { throw new Error('EIO (injected)') })
    await expect(purgeCountyDayObsStore()).rejects.toThrow(/EIO/)
    // And the chain is not poisoned: the next purge reaches the seam.
    await expect(purgeCountyDayObsStore()).resolves.toBeUndefined()
  })
})

describe('the preview build\'s legacy key (schema.md 3.6)', () => {
  it('is deleted exactly once per session, AFTER the first load of the new document', async () => {
    const read = deferred<unknown>()
    disk.getStore.mockImplementationOnce(() => read.promise)
    const loading = loadAll()
    await Promise.resolve()
    expect(disk.deleteSetting).not.toHaveBeenCalled()
    read.resolve(null)
    await loading
    expect(disk.deleteSetting).toHaveBeenCalledTimes(1)
    expect(disk.deleteSetting).toHaveBeenCalledWith(LEGACY_DAY_OBS_SETTING_KEY)
    expect(LEGACY_DAY_OBS_SETTING_KEY).toBe('county-day-obs-v1')
    await loadAll()
    await dedupedFetch(R, '2020-07-01', async () => payload('2020-07-01'))
    expect(disk.deleteSetting).toHaveBeenCalledTimes(1)
  })

  it('is never the purge: a purge from cold deletes the document and not the legacy key', async () => {
    await purgeCountyDayObsStore()
    expect(disk.deleteStore).toHaveBeenCalledTimes(1)
    expect(disk.deleteSetting).not.toHaveBeenCalled()
  })

  it('a rejected legacy delete is swallowed and the load still resolves', async () => {
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown) => { unhandled.push(reason) }
    process.on('unhandledRejection', onUnhandled)
    try {
      disk.rawDeleteSetting = () => Promise.reject(new Error('EIO (injected)'))
      disk.doc = { version: 2, order: [dayObsKey(R, '2026-09-01')], entries: { [dayObsKey(R, '2026-09-01')]: entry('2026-09-01') } }
      await expect(loadAll()).resolves.toBeInstanceOf(Map)
      expect((await loadAll()).size).toBe(1)
      // Let an unhandled rejection surface: Node reports it after the
      // microtask queue drains.
      await new Promise(r => setTimeout(r, 20))
      expect(unhandled).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })
})

describe('the purge supersedes in-flight work (clear-means-clear)', () => {
  it('a fetch that started before the purge cannot write', async () => {
    const gate = deferred<DayObsPayload>()
    const run = dedupedFetch(R, '2020-05-01', () => gate.promise)
    await vi.waitFor(() => expect(stats().loaderCalls).toBe(1))
    await purgeCountyDayObsStore()
    gate.resolve(payload('2020-05-01'))
    const res = await run
    // The caller still gets its answer for this session; only persistence is refused.
    expect(res.fromNetwork).toBe(true)
    expect(stats().puts).toBe(0)
    expect((await loadAll()).size).toBe(0)
    expect(disk.deleteStore).toHaveBeenCalledTimes(1)
  })

  it('a fetch whose FIRST disk read straddles the purge cannot write (the generation guard, not the identity guard)', async () => {
    // The identity check alone cannot see this: the fetch reaches ensureLoaded
    // AFTER the purge installed the fresh empty mirror, so `store === _store`
    // holds. Only the generation captured before the load can refuse it.
    const read = deferred<unknown>()
    disk.getStore.mockImplementationOnce(() => read.promise)
    const run = dedupedFetch(R, '2020-05-04', async () => payload('2020-05-04'))
    await purgeCountyDayObsStore()
    read.resolve(null)
    await run
    expect(stats().puts).toBe(0)
    expect((await loadAll()).size).toBe(0)
  })

  it('a scheduled flush is cancelled by the purge and never re-lands the document', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await dedupedFetch(R, '2020-05-02', async () => payload('2020-05-02'))
    await purgeCountyDayObsStore()
    await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS * 2)
    expect(disk.setStore).not.toHaveBeenCalled()
    expect(disk.doc).toBeUndefined()
  })

  it('a load parked across a purge does not adopt the pre-purge document', async () => {
    const doc = { version: 2, order: [dayObsKey(R, '2020-05-03')], entries: { [dayObsKey(R, '2020-05-03')]: entry('2020-05-03') } }
    disk.doc = doc
    const read = deferred<unknown>()
    disk.getStore.mockImplementationOnce(() => read.promise)
    const loading = loadAll()
    await purgeCountyDayObsStore()
    read.resolve(doc)
    expect((await loading).size).toBe(0)
  })
})
