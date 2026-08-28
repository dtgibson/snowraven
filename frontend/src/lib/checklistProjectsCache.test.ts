// The projects store (county-shading-and-project-stats, FR-33 through FR-38;
// QA-34, QA-36, QA-37, QA-38, QA-39, QA-40, QA-73).
//
// The capacity+1 measurement asserts WORK DONE — admissions, refusals, evictions
// — never elapsed time. "Never much worse than not caching" has an exact meaning
// in those counts that no loaded machine can move, and the elapsed-time form of
// the same claim is what shipped twice as a defect.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const disk = vi.hoisted(() => ({ doc: null as unknown, writes: 0, failGet: false }))
vi.mock('./storage', () => ({
  storage: {
    getSetting: vi.fn(async () => {
      if (disk.failGet) throw new Error('disk')
      return disk.doc
    }),
    setSetting: vi.fn(async (_k: string, v: unknown) => { disk.writes += 1; disk.doc = v }),
  },
}))

import {
  sanitizeStore, dedupedFetchProjects, loadSnapshot, getSnapshot, getRevision,
  setProjectsMaxChecklists, remainingCapacity,
  _getProjectsCacheWorkStatsForTests, _resetProjectsCacheForTests,
  PROJECTS_TTL_MS, PROJECTS_STORE_KEY,
} from './checklistProjectsCache'

const answer = (projId = 'EBIRD_ATL_CA', projectIds: number[] = [1050]) =>
  async () => ({ projId, projectIds })

beforeEach(() => {
  _resetProjectsCacheForTests()
  disk.doc = null
  disk.writes = 0
  disk.failGet = false
})

describe('the document key and shape', () => {
  it('carries the version in the KEY as well as in the document', () => {
    // Bump the suffix AND `version` together on any shape change: a mismatch
    // yields an empty store, never a half-read migration.
    expect(PROJECTS_STORE_KEY).toBe('checklist-projects-v1')
  })

  it('the TTL is a year, an order of magnitude beyond the escapee store', () => {
    // A 30-day TTL would force a full eight-minute re-sweep every month and
    // destroy the feature's premise.
    expect(PROJECTS_TTL_MS).toBe(365 * 24 * 60 * 60 * 1000)
  })
})

describe('sanitizeStore (FR-33, QA-34)', () => {
  const good = {
    version: 1,
    entries: { S1: { proj: 'EBIRD', ids: [1050], at: 5 } },
    order: ['S1'],
  }

  it('round-trips a well-formed document', () => {
    const s = sanitizeStore(good)
    expect(s.order).toEqual(['S1'])
    expect(s.entries.S1).toEqual({ proj: 'EBIRD', ids: [1050], at: 5 })
  })

  it.each([
    ['not an object', 42],
    ['null', null],
    ['a wrong version', { version: 2, entries: {}, order: [] }],
    ['entries not an object', { version: 1, entries: 7, order: [] }],
    ['order not an array', { version: 1, entries: {}, order: {} }],
  ])('degrades %s to the EMPTY store rather than throwing', (_why, doc) => {
    const s = sanitizeStore(doc)
    expect(s.order).toEqual([])
    expect(Object.keys(s.entries)).toEqual([])
  })

  it.each([
    ['a key that fails the shape guard', 'nope'],
    ['a key past the length ceiling', 'S1234567890123456'],
    ['a prototype-chain name', '__proto__'],
    ['another prototype-chain name', 'constructor'],
  ])('drops %s without throwing', (_why, key) => {
    const s = sanitizeStore({ version: 1, entries: { [key]: { proj: '', ids: [], at: 1 } }, order: [key] })
    expect(s.order).toEqual([])
  })

  it.each([
    ['proj outside the class', { proj: 'ebird', ids: [], at: 1 }],
    ['proj past the ceiling', { proj: 'A'.repeat(33), ids: [], at: 1 }],
    ['ids not an array', { proj: '', ids: 3, at: 1 }],
    ['ids over the cap', { proj: '', ids: [1, 2, 3, 4, 5, 6, 7, 8, 9], at: 1 }],
    ['a non-integer id', { proj: '', ids: [1.5], at: 1 }],
    ['a negative id', { proj: '', ids: [-1], at: 1 }],
    ['an over-max id', { proj: '', ids: [1_000_000_000], at: 1 }],
    ['a non-finite timestamp', { proj: '', ids: [], at: Number.NaN }],
    ['a missing timestamp', { proj: '', ids: [] }],
    ['an entry that is not an object', 'nope'],
  ])('drops an entry with %s, keeping the rest', (_why, entry) => {
    const s = sanitizeStore({
      version: 1,
      entries: { S1: entry, S2: { proj: 'EBIRD', ids: [], at: 9 } },
      order: ['S1', 'S2'],
    })
    expect(s.order).toEqual(['S2'])
  })

  it('accepts an empty proj and an empty ids array (the common real shape)', () => {
    const s = sanitizeStore({ version: 1, entries: { S1: { proj: '', ids: [], at: 1 } }, order: ['S1'] })
    expect(s.order).toEqual(['S1'])
  })

  it('drops a duplicate order key rather than admitting it twice', () => {
    const s = sanitizeStore({ version: 1, entries: { S1: { proj: '', ids: [], at: 1 } }, order: ['S1', 'S1'] })
    expect(s.order).toEqual(['S1'])
  })

  it('drops an order key with no OWN entry', () => {
    const s = sanitizeStore({ version: 1, entries: {}, order: ['S1'] })
    expect(s.order).toEqual([])
  })

  it('survives a REAL prototype-pollution shape (built with JSON.parse)', () => {
    // `{ __proto__: ... }` in source sets the prototype and creates NO own
    // property, i.e. tests a shape that cannot arrive from storage. JSON.parse
    // produces the real own `__proto__` key that can.
    const hostile = JSON.parse('{"version":1,"entries":{"__proto__":{"proj":"EBIRD","ids":[],"at":1},"S1":{"proj":"EBIRD","ids":[],"at":1}},"order":["__proto__","S1"]}')
    const s = sanitizeStore(hostile)
    expect(s.order).toEqual(['S1'])
    expect(Object.getPrototypeOf(s.entries)).toBe(null)
    expect(({} as Record<string, unknown>).proj).toBeUndefined()
  })

  it('stops admitting at the cap on the LOAD path too', () => {
    setProjectsMaxChecklists(2)
    const entries: Record<string, unknown> = {}
    const order: string[] = []
    for (let i = 1; i <= 5; i += 1) {
      entries[`S${i}`] = { proj: '', ids: [], at: 1 }
      order.push(`S${i}`)
    }
    expect(sanitizeStore({ version: 1, entries, order }).order).toEqual(['S1', 'S2'])
  })
})

describe('the one fetch chokepoint (FR-38, QA-40)', () => {
  it('exports no direct write path', async () => {
    const mod = await import('./checklistProjectsCache')
    // `mergeEntry` is deliberately private: every persisted entry is fixed-shape
    // by ONE write path rather than by each caller's discipline.
    expect('mergeEntry' in mod).toBe(false)
    expect(Object.keys(mod)).toContain('dedupedFetchProjects')
  })

  it('a FRESH entry short-circuits with no network', async () => {
    await dedupedFetchProjects('S1', answer())
    const before = _getProjectsCacheWorkStatsForTests().loaderCalls
    const res = await dedupedFetchProjects('S1', answer())
    expect(res.fromNetwork).toBe(false)
    expect(_getProjectsCacheWorkStatsForTests().loaderCalls).toBe(before)
  })

  it('dedupes CONCURRENT requests for one id into a single loader call', async () => {
    // The chokepoint awaits the disk load first, so the loader is not called
    // synchronously; pre-load the mirror, then race two calls.
    await loadSnapshot()
    let resolve!: (v: { projId: string; projectIds: number[] }) => void
    const loader = vi.fn(() => new Promise<{ projId: string; projectIds: number[] }>(r => { resolve = r }))
    const a = dedupedFetchProjects('S1', loader)
    const b = dedupedFetchProjects('S1', loader)
    // Let both calls reach the in-flight map before the first one settles.
    await Promise.resolve()
    await Promise.resolve()
    resolve({ projId: 'EBIRD', projectIds: [] })
    await Promise.all([a, b])
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('the in-flight dedupe lives in the STORE, so it holds across controller remounts', async () => {
    // A controller remount (tab switch, a retry overlapping a running pass)
    // must not double-fetch: the Map is module-scoped rather than owned by the
    // hook.
    await loadSnapshot()
    let resolve!: (v: { projId: string; projectIds: number[] }) => void
    const loader = vi.fn(() => new Promise<{ projId: string; projectIds: number[] }>(r => { resolve = r }))
    const first = dedupedFetchProjects('S9', loader)
    await Promise.resolve()
    await Promise.resolve()
    const second = dedupedFetchProjects('S9', vi.fn(answer()))
    resolve({ projId: 'EBIRD', projectIds: [] })
    const [a, b] = await Promise.all([first, second])
    expect(loader).toHaveBeenCalledTimes(1)
    expect(a.entry).toEqual(b.entry)
  })

  it('`force` skips the fresh short-circuit through the SAME chokepoint (QA-39)', async () => {
    // Under the 365-day TTL the normal target set is empty for a year after a
    // complete sweep, so without this the complete state's control would be a
    // no-op press for its entire useful lifetime.
    await dedupedFetchProjects('S1', answer('EBIRD', []))
    const res = await dedupedFetchProjects('S1', answer('EBIRD_ATL_CA', [1050]), { force: true })
    expect(res.fromNetwork).toBe(true)
    expect(getSnapshot().get('S1')!.ids).toEqual([1050])
    // Still ONE write path: the merge and the dedupe are unchanged.
    expect(_getProjectsCacheWorkStatsForTests().merges).toBe(2)
  })
})

describe('the write chokepoint VALIDATES, not merely constructs (SEC-01)', () => {
  // Both shipped producers normalize first (`_norm_project_fields` on FastAPI,
  // `normalizeProjectFields` on desktop), so these answers are not reachable
  // today — a backend at a different revision, a modified local backend on the
  // web transport, or a future change to either seam is what makes them
  // reachable, which is exactly the class of change the one-chokepoint rule
  // exists to survive. The failure mode is not a crash: a value that passes the
  // WRITE path and fails the LOAD path is counted, displayed, persisted, and
  // then silently dropped by `sanitizeStore` on the next load — and in a
  // fill-and-stop store with a 365-day TTL, that checklist is re-asked every
  // session forever and never converges.
  const outOfBounds: [string, { projId: string; projectIds: number[] }][] = [
    ['a projId outside ^[A-Z0-9_]{1,32}$', { projId: 'not a proj id', projectIds: [] }],
    ['a projId past the 32-char ceiling', { projId: 'A'.repeat(33), projectIds: [] }],
    ['an id past PROJECT_ID_MAX', { projId: 'EBIRD', projectIds: [1_000_000_000] }],
    ['a negative id', { projId: 'EBIRD', projectIds: [-1] }],
    ['a non-integer id', { projId: 'EBIRD', projectIds: [1.5] }],
    ['more ids than MAX_PROJECT_IDS', { projId: 'EBIRD', projectIds: [1, 2, 3, 4, 5, 6, 7, 8, 9] }],
  ]

  it.each(outOfBounds)('substitutes the empty answer for %s rather than persisting it', async (_why, raw) => {
    const res = await dedupedFetchProjects('S1', async () => raw)
    // The caller receives what was persisted — the two cannot disagree.
    expect(res.entry).toEqual({ proj: '', ids: [], at: expect.any(Number) })
    expect(res.fromNetwork).toBe(true)
    const held = getSnapshot().get('S1')
    expect(held).toBeDefined()
    expect(held!.proj).toBe('')
    expect(held!.ids).toEqual([])
  })

  it('a conforming answer is untouched by the validation', async () => {
    const res = await dedupedFetchProjects('S1', answer('EBIRD_ATL_CA', [1050]))
    expect(res.entry.proj).toBe('EBIRD_ATL_CA')
    expect(getSnapshot().get('S1')!.ids).toEqual([1050])
  })

  it('a lying producer whose answer is not even the declared TYPE is substituted, not thrown on', async () => {
    // `ids` reaches `mergeEntry`'s spread; a non-iterable would throw there and
    // take the whole sweep down. The predicate rejects it first.
    const lying = async () => ({ projId: 7, projectIds: 'nope' } as unknown as { projId: string; projectIds: number[] })
    const res = await dedupedFetchProjects('S4', lying)
    expect(res.entry).toEqual({ proj: '', ids: [], at: expect.any(Number) })
    expect(getSnapshot().get('S4')!.ids).toEqual([])
  })

  it('EVERY entry the write path persists survives the load path (no silent discard)', async () => {
    // The property, stated where a test can see it: write then reload, and the
    // document round-trips whole. Without validation at the write path S1 is
    // written and then dropped here, so the id is re-asked on every session.
    vi.useFakeTimers()
    try {
      await dedupedFetchProjects('S1', async () => ({ projId: 'A'.repeat(33), projectIds: [1_000_000_000] }))
      await dedupedFetchProjects('S2', answer('EBIRD_ATL_CA', [1050]))
      await vi.advanceTimersByTimeAsync(300)          // flush the debounced write
      expect(disk.writes).toBeGreaterThan(0)

      const reloaded = sanitizeStore(disk.doc)
      expect(reloaded.order).toEqual(['S1', 'S2'])
      expect(reloaded.entries.S1.proj).toBe('')
      expect(reloaded.entries.S2.proj).toBe('EBIRD_ATL_CA')
    } finally {
      vi.useRealTimers()
    }
  })

  it('the substituted entry still occupies its admission slot, so it is not re-asked', async () => {
    // Substituting rather than declining is what makes the answer converge: the
    // checklist is answered ("no project"), the TTL governs the next ask, and a
    // fresh entry short-circuits with no network.
    await dedupedFetchProjects('S1', async () => ({ projId: 'not a proj id', projectIds: [] }))
    const loader = vi.fn(answer())
    const again = await dedupedFetchProjects('S1', loader)
    expect(again.fromNetwork).toBe(false)
    expect(loader).not.toHaveBeenCalled()
  })
})

describe('errors are NEVER cached (FR-37, QA-38)', () => {
  it('a rejection writes nothing and a retry issues a fresh request', async () => {
    const fail = vi.fn(async () => { throw Object.assign(new Error('nope'), { status: 500 }) })
    await expect(dedupedFetchProjects('S1', fail)).rejects.toThrow('nope')
    expect(getSnapshot().has('S1')).toBe(false)
    const res = await dedupedFetchProjects('S1', answer())
    expect(res.fromNetwork).toBe(true)
    expect(getSnapshot().has('S1')).toBe(true)
  })

  it('a 429 is not cached either', async () => {
    const limited = vi.fn(async () => { throw Object.assign(new Error('slow down'), { status: 429 }) })
    await expect(dedupedFetchProjects('S2', limited)).rejects.toThrow()
    expect(getSnapshot().has('S2')).toBe(false)
  })

  it('the in-flight map is cleared in a finally, so a failure does not wedge the id', async () => {
    const fail = async () => { throw new Error('boom') }
    await expect(dedupedFetchProjects('S3', fail)).rejects.toThrow()
    await expect(dedupedFetchProjects('S3', answer())).resolves.toBeDefined()
  })
})

describe('TTL semantics: re-consultation only, never display (FR-37, QA-39)', () => {
  it('an EXPIRED entry still displays and still counts as checked', async () => {
    disk.doc = {
      version: 1,
      entries: { S1: { proj: 'EBIRD_ATL_CA', ids: [1050], at: 1 } },  // ms epoch 1 = ancient
      order: ['S1'],
    }
    const snap = await loadSnapshot()
    expect(snap.has('S1')).toBe(true)
    expect(snap.get('S1')!.ids).toEqual([1050])
  })

  it('an expired entry IS re-asked by the next pass', async () => {
    disk.doc = { version: 1, entries: { S1: { proj: 'EBIRD', ids: [], at: 1 } }, order: ['S1'] }
    await loadSnapshot()
    const loader = vi.fn(answer('EBIRD_ATL_CA', [1050]))
    const res = await dedupedFetchProjects('S1', loader)
    expect(res.fromNetwork).toBe(true)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('a FRESH entry is not re-asked', async () => {
    disk.doc = { version: 1, entries: { S1: { proj: 'EBIRD', ids: [], at: Date.now() } }, order: ['S1'] }
    await loadSnapshot()
    const loader = vi.fn(answer())
    const res = await dedupedFetchProjects('S1', loader)
    expect(res.fromNetwork).toBe(false)
    expect(loader).not.toHaveBeenCalled()
  })
})

describe('admission is FILL-AND-STOP, never FIFO (FR-35, NFR-03)', () => {
  it('QA-36: at CAPACITY PLUS ONE a new key is refused and NOTHING is evicted', async () => {
    const N = 8
    setProjectsMaxChecklists(N)
    for (let i = 1; i <= N; i += 1) await dedupedFetchProjects(`S${i}`, answer('EBIRD', []))
    expect(remainingCapacity()).toBe(0)

    const before = _getProjectsCacheWorkStatsForTests()
    const overflow = await dedupedFetchProjects(`S${N + 1}`, answer('EBIRD_ATL_CA', [1050]))
    const after = _getProjectsCacheWorkStatsForTests()

    // WORK DONE, not elapsed time.
    expect(after.admissionsRefused - before.admissionsRefused).toBe(1)
    expect(after.evictions).toBe(0)          // fill-and-stop NEVER evicts
    expect(getSnapshot().size).toBe(N)

    // The N existing entries are all still readable — an eviction here would
    // destroy a paid-for network answer and, at capacity+1, would do so on
    // every pass forever.
    for (let i = 1; i <= N; i += 1) expect(getSnapshot().has(`S${i}`)).toBe(true)

    // ...and the refused key STILL RETURNS ITS ANSWER to the caller. Only
    // persistence was declined, so this session's tally still counts it.
    expect(overflow.refused).toBe(true)
    expect(overflow.entry.ids).toEqual([1050])
    expect(overflow.fromNetwork).toBe(true)
  })

  it('QA-37: re-merging ONE existing id fifty times consumes no admission capacity', async () => {
    // The test that would have caught the v0.5.85 defect: a bound enforced by a
    // separate counter that silently inflated until admission closed
    // permanently, invisible in both the entries and the answers.
    const N = 8
    setProjectsMaxChecklists(N)
    for (let i = 1; i < N; i += 1) await dedupedFetchProjects(`S${i}`, answer('EBIRD', []))
    const admissionsAfterFill = _getProjectsCacheWorkStatsForTests().admissions
    const orderLenAfterFill = getSnapshot().size
    expect(remainingCapacity()).toBe(1)

    for (let k = 0; k < 50; k += 1) {
      await dedupedFetchProjects('S1', answer('EBIRD', [k]), { force: true })
    }
    const stats = _getProjectsCacheWorkStatsForTests()
    expect(stats.admissions).toBe(admissionsAfterFill)   // no NEW key admitted
    expect(stats.admissionsRefused).toBe(0)              // and none refused
    expect(stats.evictions).toBe(0)
    expect(getSnapshot().size).toBe(orderLenAfterFill)
    expect(remainingCapacity()).toBe(1)                  // capacity NOT consumed

    // ...and one further NEW key is still admitted afterwards.
    const fresh = await dedupedFetchProjects(`S${N}`, answer('EBIRD', []))
    expect(fresh.refused).toBe(false)
    expect(getSnapshot().size).toBe(N)
  })

  it('a merge into an EXISTING key is never blocked by the cap, so a full store stays current', async () => {
    setProjectsMaxChecklists(2)
    await dedupedFetchProjects('S1', answer('EBIRD', []))
    await dedupedFetchProjects('S2', answer('EBIRD', []))
    expect(remainingCapacity()).toBe(0)
    const res = await dedupedFetchProjects('S1', answer('EBIRD_ATL_CA', [1050]), { force: true })
    expect(res.refused).toBe(false)
    expect(getSnapshot().get('S1')!.proj).toBe('EBIRD_ATL_CA')
  })

  it('admission is gated on the CONTAINER, not on a separate counter', async () => {
    // Stated as a property the test can see: the remaining capacity always
    // equals (cap - the number of distinct keys actually held), across a mix of
    // new keys and re-merges. A counter that inflates independently breaks this.
    setProjectsMaxChecklists(5)
    for (let i = 1; i <= 3; i += 1) await dedupedFetchProjects(`S${i}`, answer('EBIRD', []))
    for (let k = 0; k < 10; k += 1) await dedupedFetchProjects('S2', answer('EBIRD', [k]), { force: true })
    expect(remainingCapacity()).toBe(5 - getSnapshot().size)
    expect(getSnapshot().size).toBe(3)
  })
})

describe('persistence goes through the storage seam only (NFR-11, QA-73)', () => {
  it('a corrupt read degrades to an empty store with no crash', async () => {
    disk.failGet = true
    const snap = await loadSnapshot()
    expect(snap.size).toBe(0)
  })

  it('the revision advances on every merge so passive readers re-derive', async () => {
    const before = getRevision()
    await dedupedFetchProjects('S1', answer())
    expect(getRevision()).toBeGreaterThan(before)
  })

  it('reads the disk ONCE per session even under concurrent loads', async () => {
    const storage = (await import('./storage')).storage as unknown as { getSetting: ReturnType<typeof vi.fn> }
    storage.getSetting.mockClear()
    await Promise.all([loadSnapshot(), loadSnapshot(), loadSnapshot()])
    expect(storage.getSetting).toHaveBeenCalledTimes(1)
  })

  it('getSnapshot is render-safe: synchronous, no I/O, no clock', async () => {
    // Empty until the first loadSnapshot resolves, and never triggers a read.
    const storage = (await import('./storage')).storage as unknown as { getSetting: ReturnType<typeof vi.fn> }
    storage.getSetting.mockClear()
    expect(getSnapshot().size).toBe(0)
    expect(storage.getSetting).not.toHaveBeenCalled()
  })
})
