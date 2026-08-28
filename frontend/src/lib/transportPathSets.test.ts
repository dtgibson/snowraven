// PATH-SET HYGIENE (county-shading-and-project-stats, FR-28, QA-29).
//
// `/checklists/{id}` is deliberately absent from BOTH transport path sets, and
// each absence has its own reason:
//
//   CACHED_GET_PATHS  — the durable stores own this path's caching
//                       (exoticProvenanceCache 30 d, checklistProjectsCache
//                       365 d). A second 90 s layer would only shadow them:
//                       ONE caching layer per call.
//   EBIRD_GATED_PATHS — the projects sweep is this path's own enforcement point
//                       over the SAME shared gate state. One request gets
//                       exactly one enforcement point: never neither, never
//                       both.
//
// Assert the absence IN THE FORM THE DEFECT WOULD RETURN IN. Both sets are
// matched with `Set.has(path)` on the exact path string, so a well-meaning
// addition cannot be the literal `/checklists/{id}` — it would be a PREFIX
// (`/checklists`) or a specific id. Testing only `has('/checklists/')` would
// therefore pass against the very change it exists to reject.
//
// The sets are read as real exports rather than scanned as source text: a
// source-text guard cannot see a member added through a variable (the
// cacheInventory.test.ts caveat, resolved here in favour of the real export).

import { describe, it, expect } from 'vitest'
import { CACHED_GET_PATHS, EBIRD_GATED_PATHS } from './transport'

const SETS: Array<[string, Set<string>]> = [
  ['CACHED_GET_PATHS', CACHED_GET_PATHS],
  ['EBIRD_GATED_PATHS', EBIRD_GATED_PATHS],
]

describe('transport path sets exclude the checklist path (FR-28)', () => {
  it.each(SETS)('%s holds no member on the /checklists prefix', (_name, set) => {
    expect([...set].some(p => p.startsWith('/checklists'))).toBe(false)
  })

  it.each(SETS)('%s does not contain the literal path, its prefix, or an id form', (_name, set) => {
    for (const candidate of ['/checklists', '/checklists/', '/checklists/{id}', '/checklists/S12345678']) {
      expect(set.has(candidate)).toBe(false)
    }
  })

  // Non-vacuity: an emptied or renamed set would pass every assertion above.
  // These pin that the sets are the real, populated ones, so the absences are
  // evidence rather than an absence of evidence.
  it('both sets are the real populated sets, so the absences above mean something', () => {
    expect(CACHED_GET_PATHS.size).toBeGreaterThanOrEqual(3)
    expect(EBIRD_GATED_PATHS.size).toBeGreaterThanOrEqual(4)
    for (const p of ['/map/hotspots', '/map/recent-obs', '/map/hotspot-region']) {
      expect(CACHED_GET_PATHS.has(p)).toBe(true)
    }
    for (const p of ['/map/hotspots', '/map/recent-obs', '/map/hotspot-region', '/map/county-species']) {
      expect(EBIRD_GATED_PATHS.has(p)).toBe(true)
    }
  })

  it('/map/hotspot-activity stays out of the gated set (one enforcement point)', () => {
    // The shipped precedent for the same rule the sweep follows: the activity
    // controller enforces the identical contract for that route over the same
    // shared state, so transport-gating it too would be the "never both" half.
    expect(EBIRD_GATED_PATHS.has('/map/hotspot-activity')).toBe(false)
    expect(CACHED_GET_PATHS.has('/map/hotspot-activity')).toBe(false)
  })

  it('/map/county-species stays out of the short-TTL cache (its durable store owns it)', () => {
    expect(CACHED_GET_PATHS.has('/map/county-species')).toBe(false)
  })
})
