// The ONE load site for the bundled US county geometry
// (county-shading-and-project-stats, FR-01, FR-02).
//
// Until this module, the only load site was MapExplorer's own
// `await import('../assets/us-counties.json')` cached in that component's
// `useState`. A per-mount state cache cannot serve three mount sites: two
// components enabling Counties in one session would each import and each parse
// 3.85 MB. The module-scope memo below prevents the second PARSE; each host
// still keeps its own `useState<CountyFC | null>` for the re-render.
//
// DEPENDENCY-FREE AT RUNTIME BY CONSTRUCTION. The only import is a TYPE import,
// erased at build, so this module can sit in `entryChunk.test.ts`'s App-graph
// negatives without dragging `countyBoundaries.ts` behind it (the same
// extraction discipline `lib/rateLimit.ts` records). Every call site reaches it
// through `await import('../lib/countyGeometry')`, which is what keeps the
// geometry two dynamic hops from any host.
//
// It THROWS; it does not swallow. Each call site keeps its own
// `try/catch → leave data null`, which is exactly what MapExplorer already did,
// and is what makes "rendered output, loading copy and first-enable timing
// unchanged" true by construction rather than by inspection.
//
// NO SYNCHRONOUS ACCESSOR is exported. A render-time read of module state would
// be a purity hazard (NFR-10) for no gain.

import type { CountyFC } from './countyBoundaries'

let _geometry: CountyFC | null = null
let _inflight: Promise<CountyFC> | null = null

/**
 * Parse the US county geometry once per session. Concurrent first calls share
 * ONE Promise and ONE dynamic import (FR-01).
 *
 * A FAILURE IS NEVER MEMOIZED: `_geometry` is written only on success and
 * `_inflight` is cleared in a `finally`, so a retry re-imports. Same rule as the
 * durable stores' errors-never-cached contract.
 */
export async function loadCountyGeometry(): Promise<CountyFC> {
  if (_geometry) return _geometry
  if (_inflight) return _inflight
  _inflight = (async () => {
    const mod = await import('../assets/us-counties.json')
    const data = ((mod as { default?: unknown }).default ?? mod) as unknown as CountyFC
    _geometry = data
    return data
  })()
  try {
    return await _inflight
  } finally {
    _inflight = null
  }
}

/** Test seam: drop the memo and any in-flight Promise. */
export function _resetCountyGeometryForTests(): void {
  _geometry = null
  _inflight = null
}
