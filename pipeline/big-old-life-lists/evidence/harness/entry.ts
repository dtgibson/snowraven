// Harness entry for the big-old-life-lists measurement. Bundled by
// build-harness.sh into one script that runs unchanged in Node (V8), the
// macOS jsc shell (JavaScriptCore, the engine of the Mac, iPhone and iPad
// apps) and a browser page. It exposes the SHIPPED parse and stats code, so
// what is timed and weighed is the code the app runs, not a copy of it.
import { parseEbirdObservations } from '../../../../frontend/src/lib/parseEbirdObservations'
import { computeStatsBundle } from '../../../../frontend/src/lib/statsBundle'

const g = globalThis as unknown as Record<string, unknown>
g.SRH = {
  parseEbirdObservations,
  computeStatsBundle,
  defaultRequest: { includeSpuh: false, granularity: 'total', excludedNames: [] },
}
