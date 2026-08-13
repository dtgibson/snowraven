// The persistent exotic-provenance store: TTL freshness, in-flight dedupe, the
// two DELIBERATELY OPPOSITE retention policies, load-path shape validation, and
// errors never cached. The storage seam is mocked to an in-memory document so
// persistence round-trips are observable.
//
// Two of this file's disciplines are house rules earned from shipped defects:
//
//  - A FIXED-SIZE CACHE'S PERFORMANCE CLAIM IS MEASURED AT CAPACITY PLUS ONE.
//    At capacity a fixed-size structure never evicts and every measurement after
//    the first is a hit, so it reports its best case as its typical case. The
//    rule is applied to BOTH ledgers here, not only the one that prompted it.
//  - The bound is asserted as WORK DONE (loader calls, order searches,
//    evictions, admissions refused), never as elapsed time, because a hit and a
//    miss are two kinds of work that lose CPU-cache locality at different rates
//    and an elapsed-time form has already been measured getting WORSE with more
//    rounds.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as cache from './exoticProvenanceCache'
import type { ProvenanceObservation } from './exoticProvenanceCache'

const seamDoc: { value: unknown } = { value: null }

vi.mock('./storage', () => ({
  storage: {
    getSetting: vi.fn(async (key: string) => (key === 'exotic-provenance-v1' ? seamDoc.value : null)),
    setSetting: vi.fn(async (_key: string, value: unknown) => { seamDoc.value = JSON.parse(JSON.stringify(value)) }),
  },
}))

const setSettingSpy = vi.mocked((await import('./storage')).storage.setSetting)

const DAY = 86_400_000
const ALL = new Set<string>(['musduc', 'graygo', 'amerob', 'redjun', 'mallar3'])

function o(speciesCode: string, exoticCategory = '', userDoNotCount = ''): ProvenanceObservation {
  return { speciesCode, exoticCategory, userDoNotCount }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(1_750_000_000_000)
  seamDoc.value = null
  setSettingSpy.mockClear()
  cache._resetProvenanceCacheForTests()
})

afterEach(() => { vi.useRealTimers() })

// ── Merge and the snapshot ────────────────────────────────────────────────────

describe('merge (schema.md §8.4)', () => {
  it('records the raw pair per species and unions across checklists', async () => {
    await cache.mergeChecklist('S1', [o('musduc', 'X', 'DNC')], ALL, Date.now())
    await cache.mergeChecklist('S2', [o('musduc', 'N')], ALL, Date.now())
    const snap = cache.getSnapshot()
    expect(snap.species.get('musduc')!.seen).toEqual(['X|DNC', 'N|'])
    expect(snap.species.get('musduc')!.n).toBe(2)
    expect([...snap.checklists]).toEqual(['S1', 'S2'])
  })

  it('does NOT de-duplicate two forms that collapse to one species code', async () => {
    // "Mallard" and "Mallard (Domestic type)" on one checklist arrive as two
    // observations that resolve to the SAME parent code. Both tokens must land,
    // because the monotone OR is exactly what settles that case, and it is what
    // makes the `category === 'domestic'` shortcut wrong.
    await cache.mergeChecklist('S1', [o('mallar3', 'X', 'DNC'), o('mallar3', '')], ALL, Date.now())
    const r = cache.getSnapshot().species.get('mallar3')!
    expect(r.seen).toEqual(['X|DNC', '|'])
    expect(r.n).toBe(2)
  })

  it('records a species only when it is in the current cover index', async () => {
    await cache.mergeChecklist('S1', [o('musduc', 'X', 'DNC'), o('notinexport', 'X', 'DNC')], ALL, Date.now())
    const snap = cache.getSnapshot()
    expect(snap.species.has('musduc')).toBe(true)
    expect(snap.species.has('notinexport')).toBe(false)
  })

  it('bounds the distinct tokens per species', async () => {
    for (let i = 0; i < 20; i += 1) {
      await cache.mergeChecklist(`S${i}`, [o('musduc', String.fromCharCode(65 + i))], ALL, Date.now())
    }
    expect(cache.getSnapshot().species.get('musduc')!.seen.length).toBe(8)
  })

  it('notifies subscribers so every passive reader re-derives after a merge', async () => {
    await cache.loadSnapshot()      // the initial load notifies too; start after it
    const seen: number[] = []
    const unsub = cache.subscribe(() => seen.push(cache.getRevision()))
    await cache.mergeChecklist('S1', [o('musduc', 'X', 'DNC')], ALL, Date.now())
    unsub()
    await cache.mergeChecklist('S2', [o('graygo', 'X', 'DNC')], ALL, Date.now())
    expect(seen.length).toBe(1)
  })
})

// ── TTL and freshness ─────────────────────────────────────────────────────────

describe('TTL governs RE-CONSULTATION, not display (schema.md §9)', () => {
  it('a fresh checklist short-circuits with NO loader call', async () => {
    const loader = vi.fn(async () => [o('musduc', 'X', 'DNC')])
    expect((await cache.dedupedFetchChecklist('S1', ALL, loader)).fromNetwork).toBe(true)
    vi.advanceTimersByTime(29 * DAY)
    expect((await cache.dedupedFetchChecklist('S1', ALL, loader)).fromNetwork).toBe(false)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('a stale checklist becomes eligible again', async () => {
    const loader = vi.fn(async () => [o('musduc', 'X', 'DNC')])
    await cache.dedupedFetchChecklist('S1', ALL, loader)
    vi.advanceTimersByTime(31 * DAY)
    expect((await cache.dedupedFetchChecklist('S1', ALL, loader)).fromNetwork).toBe(true)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('a STALE record still counts and still excludes: the snapshot never blanks', async () => {
    // A total that blanked itself because a timer expired would be a worse
    // answer than a slightly old one.
    await cache.mergeChecklist('S1', [o('musduc', 'X', 'DNC')], ALL, Date.now())
    vi.advanceTimersByTime(90 * DAY)
    expect(cache.getSnapshot().species.get('musduc')!.seen).toEqual(['X|DNC'])
    expect(cache.getSnapshot().checklists.has('S1')).toBe(true)
    // ...but it is no longer treated as consulted for planning purposes.
    expect(cache.isFreshFor(['S1'], Date.now())).toBe(false)
    expect(cache.consultedSet(Date.now()).has('S1')).toBe(false)
    expect([...cache.staleOrUnconsulted(['S1'], Date.now())]).toEqual(['S1'])
  })
})

// ── In-flight dedupe and failure ──────────────────────────────────────────────

describe('in-flight dedupe and failure (FR-20, FR-21, QA-26, QA-27)', () => {
  it('concurrent requests for one checklist share ONE call', async () => {
    let resolve!: (v: ProvenanceObservation[]) => void
    const loader = vi.fn(() => new Promise<ProvenanceObservation[]>(r => { resolve = r }))
    const a = cache.dedupedFetchChecklist('S1', ALL, loader)
    const b = cache.dedupedFetchChecklist('S1', ALL, loader)
    await vi.advanceTimersByTimeAsync(0)
    resolve([o('musduc', 'X', 'DNC')])
    await a; await b
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('a failure caches NOTHING, so a retry issues a fresh request', async () => {
    const loader = vi.fn(async () => { throw Object.assign(new Error('boom'), { status: 502 }) })
    await expect(cache.dedupedFetchChecklist('S1', ALL, loader)).rejects.toThrow('boom')
    expect(cache.getSnapshot().checklists.has('S1')).toBe(false)
    const ok = vi.fn(async () => [o('musduc', 'N')])
    expect((await cache.dedupedFetchChecklist('S1', ALL, ok)).fromNetwork).toBe(true)
    expect(ok).toHaveBeenCalledTimes(1)
  })

  it('an OFFLINE failure with a prior entry keeps the merged answer standing', async () => {
    await cache.dedupedFetchChecklist('S1', ALL, async () => [o('musduc', 'X', 'DNC')])
    vi.advanceTimersByTime(31 * DAY)
    const offline = async (): Promise<ProvenanceObservation[]> => { throw new TypeError('Failed to fetch') }
    await expect(cache.dedupedFetchChecklist('S1', ALL, offline)).resolves.toEqual({ fromNetwork: false })
    expect(cache.getSnapshot().species.get('musduc')!.seen).toEqual(['X|DNC'])
  })

  it('an offline failure with NO prior entry rethrows rather than inventing an answer', async () => {
    const offline = async (): Promise<ProvenanceObservation[]> => { throw new TypeError('Failed to fetch') }
    await expect(cache.dedupedFetchChecklist('S9', ALL, offline)).rejects.toThrow()
  })
})

// ── Retention: the two opposite policies ──────────────────────────────────────

describe('retention (schema.md §4)', () => {
  it('the CHECKLIST ledger is FIFO, evicting oldest-fetched first', async () => {
    cache.setProvenanceMaxChecklists(3)
    for (const id of ['S1', 'S2', 'S3', 'S4']) {
      await cache.mergeChecklist(id, [o('musduc', 'N')], ALL, Date.now())
    }
    expect([...cache.getSnapshot().checklists]).toEqual(['S2', 'S3', 'S4'])
  })

  it('an evicted ledger entry LOSES NO ANSWER: the species record survives', async () => {
    // This is the whole reason the ledger may be FIFO. Eviction costs one
    // redundant request next pass; the paid-for provenance is untouched.
    cache.setProvenanceMaxChecklists(2)
    await cache.mergeChecklist('S1', [o('musduc', 'X', 'DNC')], ALL, Date.now())
    await cache.mergeChecklist('S2', [o('graygo', 'X', 'DNC')], ALL, Date.now())
    await cache.mergeChecklist('S3', [o('amerob', 'N')], ALL, Date.now())
    const snap = cache.getSnapshot()
    expect(snap.checklists.has('S1')).toBe(false)
    expect(snap.species.get('musduc')!.seen).toEqual(['X|DNC'])
  })

  it('the SPECIES index uses ADMISSION control and NEVER evicts', async () => {
    // Evicting a species entry would destroy a paid-for network answer AND the
    // raw tokens FR-09 exists to keep, and at capacity+1 it would do so on every
    // pass forever, never converging. Admission control degrades instead to the
    // state the feature already defines as safe: no record, `unknown`, counts.
    cache.setProvenanceMaxSpecies(2)
    const wide = new Set(['a1', 'b2', 'c3'])
    await cache.mergeChecklist('S1', [o('a1', 'X', 'DNC'), o('b2', 'X', 'DNC'), o('c3', 'X', 'DNC')], wide, Date.now())
    const snap = cache.getSnapshot()
    expect([...snap.species.keys()]).toEqual(['a1', 'b2'])
    // The FIRST admitted species is the one retained, not the last: nothing was
    // evicted to make room for `c3`.
    expect(snap.species.get('a1')!.seen).toEqual(['X|DNC'])
  })

  it('admission gates NEW KEYS ONLY: a full index still stays current', async () => {
    cache.setProvenanceMaxSpecies(1)
    const wide = new Set(['a1', 'b2'])
    await cache.mergeChecklist('S1', [o('a1', 'X', 'DNC')], wide, Date.now())
    await cache.mergeChecklist('S2', [o('a1', 'N'), o('b2', 'X', 'DNC')], wide, Date.now())
    const snap = cache.getSnapshot()
    // Merging a fresh token into an existing record is not admission.
    expect(snap.species.get('a1')!.seen).toEqual(['X|DNC', 'N|'])
    expect(snap.species.has('b2')).toBe(false)
  })

  it('the bound is enforced by the CONTAINER SIZE, not a separate counter', async () => {
    // The v0.5.85 finding was a counter-enforced bound silently inflating until
    // admission closed permanently, invisible in both the entries and the
    // answers. Re-merging the SAME species many times must never consume
    // admission capacity, which a counter-based implementation would.
    cache.setProvenanceMaxSpecies(2)
    const wide = new Set(['a1', 'b2'])
    for (let i = 0; i < 50; i += 1) {
      await cache.mergeChecklist(`S${i}`, [o('a1', i % 2 ? 'X' : 'N')], wide, Date.now())
    }
    await cache.mergeChecklist('S999', [o('b2', 'X', 'DNC')], wide, Date.now())
    expect(cache.getSnapshot().species.has('b2')).toBe(true)
    expect([...cache.getSnapshot().species.keys()]).toEqual(['a1', 'b2'])
  })
})

// ── Capacity plus one ─────────────────────────────────────────────────────────

describe('capacity+1, measured as WORK DONE, on BOTH ledgers', () => {
  it('the SPECIES index does no eviction work at capacity+1 (admission control)', async () => {
    // The property that matters is "never much worse than not caching". Past
    // capacity, a FIFO would delete-and-insert on every call; admission control
    // simply stops admitting, so the eviction count stays exactly zero and the
    // refusal count is the honest, visible cost.
    cache.setProvenanceMaxSpecies(8)
    const wide = new Set(Array.from({ length: 9 }, (_, i) => `sp${i}`))
    for (let i = 0; i < 9; i += 1) {
      await cache.mergeChecklist(`S${i}`, [o(`sp${i}`, 'X', 'DNC')], wide, Date.now())
    }
    // ...and keep going past capacity, rotating the whole set, which is the
    // workload a FIFO falls off a cliff on.
    for (let round = 0; round < 5; round += 1) {
      for (let i = 0; i < 9; i += 1) {
        await cache.mergeChecklist(`T${round}-${i}`, [o(`sp${i}`, 'N')], wide, Date.now())
      }
    }
    const stats = cache._getProvenanceCacheWorkStatsForTests()
    expect(stats.evictions).toBe(0)
    expect(stats.admissions).toBe(8)
    expect(stats.admissionsRefused).toBeGreaterThan(0)
    expect(cache.getSnapshot().species.size).toBe(8)
  })

  it('the CHECKLIST ledger evicts exactly one entry per insert past capacity+1', async () => {
    // FIFO here is correct and its cost is bounded and known: one shift per
    // insert once full, never a growing amount of bookkeeping.
    cache.setProvenanceMaxChecklists(8)
    for (let i = 0; i < 8; i += 1) {
      await cache.mergeChecklist(`S${i}`, [o('musduc', 'N')], ALL, Date.now())
    }
    const atCapacity = cache._getProvenanceCacheWorkStatsForTests()
    expect(atCapacity.evictions).toBe(0)

    for (let i = 8; i < 20; i += 1) {
      await cache.mergeChecklist(`S${i}`, [o('musduc', 'N')], ALL, Date.now())
    }
    const past = cache._getProvenanceCacheWorkStatsForTests()
    expect(past.evictions).toBe(12)                       // one per insert, exactly
    expect(past.shiftedSlots).toBe(12 * 8)                // bounded by the cap
    expect(cache.getSnapshot().checklists.size).toBe(8)
  })

  it('re-merging a checklist already in the ledger moves it without growing it', async () => {
    cache.setProvenanceMaxChecklists(4)
    for (const id of ['S1', 'S2', 'S3']) await cache.mergeChecklist(id, [o('musduc', 'N')], ALL, Date.now())
    await cache.mergeChecklist('S1', [o('musduc', 'N')], ALL, Date.now())
    expect([...cache.getSnapshot().checklists]).toEqual(['S2', 'S3', 'S1'])
    expect(cache._getProvenanceCacheWorkStatsForTests().orderMoves).toBe(1)
  })
})

// ── Load-path shape validation ────────────────────────────────────────────────

describe('sanitizeStore (schema.md §5, FR-22, NFR-08)', () => {
  const good = {
    version: 1,
    checklists: { S1: 1_750_000_000_000 },
    order: ['S1'],
    species: { musduc: { seen: ['X|DNC'], n: 1, at: 1_750_000_000_000 } },
    speciesOrder: ['musduc'],
    excludedNames: ['Muscovy Duck'],
  }

  it('accepts a well-formed document', () => {
    const s = cache.sanitizeStore(JSON.parse(JSON.stringify(good)))
    expect(s.order).toEqual(['S1'])
    expect(s.speciesOrder).toEqual(['musduc'])
    expect(s.excludedNames).toEqual(['Muscovy Duck'])
  })

  it('a corrupt or wrong-version document degrades to EMPTY, never a crash', () => {
    for (const bad of [null, undefined, 42, 'nope', [], {}, { ...good, version: 2 }]) {
      const s = cache.sanitizeStore(bad)
      expect(s.version).toBe(1)
      expect(s.order).toEqual([])
      expect(s.speciesOrder).toEqual([])
    }
  })

  it('DROPS a malformed entry rather than throwing on it', () => {
    const s = cache.sanitizeStore({
      version: 1,
      checklists: { S1: 1, S2: 'not-a-number', 'not-an-id': 3, S4: 4 },
      order: ['S1', 'S2', 'not-an-id', 'S4', 'S1'],
      species: {
        musduc: { seen: ['X|DNC'], n: 1, at: 1 },
        BADCODE: { seen: ['X|DNC'], n: 1, at: 1 },
        graygo: { seen: ['not a token'], n: 1, at: 1 },
        swagoo: { seen: 'not-an-array', n: 1, at: 1 },
        amerob: { seen: [], n: Infinity, at: 1 },
      },
      speciesOrder: ['musduc', 'BADCODE', 'graygo', 'swagoo', 'amerob', 'musduc'],
      excludedNames: ['ok', 42, '', 'x'.repeat(500)],
    })
    expect(s.order).toEqual(['S1', 'S4'])                 // dupes and bad shapes dropped
    expect(s.speciesOrder).toEqual(['musduc'])
    expect(s.excludedNames).toEqual(['ok'])
  })

  it('accepts the one real hyphenated species code', () => {
    // Exactly one code in the bundled v2027 snapshot carries a hyphen
    // ('bird-o1'). Omitting the hyphen from the key class would silently drop
    // that species forever.
    const s = cache.sanitizeStore({
      ...good,
      species: { 'bird-o1': { seen: ['N|'], n: 1, at: 1 } },
      speciesOrder: ['bird-o1'],
    })
    expect(s.speciesOrder).toEqual(['bird-o1'])
  })

  it('reads records through Object.hasOwn, so a PROTOTYPE-CHAIN key cannot slip in', () => {
    // A bare index on an object literal returns a truthy INHERITED member for at
    // least twelve strings, so a `raw[key] ? ... : ...` guard takes the wrong
    // branch for every one of them (the v0.5.81 finding). None of these has an
    // own property here, so none may survive.
    const chainNames = [
      'constructor', 'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf',
      'toLocaleString', 'propertyIsEnumerable', '__defineGetter__',
      '__defineSetter__', '__lookupGetter__', '__lookupSetter__',
    ]
    const s = cache.sanitizeStore({
      version: 1,
      checklists: {},
      order: chainNames,
      species: {},
      speciesOrder: chainNames,
      excludedNames: [],
    })
    expect(s.order).toEqual([])
    expect(s.speciesOrder).toEqual([])
  })

  it('a real own `__proto__` key from storage cannot pollute the store', () => {
    // Built with JSON.parse, NOT an object literal: `{ __proto__: ... }` in
    // source is special-cased by the language to set the prototype and creates
    // NO own property, i.e. tests a shape that cannot arrive from storage.
    const hostile = JSON.parse(
      '{"version":1,"checklists":{"__proto__":1,"S1":1},"order":["__proto__","S1"],'
      + '"species":{"__proto__":{"seen":["X|DNC"],"n":1,"at":1}},"speciesOrder":["__proto__"],'
      + '"excludedNames":[]}',
    )
    const s = cache.sanitizeStore(hostile)
    expect(s.order).toEqual(['S1'])
    expect(s.speciesOrder).toEqual([])
    expect(Object.prototype.hasOwnProperty.call({}, 'seen')).toBe(false)
    expect(({} as Record<string, unknown>).seen).toBeUndefined()
  })

  it('a corrupt document on disk yields the empty store and today\'s numbers', async () => {
    seamDoc.value = { version: 1, checklists: 'nope' }
    const snap = await cache.loadSnapshot()
    expect(snap.species.size).toBe(0)
    expect(snap.checklists.size).toBe(0)
    expect(snap.excludedNames).toEqual([])
  })
})

// ── Persistence ───────────────────────────────────────────────────────────────

describe('persistence through the storage seam (NFR-10)', () => {
  it('writes the whole document, debounced, and reads it back next session', async () => {
    await cache.mergeChecklist('S1', [o('musduc', 'X', 'DNC')], ALL, Date.now())
    await cache.publishExcludedNames(['Muscovy Duck'])
    await vi.advanceTimersByTimeAsync(300)
    expect(setSettingSpy).toHaveBeenCalled()

    cache._resetProvenanceCacheForTests()
    const snap = await cache.loadSnapshot()
    expect(snap.checklists.has('S1')).toBe(true)
    expect(snap.species.get('musduc')!.seen).toEqual(['X|DNC'])
    expect(snap.excludedNames).toEqual(['Muscovy Duck'])
  })

  it('publishing an UNCHANGED list schedules no write', async () => {
    await cache.mergeChecklist('S1', [o('musduc', 'X', 'DNC')], ALL, Date.now())
    await cache.publishExcludedNames(['Muscovy Duck'])
    const before = cache._getProvenanceCacheWorkStatsForTests().writeSchedules
    await cache.publishExcludedNames(['Muscovy Duck'])
    expect(cache._getProvenanceCacheWorkStatsForTests().writeSchedules).toBe(before)
  })

  it('a seam read failure degrades to "not cached" rather than rejecting', async () => {
    const { storage } = await import('./storage')
    vi.mocked(storage.getSetting).mockRejectedValueOnce(new Error('disk gone'))
    const snap = await cache.loadSnapshot()
    expect(snap.species.size).toBe(0)
  })

  it('lastConsultedAt reads a PERSISTED number and never the clock', async () => {
    expect(cache.lastConsultedAt()).toBe(null)
    await cache.mergeChecklist('S1', [o('musduc', 'N')], ALL, 1_700_000_000_000)
    expect(cache.lastConsultedAt()).toBe(1_700_000_000_000)
  })
})
