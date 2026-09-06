// The Statistics tab's whole derivation chain, as ONE pure function.
//
// Every function it calls already existed in `birdingStats.ts` and is untouched
// here — three other surfaces (`MapExplorer`, `SpeciesDetail`, `lib/checklistsTab`)
// and `birdingStats.test.ts` depend on those signatures. What this module adds is
// the CHAIN: the order the Statistics tab ran them in as a cascade of `useMemo`s,
// lifted out of the component so the same chain can run in a worker
// (`statsWorker.ts`) or on this thread (the fallback), with no second copy of the
// wiring to keep in step.
//
// EVERYTHING IN AND OUT IS STRUCTURED-CLONE-SAFE, and that is a requirement rather
// than an observation: the whole point of lifting the chain is that it can cross a
// worker boundary. The inputs are plain data plus a `string[]`; the outputs are
// plain data plus two `Map`s (`accumulation*.milestones`, `effort.protocolComplete`),
// both of which structured clone carries. Nothing here may grow a function, a class
// instance, or a DOM value. `buildCoverIndex` is the one derivation on this tab that
// takes a function argument, which is why it stays in the component.
import type { ObservationEntry, ChecklistEntry } from '../types'
import {
  filterObservations, computeChecklists, computeLifeList, computeTopSpecies, computeTotals,
  computeAccumulation, computeTemporal, computeDurationBins, computeGeo, computeEffort,
  computeQuality, computeBreedingStats, computeFunStats,
} from './birdingStats'
import type { Granularity } from './birdingStats'

/**
 * The three inputs that change what the chain produces.
 *
 * `excludedNames` is a SORTED ARRAY rather than the `Set` its consumer wants, for
 * two reasons that both matter at the call site. It gives the request a total
 * order, so a stable content key can be derived from it — `useStatsBundle`
 * stringifies the sorted array and never decodes the result, which is the point
 * rather than a detail; see the content-key note there — and a provenance
 * snapshot that re-publishes an IDENTICAL escapee set therefore costs no
 * recompute at all (the pre-change memo, keyed on Set identity, re-ran on every
 * snapshot bump). And it makes the request a plain value, so the whole request
 * object is trivially clonable and trivially comparable. The `Set` is rebuilt
 * where it is used.
 */
export interface StatsRequest {
  includeSpuh: boolean
  granularity: Granularity
  excludedNames: readonly string[]
}

/**
 * One reply, one commit. Every figure the Statistics tab paints from the parsed
 * export is in here, so it lands in a single state update and the page never has a
 * partially-updated state it did not have before this change.
 *
 * `includeSpuh` and `granularity` are ECHOED BACK from the request, and they are
 * load-bearing rather than diagnostic: they are the values this data was computed
 * with, so the accumulation chart's branch and its tick formatters read them
 * instead of the live control state. That is what the component's `useDeferredValue`
 * pair used to approximate — the deferred value was a proxy for "the value the memo
 * consumed", and this is that value exactly.
 *
 * NOT in here, deliberately:
 *  - `projectChecklists` (`computeChecklists` over the RAW observations). It feeds
 *    `useChecklistProjects`, which CANCELS A RUNNING SWEEP when its checklist
 *    identity changes. A bundle field is a fresh array on every reply, so shipping
 *    it here would cancel an eight-minute pass on every toggle — the exact defect
 *    the projects denominator fix was about, reintroduced by the transport. It
 *    stays a component memo over `effectiveObs`, stable for the life of the export.
 *  - the ML, provenance, county and cover-index derivations, which are not
 *    functions of the observations alone.
 */
export interface StatsBundle {
  /** The request this was computed from — see the note above. */
  includeSpuh: boolean
  granularity: Granularity
  /** `filterObservations(...).length`, the denominator of the species-comment rate.
   *  The filtered ARRAY is 21k rows and has no other reader on the main thread. */
  filteredCount: number
  checklists: ChecklistEntry[]
  lifeList: string[]
  topSpecies: ReturnType<typeof computeTopSpecies>
  totals: ReturnType<typeof computeTotals>
  /** Both accumulation series, precomputed, selected at read — the escapee
   *  toggle's precompute-both shape (NFR-02), carried across the wire unchanged so
   *  "Count escapees" still invalidates nothing and issues no request. */
  accumulationAll: ReturnType<typeof computeAccumulation>
  accumulationCountable: ReturnType<typeof computeAccumulation>
  temporal: ReturnType<typeof computeTemporal>
  durationBins: ReturnType<typeof computeDurationBins>
  geo: ReturnType<typeof computeGeo>
  effort: ReturnType<typeof computeEffort>
  quality: ReturnType<typeof computeQuality>
  breedingStats: ReturnType<typeof computeBreedingStats>
  funStats: ReturnType<typeof computeFunStats>
}

/**
 * Every field of a bundle, as a table the COMPILER keeps exhaustive: adding a
 * field to `StatsBundle` and forgetting this line is a build error, not a hole in
 * the predicate below. A hand-written roster would go one behind the type the
 * first time someone added a section.
 */
const BUNDLE_FIELDS: Record<keyof StatsBundle, true> = {
  includeSpuh: true, granularity: true, filteredCount: true, checklists: true,
  lifeList: true, topSpecies: true, totals: true, accumulationAll: true,
  accumulationCountable: true, temporal: true, durationBins: true, geo: true,
  effort: true, quality: true, breedingStats: true, funStats: true,
}

/**
 * Is this actually a bundle?
 *
 * WHY A REPLY IS NOT TRUSTED ONCE ITS ID MATCHES. The worker protocol says a
 * reply carrying `ok: true` carries a bundle, and the shipped worker honours
 * that — but "the shipped worker honours it" is a claim about one file, and the
 * value arrives through `structuredClone` from another thread. A reply whose
 * `bundle` is missing or half-built resolves the request, reaches `setBundle`,
 * and leaves the tab on its "Computing your statistics…" spinner for the rest of
 * the session, because the component reads a falsy bundle as "not computed yet".
 * That is precisely the failure the settle contract exists to remove, arriving
 * one layer above it: the promise settled, and the tab hung anyway.
 *
 * So an unusable reply is a FAILED reply. The caller then computes on this
 * thread and paints the right figures, which is the same answer every other
 * failure path gives.
 *
 * The check is structural, not deep: the fields the render body reads must exist
 * and be the right kind of thing. It is not trying to detect a worker that
 * computed wrong numbers — nothing here could — only one that did not send a
 * bundle at all.
 */
export function isStatsBundle(value: unknown): value is StatsBundle {
  if (!value || typeof value !== 'object') return false
  const b = value as Record<string, unknown>
  for (const field of Object.keys(BUNDLE_FIELDS)) {
    if (b[field] === undefined || b[field] === null) return false
  }
  return typeof b.includeSpuh === 'boolean'
    && typeof b.granularity === 'string'
    && typeof b.filteredCount === 'number'
    && Array.isArray(b.checklists)
    && Array.isArray(b.lifeList)
}

/**
 * The chain, in the order the component's memo cascade ran it. Pure: same
 * observations plus same request in, same figures out, on either thread.
 *
 * Measured on the reference export (21,856 rows, 7.18 Mchar): 44-56 ms depending on
 * granularity and whether the escapee set is empty, and roughly linear in the row
 * count over a 16x size range.
 */
export function computeStatsBundle(
  observations: readonly ObservationEntry[],
  request: StatsRequest,
): StatsBundle {
  const { includeSpuh, granularity } = request
  // `filterObservations` wants a mutable array only because that is the shipped
  // signature; it never writes to it.
  const filtered = filterObservations(observations as ObservationEntry[], includeSpuh)
  const checklists = computeChecklists(filtered)
  const lifeList = computeLifeList(filtered)

  // Both series in one pass, exactly as the component's `accumulationPair` memo
  // did. With nothing excluded the second series IS the first, so an unresolved
  // provenance cache costs one comparison rather than a second full pass.
  const excluded = new Set(request.excludedNames)
  const accumulationAll = computeAccumulation(filtered, granularity)
  const accumulationCountable = excluded.size === 0
    ? accumulationAll
    : computeAccumulation(filtered, granularity, excluded)

  return {
    includeSpuh,
    granularity,
    filteredCount: filtered.length,
    checklists,
    lifeList,
    topSpecies: computeTopSpecies(filtered),
    totals: computeTotals(checklists, lifeList),
    accumulationAll,
    accumulationCountable,
    temporal: computeTemporal(checklists, filtered),
    durationBins: computeDurationBins(checklists),
    geo: computeGeo(checklists, filtered),
    effort: computeEffort(checklists),
    quality: computeQuality(filtered, checklists),
    breedingStats: computeBreedingStats(filtered),
    funStats: computeFunStats(filtered, checklists, observations as ObservationEntry[]),
  }
}

/**
 * The bundle for no observations at all.
 *
 * The Statistics tab paints a shell and a "Computing your statistics…" spinner
 * before the heavy work, and every `Math.max(...)` / `.length` / `.map()` in the
 * ready return runs during that pass. Before this change those read memos fed a
 * stable `EMPTY_OBS`; this is the same values by the same route, computed once at
 * module scope rather than per render, so the shell pass is byte-identical to
 * 1.0.19's and nothing in the render body has to learn about `null`.
 */
export const EMPTY_STATS_BUNDLE: StatsBundle = computeStatsBundle(
  [],
  { includeSpuh: false, granularity: 'total', excludedNames: [] },
)
