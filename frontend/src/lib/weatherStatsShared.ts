// The publication point for the weather derivation (species-detail-weather).
//
// ONE DERIVATION, TWO SURFACES. `computeWeatherStats` stays the only weather
// aggregation in `frontend/src`. Statistics reads its variant out of
// `bundle.weather` exactly as it ships; the Species Detail card reads the
// all-forms variant out of this module. Two invocations of one function, two
// stated bases -- and on the reference export the two print identical figures
// for all 158 species Statistics can offer (the divergence is entirely the
// eleven rows that exist only under all-forms, every one of them a
// non-countable form).
//
// WHY NOT THE STATS WORKER BUNDLE, which is the obvious move and is the brief's
// second kill criterion wearing a hat: `bundle.weather` exists only after the
// Statistics tab has been mounted and painted, so on a device where Statistics
// has never been opened the card would be silently absent. A "read the bundle if
// it exists, else compute" hybrid is worse than either half -- the same bird on
// the same export would print two different cards depending on browsing history
// AND on another tab's Count all forms switch. This module therefore imports
// neither `statsBundle.ts`, `statsOffThread.ts`, `useStatsBundle.ts`,
// `transport.ts` nor `storage.ts`. There is no cached-answer path, so there is
// no "missing" branch to fall into.
//
// WHY NOT A WORKER OF ITS OWN, on this repo's own numbers: `statsOffThread.ts`
// records a 34 ms round trip for the ~21k-row structuredClone, ~17 ms of it
// unbreakable main-thread serialization, and 19.2 MB held in worker heap. That
// is ~17 ms of main-thread time and 19.2 MB spent to move 15.67 ms of
// main-thread time -- a loss on both axes. The v1.0.20 rule says that trade is
// taken on measurement; taken here, it fails.
//
// NOTHING IS PERSISTED AND THERE IS NO `clearDerived.ts` ROW, structurally
// rather than as an omission: every row in that registry is a durable DOCUMENT
// on disk whose purge ends in a `storage.deleteSetting`, and
// `cacheInventory.test.ts` pairs each row to an exported production purge. There
// is nothing on disk here, so a row would turn that guard red for a store that
// does not exist. `cacheInventory.test.ts` is unchanged by this work. The
// in-memory equivalent of a teardown is the `WeakRef` below.
//
// COST, measured on the reference export (21,856 rows, 3,300 checklists, 392
// readable blocks) on a quiet machine, Node v24.18.0, median of nine, recorded
// here the way `statsBundle.ts` records its own chain:
//
//   filterObservations(obs, true)      0.00 ms   (returns the input array itself)
//   computeChecklists(obs)             4.72 ms   (4.58 - 5.22)
//   computeWeatherStats(cl, obs)       9.29 ms   (9.02 - 10.39)
//   cold seam, gate included          15.67 ms   (14.81 - 16.68)
//   warm memo hit                      0.000 ms  (n=15)
//   export with no weather block       0.570 ms  (gate short-circuits the rest)
//   per species change                 0.00084 ms
//
// 15.67 ms against NFR-01's 20 ms budget is 1.28x, NOT the 2x this repo's own
// testing rules call margin. THAT IS WHY THE SCHEDULING IS PART OF THE
// REQUIREMENT: `useExportWeather` runs this in an effect, after paint, in its
// own task. A `useMemo` would meet the budget on the development Mac and break
// it on a Raspberry Pi.

import type { ObservationEntry } from '../types'
import { hasRaincrowWeatherBlock, hasSnowravenWeatherBlock } from './commentBlocks'
import { computeChecklists, filterObservations } from './birdingStats'
import { normalizeSpeciesName } from './speciesUtils'
import { computeWeatherStats } from './weatherStats'
import type { WeatherStats } from './weatherStats'

/**
 * Does this export carry ANY attributed weather block?
 *
 * THE GATE, and it is what makes "a user with no weather blocks pays nothing for
 * this feature" a measured statement rather than a hope: 0.570 ms end to end
 * against 6.29 ms without it, and no card component is imported at all.
 *
 * IT USES THE IDENTICAL PREDICATE `computeWeatherStats` USES for its attribution
 * gate, but that makes the relationship an IMPLICATION IN ONE DIRECTION, not an
 * equivalence, and the difference matters to whoever reads the card's absent
 * branch next. What holds:
 *
 *     weatherStatsFor(obs).foundCount > 0   ==>   hasAnyWeatherBlock(obs)
 *
 * The gate therefore never misses an export the aggregate would find, which is
 * the direction that would cost something: a false negative would hide the card
 * on a file that has data. The CONVERSE does not hold, and the diverging shape
 * is concrete and reproducible. The two disagree about WHICH row of a submission
 * speaks for it: this gate skips falsy comments before marking the submission
 * seen, so it tests the first NON-EMPTY comment, while `computeChecklists` rolls
 * a submission up on `firstRowBySub` and takes `checklistComments ?? ''`, so it
 * tests the first row whatever that row holds. Give a submission an empty or
 * `undefined` `checklistComments` on its first row and a real block on a later
 * one, and the gate answers true while `foundCount` is 0. (A first row carrying
 * non-block PROSE does not diverge: the gate marks the submission seen on that
 * comment and never reaches the later row.)
 *
 * eBird's own export replicates the checklist-level column onto every row, so
 * reaching this needs a hand-edited or third-party-generated CSV -- which is
 * exactly the input class this project treats as untrusted, and the reason it is
 * written down rather than dismissed.
 *
 * THE OVER-ADMISSION IS CLOSED BY THE CARD, NOT HERE, and deliberately so:
 * `SpeciesWeatherCard`'s `if (state === 'absent') return null` is what makes the
 * benign direction benign. Making this a true equivalence would mean moving the
 * `seen` insert after the predicate call so every row of a submission is tested,
 * which changes the gate's cost profile on hostile input and would need the
 * growth check re-run; the guard is cheaper and truer.
 *
 * LINEARITY. One pass, one `Set` add per row, at most one predicate call per
 * distinct submission, returning on the first hit. It introduces no regex of its
 * own (both predicates are shipped and already length-bounded, guarded by
 * `commentBlocksRegexBound.test.ts`) and contains no `includes`, `indexOf` or
 * `find` over an export-derived needle. The accumulator is a `Set`, never an
 * object literal, so a `submissionId` of `__proto__` is an ordinary key -- the
 * `Set` is what makes that a property rather than an argument about eBird's id
 * format.
 */
export function hasAnyWeatherBlock(observations: readonly ObservationEntry[]): boolean {
  const seen = new Set<string>()
  for (const o of observations) {
    const comment = o.checklistComments
    if (!comment) continue
    if (seen.has(o.submissionId)) continue
    seen.add(o.submissionId)
    if (hasSnowravenWeatherBlock(comment) || hasRaincrowWeatherBlock(comment)) return true
  }
  return false
}

// ── The memo ────────────────────────────────────────────────────────────────
//
// A module-scope single slot keyed on the IDENTITY of the observations array,
// following `lib/speciesIndex.ts` exactly: a `WeakRef` on the source, strong
// references on the two derived values.
//
// WHY IDENTITY. `loadEbirdObservations` hands back the same array for the whole
// life of its own cache and replaces it only when the parse changes, so the
// identity changes exactly when the file does: no epoch arithmetic, no stale
// window, and no way for the memo to describe a file that is gone. DO NOT add a
// `useFilesEpoch` subscription here -- identity already carries the signal, and
// an epoch would be a second, weaker source of truth for the same fact.
//
// WHY THE CAPACITY+1 RULE DOES NOT APPLY. That rule is about a one-slot memo
// defeated by two ALTERNATING keys. There is at most one live observations array
// in the process and the previous one is unreachable the moment the parse cache
// replaces it, so two keys cannot alternate and there is no capacity+1 to
// measure.
//
// THE STATED RESIDUAL, smaller than its precedent's: a `WeakRef`'d memo still
// holds its derived values strongly after the source is collectable. Here those
// are bounded by the BAND and SPECIES counts, never the row count -- 169 species
// rows of 18 small integers, 27 band rows, and one name-to-count map over the
// export's distinct species -- a few tens of KB on the reference export,
// replaced on the next call. Not zero, not persisted.

let memoSource: WeakRef<ObservationEntry[]> | null = null
let memoStats: WeatherStats | null = null
let memoOwnChecklists: ReadonlyMap<string, number> | null = null

/** Point the slot at `observations`, dropping anything derived from another
 *  array. One key for both derived values, which is what makes them a single
 *  observations-identity memo rather than two that can disagree about which
 *  export they describe. */
function keyOn(observations: ObservationEntry[]): void {
  if (memoSource?.deref() === observations) return
  memoSource = new WeakRef(observations)
  memoStats = null
  memoOwnChecklists = null
}

/**
 * The whole-export weather aggregate for `observations`, computed once per
 * export.
 *
 * IT TAKES ONE ARGUMENT, AND THAT IS THE POINT. There is no `includeSpuh`
 * parameter to thread, no options object and no default to override; the `true`
 * below is a literal on the `filterObservations` line, in a module that imports
 * no React and reads no state. A caller CANNOT pass a control value into it,
 * because there is no parameter that would accept one -- the difference between
 * "the call site happens to pass true" and "the call site has nothing else it
 * could pass", and the reason the seam owns the call rather than the card.
 *
 * The all-forms variant is the only one in which every species the tab can offer
 * has a row, its denominators really are every checklist in the export (which is
 * what the row's own sentence claims), and it costs nothing to select:
 * `filterObservations(obs, true)` returns the input array itself, verified by
 * identity comparison rather than inferred from the source.
 *
 * A LEANER CHECKLIST ROLLUP WOULD SAVE THE 4.72 ms AND IS FORBIDDEN. A second
 * rollup that agrees with `computeChecklists` today is a second rollup that will
 * disagree later -- on the dedupe key, on the `speciesCount` normalizer, on the
 * `checklistComments ?? ''` fallback -- and the disagreement would surface as two
 * different coverage lines for one export.
 */
export function weatherStatsFor(observations: ObservationEntry[]): WeatherStats {
  keyOn(observations)
  if (memoStats === null) {
    const all = filterObservations(observations, true)
    memoStats = computeWeatherStats(computeChecklists(all), all)
  }
  return memoStats
}

/**
 * Normalized common name -> the number of DISTINCT SUBMISSIONS the species is
 * on, over the raw unfiltered parse.
 *
 * This is the second whole in the card's opening block, and it is a
 * distinct-submission count rather than a row count: a checklist carrying both
 * the parent and a form contributes 1, not 2. `normalizeSpeciesName` is applied
 * on BOTH sides of the eventual lookup, so numerator and denominator fold forms
 * into the parent on exactly the same basis.
 *
 * EXPORT-WIDE AND ALL-FORMS BY CONSTRUCTION. The county and date filters touch
 * only Species Detail's own `speciesObs`, never this array, and
 * `filterObservations(obs, true)` is a passthrough -- so the raw parse IS the
 * all-forms set. That satisfies the card's stated basis with no payload change,
 * no new field on `WeatherStats.species`, and no seam change.
 *
 * ONE PASS, NEVER PER SPECIES. A per-species scan over 21,856 rows inside the
 * selection gesture is the thing NFR-02 forbids, however small it looks. The
 * transient pair `Set` is what makes the count distinct-by-submission in that
 * one pass, and it is a `Set` and two `Map`s rather than object literals for the
 * reason the v1.0.22 crash records: a species named `__proto__` is an ordinary
 * key here.
 *
 * THE PAIR KEY IS THE SPECIES' INDEX AND NOT ITS NAME, which is the shipped
 * `computeWeatherStats` pattern and is injective by construction rather than by
 * a premise about eBird's data. An index is digits, so it can never contain the
 * separator, so `${si}|${submissionId}` separates unambiguously at its first
 * `|` whatever the submission id turns out to hold. Joining the NAME instead is
 * the lossy-key shape `useStatsBundle`'s own header records: nothing enforces
 * that a common name cannot contain the separator, and `streamCsvRows` admits
 * far stranger things inside a quoted field.
 */
export function speciesChecklistCountsFor(observations: ObservationEntry[]): ReadonlyMap<string, number> {
  keyOn(observations)
  if (memoOwnChecklists === null) {
    const counts = new Map<string, number>()
    const indexByName = new Map<string, number>()
    const seenPairs = new Set<string>()
    for (const o of observations) {
      const name = normalizeSpeciesName(o.commonName)
      let si = indexByName.get(name)
      if (si === undefined) { si = indexByName.size; indexByName.set(name, si) }
      const pair = `${si}|${o.submissionId}`
      if (seenPairs.has(pair)) continue
      seenPairs.add(pair)
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    memoOwnChecklists = counts
  }
  return memoOwnChecklists
}

/**
 * Drop the memo. TEST SEAM ONLY.
 *
 * There is no production teardown and there is deliberately no
 * `clearDerived.ts` row calling this: the memo is released by its own `WeakRef`
 * when the parse cache lets the source go. Shipping a `_reset*ForTests` seam as
 * a clear path looks correct in a test and clears nothing -- it detaches the
 * in-memory slot and there is no document behind it to delete.
 */
export function _resetWeatherStatsMemoForTests(): void {
  memoSource = null
  memoStats = null
  memoOwnChecklists = null
}
