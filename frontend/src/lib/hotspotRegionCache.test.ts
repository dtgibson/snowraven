// The persisted per-region hotspot store (hotspot-share-stat, schema.md 7.2, 7.3, 9).
// Driven against an in-memory storage seam, so every assertion is about what the
// document holds or what the store did (its work-stats seam), never elapsed time.
/// <reference types="node" />
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'

const disk = vi.hoisted(() => ({
  settings: new Map<string, unknown>(),
  raw: new Map<string, unknown>(),
  /** When set, a read takes its value FIRST and then waits on this before
   *  answering, the order a Tauri `settings.json` chain link queued ahead of a
   *  purge's delete has (security L2). Null in every other row. */
  afterRead: null as (() => Promise<void>) | null,
}))
vi.mock('./storage', () => ({
  storage: {
    // `raw` holds a value handed back exactly as stored (an unparseable or hostile
    // shape a JSON round trip would not reproduce); `settings` round-trips.
    getSetting: async (k: string) => {
      const value = disk.raw.has(k)
        ? disk.raw.get(k)
        : disk.settings.has(k) ? JSON.parse(JSON.stringify(disk.settings.get(k))) as unknown : null
      if (disk.afterRead) await disk.afterRead()
      return value
    },
    setSetting: async (k: string, v: unknown) => { disk.settings.set(k, JSON.parse(JSON.stringify(v)) as unknown) },
    deleteSetting: async (k: string) => { disk.settings.delete(k); disk.raw.delete(k) },
  },
}))

import * as store from './hotspotRegionCache'

const KEY = store.HOTSPOT_REGIONS_STORE_KEY
type Entry = { ids: string[]; fetchedAt: number }
const doc = () => disk.settings.get(KEY) as { entries: Record<string, Entry>; order: string[] } | undefined
const NOW = Date.parse('2026-11-06T12:00:00.000Z')

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

beforeEach(() => {
  store._resetHotspotRegionCacheForTests()
  disk.settings.clear()
  disk.raw.clear()
  disk.afterRead = null
})

describe('the derived payload length', () => {
  it('equals JSON.stringify(ids).length at 0, 1, 2 and 1,000 ids', () => {
    for (const n of [0, 1, 2, 1000]) {
      const ids = Array.from({ length: n }, (_, i) => `L${i * 7919 + 1}`)
      expect(store.idsPayloadLength(ids), `${n} ids`).toBe(JSON.stringify(ids).length)
    }
  })
})

describe('validation on load (QA-48)', () => {
  const load = async (value: unknown, viaRaw = false) => {
    if (viaRaw) disk.raw.set(KEY, value)
    else disk.settings.set(KEY, value)
    await store.ensureLoaded()
  }

  it('drops each malformed entry without throwing, keeps the valid ones, and reads a dropped region as never answered', async () => {
    // `__proto__` written through JSON.parse, so it is a real OWN key as it would
    // arrive from storage (an object literal would set the prototype instead).
    const body = JSON.stringify({
      'US-MN': { ids: ['L1', 'L2'], fetchedAt: NOW },
      'us-wi': { ids: ['L3'], fetchedAt: NOW },               // invalid region code
      'US-ND': { ids: ['L4', 'S5'], fetchedAt: NOW },          // an id failing the shape test, last
      'US-SD': { ids: ['L6'], fetchedAt: Number.NaN },         // serializes to null
      'US-IA': { ids: ['L7'], fetchedAt: '2026' },             // not a number
      'ZZ-ZZZZ-00000': { ids: ['L8'], fetchedAt: NOW },        // 13 characters
      'US-NE': { ids: 'L9', fetchedAt: NOW },                  // not an array
    })
    const entries = JSON.parse(`${body.slice(0, -1)},"__proto__":{"ids":["L10"],"fetchedAt":1}}`) as Record<string, unknown>
    expect(Object.hasOwn(entries, '__proto__')).toBe(true) // the probe really is an own key
    await load({ version: 1, entries, order: Object.keys(entries) }, true)
    expect(store.peekRegion('US-MN')?.ids).toEqual(['L1', 'L2'])
    for (const k of ['us-wi', 'US-ND', 'US-SD', 'US-IA', 'ZZ-ZZZZ-00000', 'US-NE', '__proto__']) {
      expect(store.peekRegion(k), k).toBeNull()
    }
  })

  it('an entry one id past the per-region bound is refused before any id is examined', () => {
    const ids = Array.from({ length: store.HOTSPOT_IDS_PER_REGION_MAX + 1 }, (_, i) => `L${i + 1}`)
    const s = store.sanitizeStore({ version: 1, entries: { 'US-TX': { ids, fetchedAt: NOW } }, order: ['US-TX'] })
    expect(s.order).toEqual([])
    expect(store._getHotspotRegionCacheWorkStatsForTests().idTests).toBe(0)
  })

  it.each([
    ['null', null],
    ['a string', 'not a document'],
    ['an array', []],
    ['no order', { version: 1, entries: {} }],
    ['entries not an object', { version: 1, entries: 'x', order: [] }],
  ])('a document that is %s loads as empty', async (_label, value) => {
    await load(value, true)
    expect(store.peekRegion('US-MN')).toBeNull()
  })

  it('an order repeating one invalid key pays ONE validation, however long (work done, not time)', () => {
    const counts: number[] = []
    for (const n of [5_000, 10_000]) {
      store._resetHotspotRegionCacheForTests()
      store.sanitizeStore({ version: 1, entries: {}, order: Array.from({ length: n }, () => 'not-a-region') })
      counts.push(store._getHotspotRegionCacheWorkStatsForTests().keyValidations)
    }
    expect(counts).toEqual([1, 1])
  })

  it('a document of malformed entries cannot buy more id tests than the declared bound', () => {
    store.setHotspotRegionsMaxBytes(50)
    // floor(50 / 5) + 65,536 ids may be examined in all; each entry here is the
    // per-region maximum with one bad id in LAST position, so every id is tested.
    const bound = Math.floor(50 / 5) + store.HOTSPOT_IDS_PER_REGION_MAX
    const ids = [...Array.from({ length: store.HOTSPOT_IDS_PER_REGION_MAX - 1 }, (_, i) => `L${i + 1}`), 'bad']
    const entries: Record<string, Entry> = {}
    const order: string[] = []
    for (let i = 0; i < 4; i += 1) { const k = `US-A${i}`; entries[k] = { ids, fetchedAt: NOW }; order.push(k) }
    store.sanitizeStore({ version: 1, entries, order })
    expect(store._getHotspotRegionCacheWorkStatsForTests().idTests).toBeLessThanOrEqual(bound)
    expect(store._getHotspotRegionCacheWorkStatsForTests().idTests).toBe(store.HOTSPOT_IDS_PER_REGION_MAX)
  })

  it('walks newest first: a document over the entry cap sheds its OLDEST entries at load', () => {
    store.setHotspotRegionsMaxEntries(2)
    const s = store.sanitizeStore({
      version: 1,
      entries: { 'US-A': { ids: ['L1'], fetchedAt: 1 }, 'US-B': { ids: ['L2'], fetchedAt: 2 }, 'US-C': { ids: ['L3'], fetchedAt: 3 } },
      order: ['US-A', 'US-B', 'US-C'],
    })
    expect(s.order).toEqual(['US-B', 'US-C']) // re-emitted oldest first
  })
})

describe('the write chokepoint', () => {
  it('QA-51: two concurrent asks of one region share one request and resolve to the same list', async () => {
    const gate = deferred<string[]>()
    const loader = vi.fn(() => gate.promise)
    const a = store.dedupedFetch('US-MN', loader, { refresh: false })
    const b = store.dedupedFetch('US-MN', loader, { refresh: false })
    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(1))
    gate.resolve(['L1', 'L2'])
    const [ra, rb] = await Promise.all([a, b])
    expect(loader).toHaveBeenCalledTimes(1)
    expect(ra.ids).toEqual(['L1', 'L2'])
    expect(rb.ids).toBe(ra.ids)
  })

  it('a fresh entry answers with no request; a due one answers with no request unless refresh is asked', async () => {
    disk.settings.set(KEY, {
      version: 1,
      entries: { 'US-MN': { ids: ['L1'], fetchedAt: Date.now() }, 'US-WI': { ids: ['L7'], fetchedAt: Date.now() - store.HOTSPOT_REGION_TTL_MS } },
      order: ['US-MN', 'US-WI'],
    })
    const loader = vi.fn(async () => ['L9'])
    expect((await store.dedupedFetch('US-MN', loader, { refresh: true })).fromNetwork).toBe(false)
    expect((await store.dedupedFetch('US-WI', loader, { refresh: false })).ids).toEqual(['L7'])
    expect(loader).not.toHaveBeenCalled()
    expect((await store.dedupedFetch('US-WI', loader, { refresh: true })).ids).toEqual(['L9'])
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('QA-47: a failure of any kind, and a body that is not a list, writes nothing', async () => {
    const failures: Array<() => Promise<unknown>> = [
      async () => { throw Object.assign(new Error('Transport error: 429'), { status: 429 }) },
      async () => { throw new TypeError('Failed to fetch') },
      async () => ({ species: [] }),
      () => { throw new Error('synchronous') },
    ]
    for (const loader of failures) {
      await expect(store.dedupedFetch('US-MN', loader, { refresh: false })).rejects.toBeTruthy()
    }
    store._flushHotspotRegionWriteForTests()
    expect(doc()).toBeUndefined()
    expect(store._getHotspotRegionCacheWorkStatsForTests().puts).toBe(0)
    // Nothing failed was left in flight to be joined: the next ask runs its loader.
    const ok = vi.fn(async () => ['L1'])
    expect((await store.dedupedFetch('US-MN', ok, { refresh: false })).ids).toEqual(['L1'])
    expect(ok).toHaveBeenCalledTimes(1)
  })

  it('abandonInflight: a running request is not joined by a later ask and does not persist', async () => {
    const old = deferred<string[]>()
    const first = store.dedupedFetch('US-MN', () => old.promise, { refresh: false })
    await vi.waitFor(() => expect(store._getHotspotRegionCacheWorkStatsForTests().loaderCalls).toBe(1))
    store.abandonInflight()
    const fresh = vi.fn(async () => ['L9'])
    const second = store.dedupedFetch('US-MN', fresh, { refresh: false })
    expect((await second).ids).toEqual(['L9'])
    expect(fresh).toHaveBeenCalledTimes(1)
    old.resolve(['L1'])
    expect((await first).ids).toEqual(['L1']) // still settles for whoever awaited it
    store._flushHotspotRegionWriteForTests()
    expect(doc()!.entries['US-MN'].ids).toEqual(['L9'])
    expect(store._getHotspotRegionCacheWorkStatsForTests().puts).toBe(1)
  })

  it('a region key the validator would refuse is answered and not persisted', async () => {
    const key = 'US-ABCDEFGHIJ' // 13 characters: REGION_RE admits it, the store does not
    expect((await store.dedupedFetch(key, async () => ['L1'], { refresh: false })).ids).toEqual(['L1'])
    store._flushHotspotRegionWriteForTests()
    expect(doc()).toBeUndefined()
  })
})

describe('the entry cap and the payload budget (QA-49), read from the exported constants', () => {
  it('at cap + 1 entries the OLDEST is evicted and the rest are untouched (work done: one eviction)', async () => {
    store.setHotspotRegionsMaxEntries(4)
    for (let i = 0; i <= store.HOTSPOT_REGIONS_MAX_ENTRIES; i += 1) {
      await store.dedupedFetch(`US-R${i}`, async () => [`L${i + 1}`], { refresh: false })
    }
    expect(store.peekRegion('US-R0')).toBeNull()
    for (let i = 1; i <= store.HOTSPOT_REGIONS_MAX_ENTRIES; i += 1) expect(store.peekRegion(`US-R${i}`)?.ids).toEqual([`L${i + 1}`])
    const w = store._getHotspotRegionCacheWorkStatsForTests()
    expect([w.puts, w.evictions]).toEqual([store.HOTSPOT_REGIONS_MAX_ENTRIES + 1, 1])
  })

  it('one id past the payload budget evicts the oldest entry and keeps the derived total within it', async () => {
    const one = store.idsPayloadLength(['L1', 'L2'])
    store.setHotspotRegionsMaxBytes(one * 3)
    await store.dedupedFetch('US-A', async () => ['L1', 'L2'], { refresh: false })
    await store.dedupedFetch('US-B', async () => ['L1', 'L2'], { refresh: false })
    await store.dedupedFetch('US-C', async () => ['L1', 'L2'], { refresh: false })
    expect(store._hotspotRegionBytesForTests()).toBe(store.HOTSPOT_REGIONS_MAX_BYTES)
    await store.dedupedFetch('US-D', async () => ['L1'], { refresh: false }) // one id past
    expect(store.peekRegion('US-A')).toBeNull()
    expect(store.peekRegion('US-D')).not.toBeNull()
    expect(store._hotspotRegionBytesForTests()).toBeLessThanOrEqual(store.HOTSPOT_REGIONS_MAX_BYTES)
    store._flushHotspotRegionWriteForTests()
    expect(doc()!.order).toEqual(['US-B', 'US-C', 'US-D'])
  })

  it('the shipped caps are the documented constants, and no single admitted entry can exceed the budget', () => {
    expect(store.HOTSPOT_REGIONS_MAX_ENTRIES).toBe(store.HOTSPOT_REGIONS_MAX_ENTRIES_DEFAULT)
    expect(store.HOTSPOT_REGIONS_MAX_BYTES).toBe(store.HOTSPOT_REGIONS_MAX_BYTES_DEFAULT)
    const largest = 1 + store.HOTSPOT_IDS_PER_REGION_MAX * (store.HOTSPOT_ID_MAX_CHARS + 3)
    expect(largest).toBeLessThan(store.HOTSPOT_REGIONS_MAX_BYTES_DEFAULT)
  })
})

describe('the purge (QA-45, QA-46)', () => {
  it('removes the document and empties the mirror; a write already scheduled does not restore it', async () => {
    await store.dedupedFetch('US-MN', async () => ['L1'], { refresh: false })
    store._flushHotspotRegionWriteForTests()
    expect(doc()).toBeDefined()
    await store.dedupedFetch('US-WI', async () => ['L7'], { refresh: false }) // a write now pending
    await store.purgeHotspotRegionStore()
    store._flushHotspotRegionWriteForTests()
    expect(doc()).toBeUndefined()
    expect(store.peekRegion('US-MN')).toBeNull()
  })

  it('QA-46: a load that read the document BEFORE the purge and answers after it adopts nothing, and nothing is written back (security L2)', async () => {
    // Read first, then park: the parked read hands back the PRE-purge document, as
    // a Tauri chain link queued ahead of the purge's delete does. A mock that parks
    // first and reads after hands back the post-purge disk and cannot see the
    // parked-load guard at all (the shared `clearDerived.test.ts` roster's shape).
    disk.settings.set(KEY, { version: 1, entries: { 'US-WI': { ids: ['L7'], fetchedAt: NOW } }, order: ['US-WI'] })
    const park = deferred<void>()
    let read = false
    disk.afterRead = async () => { read = true; await park.promise }
    const loading = store.ensureLoaded()
    await vi.waitFor(() => expect(read).toBe(true))
    disk.afterRead = null
    await store.purgeHotspotRegionStore()
    expect(doc()).toBeUndefined()
    park.resolve()
    await loading
    expect(store.peekRegion('US-WI')).toBeNull()
    expect(store._hotspotRegionBytesForTests()).toBe(0)
    store._flushHotspotRegionWriteForTests()
    expect(doc()).toBeUndefined()
    // The next answer writes only itself: an adopted pre-purge mirror would carry
    // the cleared region back to disk with it.
    await store.dedupedFetch('US-MN', async () => ['L1'], { refresh: false })
    store._flushHotspotRegionWriteForTests()
    expect(doc()!.order).toEqual(['US-MN'])
  })

  it('a Clear landing after the chokepoint read the old mirror, before its request registered, persists nothing (security I1)', async () => {
    // `putEntry`'s identity check is the ONLY guard here: the purge's synchronous
    // part runs while `dedupedFetch` is suspended on `await loadStore()` holding the
    // old mirror, so the request registers in `_inflight` AFTER the purge cleared it
    // and the in-flight check passes.
    await store.ensureLoaded()
    const pending = store.dedupedFetch('US-MN', async () => ['L1'], { refresh: false })
    const purge = store.purgeHotspotRegionStore()
    expect((await pending).ids).toEqual(['L1']) // still served to its caller
    await purge
    store._flushHotspotRegionWriteForTests()
    const w = store._getHotspotRegionCacheWorkStatsForTests()
    expect(w.loaderCalls).toBe(1) // the request really ran, past the in-flight check
    expect(w.puts).toBe(0)
    expect(store._hotspotRegionBytesForTests()).toBe(0)
    expect(store.peekRegion('US-MN')).toBeNull()
    expect(doc()).toBeUndefined()
  })
})

describe('the write guards are each pinned at the source (security.md: one pin per guard)', () => {
  // A request begun before a Clear can meet two write guards: the purge clears the
  // in-flight map (so `_inflight.get(region) === p` fails at the write) and replaces
  // the mirror (so `putEntry`'s identity check fails). They are NOT redundant. When a
  // Clear's synchronous part runs after `dedupedFetch`'s `await loadStore()` has
  // settled with the old mirror but before its request registers in `_inflight`, the
  // in-flight check passes and the identity check is the only guard: without it the
  // put lands in the detached mirror and the live byte total over-counts (security
  // I1). Each is pinned here at its source; the abandon row is the in-flight check's
  // behavioural guard and the interleaving row in the purge block is the identity
  // check's. `flushWrite`'s own identity check is what keeps the disk clean in that
  // interleaving even with `putEntry`'s removed, so it is pinned too.
  const src = readFileSync('src/lib/hotspotRegionCache.ts', 'utf8')
    .split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n')
  const body = (fn: string) => { const at = src.slice(src.indexOf(fn)); return at.slice(0, at.indexOf('\n}')) }

  it('dedupedFetch writes only while its request is still the current one for its region', () => {
    expect(body('export function dedupedFetch(')).toContain('_inflight.get(regionCode) === p &&')
  })
  it('putEntry writes only into the mirror it was handed, never a replaced one', () => {
    expect(body('function putEntry(')).toContain('if (store !== _store) return')
  })
  it('the deferred write declines a replaced mirror too', () => {
    expect(body('function flushWrite(')).toContain('if (store !== _store) return')
  })
})
