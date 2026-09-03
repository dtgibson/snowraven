/// <reference types="node" />
// Guard for fix: cache-read-throw-containment.
//
// Both shared parse caches DOCUMENTED a falsy answer on failure and delivered it
// for the parse only. `await storage.readFile(...)` sat OUTSIDE `loadFresh`'s own
// `try` in each module, so a read rejection was the one failure in there that
// escaped to the caller as a throw:
//
//     const text = await storage.readFile('ebird')   // <- outside the try
//     if (text === null) return null
//     try { observations = await parseOffThread(text) } catch { return null }
//
// That is not an exotic path on web/Pi. `WebStorage.readFile` is a bare
// `fetch` + `res.text()`: the fetch rejects when the backend is unreachable, and
// `res.text()` rejects on a body truncated mid-download, which is an ordinary
// Wi-Fi event over a ~6 MB CSV served off a Pi. The throw then landed in each tab
// loader's outer catch, which sets `setup-required` — "upload a backup" over a
// backup that is plainly stored (DECISIONS.md 2026-05-22: `error` and
// `setup-required` are deliberately distinct, and 1.0.14's honest-load-failures
// build removed exactly this lie everywhere else).
//
// This file asserts the SEAM, at the module level, for both caches from one
// roster — the tab-level consequence is `cacheReadThrowTabs.test.tsx`. Four
// claims per cache, and each fails with the read moved back above the try:
//
//   1. A REJECTING READ RESOLVES NULL. The promise these modules hand back
//      structurally cannot reject.
//   2. THE FAILURE IS NOT CACHED AND `inflight` CLEARS, so the next mount, save
//      or file arrival gets its own attempt rather than re-joining a dead promise
//      (the v1.0.14 memoized-promise hazard: a memoized promise inherits its
//      producer's worst settle path).
//   3. CONCURRENT FIRST-CALLERS ALL GET NULL from the one shared attempt — the
//      memoized promise is handed to every one of them, so if it can reject it
//      rejects into all of them at once.
//   4. THE ABSENT CASE STILL WORKS: a read that resolves null is still null, and
//      a healthy read still parses and caches.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({ readFile: vi.fn() }))

vi.mock('./storage', () => ({
  storage: { readFile: (name: string) => mocks.readFile(name) },
}))

import { clearEbirdObservationsCache, loadEbirdObservations } from './observationsCache'
import { clearMLExportCache, loadMLExport } from './mlExportCache'

// Node environment, so `Worker` does not exist and the eBird parse takes its
// documented main-thread fallback. Nothing here depends on which path it takes:
// on the failing rows the parse is never reached at all.
const EBIRD_CSV = 'Submission ID,Common Name,Scientific Name,Date\nS1,Sora,Porzana carolina,2024-04-09\n'
const ML_CSV = 'Catalog Number,Common Name,Scientific Name,Format\n1,American Robin,Turdus migratorius,Photo\n'

/** One row per shared parse cache. A third cache of this shape reads as a MISSING
 *  ROW rather than as nothing at all. */
const CACHES: {
  name: string
  slot: 'ebird' | 'ml'
  good: string
  load: () => Promise<unknown>
  clear: () => void
  /** Proves the healthy result is real, so the null rows are not vacuous. */
  expectLoaded: (value: unknown) => void
}[] = [
  {
    name: 'loadEbirdObservations',
    slot: 'ebird',
    good: EBIRD_CSV,
    load: loadEbirdObservations,
    clear: clearEbirdObservationsCache,
    expectLoaded: v => {
      const loaded = v as { headerLine: string; observations: unknown[] }
      expect(loaded.observations).toHaveLength(1)
      expect(loaded.headerLine).toBe('Submission ID,Common Name,Scientific Name,Date')
    },
  },
  {
    name: 'loadMLExport',
    slot: 'ml',
    good: ML_CSV,
    load: loadMLExport,
    clear: clearMLExportCache,
    expectLoaded: v => {
      const loaded = v as { rows: unknown[] }
      expect(loaded.rows).toHaveLength(1)
    },
  },
]

const rows = CACHES.map(c => [c.name, c] as const)

beforeEach(() => {
  clearEbirdObservationsCache()
  clearMLExportCache()
  mocks.readFile.mockReset()
})

describe('a stored file whose READ fails resolves null rather than throwing', () => {
  it.each(rows)('%s resolves null when storage.readFile rejects', async (_name, cache) => {
    mocks.readFile.mockRejectedValue(new TypeError('Failed to fetch'))

    // `.resolves` is the whole claim: before the fix this line rejected, and the
    // rejection reached the tab's outer catch as `setup-required`.
    await expect(cache.load()).resolves.toBeNull()
    expect(mocks.readFile).toHaveBeenCalledWith(cache.slot)
  })

  it.each(rows)('%s resolves null when the read rejects mid-body, not at connect', async (_name, cache) => {
    // `res.text()` rejecting after a 200 — the truncated-download case, which is
    // the one a large CSV off a Pi actually hits.
    mocks.readFile.mockRejectedValue(new Error('network error: body truncated'))

    await expect(cache.load()).resolves.toBeNull()
  })
})

describe('a failed read is not cached and does not poison the session', () => {
  it.each(rows)('%s re-reads on the next call after a read failure', async (_name, cache) => {
    mocks.readFile.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    expect(await cache.load()).toBeNull()
    expect(mocks.readFile).toHaveBeenCalledTimes(1)

    // The line the throw made impossible to reach cleanly: a later mount gets its
    // own attempt instead of re-joining a settled-bad promise.
    mocks.readFile.mockResolvedValue(cache.good)
    const second = await cache.load()

    cache.expectLoaded(second)
    expect(mocks.readFile).toHaveBeenCalledTimes(2)

    // And the good parse IS cached, so the failure left nothing behind.
    expect(await cache.load()).toBe(second)
    expect(mocks.readFile).toHaveBeenCalledTimes(2)
  })

  it.each(rows)('%s hands every concurrent first-caller the same null', async (_name, cache) => {
    mocks.readFile.mockRejectedValue(new TypeError('Failed to fetch'))

    // All three share the one memoized `inflight` promise, so a promise that can
    // reject rejects into all three at once — this is the tab-wide blast radius.
    const [a, b, c] = await Promise.all([cache.load(), cache.load(), cache.load()])

    expect(a).toBeNull()
    expect(b).toBeNull()
    expect(c).toBeNull()
    expect(mocks.readFile).toHaveBeenCalledTimes(1)
  })
})

describe('the absent and healthy cases are unchanged', () => {
  it.each(rows)('%s still returns null when no file is stored', async (_name, cache) => {
    mocks.readFile.mockResolvedValue(null)

    expect(await cache.load()).toBeNull()
  })

  it.each(rows)('%s still parses and caches a healthy read', async (_name, cache) => {
    mocks.readFile.mockResolvedValue(cache.good)

    const first = await cache.load()
    cache.expectLoaded(first)
    expect(await cache.load()).toBe(first)
    expect(mocks.readFile).toHaveBeenCalledTimes(1)
  })
})
