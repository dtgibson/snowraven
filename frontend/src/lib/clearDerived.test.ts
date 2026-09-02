// clear-means-clear: the shared clear-path teardown, driven against a fake
// storage seam so every assertion is about what is left ON DISK afterwards
// rather than about which function was called.
//
// The four documents under test are the ones a Clear used to leave behind:
// `exotic-provenance-v1` (the user's own checklist ids, species codes and
// escapee common names), `checklist-projects-v1` (submission ids as keys),
// `county-completeness-v1` (public payloads under a KEY SET that says which
// counties the user has birded), and the `/weather/S…` / `/tide/S…` entries in
// `replay.json`.
//
// The negative half matters as much as the positive: a REPLACE must purge
// nothing (PRIVACY_POLICY.md publishes that a newer export asks only about
// unanswered checklists), and the coordinate-keyed `/weather/at` and
// `/tide/at` entries are not derived from the export and must survive a clear.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ReplayStore } from './storage'

// ── fake storage seam ────────────────────────────────────────────────────────
// Settings documents live in one record (as they do in settings.json); the
// replay document is its own file (as data/replay.json is).
const disk = vi.hoisted(() => ({
  settings: {} as Record<string, unknown>,
  replay: null as ReplayStore | null,
  // Paths whose next write rejects, for the best-effort teardown assertion.
  failNextDelete: new Set<string>(),
  // When set, every getSetting parks on it — the seam-level hold that lets a
  // test put a one-per-session disk read in flight ACROSS a purge.
  holdSettingRead: null as Promise<void> | null,
  // ONE-SHOT: the next setReplayStore parks on it and clears it, so a test can
  // hold ONE write in flight while later writes proceed. It has to be one-shot,
  // or a test could not tell an ordered writer from two parked writes that
  // happen to resume in registration order.
  holdReplayWrite: null as Promise<void> | null,
  // The keys of each replay document written, in the order the seam saw them.
  replayWrites: [] as string[][],
}))

vi.mock('./storage', () => ({
  storage: {
    async getSetting<T>(key: string): Promise<T | null> {
      if (disk.holdSettingRead) await disk.holdSettingRead
      return (disk.settings[key] as T) ?? null
    },
    async setSetting<T>(key: string, value: T): Promise<void> {
      disk.settings[key] = JSON.parse(JSON.stringify(value)) as unknown
    },
    async deleteSetting(key: string): Promise<void> {
      if (disk.failNextDelete.delete(key)) throw new Error(`EIO (injected): ${key}`)
      delete disk.settings[key]
    },
    async getReplayStore(): Promise<ReplayStore | null> {
      return disk.replay === null ? null : (JSON.parse(JSON.stringify(disk.replay)) as ReplayStore)
    },
    async setReplayStore(store: ReplayStore): Promise<void> {
      const hold = disk.holdReplayWrite
      if (hold) { disk.holdReplayWrite = null; await hold }
      disk.replay = JSON.parse(JSON.stringify(store)) as ReplayStore
      disk.replayWrites.push(Object.keys(disk.replay.entries).sort())
    },
  },
}))

import { purgeDerivedOnClear, registeredTeardowns } from './clearDerived'
import * as provenance from './exoticProvenanceCache'
import * as projects from './checklistProjectsCache'
import * as county from './countyCompletenessCache'
import * as replay from './replayStore'

const T = Date.parse('2026-09-01T12:00:00.000Z')

const PROVENANCE_DOC = {
  version: 1,
  checklists: { S1000001: T, S1000002: T },
  order: ['S1000001', 'S1000002'],
  species: { mallar3: { seen: ['|'], n: 2, at: T }, mutswa: { seen: ['N|'], n: 1, at: T } },
  speciesOrder: ['mallar3', 'mutswa'],
  excludedNames: ['Mute Swan'],
}

const PROJECTS_DOC = {
  version: 1,
  entries: { S1000001: { proj: 'EBIRD_ATL_VA', ids: [1042], at: T } },
  order: ['S1000001'],
}

const COUNTY_DOC = {
  version: 1,
  entries: {
    'US-CA-085': {
      data: { regionCode: 'US-CA-085', speciesCount: 1, species: [{ speciesCode: 'mallar3', commonName: 'Mallard' }] },
      fetchedAt: T,
      bytes: 90,
    },
  },
  order: ['US-CA-085'],
}

const CHECKLIST_REPLAY_KEYS = ['/weather/S1000001?', '/tide/S1000001?']
const COORD_REPLAY_KEYS = ['/weather/at?lat=37.00000&lng=-122.00000', '/tide/at?lat=37.00000&lng=-122.00000']
// A checklist-derived key NOT in the seeded document: what an in-flight lookup
// is about to persist when the Clear lands.
const IN_FLIGHT_REPLAY_KEY = '/weather/S1000009?'

function replayDoc(): ReplayStore {
  const keys = [...CHECKLIST_REPLAY_KEYS, ...COORD_REPLAY_KEYS]
  const entries: ReplayStore['entries'] = {}
  for (const k of keys) entries[k] = { data: { formatted: k }, loadedAt: T, bytes: 20 }
  return { version: 1, entries, order: [...keys] }
}

/** Seed all four documents, plus one setting nothing may touch. */
function seedDisk(): void {
  disk.settings = {
    [provenance.PROVENANCE_STORE_KEY]: JSON.parse(JSON.stringify(PROVENANCE_DOC)) as unknown,
    [projects.PROJECTS_STORE_KEY]: JSON.parse(JSON.stringify(PROJECTS_DOC)) as unknown,
    [county.COMPLETENESS_STORE_KEY]: JSON.parse(JSON.stringify(COUNTY_DOC)) as unknown,
    'map-defaults': { lat: 37, lng: -122, dist: 5 },
  }
  disk.replay = replayDoc()
}

/** Hydrate every mirror from disk, the state a real session is in at Clear. */
async function hydrateAll(): Promise<void> {
  await provenance.loadSnapshot()
  await projects.loadSnapshot()
  await county.loadAll()
  await replay.get(CHECKLIST_REPLAY_KEYS[0])
}

const replayKeysOnDisk = (): string[] => Object.keys(disk.replay?.entries ?? {}).sort()

beforeEach(() => {
  provenance._resetProvenanceCacheForTests()
  projects._resetProjectsCacheForTests()
  county._resetCountyCompletenessCacheForTests()
  replay._resetReplayStoreForTests()
  disk.failNextDelete.clear()
  disk.holdSettingRead = null
  disk.holdReplayWrite = null
  disk.replayWrites = []
  seedDisk()
})

/** A promise a test resolves by hand, for forcing an interleaving. */
function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('the registry (clear-means-clear)', () => {
  it('names every eBird-derived durable store, and nothing for ML', () => {
    expect([...registeredTeardowns('ebird')].sort()).toEqual([
      'checklist-projects-v1',
      'county-completeness-v1',
      'exotic-provenance-v1',
      'replay.json (checklist-keyed entries)',
    ])
    // Nothing durable is keyed to ml-export.csv. Asserted rather than assumed,
    // so the first ML-derived store has to come here and say so.
    expect(registeredTeardowns('ml')).toEqual([])
  })
})

describe('a Clear of the eBird backup purges every derived store', () => {
  it('leaves all four documents empty on disk, and the unrelated setting alone', async () => {
    await hydrateAll()
    await purgeDerivedOnClear('ebird')

    expect(disk.settings[provenance.PROVENANCE_STORE_KEY]).toBeUndefined()
    expect(disk.settings[projects.PROJECTS_STORE_KEY]).toBeUndefined()
    expect(disk.settings[county.COMPLETENESS_STORE_KEY]).toBeUndefined()
    expect(replayKeysOnDisk()).toEqual([...COORD_REPLAY_KEYS].sort())
    // A purge is not a settings wipe: everything else in the document stands.
    expect(disk.settings['map-defaults']).toEqual({ lat: 37, lng: -122, dist: 5 })
  })

  it('resolves with an empty list when every store purged', async () => {
    await hydrateAll()
    await expect(purgeDerivedOnClear('ebird')).resolves.toEqual([])
  })

  it('carries a hostile KEY from the persisted document across the purge', async () => {
    // `replay.json` is unvalidated on disk, and its keys go straight into the
    // purge's accumulator. On a plain `{}` the single key `__proto__` is an
    // inherited SETTER, so `next.entries[key] = entry` would set the
    // accumulator's prototype instead of storing the entry: the entry silently
    // disappears from the purged document (and the mirror is left with a
    // polluted prototype). It is not checklist-derived, so a Clear must keep
    // it, exactly like the coordinate keys.
    disk.replay = {
      version: 1,
      // Computed key: an own property. The identifier form `__proto__:` in an
      // object literal would set the prototype instead, which is the very
      // mechanism under test.
      entries: { ...replayDoc().entries, ['__proto__']: { data: { formatted: 'hostile' }, loadedAt: T, bytes: 20 } },
      order: [...CHECKLIST_REPLAY_KEYS, ...COORD_REPLAY_KEYS, '__proto__'],
    }
    await hydrateAll()

    await purgeDerivedOnClear('ebird')

    expect(replayKeysOnDisk()).toEqual([...COORD_REPLAY_KEYS, '__proto__'].sort())
    expect(disk.replay?.order).toContain('__proto__')
  })

  it('empties the in-memory mirrors too, so a still-mounted tab shows nothing stale', async () => {
    await hydrateAll()
    expect(provenance.getSnapshot().checklists.size).toBe(2)
    expect(projects.getSnapshot().size).toBe(1)

    await purgeDerivedOnClear('ebird')

    expect(provenance.getSnapshot().checklists.size).toBe(0)
    expect(provenance.getSnapshot().species.size).toBe(0)
    expect(provenance.getSnapshot().excludedNames).toEqual([])
    expect(projects.getSnapshot().size).toBe(0)
    expect(await county.loadAll()).toEqual(new Map())
    for (const key of CHECKLIST_REPLAY_KEYS) expect(await replay.get(key)).toBeNull()
  })

  it('works from cold, with no mirror hydrated first (the Clear-then-quit path)', async () => {
    // The reproduction in the brief never opened Statistics in this session:
    // the documents are on disk and no mirror has been loaded. A teardown that
    // only cleared mirrors would leave every one of them behind.
    await purgeDerivedOnClear('ebird')

    expect(disk.settings[provenance.PROVENANCE_STORE_KEY]).toBeUndefined()
    expect(disk.settings[projects.PROJECTS_STORE_KEY]).toBeUndefined()
    expect(disk.settings[county.COMPLETENESS_STORE_KEY]).toBeUndefined()
    expect(replayKeysOnDisk()).toEqual([...COORD_REPLAY_KEYS].sort())
  })

  it('a later load does not resurrect anything (the mirror survives a relaunch-shaped reload)', async () => {
    await hydrateAll()
    await purgeDerivedOnClear('ebird')

    // Detach every mirror, as a relaunch would, and read from the purged disk.
    provenance._resetProvenanceCacheForTests()
    projects._resetProjectsCacheForTests()
    county._resetCountyCompletenessCacheForTests()
    replay._resetReplayStoreForTests()

    expect((await provenance.loadSnapshot()).checklists.size).toBe(0)
    expect((await projects.loadSnapshot()).size).toBe(0)
    expect(await county.loadAll()).toEqual(new Map())
    expect(await replay.get(CHECKLIST_REPLAY_KEYS[0])).toBeNull()
    expect(await replay.get(COORD_REPLAY_KEYS[0])).not.toBeNull()
  })

  it('is best-effort per store: one failing write does not abandon the other three', async () => {
    await hydrateAll()
    disk.failNextDelete.add(projects.PROJECTS_STORE_KEY)

    // And it REPORTS the one that failed rather than resolving as a clean
    // sweep: a Clear that half-failed used to be indistinguishable from one
    // that worked, which is the same lie the whole change is about.
    await expect(purgeDerivedOnClear('ebird')).resolves.toEqual(['checklist-projects-v1'])

    expect(disk.settings[provenance.PROVENANCE_STORE_KEY]).toBeUndefined()
    expect(disk.settings[county.COMPLETENESS_STORE_KEY]).toBeUndefined()
    expect(replayKeysOnDisk()).toEqual([...COORD_REPLAY_KEYS].sort())
    // The one that failed is still on disk, and its MIRROR is empty anyway, so
    // the session shows nothing stale and the next Clear re-attempts it.
    expect(disk.settings[projects.PROJECTS_STORE_KEY]).toBeDefined()
    expect(projects.getSnapshot().size).toBe(0)
  })
})

describe('a Clear of the ML export purges nothing', () => {
  it('leaves every eBird-derived document untouched', async () => {
    await hydrateAll()
    await purgeDerivedOnClear('ml')

    expect(disk.settings[provenance.PROVENANCE_STORE_KEY]).toEqual(PROVENANCE_DOC)
    expect(disk.settings[projects.PROJECTS_STORE_KEY]).toEqual(PROJECTS_DOC)
    expect(disk.settings[county.COMPLETENESS_STORE_KEY]).toEqual(COUNTY_DOC)
    expect(replayKeysOnDisk()).toEqual([...CHECKLIST_REPLAY_KEYS, ...COORD_REPLAY_KEYS].sort())
  })
})

describe('the checklist-derived replay key predicate', () => {
  it.each([
    ['/weather/S1000001?', true],
    ['/tide/S1000001?', true],
    ['/tide/S1000001?force=1', true],           // force is stripped by replayKey, belt and braces
    ['/weather/at?lat=37.00000&lng=-122.00000', false],
    ['/tide/at?lat=37.00000&lng=-122.00000', false],
    ['/weather/at?dt=2026-09-01+08%3A00&lat=37.00000&lng=-122.00000', false],
    ['/map/hotspots?lat=37.00000&lng=-122.00000', false],
    ['/weather/S1000001/extra?', false],        // an id is one segment
    ['/weather/X1000001?', false],              // not a submission id
    ['/weather/S?', false],                     // no digits
    ['/weather/%E0%A4%A?', false],              // malformed escape: guarded, not thrown on
  ])('%s -> %s', (key, expected) => {
    expect(replay.isChecklistDerivedReplayKey(key as string)).toBe(expected)
  })

  it('never matches a key that a coordinate lookup can produce', () => {
    // The whole clear/keep split rests on `at` not being a submission id.
    expect(replay.isChecklistDerivedReplayKey(replay.replayKey('/weather/at', { lat: '37', lng: '-122' }))).toBe(false)
    expect(replay.isChecklistDerivedReplayKey(replay.replayKey('/weather/S1000001'))).toBe(true)
  })
})

describe('a purge supersedes work already in flight', () => {
  it('lands even with a debounced replay write pending, and the flush cannot re-land it', async () => {
    vi.useFakeTimers()
    await hydrateAll()

    // A put inside the 250 ms debounce window: the timer is holding the whole
    // pre-purge document, which is exactly what used to re-land it.
    await replay.put(IN_FLIGHT_REPLAY_KEY, { formatted: 'fresh' }, replay.purgeGeneration())
    await purgeDerivedOnClear('ebird')

    expect(replayKeysOnDisk()).toEqual([...COORD_REPLAY_KEYS].sort())
    await vi.advanceTimersByTimeAsync(1_000)
    expect(replayKeysOnDisk()).toEqual([...COORD_REPLAY_KEYS].sort())
  })

  it('a flush whose write is ALREADY IN FLIGHT lands BEFORE the purge, not after it', async () => {
    // The debounce test above supersedes a PENDING timer and a fired-but-not-
    // yet-flushed callback. This is the third case, and neither mechanism
    // reaches it: the timer has fired, the identity check has passed, and the
    // write is inside the seam. `replay.json` is the one durable document not
    // on the storage seam's `docChains`, so ordering two concurrent writes is
    // the store's own job — and the purge's document is the SMALLER one, so
    // "whichever finishes first" is a coin flip that lands on the pre-purge
    // document often enough to leave checklist weather keys on disk after a
    // Clear.
    vi.useFakeTimers()
    await hydrateAll()

    await replay.put(IN_FLIGHT_REPLAY_KEY, { formatted: 'fresh' }, replay.purgeGeneration())
    const inFlightWrite = deferred<void>()
    disk.holdReplayWrite = inFlightWrite.promise
    await vi.advanceTimersByTimeAsync(300)
    // The flush is genuinely in flight: called, parked inside the seam.
    expect(disk.replayWrites).toEqual([])

    const purging = purgeDerivedOnClear('ebird')
    // Give the purge every chance to ISSUE its write before the parked one is
    // released. An ordered writer cannot: its link is queued behind the flush
    // that is still inside the seam, so the disk is still untouched here. An
    // unordered one writes now, and the flush then overwrites it on resume.
    // (Releasing the hold first would let an unordered store pass on timing
    // alone, which is how the first version of this test was green against a
    // deliberately unordered mutant.)
    await vi.advanceTimersByTimeAsync(50)
    expect(disk.replayWrites).toEqual([])

    inFlightWrite.resolve()
    await purging
    await vi.advanceTimersByTimeAsync(1_000)

    // Both writes happened, in call order, and the purge's document is the one
    // left on disk. The assertion is the ORDER, not just the end state: a store
    // that got this right by luck would show the reverse here.
    expect(disk.replayWrites).toHaveLength(2)
    expect(disk.replayWrites[0]).toContain(IN_FLIGHT_REPLAY_KEY)
    expect(disk.replayWrites[1]).toEqual([...COORD_REPLAY_KEYS].sort())
    expect(replayKeysOnDisk()).toEqual([...COORD_REPLAY_KEYS].sort())
  })

  // The real race, and the one every durable store has to survive: a pass is
  // mid-request when the user presses Clear, and every id in that pass was read
  // out of the backup being deleted. The answer lands AFTER the fresh mirror is
  // installed, so an identity check on the mirror is not by itself an answer —
  // a public write path that re-loads for itself finds the new mirror perfectly
  // valid. Each store either captures its `store` before the loader runs
  // (projects, county) or carries a purge generation (provenance, replay).
  //
  // ONE ROW PER DURABLE STORE, ONE TEMPLATE. The roster is the point: the
  // replay store reached review with the other three tested and itself not,
  // which is exactly how its `put` — public, and loading for itself — passed as
  // safe. A fifth store with no row here should be conspicuous.
  //
  // EVERY ROW ASSERTS TWO THINGS, and the second is not decoration: the
  // observable outcome (nothing on disk, nothing in the mirror) AND that the
  // store's write path never RAN, read from its work-stats seam. A row that
  // checks the disk alone can pass on a downstream guard while the guard it
  // means to test is gone — `putEntry`'s identity check was exactly that, since
  // `scheduleWrite` declines the flush anyway while `putEntry` has already
  // mutated module-level `_totalBytes` and left the freshly reset budget
  // over-counted, which drives premature eviction later. Four green rows are
  // not four working guards unless each row is mutation-checked on its own
  // guard; these were.
  //
  // Typed explicitly for the same reason as LOAD_RACES below (TS7024).
  const WRITE_RACES: ReadonlyArray<[
    label: string,
    start: () => { land: () => void; settled: Promise<unknown> },
    expectRefused: (result: unknown) => Promise<void>,
  ]> = [
    ['provenance', () => {
      const gate = deferred<readonly provenance.ProvenanceObservation[]>()
      const settled = provenance.dedupedFetchChecklist('S1000003', new Set(['mallar3']), () => gate.promise)
      return {
        land: () => gate.resolve([{ speciesCode: 'mallar3', exoticCategory: 'N', userDoNotCount: '' }]),
        settled,
      }
    }, async () => {
      expect(disk.settings[provenance.PROVENANCE_STORE_KEY]).toBeUndefined()
      expect(provenance.getSnapshot().checklists.size).toBe(0)
      expect(provenance.getSnapshot().species.size).toBe(0)
      expect(provenance._getProvenanceCacheWorkStatsForTests().merges).toBe(0)
    }],

    ['projects', () => {
      const gate = deferred<{ projId: string; projectIds: number[] }>()
      const settled = projects.dedupedFetchProjects('S1000003', () => gate.promise)
      return { land: () => gate.resolve({ projId: 'EBIRD_ATL_VA', projectIds: [7] }), settled }
    }, async (result) => {
      // The caller still receives its answer for this session — only persistence
      // was skipped — and it is not reported as a cap refusal.
      const r = result as projects.ProjectsFetchResult
      expect(r.entry.proj).toBe('EBIRD_ATL_VA')
      expect(r.refused).toBe(false)
      expect(disk.settings[projects.PROJECTS_STORE_KEY]).toBeUndefined()
      expect(projects.getSnapshot().size).toBe(0)
      expect(projects._getProjectsCacheWorkStatsForTests().merges).toBe(0)
    }],

    ['county completeness', () => {
      const gate = deferred<{ regionCode: string; speciesCount: number; species: { speciesCode: string; commonName: string }[] }>()
      const settled = county.dedupedFetch('US-CA-001', () => gate.promise)
      return {
        land: () => gate.resolve({ regionCode: 'US-CA-001', speciesCount: 1, species: [{ speciesCode: 'mallar3', commonName: 'Mallard' }] }),
        settled,
      }
    }, async (result) => {
      expect((result as county.CompletenessFetchResult).data.regionCode).toBe('US-CA-001')
      expect(disk.settings[county.COMPLETENESS_STORE_KEY]).toBeUndefined()
      expect(await county.loadAll()).toEqual(new Map())
      // The one that made this assertion a rule: without it the row is green
      // with `putEntry`'s guard removed, because `scheduleWrite` keeps the disk
      // clean downstream while `_totalBytes` has already been corrupted.
      expect(county._getCountyCompletenessCacheWorkStatsForTests().puts).toBe(0)
    }],

    ['replay', () => {
      // transport.getReplayable's exact shape: capture the generation, await
      // the live GET, then put. The Weather Backlog fires a run of these for
      // ids read out of the backup while its tab sits mounted, so this is the
      // reachable one. That the transport really passes the captured
      // generation is pinned in transport.test.ts; this row is the store's
      // half of the contract.
      const gate = deferred<{ formatted: string }>()
      const gen = replay.purgeGeneration()
      const settled = (async () => {
        const data = await gate.promise
        await replay.put(IN_FLIGHT_REPLAY_KEY, data, gen)
      })()
      return { land: () => gate.resolve({ formatted: 'cleared checklist weather' }), settled }
    }, async () => {
      expect(replayKeysOnDisk()).toEqual([...COORD_REPLAY_KEYS].sort())
      expect(await replay.get(IN_FLIGHT_REPLAY_KEY)).toBeNull()
      expect(replay._getReplayStoreWorkStatsForTests().puts).toBe(0)
    }],
  ]

  it.each(WRITE_RACES)('a %s answer already in flight is NOT persisted: it came from the cleared export', async (_label, start, expectRefused) => {
    vi.useFakeTimers()
    await hydrateAll()

    const { land, settled } = start()
    await Promise.resolve()

    // The user presses Clear while that request is outstanding.
    await purgeDerivedOnClear('ebird')

    // The answer lands afterwards, for an id from the export just deleted.
    land()
    const result = await settled
    await vi.advanceTimersByTimeAsync(1_000)

    await expectRefused(result)
  })

  it('an escapee-name publish already in flight does not re-write the names', async () => {
    // publishExcludedNames carries species COMMON NAMES verbatim from the
    // export, so a publish that lands after a Clear is the same leak by another
    // door.
    vi.useFakeTimers()
    await hydrateAll()

    const gate = deferred<void>()
    disk.holdSettingRead = gate.promise
    provenance._resetProvenanceCacheForTests()
    const pending = provenance.publishExcludedNames(['Mute Swan', 'Egyptian Goose'])
    await Promise.resolve()

    await purgeDerivedOnClear('ebird')
    gate.resolve()
    disk.holdSettingRead = null
    await pending
    await vi.advanceTimersByTimeAsync(1_000)

    expect(disk.settings[provenance.PROVENANCE_STORE_KEY]).toBeUndefined()
    expect(provenance.getSnapshot().excludedNames).toEqual([])
  })

  // Typed explicitly: an inline tuple whose members are arrow functions returning
  // module values makes TS give up on inferring the case type (TS7024).
  const LOAD_RACES: ReadonlyArray<[label: string, load: () => Promise<unknown>, key: string]> = [
    ['provenance', () => provenance.loadSnapshot(), provenance.PROVENANCE_STORE_KEY],
    ['projects', () => projects.loadSnapshot(), projects.PROJECTS_STORE_KEY],
    ['county completeness', () => county.loadAll(), county.COMPLETENESS_STORE_KEY],
  ]

  it.each(LOAD_RACES)('a %s disk read in flight cannot restore the pre-purge document', async (_label, load, key) => {
    // The one-disk-read-per-session load is parked when Clear happens. Without
    // the load-path guard it resolves afterwards, adopts the PRE-purge document
    // it read, and the next write puts every purged id straight back.
    const gate = deferred<void>()
    disk.holdSettingRead = gate.promise
    const loading = load()
    await Promise.resolve()

    await purgeDerivedOnClear('ebird')

    gate.resolve()
    disk.holdSettingRead = null
    await loading

    expect(disk.settings[key]).toBeUndefined()
    expect(provenance.getSnapshot().checklists.size).toBe(0)
    expect(projects.getSnapshot().size).toBe(0)
    expect(await county.loadAll()).toEqual(new Map())
  })
})

describe('the stores keep working after a purge', () => {
  it('a fresh answer merged later persists normally', async () => {
    vi.useFakeTimers()
    await hydrateAll()
    await purgeDerivedOnClear('ebird')

    // The purge detaches the mirror; a NEW load (the next session, or the next
    // pass after a fresh upload) must be able to write again.
    provenance._resetProvenanceCacheForTests()
    await provenance.loadSnapshot()
    await provenance.mergeChecklist(
      'S2000001',
      [{ speciesCode: 'mallar3', exoticCategory: 'N', userDoNotCount: '' }],
      new Set(['mallar3']),
      T,
    )
    await vi.advanceTimersByTimeAsync(1_000)

    const doc = disk.settings[provenance.PROVENANCE_STORE_KEY] as typeof PROVENANCE_DOC
    expect(doc.order).toEqual(['S2000001'])
    expect(doc.speciesOrder).toEqual(['mallar3'])
  })
})
