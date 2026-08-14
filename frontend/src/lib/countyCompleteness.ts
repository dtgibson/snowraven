// County Completeness — the pure core (schema.md, county-completeness).
//
// A third county-shading metric: the user's countable species recorded in a
// county (X, from the loaded backup) over everything eBird reports for that
// county all-time (Y, from /map/county-species). This module is the math +
// local-derivation half: X per county, the recent-new-in-county list, the FR-10
// display-percent rules, the FR-11 fixed 0–100% band mapping, and the FR-22
// targets subtraction. No network, no maplibre, no React — unit-tests without
// the map (the countyShading.ts posture).
//
// The Species/Checklists quantile path (computeCountyTiers) is NOT touched:
// completeness is a PARALLEL fixed-band path (FR-06) — a static band table, not
// data-driven breaks.

import type { ObservationEntry } from '../types'
import { isNonCountableForm, normalizeSpeciesName } from './speciesUtils'
import { countyKeyFromState } from './countyBoundaries'
import type { CountyMetric } from './countyShading'

/** Shared no-exclusion default (see buildCountyCompletenessLocal). */
const EMPTY_EXCLUDED: ReadonlySet<string> = new Set<string>()

/** The county shade metric union — the two shipped count metrics plus
 *  completeness. `CountyMetric` itself is deliberately unchanged (FR-06). */
export type CountyShadeMetric = CountyMetric | 'completeness'

/** OQ-02 default: recent new-in-county species shown in the popup. */
export const RECENT_NEW_COUNT = 5
/** OQ-03 default: target species shown in the popup. */
export const TARGETS_COUNT = 5

// ── Types (schema.md) ───────────────────────────────────────────────────────────

export interface FirstCountyRecord {
  /** Normalized (species-level) common name. */
  commonName: string
  scientificName: string
  /** YYYY-MM-DD — the EARLIEST record of this species in the county. */
  firstDate: string
}

/** Local, backup-derived per-county facts — available offline, no key. */
export interface CountyLocalCompleteness {
  /** eBird subnational1 code, e.g. "US-CA". */
  stateProvince: string
  /** Display county name. */
  county: string
  /** X: DISTINCT countable species (isNonCountableForm), subspecies collapsed. */
  countableCount: number
  /** Normalized DISTINCT countable common names (targets subtraction + code resolve). */
  countableNames: string[]
  /** Representative scientific name per countable common name — makes the batched
   *  /taxonomy/codes resolution robust to common-name drift. */
  sciByName: Record<string, string>
  /** By first-in-county date, newest first, capped at RECENT_NEW_COUNT. */
  recentNew: FirstCountyRecord[]
}

export interface EbirdSpecies { speciesCode: string; commonName: string }

/** The eBird payload for a county (the /map/county-species contract; cacheable). */
export interface CountyEbirdData {
  regionCode: string
  /** Y — species-level, comparable (FR-08/FR-09). */
  speciesCount: number
  /** Species-level, eBird taxonomic order (the targets pool, FR-22). */
  species: EbirdSpecies[]
}

export type CompletenessStatus =
  | 'ready'        // local + eBird combined (band may be 0 if X = 0)
  | 'loading'      // fetch in flight (FR-33)
  | 'offline'      // FR-30
  | 'no-key'       // FR-29
  | 'error'        // FR-31 server error
  | 'empty'        // eBird returned 0 species (FR-25)
  | 'unfetched'    // known but not yet fetched, or un-birded not yet requested
  | 'no-region'    // deriveCountyRegionCode === null (FR-18)

export interface TargetSpecies { speciesCode: string; commonName: string }

/** Light per-county view — cheap enough for the per-feature tier assignment and
 *  the "Counties in view" rows (no targets computation). */
export interface CountyCompletenessSummary {
  x: number
  y?: number
  /** FR-10 display value 0..100 — present only when y > 0. */
  percent?: number
  /** 0..10 — the fill/texture tier (0 = unshaded). */
  band: number
  status: CompletenessStatus
  /** True when the eBird half came from the persistent store (an earlier session). */
  fromCache: boolean
  /** ms epoch of the eBird fetch backing y (cache line). */
  fetchedAt?: number
  /** Classified degraded-state message (offline / no-key / error), when any. */
  message?: string
}

/** Combined, render-ready per-county result (the popup's shape). */
export interface CountyCompletenessResult extends CountyCompletenessSummary {
  recentNew: FirstCountyRecord[]
  /** min(x/y, 1) when y > 0 (the FR-09 clamp), else undefined. */
  ratio?: number
  /** FR-22 targets — present when eBird data is present. */
  targets?: TargetSpecies[]
  /** False → status 'no-region' (FR-18). */
  regionResolvable: boolean
}

/** The controller surface CountyLayer consumes (implemented by
 *  useCountyCompleteness). All reads are render-safe (no Date.now()). */
export interface CountyCompletenessView {
  summaryFor(stusps: string, name: string, geoid: string): CountyCompletenessSummary
  resultFor(stusps: string, name: string, geoid: string): CountyCompletenessResult
  /** Bounded eager fetch: birded, region-resolvable, non-fresh in-view counties (FR-13). */
  onViewportCounties(rows: { stusps: string; name: string; geoid: string }[]): void
  /** Explicit single-county fetch (click-to-fetch / retry; FR-14, FR-31). */
  requestCounty(stusps: string, name: string, geoid: string): void
  /** Popup-open hook: auto-fetch a BIRDED, unfetched county (un-birded stays button-gated). */
  ensureCountyForPopup(stusps: string, name: string, geoid: string): void
  /** Taxon code for a LOCAL (backup) species name — recent-new favicons. */
  codeFor(commonName: string): string | undefined
  hasKey: boolean | null
}

// ── Band mapping (FR-11 — fixed equal-width bands over 0–100%) ─────────────────

/** Static legend table: band 1 = (0,10%] … band 10 = (90,100%] (FR-27/OQ-06). */
export const COMPLETENESS_BANDS: { band: number; label: string }[] =
  Array.from({ length: 10 }, (_, i) => ({ band: i + 1, label: `${i * 10 + 1}–${(i + 1) * 10}%` }))

// FP guard: 0.3 * 10 can land epsilon-above an integer; the subtraction keeps a
// TRUE band boundary (exactly 10%, 20%, …) in its lower band. Bounded so it can
// never demote a genuinely-above-boundary ratio at real-world county scales
// (Y ≤ a few thousand ⇒ the smallest ratio step is far larger than 1e-9).
const BAND_EPSILON = 1e-9

/**
 * True ratio → band 0..10. `ratio <= 0` → 0 (unshaded); any positive ratio lands
 * in band ≥ 1 (a 1-of-300 county is visibly shaded, QA-10); ratio ≥ 1 → band 10.
 * Band assignment uses the TRUE ratio, never the rounded display percent (FR-11).
 */
export function completenessBand(ratio: number): number {
  if (ratio <= 0) return 0
  return Math.max(1, Math.min(10, Math.ceil(ratio * 10 - BAND_EPSILON)))
}

/**
 * FR-10 display percent (call only with y > 0):
 *   x = 0            → 0   (0% only when truly nothing recorded)
 *   x ≥ y            → 100 (100% only when truly complete; also the >100% clamp)
 *   otherwise round, but an incomplete county never shows 100 (→ 99) and a
 *   non-zero county never shows 0 (→ 1).
 */
export function completenessPercent(x: number, y: number): number {
  if (x === 0) return 0
  if (y > 0 && x >= y) return 100
  const r = Math.round((x / y) * 100)
  if (r >= 100) return 99
  if (r <= 0) return 1
  return r
}

// ── Local derivation (X + recent-new; offline, no key) ─────────────────────────

/**
 * Build the per-county local completeness map from the loaded backup, keyed by
 * `countyKey(stusps, name)` (FR-12 — never name-only). Countable = the forms
 * eBird counts toward a species list (`isNonCountableForm`, FR-07); subspecies
 * collapse via `normalizeSpeciesName`. `recentNew` ranks each county's species by
 * their FIRST in-county date, newest first (FR-21).
 */
export function buildCountyCompletenessLocal(
  observations: ObservationEntry[],
  /**
   * Normalized names classified eBird Exotic: Escapee. Applied to the NUMERATOR
   * (X) only, unconditionally and independent of the Statistics "Count escapees"
   * toggle (FR-34, FR-37).
   *
   * DELIBERATE ASYMMETRY, stated here rather than left silent (OQ-03): the
   * DENOMINATOR is eBird's own region species list, which we do not filter, so a
   * county's percentage is measured against a list that still contains whatever
   * exotics eBird publishes for the region. Filtering the denominator would mean
   * classifying every species on eBird's regional list, which is a different and
   * much larger question than classifying the birder's own. It is the same
   * approximation the metric already carries for spuh and slash names, and the
   * popup caption now says so in words.
   *
   * An empty set is a no-op returning byte-identical pre-feature numbers.
   */
  excludedNames: ReadonlySet<string> = EMPTY_EXCLUDED,
): Map<string, CountyLocalCompleteness> {
  interface Work {
    stateProvince: string
    county: string
    firstDates: Map<string, FirstCountyRecord> // by normalized name; firstDate = earliest
  }
  const work = new Map<string, Work>()

  for (const o of observations) {
    const key = countyKeyFromState(o.stateProvince, o.county)
    if (!key) continue
    const norm = normalizeSpeciesName(o.commonName)
    // Two rules, two inputs, deliberately: the form rule takes the RAW name
    // (the form eBird judges only exists there, so `norm` would lose
    // "Brewster's Warbler (hybrid)"), the escapee rule takes the NORMALIZED
    // name (its cache is keyed per species). They compose; neither replaces the
    // other (FR-05).
    if (isNonCountableForm(o.commonName) || excludedNames.has(norm)) continue
    let w = work.get(key)
    if (!w) {
      w = { stateProvince: o.stateProvince!, county: o.county!, firstDates: new Map() }
      work.set(key, w)
    }
    const rec = w.firstDates.get(norm)
    if (!rec) {
      w.firstDates.set(norm, { commonName: norm, scientificName: o.scientificName, firstDate: o.date })
    } else if (o.date < rec.firstDate) {
      rec.firstDate = o.date
    }
  }

  const out = new Map<string, CountyLocalCompleteness>()
  for (const [key, w] of work) {
    const records = [...w.firstDates.values()]
    // Newest first-in-county date first; name ties deterministic (FR-21).
    const recentNew = [...records]
      .sort((a, b) => (a.firstDate < b.firstDate ? 1 : a.firstDate > b.firstDate ? -1 : a.commonName.localeCompare(b.commonName)))
      .slice(0, RECENT_NEW_COUNT)
    const sciByName: Record<string, string> = {}
    for (const r of records) sciByName[r.commonName] = r.scientificName
    out.set(key, {
      stateProvince: w.stateProvince,
      county: w.county,
      countableCount: records.length,
      countableNames: records.map(r => r.commonName),
      sciByName,
      recentNew,
    })
  }
  return out
}

// ── Targets (FR-22 — OQ-01 floor: taxonomic order, one call) ───────────────────

/**
 * Countable species on the eBird county list and absent from the user's county
 * list, first `n` in taxonomic order. Subtraction is by species CODE (the
 * resolved user set) AND by normalized name (belt-and-braces so an unresolved
 * code can never surface an already-recorded species — QA-18). The pool is
 * already species-level, so spuh/slash/hybrid cannot appear.
 */
export function completenessTargets(
  ebirdSpecies: EbirdSpecies[],
  userCodes: ReadonlySet<string>,
  userNames: ReadonlySet<string>,
  n = TARGETS_COUNT,
): TargetSpecies[] {
  const out: TargetSpecies[] = []
  for (const s of ebirdSpecies) {
    if (userCodes.has(s.speciesCode)) continue
    if (userNames.has(normalizeSpeciesName(s.commonName))) continue
    out.push({ speciesCode: s.speciesCode, commonName: s.commonName })
    if (out.length >= n) break
  }
  return out
}

// ── Combine (pure assembly of the render-ready result) ─────────────────────────

export interface CombineOptions {
  status: CompletenessStatus
  fromCache: boolean
  regionResolvable: boolean
  fetchedAt?: number
  message?: string
  targetCount?: number
}

/**
 * Combine the local half and the eBird half into the render-ready result.
 * `ratio = min(x/y, 1)` (FR-09 — a user species eBird's list lacks still counts
 * in X but can never push the display above 100%); band from the true ratio.
 */
export function computeCompleteness(
  local: CountyLocalCompleteness | null,
  ebird: CountyEbirdData | null,
  userCountyCodes: ReadonlySet<string>,
  opts: CombineOptions,
): CountyCompletenessResult {
  const x = local?.countableCount ?? 0
  const recentNew = local?.recentNew ?? []
  const base: CountyCompletenessResult = {
    x,
    recentNew,
    band: 0,
    status: opts.status,
    fromCache: opts.fromCache,
    regionResolvable: opts.regionResolvable,
    fetchedAt: opts.fetchedAt,
    message: opts.message,
  }
  if (!ebird) return base
  if (ebird.speciesCount <= 0) {
    return { ...base, y: 0, targets: [] }
  }
  const y = ebird.speciesCount
  const ratio = Math.min(x / y, 1)
  const userNames = new Set(local?.countableNames ?? [])
  return {
    ...base,
    y,
    ratio,
    percent: completenessPercent(x, y),
    band: completenessBand(ratio),
    targets: completenessTargets(ebird.species, userCountyCodes, userNames, opts.targetCount ?? TARGETS_COUNT),
  }
}

// ── Cache line copy (popup footer; pure — caller supplies "now") ───────────────

export function cacheLineText(fetchedAt: number, nowMs: number): string {
  const days = Math.floor((nowMs - fetchedAt) / 86_400_000)
  if (days <= 0) return 'eBird data fetched just now, cached for 30 days'
  return `eBird data from ${days} day${days === 1 ? '' : 's'} ago, cached for 30 days`
}

// ── Date formatting for the popup's recent-new rows ────────────────────────────
// Lives here (not in the popup component file) so the component file stays
// component-only (react-refresh/only-export-components).

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-06-14" → "Jun 14" (pure; falls back to the raw string on a bad shape). */
export function monthDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  const month = MONTHS[parseInt(m[2], 10) - 1]
  return month ? `${month} ${parseInt(m[3], 10)}` : iso
}
