// The county choropleth model: per-county aggregates (species / records totals +
// the contextual top-3 species and top-3 locations the popup shows) and the
// data-driven quantile tiers that map each county's value onto the green
// --sr-county-1..4 ramp. The structural twin of `lib/atlasBreeding.ts`. Pure +
// dependency-light so it unit-tests without the map.
//
// No point-in-polygon, ever (FR-09): geometry only draws and locates a county;
// the count comes from the CSV's own County / State columns, the same data the
// Statistics county tables read (parity — QA-09). Built once over the parse-once
// observations/checklists and memoized by the caller (NFR-01).

import type { ObservationEntry, ChecklistEntry } from '../types'
import { normalizeSpeciesName } from './speciesUtils'
import { countyKeyFromState } from './countyBoundaries'

export type CountyMetric = 'species' | 'records'

/** A county's top species (by record count) for the popup's Species-mode list. */
export interface CountyTopSpecies {
  /** Species-level common name (subspecies parenthetical stripped). */
  commonName: string
  scientificName: string
  /** Number of the user's observation records of this species in the county. */
  count: number
}

/** A county's top location (by checklist count) for the popup's Records-mode list. */
export interface CountyTopLocation {
  locationId: string
  name: string
  /** Number of the user's checklists at this location in the county. */
  count: number
}

export interface CountyAggregate {
  /** eBird subnational1 code, e.g. "US-CA". */
  stateProvince: string
  /** Display county name, e.g. "Sonoma". */
  county: string
  /** Distinct species recorded in the county. */
  species: number
  /** Checklist count in the county (the Statistics "by checklists" number). */
  records: number
  /** Top 3 species by record count (Species-mode popup). */
  topSpecies: CountyTopSpecies[]
  /** Top 3 locations by checklist count (Records-mode popup). */
  topLocations: CountyTopLocation[]
}

const TOP_N = 3

/** Bounded top-N by `count`, ties broken by `name` ascending (deterministic). */
function topByCount<T extends { count: number }>(items: T[], name: (t: T) => string, n = TOP_N): T[] {
  return [...items]
    .sort((a, b) => b.count - a.count || name(a).localeCompare(name(b)))
    .slice(0, n)
}

/**
 * Build the per-county aggregate map, keyed by `countyKey(stusps, name)`, from the
 * already-parsed backup. Self-contained over (observations, checklists) so the
 * caller needn't thread `computeGeo`; the species/records totals are computed with
 * the SAME keying/normalization computeGeo uses, so they match the Statistics
 * county tables (a parity test locks this — QA-09). US counties only (FR-26):
 * non-US rows get no key and are simply absent (→ unshaded).
 *
 * Each county also accumulates a species→record-count map and a location→
 * checklist-count map in the same passes, and emits the bounded top-3 of each —
 * the popup's contextual lists (D-03). No geometry, no point-in-polygon, no
 * network calls.
 */
export function buildCountyAggregates(
  observations: ObservationEntry[],
  checklists: ChecklistEntry[],
): Map<string, CountyAggregate> {
  interface Work {
    stateProvince: string
    county: string
    species: Set<string>
    records: number
    speciesCounts: Map<string, CountyTopSpecies>      // by normalized species name
    locationCounts: Map<string, CountyTopLocation>    // by locationId
  }
  const work = new Map<string, Work>()

  // checklists → records (checklist count) + per-location checklist counts.
  for (const c of checklists) {
    const key = countyKeyFromState(c.stateProvince, c.county)
    if (!key) continue
    let w = work.get(key)
    if (!w) {
      w = { stateProvince: c.stateProvince!, county: c.county!, species: new Set(), records: 0, speciesCounts: new Map(), locationCounts: new Map() }
      work.set(key, w)
    }
    w.records += 1
    let loc = w.locationCounts.get(c.locationId)
    if (!loc) { loc = { locationId: c.locationId, name: c.location, count: 0 }; w.locationCounts.set(c.locationId, loc) }
    loc.count += 1
  }

  // observations → distinct species + per-species record counts. Mirrors
  // computeGeo's `countySpecies.get(...)?.add(...)`: only counties already
  // established by a checklist accumulate (every obs has a submission, so in
  // practice this never drops anything).
  for (const o of observations) {
    const key = countyKeyFromState(o.stateProvince, o.county)
    if (!key) continue
    const w = work.get(key)
    if (!w) continue
    const norm = normalizeSpeciesName(o.commonName)
    w.species.add(norm)
    let s = w.speciesCounts.get(norm)
    if (!s) { s = { commonName: norm, scientificName: o.scientificName, count: 0 }; w.speciesCounts.set(norm, s) }
    s.count += 1
  }

  const out = new Map<string, CountyAggregate>()
  for (const [key, w] of work) {
    out.set(key, {
      stateProvince: w.stateProvince,
      county: w.county,
      species: w.species.size,
      records: w.records,
      topSpecies: topByCount([...w.speciesCounts.values()], s => s.commonName),
      topLocations: topByCount([...w.locationCounts.values()], l => l.name),
    })
  }
  return out
}

export function countyMetricValue(agg: CountyAggregate, metric: CountyMetric): number {
  return metric === 'species' ? agg.species : agg.records
}

/** The active metric's non-zero county values — the input to `computeCountyTiers`. */
export function nonZeroMetricValues(aggregates: Map<string, CountyAggregate>, metric: CountyMetric): number[] {
  const out: number[] = []
  for (const a of aggregates.values()) {
    const v = countyMetricValue(a, metric)
    if (v > 0) out.push(v)
  }
  return out
}

export interface CountyTiers {
  /** Upper bound of each class, strictly ascending; length = class count (0–10). */
  breaks: number[]
  /** value → tier 1..N (0 if the county has no record for the metric). */
  tierFor(value: number): number
  /** Per-tier inclusive [min,max] for the legend (integer counts). */
  legend: { tier: number; min: number; max: number }[]
}

/** Number of classes in the county choropleth — the green --sr-county-1..N ramp.
 *  Quantile (equal-count) breaks over the user's own counts, so adjacent
 *  well-birded counties separate instead of all landing in one coarse top class. */
export const COUNTY_CLASS_COUNT = 10

/**
 * Data-driven quantile tiers over the user's own non-zero county values for the
 * active metric, mapped onto up to `maxClasses` classes (the green ramp has 10).
 * Ties / small datasets collapse to FEWER classes — never empty or duplicate
 * ranges (FR-11). Zero non-zero counties → empty breaks/legend and a tierFor that
 * always returns 0 (FR-14: the layer draws no fills, the control shows the honest
 * "nothing to shade" note).
 */
export function computeCountyTiers(nonZeroValues: number[], maxClasses = COUNTY_CLASS_COUNT): CountyTiers {
  const positive = nonZeroValues.filter(v => v > 0).sort((a, b) => a - b)
  if (positive.length === 0) {
    return { breaks: [], tierFor: () => 0, legend: [] }
  }
  const distinct = new Set(positive).size
  const k = Math.min(maxClasses, distinct)
  const n = positive.length

  // Equal-count (quantile) upper bounds: the value at each i/k cut of the sorted
  // distribution. The last bound is always the maximum.
  const rawBreaks: number[] = []
  for (let i = 1; i <= k; i++) {
    const idx = Math.min(Math.ceil((i * n) / k) - 1, n - 1)
    rawBreaks.push(positive[idx])
  }
  // Dedupe to a strictly-ascending set (ties collapse classes).
  const breaks: number[] = []
  for (const b of rawBreaks) if (breaks.length === 0 || b > breaks[breaks.length - 1]) breaks.push(b)

  const min0 = positive[0]
  const legend = breaks.map((upper, i) => ({
    tier: i + 1,
    min: i === 0 ? min0 : breaks[i - 1] + 1,
    max: upper,
  }))

  const tierFor = (value: number): number => {
    if (value <= 0) return 0
    for (let i = 0; i < breaks.length; i++) if (value <= breaks[i]) return i + 1
    return breaks.length // above the max — not present in the data, defensive
  }

  return { breaks, tierFor, legend }
}

/** Legend title + unit per metric (used by the sidebar legend). */
export const COUNTY_METRIC_META: Record<CountyMetric, { title: string; unit: string; label: string }> = {
  species: { title: 'Distinct species per county', unit: 'species', label: 'Species' },
  records: { title: 'Total checklists per county', unit: 'checklists', label: 'Checklists' },
}
