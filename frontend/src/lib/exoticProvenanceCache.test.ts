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

/// <reference types="node" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import * as cache from './exoticProvenanceCache'
import type { ProvenanceObservation } from './exoticProvenanceCache'
import { SPECIES_CODE_RE } from './speciesCode'

const seamDoc: { value: unknown } = { value: null }

vi.mock('./storage', () => ({
  storage: {
    getSetting: vi.fn(async (key: string) => (key === 'exotic-provenance-v1' ? seamDoc.value : null)),
    setSetting: vi.fn(async (_key: string, value: unknown) => { seamDoc.value = JSON.parse(JSON.stringify(value)) }),
    deleteSetting: vi.fn(async () => { seamDoc.value = null }),
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

// ── The plausibility window on every TTL read (ebird-request-economy D-03) ────
//
// A ledger entry or a stamp dated more than 24 hours ahead of the reader's clock
// reads as ABSENT; exactly 24 hours ahead is honoured. One roster for the four
// ledger readers, so a fifth reader with no row reads as a gap (testing.md,
// v1.0.14), and a row each for the stamps and for classification, which the
// window deliberately does not reach.

const LEDGER_READERS: Array<[string, (id: string, now: number) => Promise<boolean>]> = [
  ['isFreshFor', async (id, now) => cache.isFreshFor([id], now)],
  ['consultedSet', async (id, now) => cache.consultedSet(now).has(id)],
  ['staleOrUnconsulted', async (id, now) => !cache.staleOrUnconsulted([id], now).has(id)],
  // The chokepoint reads the clock itself, so `now` is the faked system time.
  ['dedupedFetchChecklist', async (id) => {
    const loader = vi.fn(async () => [o('musduc', 'N')])
    await cache.dedupedFetchChecklist(id, ALL, loader)
    return loader.mock.calls.length === 0
  }],
]

describe('the plausibility window on every TTL read (ebird-request-economy D-03)', () => {
  for (const [name, honoured] of LEDGER_READERS) {
    it(`${name}: a ledger entry exactly 24 h ahead is honoured, one millisecond past it is absent`, async () => {
      const now = Date.now()
      await cache.mergeChecklist('S1', [o('musduc', 'N')], ALL, now + DAY)
      await cache.mergeChecklist('S2', [o('musduc', 'N')], ALL, now + DAY + 1)
      expect(await honoured('S1', now), 'exactly 24 h ahead').toBe(true)
      expect(await honoured('S2', now), 'one millisecond past it').toBe(false)
    })

    it(`${name}: a negative or ancient ledger time reads as expired, as before`, async () => {
      for (const [id, at] of [['S3', -1], ['S4', 0], ['S5', Date.now() - 31 * DAY]] as const) {
        await cache.mergeChecklist(id, [o('musduc', 'N')], ALL, at)
        expect(await honoured(id, Date.now()), `${id} at ${at}`).toBe(false)
      }
    })
  }

  it('unmatchedSet: a stamp exactly 24 h ahead is honoured, one millisecond past it is absent, and an old one is expired', async () => {
    const now = Date.now()
    const wide = new Set(['sp1', 'sp2', 'sp3'])
    await cache.mergeChecklist('S1', [], wide, now + DAY, ['sp1'])
    await cache.mergeChecklist('S2', [], wide, now + DAY + 1, ['sp2'])
    await cache.mergeChecklist('S3', [], wide, now - 31 * DAY, ['sp3'])
    expect([...cache.unmatchedSet(now)]).toEqual(['sp1'])
  })

  it('a far-future entry is asked for once, and the answer rewrites its time at the corrected clock', async () => {
    const now = Date.now()
    await cache.mergeChecklist('S1', [o('musduc', 'N')], ALL, now + 365 * DAY)
    const loader = vi.fn(async () => [o('musduc', 'N')])
    expect((await cache.dedupedFetchChecklist('S1', ALL, loader)).fromNetwork).toBe(true)
    expect(loader).toHaveBeenCalledTimes(1)
    expect(cache.consultedSet(now).has('S1')).toBe(true)
    expect((await cache.dedupedFetchChecklist('S1', ALL, loader)).fromNetwork).toBe(false)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('classification is not windowed: a far-future answer still counts in the snapshot, and nothing is written back on read', async () => {
    await cache.mergeChecklist('S1', [o('musduc', 'X', 'DNC')], ALL, Date.now() + 365 * DAY)
    await vi.advanceTimersByTimeAsync(300)
    const writes = setSettingSpy.mock.calls.length
    expect(cache.consultedSet(Date.now()).has('S1')).toBe(false)
    expect(cache.isFreshFor(['S1'], Date.now())).toBe(false)
    expect(cache.getSnapshot().checklists.has('S1')).toBe(true)
    expect(cache.getSnapshot().species.get('musduc')!.seen).toEqual(['X|DNC'])
    await vi.advanceTimersByTimeAsync(300)
    expect(setSettingSpy.mock.calls.length).toBe(writes)
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

  it('a loader that chose not to send (null: stopped or cleared while it waited at the eBird gate) writes nothing and says so, to a joiner too', async () => {
    // ebird-request-economy D-01: neither an answer nor a failure.
    let release!: (v: null) => void
    const loader = vi.fn(() => new Promise<null>(r => { release = r }))
    const a = cache.dedupedFetchChecklist('S1', ALL, loader, { carried: ['musduc'] })
    const b = cache.dedupedFetchChecklist('S1', ALL, loader, { carried: ['musduc'] })
    await vi.advanceTimersByTimeAsync(0)
    release(null)
    expect(await a).toEqual({ fromNetwork: false, notSent: true })
    expect(await b).toEqual({ fromNetwork: false, notSent: true })
    expect(loader).toHaveBeenCalledTimes(1)
    expect(cache.getSnapshot().checklists.has('S1')).toBe(false)
    expect([...cache.unmatchedSet(Date.now())]).toEqual([])
    expect(cache._getProvenanceCacheWorkStatsForTests().merges).toBe(0)
    // Nothing was cached, so the next ask runs a fresh loader.
    const ok = vi.fn(async () => [o('musduc', 'N')])
    expect((await cache.dedupedFetchChecklist('S1', ALL, ok)).fromNetwork).toBe(true)
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

  it('at the SHIPPED ledger cap plus one (big-old-life-lists): one eviction, one shift of the cap, nothing grows', async () => {
    // The production constants, not seams. Loaded full from the document so the
    // row measures the decision at the cap, as work done. What bounds the cap
    // from above, the web/Pi settings route's body limit, is held in
    // settingsRouteBudget.test.ts.
    expect(cache.PROVENANCE_MAX_CHECKLISTS).toBe(cache.PROVENANCE_MAX_CHECKLISTS_DEFAULT)
    // And the species cap is the shipped one. That it sits above every species
    // code in the bundled taxonomy, so it cannot bind on real data, is asserted
    // against the asset in 'the shipped cap equals the species cap, and both
    // sit above...' below (v1.0.64 audit I4).
    expect(cache.PROVENANCE_MAX_SPECIES).toBe(cache.PROVENANCE_MAX_SPECIES_DEFAULT)
    const N = cache.PROVENANCE_MAX_CHECKLISTS_DEFAULT
    const checklists: Record<string, number> = {}
    const order: string[] = []
    for (let i = 0; i < N; i += 1) { checklists[`S${i}`] = 1_750_000_000_000; order.push(`S${i}`) }
    seamDoc.value = { version: 1, checklists, order, species: {}, speciesOrder: [], excludedNames: [] }
    await cache.loadSnapshot()
    expect(cache.getSnapshot().checklists.size).toBe(N)

    const before = cache._getProvenanceCacheWorkStatsForTests()
    await cache.mergeChecklist(`S${N}`, [o('musduc', 'N')], ALL, Date.now())
    const after = cache._getProvenanceCacheWorkStatsForTests()
    expect(after.evictions - before.evictions).toBe(1)
    expect(after.shiftedSlots - before.shiftedSlots).toBe(N)   // bounded by the cap
    expect(cache.getSnapshot().checklists.size).toBe(N)
    expect(cache.getSnapshot().checklists.has('S0')).toBe(false)  // oldest out
    expect(cache.getSnapshot().checklists.has(`S${N}`)).toBe(true)
  }, 60_000)

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

describe('every code in the bundled taxonomy snapshot fits the app\'s code guards', () => {
  // A regenerated snapshot is a build input, guarded here in CI rather than at
  // runtime (taxonomy-2026-readiness). A code outside SPECIES_CODE_RE gets no
  // favicon or species-page link (SpeciesLinks) and no widget deep link, and
  // one outside this module's SPECIES_CODE_KEY_RE loses its escapee record on
  // every load. The generator refuses such a code too (codeShapeViolations in
  // scripts/lib/ebirdTaxonomyDerive.mjs; alphaCodesGenerator.test.ts).
  const SNAPSHOT = JSON.parse(
    readFileSync(new URL('../assets/ebird-taxonomy.json', import.meta.url), 'utf8'),
  ) as Record<'bySci' | 'byCom' | 'byCode' | 'reportAs', Record<string, string>>
  const SOURCES: Record<string, string[]> = {
    'byCode keys': Object.keys(SNAPSHOT.byCode),
    'reportAs keys': Object.keys(SNAPSHOT.reportAs),
    'reportAs values': Object.values(SNAPSHOT.reportAs),
    'bySci values': Object.values(SNAPSHOT.bySci),
    'byCom values': Object.values(SNAPSHOT.byCom),
  }
  const CODES = [...new Set(Object.values(SOURCES).flat())]

  it('reads codes from each of the snapshot\'s code-bearing fields', () => {
    for (const [field, codes] of Object.entries(SOURCES)) expect(codes.length, field).toBeGreaterThan(0)
  })

  it('SPECIES_CODE_RE (lib/speciesCode.ts) accepts every snapshot code', () => {
    expect(CODES.filter(c => !SPECIES_CODE_RE.test(c)), 'snapshot codes SPECIES_CODE_RE refuses').toEqual([])
  })

  it('the store keeps a record under every snapshot code on load (its SPECIES_CODE_KEY_RE gate)', () => {
    // Read through sanitizeStore, the gate's one call site, so the constant
    // stays private. Each record is valid and each key distinct, so the key
    // gate is the only check here that can drop one.
    const record = { seen: ['N|'], n: 1, at: 1 }
    const s = cache.sanitizeStore({
      version: 1, checklists: {}, order: [], excludedNames: [],
      species: Object.fromEntries(CODES.map(c => [c, record])),
      speciesOrder: CODES,
    })
    expect(CODES.filter(c => !Object.hasOwn(s.species, c)), 'snapshot codes the provenance store drops on load').toEqual([])
  })
})

// ── Persistence ───────────────────────────────────────────────────────────────

describe('persistence through the storage seam (NFR-10)', () => {
  it('writes the whole document, debounced, and reads it back next session', async () => {
    await cache.mergeChecklist('S1', [o('musduc', 'X', 'DNC')], ALL, Date.now())
    await cache.publishClassifiedNames({ excludedNames: ['Muscovy Duck'], exoticNames: ['Rock Pigeon'] })
    await vi.advanceTimersByTimeAsync(300)
    expect(setSettingSpy).toHaveBeenCalled()

    cache._resetProvenanceCacheForTests()
    const snap = await cache.loadSnapshot()
    expect(snap.checklists.has('S1')).toBe(true)
    expect(snap.species.get('musduc')!.seen).toEqual(['X|DNC'])
    expect(snap.excludedNames).toEqual(['Muscovy Duck'])
    expect(snap.exoticNames).toEqual(['Rock Pigeon'])
  })

  it('publish admits through the load path: a 4,011-character name is dropped at publish, not only on reload (security L1)', async () => {
    await cache.mergeChecklist('S1', [o('musduc', 'X', 'DNC')], ALL, Date.now())
    const huge = ['Rock Pigeon ', 'x'.repeat(3_999)].join('')
    expect(huge).toHaveLength(4_011)
    await cache.publishClassifiedNames({ excludedNames: [huge, 'Muscovy Duck'], exoticNames: ['Rock Pigeon', huge, ''] })
    // The in-memory snapshot, before any write or reload.
    expect(cache.getSnapshot().excludedNames).toEqual(['Muscovy Duck'])
    expect(cache.getSnapshot().exoticNames).toEqual(['Rock Pigeon'])
  })

  it('publish sorts BEFORE it caps, so the kept set does not depend on the input order', async () => {
    await cache.mergeChecklist('S1', [o('musduc', 'X', 'DNC')], ALL, Date.now())
    const names = Array.from({ length: 2_100 }, (_, i) => `Name ${String(i).padStart(4, '0')}`)
    await cache.publishClassifiedNames({ excludedNames: [...names].reverse(), exoticNames: names })
    const snap = cache.getSnapshot()
    expect(snap.excludedNames).toHaveLength(2_048)
    expect(snap.excludedNames).toEqual(names.slice(0, 2_048))
    expect(snap.exoticNames).toEqual(names.slice(0, 2_048))
  })

  it('publishing UNCHANGED lists schedules no write', async () => {
    await cache.mergeChecklist('S1', [o('musduc', 'X', 'DNC')], ALL, Date.now())
    await cache.publishClassifiedNames({ excludedNames: ['Muscovy Duck'], exoticNames: [] })
    const before = cache._getProvenanceCacheWorkStatsForTests().writeSchedules
    await cache.publishClassifiedNames({ excludedNames: ['Muscovy Duck'], exoticNames: [] })
    expect(cache._getProvenanceCacheWorkStatsForTests().writeSchedules).toBe(before)
  })

  it('an empty exotic list against a never-published (null) store is a change, so [] is published', async () => {
    await cache.mergeChecklist('S1', [o('musduc', 'X', 'DNC')], ALL, Date.now())
    expect((await cache.loadSnapshot()).exoticNames).toBe(null)
    const before = cache._getProvenanceCacheWorkStatsForTests().writeSchedules
    await cache.publishClassifiedNames({ excludedNames: [], exoticNames: [] })
    expect(cache._getProvenanceCacheWorkStatsForTests().writeSchedules).toBe(before + 1)
    expect((await cache.loadSnapshot()).exoticNames).toEqual([])
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

// ── The exotic publication (life-lists-tab schema 3.2) ───────────────────────

describe('exoticNames: an optional field whose absence is UNRESOLVED', () => {
  const base = { version: 1, checklists: {}, order: [], species: {}, speciesOrder: [], excludedNames: [] }

  it('an absent, null or non-array field reads as null (never published), the safe direction', () => {
    expect(cache.sanitizeStore(base).exoticNames).toBe(null)
    expect(cache.sanitizeStore({ ...base, exoticNames: null }).exoticNames).toBe(null)
    expect(cache.sanitizeStore({ ...base, exoticNames: 'Rock Pigeon' }).exoticNames).toBe(null)
    expect(cache.sanitizeStore(JSON.parse('{"version":1,"checklists":{},"order":[],"species":{},"speciesOrder":[],"excludedNames":[],"exoticNames":{"0":"x"}}')).exoticNames).toBe(null)
  })

  it('admits names under the SAME bounds as excludedNames, dropping malformed entries', () => {
    const long = 'x'.repeat(129)
    const s = cache.sanitizeStore({ ...base, exoticNames: ['Rock Pigeon', '', long, 7, 'House Sparrow'], excludedNames: ['', long, 'Muscovy Duck'] })
    expect(s.exoticNames).toEqual(['Rock Pigeon', 'House Sparrow'])
    expect(s.excludedNames).toEqual(['Muscovy Duck'])
  })

  it('caps BOTH lists at the same count, and the cap is 2,048', () => {
    const many = Array.from({ length: 3000 }, (_, i) => `Name ${i}`)
    const s = cache.sanitizeStore({ ...base, excludedNames: many, exoticNames: many })
    expect(s.excludedNames.length).toBe(2048)
    expect(s.exoticNames!.length).toBe(2048)
  })

  it('the write chokepoint round trip is idempotent on BOTH the null and the [] shapes, which mean different things', () => {
    for (const exoticNames of [null, [], ['Rock Pigeon']] as const) {
      const once = cache.sanitizeStore({ ...base, exoticNames })
      const twice = cache.sanitizeStore(JSON.parse(JSON.stringify(once)))
      expect(twice).toEqual(once)
      expect(twice.exoticNames).toEqual(exoticNames)
    }
  })

  // The purge resetting the field to null is asserted in clearDerived.test.ts,
  // beside the in-flight publish race, through the real teardown.
})

// ── The unmatched stamps (exotic-provenance-reuse D-03, D-07) ────────────────

describe('unmatched stamps: what a successful answer did not include', () => {
  const COVER = new Set(['musduc', 'graygo', 'willet2', 'mallar3'])

  it('stamps a carried code the answer has no row for, and nothing else', async () => {
    // The answer carries Mallard and the slash code eBird uses since the split,
    // which is outside the cover and dropped. Muscovy Duck has a row.
    await cache.mergeChecklist('S1', [o('mallar3'), o('willet1'), o('musduc', 'N')], COVER, Date.now(), ['willet2', 'mallar3', 'musduc'])
    expect([...cache.unmatchedSet(Date.now())]).toEqual(['willet2'])
    expect(cache.getSnapshot().species.has('willet2')).toBe(false)
    expect(cache._getProvenanceCacheWorkStatsForTests().stamps).toBe(1)
  })

  it('a row whose admission was refused is still a row: a full species index stamps nothing', async () => {
    // The one case where "the answer had a row" and "a record exists" part:
    // the species index is full, so the row is not admitted, and the answer
    // still did not lack the species. Without this row the `answered` check is
    // invisible behind the record check (mutation-measured).
    cache.setProvenanceMaxSpecies(1)
    const wide = new Set(['a1', 'b2'])
    await cache.mergeChecklist('S1', [o('a1', 'N')], wide, Date.now(), ['a1'])
    await cache.mergeChecklist('S2', [o('b2', 'X', 'DNC')], wide, Date.now(), ['b2'])
    expect(cache.getSnapshot().species.has('b2')).toBe(false)
    expect(cache._getProvenanceCacheWorkStatsForTests().admissionsRefused).toBe(1)
    expect(cache.unmatchedSet(Date.now()).size).toBe(0)
  })

  it('a code with a record is never stamped: the record already answers it', async () => {
    await cache.mergeChecklist('S1', [o('musduc', 'X', 'DNC')], COVER, Date.now())
    await cache.mergeChecklist('S2', [o('mallar3')], COVER, Date.now(), ['musduc', 'mallar3'])
    expect(cache.unmatchedSet(Date.now()).size).toBe(0)
  })

  it('a code outside the cover the checklist was asked under is never stamped, so the v1.0.1 heal stays reachable', async () => {
    // The domestic-form shape: the checklist was asked under a cover without
    // Swan Goose. The merge is told only what that cover put on it, and a code
    // carried but not admissible is refused as well.
    await cache.mergeChecklist('S1', [o('mallar3')], new Set(['mallar3']), Date.now(), ['mallar3', 'swagoo'])
    expect(cache.unmatchedSet(Date.now()).size).toBe(0)
    expect(cache.getSnapshot().checklists.has('S1')).toBe(true)
  })

  it('a carried code the load path would drop is never stamped (the write chokepoint shares the validator)', async () => {
    const wide = new Set(['c-Muscovy Duck', 'graygo'])
    await cache.mergeChecklist('S1', [], wide, Date.now(), ['c-Muscovy Duck', 'graygo'])
    expect([...cache.unmatchedSet(Date.now())]).toEqual(['graygo'])
  })

  it('a record admitted later drops the stamp', async () => {
    await cache.mergeChecklist('S1', [o('mallar3')], COVER, Date.now(), ['musduc', 'mallar3'])
    expect([...cache.unmatchedSet(Date.now())]).toEqual(['musduc'])
    expect([...cache.getSnapshot().unmatched ?? []]).toEqual(['musduc'])
    // eBird confirms the record: the next answer carries its row.
    await cache.mergeChecklist('S2', [o('musduc', 'X', 'DNC')], COVER, Date.now(), ['musduc'])
    expect(cache.unmatchedSet(Date.now()).size).toBe(0)
    // ...and the completion readers see the record, not the stamp.
    expect(cache.getSnapshot().unmatched?.size).toBe(0)
    expect(cache.getSnapshot().species.get('musduc')?.seen).toEqual(['X|DNC'])
    expect(cache._getProvenanceCacheWorkStatsForTests().stampDrops).toBe(1)
    await vi.advanceTimersByTimeAsync(300)
    const doc = seamDoc.value as { unmatched: Record<string, number>; unmatchedOrder: string[] }
    expect(doc.unmatched).toEqual({})
    expect(doc.unmatchedOrder).toEqual([])
  })

  it('a failed, refused (429) or offline answer writes no stamp', async () => {
    const carried = { carried: ['musduc'] }
    const fail = (status: number) => async (): Promise<ProvenanceObservation[]> => { throw Object.assign(new Error(`eBird ${status}`), { status }) }
    await expect(cache.dedupedFetchChecklist('S1', COVER, fail(502), carried)).rejects.toThrow('502')
    await expect(cache.dedupedFetchChecklist('S1', COVER, fail(429), carried)).rejects.toThrow('429')
    // Offline with a prior, stale ledger entry: the no-op success the pass
    // counts as done. It reaches no merge, so it stamps nothing either.
    await cache.mergeChecklist('S2', [o('mallar3')], COVER, Date.now())
    vi.advanceTimersByTime(31 * DAY)
    const offline = async (): Promise<ProvenanceObservation[]> => { throw new TypeError('Failed to fetch') }
    await expect(cache.dedupedFetchChecklist('S2', COVER, offline, carried)).resolves.toEqual({ fromNetwork: false })
    expect(cache.unmatchedSet(Date.now()).size).toBe(0)
    expect(cache._getProvenanceCacheWorkStatsForTests().stamps).toBe(0)
    // ...and the same call answered successfully does stamp: the rows above
    // are not vacuous.
    await cache.dedupedFetchChecklist('S1', COVER, async () => [o('mallar3')], carried)
    expect([...cache.unmatchedSet(Date.now())]).toEqual(['musduc'])
  })

  it('honoured for the TTL and no longer: a stamp past it is out of the set, and an answer refreshes it', async () => {
    await cache.mergeChecklist('S1', [], COVER, Date.now(), ['musduc'])
    vi.advanceTimersByTime(29 * DAY)
    expect([...cache.unmatchedSet(Date.now())]).toEqual(['musduc'])
    vi.advanceTimersByTime(2 * DAY)
    expect(cache.unmatchedSet(Date.now()).size).toBe(0)
    // The TTL governs the re-ask only. The snapshot serves the stamp's CODE at
    // any age, as it serves every ledger entry, so completion never depends on
    // the clock (escapee-check-new-taxonomy re-entry).
    expect([...cache.getSnapshot().unmatched ?? []]).toEqual(['musduc'])
    await cache.mergeChecklist('S2', [], COVER, Date.now(), ['musduc'])
    expect([...cache.unmatchedSet(Date.now())]).toEqual(['musduc'])
    expect([...cache.getSnapshot().unmatched ?? []]).toEqual(['musduc'])
  })

  it('persists through the whole-document write and reads back next session', async () => {
    const at = Date.now()
    await cache.mergeChecklist('S1', [o('mallar3')], COVER, at, ['willet2', 'mallar3'])
    await vi.advanceTimersByTimeAsync(300)
    expect(seamDoc.value).toMatchObject({ unmatched: { willet2: at }, unmatchedOrder: ['willet2'] })
    cache._resetProvenanceCacheForTests()
    await cache.loadSnapshot()
    expect([...cache.unmatchedSet(Date.now())]).toEqual(['willet2'])
    // The next session's completion readers get the same code, and no time.
    expect([...cache.getSnapshot().unmatched ?? []]).toEqual(['willet2'])
  })

  it('a refreshed stamp keeps its place, and past the cap the first stamped goes, one per new stamp (capacity+1, as work done)', async () => {
    cache.setProvenanceMaxUnmatched(4)
    const wide = new Set(Array.from({ length: 12 }, (_, i) => `sp${i}`))
    for (let i = 0; i < 4; i += 1) await cache.mergeChecklist(`S${i}`, [], wide, Date.now(), [`sp${i}`])
    expect(cache._getProvenanceCacheWorkStatsForTests().stampEvictions).toBe(0)
    // A refresh of the first stamp neither grows the map nor moves it.
    await cache.mergeChecklist('S10', [], wide, Date.now(), ['sp0'])
    await vi.advanceTimersByTimeAsync(300)
    expect((seamDoc.value as { unmatchedOrder: string[] }).unmatchedOrder).toEqual(['sp0', 'sp1', 'sp2', 'sp3'])
    for (let i = 4; i < 12; i += 1) await cache.mergeChecklist(`S${i}`, [], wide, Date.now(), [`sp${i}`])
    const stats = cache._getProvenanceCacheWorkStatsForTests()
    expect(stats.stampEvictions).toBe(8)                    // one per new stamp, exactly
    expect(stats.stamps).toBe(13)
    expect([...cache.unmatchedSet(Date.now())]).toEqual(['sp8', 'sp9', 'sp10', 'sp11'])
  })

  it('the shipped cap equals the species cap, and both sit above every species code in the bundled taxonomy', () => {
    expect(cache.PROVENANCE_MAX_UNMATCHED).toBe(cache.PROVENANCE_MAX_UNMATCHED_DEFAULT)
    expect(cache.PROVENANCE_MAX_UNMATCHED_DEFAULT).toBe(cache.PROVENANCE_MAX_SPECIES_DEFAULT)
    // The title's second clause, checked rather than claimed (v1.0.64 audit
    // I4): a stamp is keyed by a cover code, and the cover's codes are species
    // codes, so the bound that makes the cap unable to bind is the snapshot's
    // species-code count, read from the asset when the test runs (v1.0.61).
    const snapshot = JSON.parse(
      readFileSync(new URL('../assets/ebird-taxonomy.json', import.meta.url), 'utf8'),
    ) as { byCom: Record<string, string> }
    const speciesCodes = new Set(Object.values(snapshot.byCom)).size
    expect(speciesCodes, 'the snapshot carries its species list').toBeGreaterThan(10_000)
    expect(cache.PROVENANCE_MAX_UNMATCHED_DEFAULT).toBeGreaterThan(speciesCodes)
  })
})

describe('unmatched stamps on the load path (sanitizeStore)', () => {
  // Written under the current join, so its stamps are read (the rows below
  // that drop them are about the marker).
  const base = {
    version: 1, checklists: {}, order: [], species: {}, speciesOrder: [], excludedNames: [],
    unmatchedJoin: cache.UNMATCHED_JOIN_VERSION,
  }

  it('stamps written under an earlier join are dropped, and nothing else is (escapee-check-new-taxonomy)', () => {
    // A document from before the taxonomy join has no marker. Its stamps say
    // "the answer had no row" under the old join, which the new one can
    // contradict (Willet answered under the slash code), so they re-open; the
    // ledger, the records and both published lists are kept, so this is not a
    // version bump and nothing already answered is asked again.
    const old = {
      ...base,
      checklists: { S1: 5 }, order: ['S1'],
      species: { mallar3: { seen: ['|'], n: 1, at: 5 } }, speciesOrder: ['mallar3'],
      excludedNames: ['Swan Goose'], exoticNames: ['Rock Pigeon'],
      unmatched: { willet2: 5, skylar: 5 }, unmatchedOrder: ['willet2', 'skylar'],
    }
    for (const marker of [undefined, 0, cache.UNMATCHED_JOIN_VERSION + 1, '1', null]) {
      const s = cache.sanitizeStore({ ...old, unmatchedJoin: marker })
      expect(s.unmatchedOrder, String(marker)).toEqual([])
      expect(s.unmatched, String(marker)).toEqual({})
      expect(s.order).toEqual(['S1'])
      expect(Object.keys(s.species)).toEqual(['mallar3'])
      expect(s.excludedNames).toEqual(['Swan Goose'])
      expect(s.exoticNames).toEqual(['Rock Pigeon'])
      // The held store is always under the current join.
      expect(s.unmatchedJoin).toBe(cache.UNMATCHED_JOIN_VERSION)
    }
    // ...and the current marker keeps them: the drop above is the marker's.
    expect(cache.sanitizeStore(old).unmatchedOrder).toEqual(['willet2', 'skylar'])
  })

  it('every write carries the current marker, so the stamps it writes are read back', async () => {
    seamDoc.value = { ...base, unmatched: { willet2: 5 }, unmatchedOrder: ['willet2'], unmatchedJoin: undefined }
    await cache.mergeChecklist('S1', [o('mallar3')], new Set(['mallar3', 'skylar']), Date.now(), ['mallar3', 'skylar'])
    await vi.advanceTimersByTimeAsync(300)
    expect(seamDoc.value).toMatchObject({ unmatchedJoin: cache.UNMATCHED_JOIN_VERSION, unmatchedOrder: ['skylar'] })
    cache._resetProvenanceCacheForTests()
    await cache.loadSnapshot()
    expect([...cache.unmatchedSet(Date.now())]).toEqual(['skylar'])
  })

  it('an absent or malformed field is NO STAMPS, the heal\'s previous behaviour', () => {
    for (const over of [{}, { unmatched: null, unmatchedOrder: [] }, { unmatched: {}, unmatchedOrder: 'willet2' }, { unmatched: 'x', unmatchedOrder: ['willet2'] }]) {
      const s = cache.sanitizeStore({ ...base, ...over })
      expect(s.unmatched).toEqual({})
      expect(s.unmatchedOrder).toEqual([])
    }
  })

  it('DROPS a malformed stamp: a bad key, a non-finite time, a key with no entry, a duplicate, or one beside a record', () => {
    const s = cache.sanitizeStore({
      ...base,
      species: { musduc: { seen: ['X|DNC'], n: 1, at: 1 } },
      speciesOrder: ['musduc'],
      unmatched: { willet2: 5, BADCODE: 1, eamwre1: 'soon', skylar: Infinity, musduc: 2, graygo: 3 },
      unmatchedOrder: ['willet2', 'BADCODE', 'eamwre1', 'skylar', 'musduc', 'nokey', 7, 'graygo', 'willet2'],
    })
    expect(s.unmatchedOrder).toEqual(['willet2', 'graygo'])
    expect(s.unmatched).toEqual({ willet2: 5, graygo: 3 })
  })

  it('reads through Object.hasOwn: neither a prototype-chain name nor a real own __proto__ key becomes a stamp', () => {
    const chain = cache.sanitizeStore({ ...base, unmatched: {}, unmatchedOrder: ['constructor', 'tostring', 'valueOf', '__proto__'] })
    expect(chain.unmatchedOrder).toEqual([])
    const hostile = cache.sanitizeStore(JSON.parse(
      `{"version":1,"checklists":{},"order":[],"species":{},"speciesOrder":[],"excludedNames":[],"unmatchedJoin":${cache.UNMATCHED_JOIN_VERSION},`
      + '"unmatched":{"__proto__":1,"constructor":2},"unmatchedOrder":["__proto__","constructor"]}',
    ))
    // `constructor` is in the key class and an own key here, so it is kept as
    // an ordinary stamp; `__proto__` fails the class.
    expect(hostile.unmatchedOrder).toEqual(['constructor'])
    expect(Object.getPrototypeOf(hostile.unmatched)).toBe(Object.prototype)
  })

  it('a key repeated n times costs ONE validation, valid or not (first-sight dedupe, as work done)', () => {
    const validations = (order: unknown[]) => {
      cache._resetProvenanceCacheForTests()
      cache.sanitizeStore({ ...base, unmatched: { willet2: 1 }, unmatchedOrder: order })
      return cache._getProvenanceCacheWorkStatsForTests().stampValidations
    }
    expect(validations(Array(10_000).fill('BAD KEY'))).toBe(1)
    expect(validations(Array(20_000).fill('BAD KEY'))).toBe(1)
    expect(validations(Array(20_000).fill('willet2'))).toBe(1)
    // ...and distinct keys still cost one each: the counter is not vacuous.
    expect(validations(Array.from({ length: 300 }, (_, i) => `k${i}`))).toBe(300)
  })

  it('keeps the NEWEST stamps when a document holds more than the cap', () => {
    cache.setProvenanceMaxUnmatched(3)
    const order = Array.from({ length: 10 }, (_, i) => `sp${i}`)
    const s = cache.sanitizeStore({ ...base, unmatched: Object.fromEntries(order.map((k, i) => [k, i])), unmatchedOrder: order })
    expect(s.unmatchedOrder).toEqual(['sp7', 'sp8', 'sp9'])
  })

  it('the write chokepoint round trip is idempotent', () => {
    const once = cache.sanitizeStore({ ...base, unmatched: { willet2: 5, graygo: 3 }, unmatchedOrder: ['graygo', 'willet2'] })
    expect(cache.sanitizeStore(JSON.parse(JSON.stringify(once)))).toEqual(once)
  })
})

describe('unmatched stamps and Clear (clear-means-clear)', () => {
  it('the purge drops every stamp from the mirror and the disk', async () => {
    await cache.mergeChecklist('S1', [], ALL, Date.now(), ['musduc'])
    await vi.advanceTimersByTimeAsync(300)
    expect(seamDoc.value).toMatchObject({ unmatchedOrder: ['musduc'] })
    await cache.purgeProvenanceStore()
    expect(cache.unmatchedSet(Date.now()).size).toBe(0)
    expect(cache.getSnapshot().unmatched?.size).toBe(0)
    expect(seamDoc.value).toBe(null)
  })

  it('an answer in flight across a Clear stamps nothing', async () => {
    await cache.loadSnapshot()
    let release!: (v: ProvenanceObservation[]) => void
    const settled = cache.dedupedFetchChecklist('S1', ALL, () => new Promise(r => { release = r }), { carried: ['musduc'] })
    await vi.advanceTimersByTimeAsync(0)
    await cache.purgeProvenanceStore()
    release([o('mallar3')])
    await settled
    await vi.advanceTimersByTimeAsync(300)
    expect(cache.unmatchedSet(Date.now()).size).toBe(0)
    expect(cache._getProvenanceCacheWorkStatsForTests().stamps).toBe(0)
    expect(seamDoc.value).toBe(null)
  })
})
