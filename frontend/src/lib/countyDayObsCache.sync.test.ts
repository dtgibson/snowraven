// icloud-bar-chart-sync on the day cache (schema.md section 8.3; PRD QA-21,
// QA-23; D8 and D9):
//   1. `mergeSharedSnapshot`: union by (county, date); complete beats
//      incomplete; otherwise the later fetch wins and a tie keeps the local
//      entry; every peer entry through the load path's own validator; an
//      unparseable snapshot is absent; the local caps apply after; a purge
//      that lands mid-merge, or while the caller's download was in flight,
//      admits nothing; a key repeated in `order` is validated once, on the
//      merge and on the load path alike (security M1).
//   2. The eviction pass (D9, ROADMAP v1.0.39 Informational (3)) held to the
//      PREVIOUS implementation, kept below as the oracle, over a generated
//      corpus: the same survivors in the same order, on the load path and on
//      the put path. The oracle is `pickVictim` + `evict` from
//      `git show HEAD~:frontend/src/lib/countyDayObsCache.ts` (the pre-change
//      revision), with only the module globals turned into parameters.
//   3. The pass is O(n log n): a same-run quotient, not a wall clock.
//   4. `awaitDayObsWrites` runs a pending debounced flush at once.
//   5. A Clear that lands while the iCloud pass downloads a peer's snapshot:
//      the real pass over the real store admits nothing and pushes nothing
//      (security L1, the generation captured before the fetch).
/// <reference types="node" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const disk = vi.hoisted(() => ({
  doc: undefined as unknown,
  writes: 0,
  getStore: vi.fn(),
}))
vi.mock('./storage', () => ({
  storage: {
    getCountyDayObsStore: () => disk.getStore(),
    setCountyDayObsStore: async (doc: unknown) => { disk.writes += 1; disk.doc = JSON.parse(JSON.stringify(doc)) },
    deleteCountyDayObsStore: async () => { disk.doc = undefined },
    deleteSetting: async () => undefined,
  },
}))

import { createHash } from 'node:crypto'
import {
  awaitDayObsWrites, dayObsKey, dayObsPurgeGeneration, dedupedFetch, loadAll, mergeSharedSnapshot, purgeCountyDayObsStore,
  setDayObsMaxBytes, setDayObsMaxEntries, DAY_OBS_MAX_ENTRIES,
  _getCountyDayObsCacheWorkStatsForTests as stats, _resetCountyDayObsCacheForTests,
} from './countyDayObsCache'
import type { DayRecord } from './countyDayObsReduce'
import { lastNDates, SWEEP_DAYS } from './targets/targetsDates'
import { runDayObsPass, type DayObsPassContext, type DayObsPref } from './icloud/dayObsSync'
import { serializeRecord, type SharedRecord } from './icloud/icloudRecord'
import { ICloudNativeError, type ICloudNativeLayer } from './icloud/icloudNativeTypes'

const R = 'US-CA-001'
const R2 = 'US-NY-005'

function record(date: string, i = 0, over: Partial<DayRecord> = {}): DayRecord {
  return { speciesCode: `sp${i.toString(36)}`, obsDt: `${date} 08:00`, locId: 'L1', locName: 'Marsh', lat: 37.7, lng: -122.2, ...over }
}
interface E { fetchedAt: number; complete: boolean; bytes: number; species: DayRecord[] }
function entry(date: string, over: Partial<E> = {}, speciesCount = 1): E {
  const species = Array.from({ length: speciesCount }, (_, i) => record(date, i))
  return { fetchedAt: 1, complete: true, bytes: JSON.stringify(species).length, species, ...over }
}
function doc(entries: Record<string, E>, order = Object.keys(entries)) {
  return { version: 2, entries, order }
}
const text = (d: unknown) => JSON.stringify(d)
/** The merge as its one caller runs it: the generation read before the fetch. */
const merge = (t: string) => mergeSharedSnapshot(t, dayObsPurgeGeneration())

/** A deterministic PRNG (mulberry32), so a failing corpus row reproduces. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

beforeEach(() => {
  disk.doc = undefined
  disk.writes = 0
  disk.getStore.mockReset().mockImplementation(async () => disk.doc ?? null)
  _resetCountyDayObsCacheForTests()
})
afterEach(() => vi.useRealTimers())

describe('mergeSharedSnapshot: the rule (FR-24, QA-21)', () => {
  const days = lastNDates(Date.now(), 5)

  it('unions by key, and schedules ONE flush when anything was taken', async () => {
    disk.doc = doc({ [dayObsKey(R, days[1])]: entry(days[1]) })
    vi.useFakeTimers()
    const r = await merge(text(doc({ [dayObsKey(R, days[2])]: entry(days[2]) })))
    expect(r).toEqual({ admitted: 1, changed: true })
    expect([...(await loadAll()).keys()].sort()).toEqual([dayObsKey(R, days[1]), dayObsKey(R, days[2])].sort())
    await vi.runAllTimersAsync()
    expect(disk.writes).toBe(1)
  })

  it('complete beats incomplete whatever the times; incomplete never beats complete', async () => {
    const k1 = dayObsKey(R, days[1])
    const k2 = dayObsKey(R, days[2])
    disk.doc = doc({ [k1]: entry(days[1], { complete: false, fetchedAt: 100 }), [k2]: entry(days[2], { complete: true, fetchedAt: 1 }) })
    await merge(text(doc({ [k1]: entry(days[1], { complete: true, fetchedAt: 50 }), [k2]: entry(days[2], { complete: false, fetchedAt: 999 }) })))
    const all = await loadAll()
    expect(all.get(k1)).toMatchObject({ complete: true, fetchedAt: 50 })
    expect(all.get(k2)).toMatchObject({ complete: true, fetchedAt: 1 })
  })

  it('with equal completeness the later fetch wins, and a tie keeps the local entry (idempotence)', async () => {
    const k = dayObsKey(R, days[1])
    disk.doc = doc({ [k]: entry(days[1], { fetchedAt: 10 }, 1) })
    expect((await merge(text(doc({ [k]: entry(days[1], { fetchedAt: 10 }, 3) }))))).toEqual({ admitted: 1, changed: false })
    expect((await loadAll()).get(k)!.species).toHaveLength(1)
    expect((await merge(text(doc({ [k]: entry(days[1], { fetchedAt: 11 }, 3) }))))).toEqual({ admitted: 1, changed: true })
    expect((await loadAll()).get(k)!.species).toHaveLength(3)
    // The same snapshot again changes nothing.
    expect((await merge(text(doc({ [k]: entry(days[1], { fetchedAt: 11 }, 3) }))))).toEqual({ admitted: 1, changed: false })
  })

  it('over a generated corpus the KEPT KEY SET is order-independent (merging A into B equals B into A)', async () => {
    const pool = lastNDates(Date.now(), 40)
    const counties = ['US-CA-001', 'US-NY-005', 'US-TX-201']
    for (let seed = 1; seed <= 25; seed++) {
      const next = rng(seed)
      const make = () => {
        const e: Record<string, E> = {}
        for (let i = 0; i < 30; i++) {
          const d = pool[Math.floor(next() * pool.length)]
          const c = counties[Math.floor(next() * counties.length)]
          e[dayObsKey(c, d)] = entry(d, { complete: next() < 0.7, fetchedAt: Math.floor(next() * 5) }, 1 + Math.floor(next() * 3))
        }
        return doc(e)
      }
      const x = make()
      const y = make()
      const keysAfter = async (base: unknown, peer: unknown) => {
        _resetCountyDayObsCacheForTests()
        disk.doc = JSON.parse(text(base))
        await merge(text(peer))
        return [...(await loadAll()).keys()].sort()
      }
      const xy = await keysAfter(x, y)
      const yx = await keysAfter(y, x)
      expect(xy, `seed ${seed}`).toEqual(yx)
      expect(xy).toEqual([...new Set([...Object.keys(x.entries), ...Object.keys(y.entries)])].sort())
    }
  })

  it('the local caps apply AFTER the merge, unchanged', async () => {
    setDayObsMaxEntries(3)
    const e: Record<string, E> = {}
    for (const d of days) e[dayObsKey(R2, d)] = entry(d)
    disk.doc = doc({ [dayObsKey(R, days[0])]: entry(days[0], { fetchedAt: 99 }) })
    const r = await merge(text(doc(e)))
    expect(r.changed).toBe(true)
    expect((await loadAll()).size).toBe(3)
    expect(stats().evictions).toBeGreaterThan(0)
  })
})

describe('mergeSharedSnapshot: a peer snapshot is untrusted at the entry level (FR-26, QA-23)', () => {
  const days = lastNDates(Date.now(), 3)

  it.each([
    ['not JSON', '{"version":2,"entries":'],
    ['another version', text({ version: 1, entries: {}, order: [] })],
    ['entries as an array', text({ version: 2, entries: [], order: [] })],
    ['a bare string', text('snapshot')],
    ['null', 'null'],
  ])('%s is treated as absent and leaves the local store untouched', async (_label, t) => {
    const k = dayObsKey(R, days[1])
    disk.doc = doc({ [k]: entry(days[1]) })
    expect(await merge(t)).toEqual({ admitted: 0, changed: false })
    expect([...(await loadAll()).keys()]).toEqual([k])
    expect(stats().puts).toBe(0)
  })

  it('one malformed entry is dropped and the rest are merged, for every DayRecord guard', async () => {
    const d = days[1]
    const bads: Array<[string, Partial<DayRecord> | Record<string, unknown>]> = [
      ['a species code outside its shape', { speciesCode: 'BAD CODE' }],
      ['a report on another day', { obsDt: `${days[2]} 08:00` }],
      ['a malformed time', { obsDt: `${d}T08:00` }],
      ['a location id outside its shape', { locId: '../x' }],
      ['a non-string place name', { locName: 5 }],
      ['a latitude out of range', { lat: 91 }],
      ['a longitude that is not finite', { lng: Number.POSITIVE_INFINITY }],
      ['half a coordinate', { lat: 37, lng: null }],
    ]
    for (const [label, over] of bads) {
      _resetCountyDayObsCacheForTests()
      disk.doc = null
      const good = dayObsKey(R, d)
      const badKey = dayObsKey(R2, d)
      const bad = { ...entry(d), species: [{ ...record(d), ...over }] }
      const r = await merge(text(doc({ [good]: entry(d), [badKey]: bad as unknown as E })))
      expect(r, label).toEqual({ admitted: 1, changed: true })
      expect([...(await loadAll()).keys()], label).toEqual([good])
    }
  })

  it('a repeated species, a key that is not a county day, and a prototype-chain key are refused', async () => {
    const d = days[1]
    const dup = { ...entry(d), species: [record(d, 1), record(d, 1)] }
    const peer = JSON.parse(`{"version":2,"entries":{"__proto__":${text(entry(d))},"US-CA-001|2026-02-30":${text(entry(d))},"US-CA-001\\n|${d}":${text(entry(d))},"${dayObsKey(R, d)}":${text(dup)},"${dayObsKey(R2, d)}":${text(entry(d))}}}`)
    const r = await merge(text(peer))
    expect(r).toEqual({ admitted: 1, changed: true })
    expect([...(await loadAll()).keys()]).toEqual([dayObsKey(R2, d)])
  })

  it('walks at most the entry cap of peer keys', async () => {
    setDayObsMaxEntries(2)
    const e: Record<string, E> = {}
    for (const d of days) e[dayObsKey(R, d)] = entry(d)
    const r = await merge(text(doc(e)))
    expect(r.admitted).toBe(2)
  })

  it('a purge that lands while the merge waits for the store admits nothing into the fresh store', async () => {
    let release!: (v: unknown) => void
    disk.getStore.mockImplementation(() => new Promise((res) => { release = res }))
    const merging = merge(text(doc({ [dayObsKey(R, days[1])]: entry(days[1]) })))
    await purgeCountyDayObsStore()
    release(null)
    expect(await merging).toEqual({ admitted: 0, changed: false })
    expect((await loadAll()).size).toBe(0)
    expect(stats().puts).toBe(0)
  })

  it('a purge after the CALLER captured its generation admits nothing, though the store is loaded and the merge starts after it (security L1)', async () => {
    // The shape a generation read inside the merge cannot see: the store is
    // already loaded, the purge lands while the caller's download is in flight,
    // and the merge is called only afterwards, against the fresh mirror.
    await loadAll()
    const gen = dayObsPurgeGeneration()
    await purgeCountyDayObsStore()
    const r = await mergeSharedSnapshot(text(doc({ [dayObsKey(R, days[1])]: entry(days[1]) })), gen)
    expect(r).toEqual({ admitted: 0, changed: false })
    expect((await loadAll()).size).toBe(0)
    expect(stats().puts).toBe(0)
    await awaitDayObsWrites()
    expect(disk.doc).toBeUndefined()
  })
})

describe('a key repeated in `order` is validated ONCE, whatever its verdict (security M1)', () => {
  // The quadratic: the dedupe recorded a key only once it was ADMITTED, so a
  // key repeated N times whose entry fails on its last record paid N full
  // validations (N x S, both bounded only by the 64 MB snapshot cap; measured
  // 2.8 s at 565 KB). Asserted as WORK DONE (`validEntry` calls, testing.md
  // v0.5.85), never elapsed time. Sized so the pre-fix code finishes in
  // milliseconds and fails on the COUNT, so no timeout is what catches it.
  const days = lastNDates(Date.now(), 3)
  const d = days[1]
  const bad = dayObsKey(R, d)
  const good = dayObsKey(R2, d)
  /** 200 records, the last one malformed: the costliest shape to reject. */
  const failsLast = (): E => {
    const e = entry(d, {}, 200)
    e.species[199] = { ...e.species[199], speciesCode: 'BAD CODE' }
    return e
  }
  const repeated = (n: number) => doc({ [bad]: failsLast(), [good]: entry(d) }, [...Array.from({ length: n }, () => bad), good])

  it.each([250, 500, 1_000])('the MERGE: %i repetitions cost one validation of the rejected key, and the rest of the snapshot still merges', async (n) => {
    _resetCountyDayObsCacheForTests()
    await loadAll()
    const before = stats().validations
    const r = await merge(text(repeated(n)))
    expect(r).toEqual({ admitted: 1, changed: true })
    expect([...(await loadAll()).keys()]).toEqual([good])
    // One per DISTINCT key (the rejected one and the good one), flat as n doubles.
    expect(stats().validations - before).toBe(2)
  })

  it.each([250, 500, 1_000])('the LOAD path: %i repetitions cost one validation of the rejected key, and the good entry still loads', async (n) => {
    _resetCountyDayObsCacheForTests()
    disk.doc = JSON.parse(text(repeated(n)))
    expect([...(await loadAll()).keys()]).toEqual([good])
    expect(stats().validations).toBe(2)
  })
})

// ── The real iCloud pass over the real store: a Clear mid-download (security L1) ──

const PEER = 'b'.repeat(32)
const SELF = 'a'.repeat(32)
const sha = (t: string) => createHash('sha256').update(t).digest('hex')

/** A container holding one peer's snapshot, whose download runs `midDownload`
 *  before it resolves. Records every command this device issues. */
function containerWithPeer(peerText: string, midDownload: () => Promise<void>) {
  const calls: string[] = []
  const rec: SharedRecord = {
    version: 1, slot: 'day-obs', state: 'file', filename: 'county-day-obs.json',
    uploadedAt: new Date(Date.now() - 60_000).toISOString(),
    origin: { deviceId: PEER, label: 'iPhone', platform: 'iphone' },
    byteLength: peerText.length, sha256: sha(peerText),
  }
  const unsupported = async (): Promise<never> => { throw new ICloudNativeError('unknown') }
  const native: ICloudNativeLayer = {
    status: unsupported, readRecord: unsupported, push: unsupported, pushCleared: unsupported, pull: unsupported,
    startDownload: unsupported, removeAll: unsupported, readKeys: unsupported, writeKeys: unsupported, removeKeys: unsupported,
    watch: async () => {}, onChanged: async () => () => {}, onIdentityChanged: async () => () => {},
    pushItemsCleared: unsupported,
    async listItems() {
      calls.push('listItems')
      return {
        items: [{ id: PEER, present: true, record: serializeRecord(rec), file: { present: true, downloaded: true, downloading: false, byteLength: peerText.length, uploaded: true } }],
        truncated: false,
      }
    },
    async pullItem() {
      calls.push('pullItem')
      await midDownload()
      return { text: peerText }
    },
    async pushItem() {
      calls.push('pushItem')
      return { sha256: 'c'.repeat(64), byteLength: 2, uploaded: true, skipped: false }
    },
    async startDownloadItem() { calls.push('startDownloadItem') },
    async removeItem() { calls.push('removeItem'); return { removed: 1 } },
    async removeItems() { calls.push('removeItems'); return { removed: 0 } },
  }
  return { native, calls }
}

describe('a Clear that lands while the pass downloads a peer snapshot (security L1)', () => {
  it('the real pass over the real store admits nothing and pushes nothing', async () => {
    // The Auditor's sequence: a check on this device is pulling the peer's
    // snapshot, and the user clears the eBird backup (which purges this store).
    // Before the fix the merge read the generation AFTER the download, found
    // the fresh store valid, admitted the peer's entries, and the push half
    // uploaded them: the day answers survived the Clear.
    const d = lastNDates(Date.now(), 3)[1]
    let backup = true
    const { native, calls } = containerWithPeer(text(doc({ [dayObsKey(R, d)]: entry(d) })), async () => {
      await purgeCountyDayObsStore()
      backup = false
    })
    const pref: { dayObs?: DayObsPref } = {}
    const ctx: DayObsPassContext = {
      native, pref, deviceId: SELF, now: () => Date.now(), log: () => {},
      thisDevice: () => ({ deviceId: SELF, label: 'Mac', platform: 'mac' }),
      raceTimeout: (p) => p,
      mergeSnapshot: mergeSharedSnapshot,
      purgeGeneration: dayObsPurgeGeneration,
      awaitWrites: awaitDayObsWrites,
      hasBackup: async () => backup,
    }
    await loadAll() // a live session: the store was loaded before the check
    const r = await runDayObsPass(ctx, () => 10_000)
    expect(calls).toEqual(['listItems', 'pullItem'])
    expect(r).toEqual({ transferred: false, failed: false })
    expect((await loadAll()).size).toBe(0)
    expect(stats().puts).toBe(0)
    expect(disk.doc).toBeUndefined()
  })

  it('control: with no Clear, the same pass merges the peer and pushes (the row above is not vacuous)', async () => {
    const d = lastNDates(Date.now(), 3)[1]
    const { native, calls } = containerWithPeer(text(doc({ [dayObsKey(R, d)]: entry(d) })), async () => {})
    const ctx: DayObsPassContext = {
      native, pref: {}, deviceId: SELF, now: () => Date.now(), log: () => {},
      thisDevice: () => ({ deviceId: SELF, label: 'Mac', platform: 'mac' }),
      raceTimeout: (p) => p,
      mergeSnapshot: mergeSharedSnapshot,
      purgeGeneration: dayObsPurgeGeneration,
      awaitWrites: awaitDayObsWrites,
      hasBackup: async () => true,
    }
    await loadAll()
    const r = await runDayObsPass(ctx, () => 10_000)
    expect(calls).toEqual(['listItems', 'pullItem', 'pushItem'])
    expect(r.transferred).toBe(true)
    expect([...(await loadAll()).keys()]).toEqual([dayObsKey(R, d)])
  })
})

describe('awaitDayObsWrites drains the writer for the snapshot push (schema.md 8.3)', () => {
  it('runs a pending debounced flush NOW, and resolves after it lands', async () => {
    vi.useFakeTimers()
    const d = lastNDates(Date.now(), 2)[1]
    await dedupedFetch(R, d, async () => ({ regionCode: R, date: d, species: [record(d)] }))
    expect(disk.writes).toBe(0) // still inside the debounce window
    await awaitDayObsWrites()
    expect(disk.writes).toBe(1)
    expect(Object.keys((disk.doc as { entries: object }).entries)).toEqual([dayObsKey(R, d)])
    // And the cancelled timer does not flush a second time.
    await vi.runAllTimersAsync()
    expect(disk.writes).toBe(1)
  })

  it('with nothing pending it resolves without writing', async () => {
    await awaitDayObsWrites()
    expect(disk.writes).toBe(0)
  })
})

// ── The previous eviction, as the oracle (pre-change revision, globals as parameters) ──

interface OracleStore { entries: Record<string, E>; order: string[] }
const regionOf = (k: string) => k.slice(0, k.indexOf('|'))
const dateOf = (k: string) => k.slice(k.indexOf('|') + 1)

function oraclePickVictim(store: OracleStore, keep: string | null, horizon: string): string | null {
  const lastVisited = new Map<string, number>()
  for (const k of store.order) {
    const r = regionOf(k)
    const at = store.entries[k].fetchedAt
    const prev = lastVisited.get(r)
    if (prev === undefined || at > prev) lastVisited.set(r, at)
  }
  let best: string | null = null
  let bestOut = false
  let bestVisited = 0
  let bestDate = ''
  for (const k of store.order) {
    if (k === keep) continue
    const date = dateOf(k)
    const out = date < horizon
    const visited = lastVisited.get(regionOf(k))!
    const better = best === null
      || (out !== bestOut ? out
        : visited !== bestVisited ? visited < bestVisited
        : date !== bestDate ? date < bestDate
        : k < best)
    if (better) { best = k; bestOut = out; bestVisited = visited; bestDate = date }
  }
  return best
}
function oracleEvict(store: OracleStore, keep: string | null, nowMs: number, maxEntries: number, maxBytes: number): void {
  const horizon = lastNDates(nowMs, SWEEP_DAYS)[SWEEP_DAYS - 1]
  let total = 0
  for (const k of store.order) total += store.entries[k].bytes
  while (store.order.length > 1 && (store.order.length > maxEntries || total > maxBytes)) {
    const victim = oraclePickVictim(store, keep, horizon)
    if (victim === null) break
    total -= store.entries[victim].bytes
    delete store.entries[victim]
    store.order.splice(store.order.indexOf(victim), 1)
  }
}

function generatedDoc(seed: number, n: number) {
  const next = rng(seed)
  const pool = lastNDates(Date.now(), 60) // half inside the sweep window, half outside
  const counties = ['US-CA-001', 'US-CA-013', 'US-NY-005', 'US-TX-201', 'US-WA-033']
  const e: Record<string, E> = {}
  const order: string[] = []
  while (order.length < n) {
    const k = dayObsKey(counties[Math.floor(next() * counties.length)], pool[Math.floor(next() * pool.length)])
    if (e[k]) continue
    // Few distinct fetch times, so recency ties across counties are exercised.
    e[k] = entry(dateOf(k), { fetchedAt: Math.floor(next() * 6), complete: next() < 0.8 }, 1 + Math.floor(next() * 4))
    order.push(k)
  }
  return doc(e, order)
}

describe('the eviction pass equals the previous implementation (D9)', () => {
  it('on the LOAD path (no keep), over a generated corpus: same survivors, same order', async () => {
    let evicting = 0
    for (let seed = 1; seed <= 40; seed++) {
      const n = 40 + (seed % 5) * 20
      const d = generatedDoc(seed, n)
      const totalBytes = Object.values(d.entries).reduce((s, e) => s + e.bytes, 0)
      const maxBytes = Math.floor(totalBytes * (0.2 + (seed % 7) / 10))
      const maxEntries = seed % 3 === 0 ? Math.floor(n / 2) : 3_000
      // The load path ADMITS at most the entry cap, in order, before it evicts
      // (sanitizeStore's load-time admission, unchanged); the oracle does too.
      const admitted = d.order.slice(0, maxEntries)
      const oracle: OracleStore = JSON.parse(text({ entries: Object.fromEntries(admitted.map(k => [k, d.entries[k]])), order: admitted }))
      oracleEvict(oracle, null, Date.now(), maxEntries, maxBytes)
      _resetCountyDayObsCacheForTests()
      setDayObsMaxBytes(maxBytes)
      setDayObsMaxEntries(maxEntries)
      disk.doc = JSON.parse(text(d))
      const got = [...(await loadAll()).keys()]
      expect(got, `seed ${seed}`).toEqual(oracle.order)
      if (got.length < n) evicting += 1
    }
    // Non-vacuity: the corpus really evicts, in most rows.
    expect(evicting).toBeGreaterThan(30)
  })

  it('on the PUT path (the entry being written is never the victim): same survivors, same order', async () => {
    for (let seed = 101; seed <= 130; seed++) {
      const d = generatedDoc(seed, 60)
      const totalBytes = Object.values(d.entries).reduce((s, e) => s + e.bytes, 0)
      _resetCountyDayObsCacheForTests()
      disk.doc = JSON.parse(text(d))
      await loadAll() // loaded under the default budget: nothing evicted yet
      const maxBytes = Math.floor(totalBytes * 0.5)
      setDayObsMaxBytes(maxBytes)
      const date = lastNDates(Date.now(), 1)[0]
      const species = [record(date, 7)]
      const newKey = dayObsKey('US-CA-001', date)
      await dedupedFetch('US-CA-001', date, async () => ({ regionCode: 'US-CA-001', date, species }))
      const got = [...(await loadAll()).keys()]
      // The oracle: the loaded document, the new entry moved to the tail, then evict(keep).
      const oracle: OracleStore = JSON.parse(text({ entries: d.entries, order: d.order }))
      const at = oracle.order.indexOf(newKey)
      if (at !== -1) oracle.order.splice(at, 1)
      const fetched = (await loadAll()).get(newKey)!
      oracle.entries[newKey] = JSON.parse(text(fetched))
      oracle.order.push(newKey)
      oracleEvict(oracle, newKey, fetched.fetchedAt, 3_000, maxBytes)
      expect(got, `seed ${seed}`).toEqual(oracle.order)
      expect(got).toContain(newKey)
    }
  })

  it('is O(n log n): a 4x larger crafted document costs well under the quadratic 16x (same-run quotient)', async () => {
    // A crafted near-empty document under a tiny budget, so almost every entry
    // is a victim: the previous loop rebuilt the county recency and rescanned
    // every entry per victim (quadratic; measured 3.3x per doubling on
    // ROADMAP's 2,996-entry case). The quotient is taken in one run so the
    // machine cancels; a distinct document per run defeats the one-load-per-
    // session memo. Stated budget: this row does real work at 3,000 entries.
    const crafted = (n: number, salt: number) => {
      const pool = lastNDates(Date.now() - salt * 86_400_000, 1_000)
      const counties = Array.from({ length: 50 }, (_, i) => `US-CA-${String(i + 1).padStart(3, '0')}`)
      const e: Record<string, E> = {}
      const order: string[] = []
      for (let i = 0; order.length < n; i++) {
        const k = dayObsKey(counties[i % counties.length], pool[Math.floor(i / counties.length)])
        e[k] = entry(dateOf(k), { fetchedAt: i % 97 })
        order.push(k)
      }
      return doc(e, order)
    }
    const time = async (n: number, salt: number) => {
      _resetCountyDayObsCacheForTests()
      setDayObsMaxBytes(1)
      disk.doc = crafted(n, salt)
      const t0 = performance.now()
      const all = await loadAll()
      const t = performance.now() - t0
      expect(all.size).toBe(1) // the pass evicted everything the budget refuses
      return t
    }
    const best = async (n: number) => {
      let m = Number.POSITIVE_INFINITY
      for (let r = 0; r < 5; r++) m = Math.min(m, await time(n, r * 7 + n))
      return m
    }
    const small = await best(750)
    const large = await best(DAY_OBS_MAX_ENTRIES)
    expect(large / Math.max(small, 0.05)).toBeLessThan(9)
  }, 30_000)
})
