// The shared county-geometry loader (county-shading-and-project-stats, FR-01,
// QA-01).
//
// The behaviour that matters is not "it returns geometry" but "it runs its load
// body once per session and dedupes concurrent first calls", because the
// alternative — the per-mount `useState` cache this replaces — would import and
// parse 3.85 MB once per mount site.
//
// HOW THE COUNT IS TAKEN, because the obvious way does not work. Vitest's module
// registry caches a `vi.mock` factory after its first evaluation, so counting
// factory invocations reports 1 however many times `import()` is called and
// would pass against a loader with no memo at all. The probe therefore counts
// accesses to the namespace's `default` GETTER, which happens exactly once per
// run of the loader's async body — which is the property under test.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const asset = vi.hoisted(() => ({
  reads: 0,
  fail: false,
  fc: { type: 'FeatureCollection', features: [] } as unknown,
}))

vi.mock('../assets/us-counties.json', () => {
  const ns = {}
  Object.defineProperty(ns, 'default', {
    get() {
      asset.reads += 1
      if (asset.fail) throw new Error('asset load failed')
      return asset.fc
    },
  })
  return ns
})

import * as geometry from './countyGeometry'
const { loadCountyGeometry, _resetCountyGeometryForTests } = geometry

beforeEach(() => {
  _resetCountyGeometryForTests()
  asset.reads = 0
  asset.fail = false
})

describe('loadCountyGeometry', () => {
  it('returns the parsed FeatureCollection', async () => {
    expect(await loadCountyGeometry()).toBe(asset.fc)
    expect(asset.reads).toBe(1)
  })

  it('a second call after resolution runs no second load (the module memo)', async () => {
    await loadCountyGeometry()
    await loadCountyGeometry()
    await loadCountyGeometry()
    expect(asset.reads).toBe(1)
  })

  it('CONCURRENT first calls share one Promise and one load (QA-01)', async () => {
    // The two-maps-in-one-session case: both hosts enable Counties before the
    // first import resolves. Without the in-flight Promise this parses twice.
    const [a, b, c] = await Promise.all([
      loadCountyGeometry(), loadCountyGeometry(), loadCountyGeometry(),
    ])
    expect(asset.reads).toBe(1)
    expect(a).toBe(b)
    expect(b).toBe(c)
  })

  it('the in-flight Promise is cleared, so a later call still returns the memo', async () => {
    await Promise.all([loadCountyGeometry(), loadCountyGeometry()])
    expect(await loadCountyGeometry()).toBe(asset.fc)
    expect(asset.reads).toBe(1)
  })

  it('a FAILURE is never memoized, so a retry loads again', async () => {
    // Same rule as the durable stores: an error is never cached. Memoizing the
    // rejection would leave the overlay permanently dead for the rest of the
    // session after one transient failure.
    asset.fail = true
    await expect(loadCountyGeometry()).rejects.toThrow('asset load failed')
    expect(asset.reads).toBe(1)
    asset.fail = false
    await expect(loadCountyGeometry()).resolves.toBe(asset.fc)
    expect(asset.reads).toBe(2)
    // ...and the success IS memoized from then on.
    await loadCountyGeometry()
    expect(asset.reads).toBe(2)
  })

  it('concurrent callers all observe a failure rather than one silently resolving', async () => {
    asset.fail = true
    const results = await Promise.allSettled([loadCountyGeometry(), loadCountyGeometry()])
    expect(results.map(r => r.status)).toEqual(['rejected', 'rejected'])
    expect(asset.reads).toBe(1)
  })

  it('exports no synchronous accessor (render purity, NFR-10)', () => {
    // A `getCountyGeometry()` sync read of module state would be a purity hazard
    // in a render body for no gain: each host keeps its own useState, which is
    // what makes React re-render. Pin the surface so one is not added casually.
    expect(Object.keys(geometry).sort()).toEqual(
      ['_resetCountyGeometryForTests', 'loadCountyGeometry'],
    )
  })
})
