// The command palette's species index: the distinct common/scientific name pairs
// in the shared eBird parse (FR-22, FR-25, FR-30, NFR-02, NFR-11).
//
// DERIVED, IN MEMORY, AND IT DIES WITH THE PARSE. It comes from
// `loadEbirdObservations()` and nothing else: no network call, no second CSV
// walk, no new file, no persisted document, no `CACHED_GET_PATHS` entry and no
// `clearDerived.ts` row (FR-55, QA-53). That last one is structural rather than
// a preference -- the clear registry deletes DOCUMENTS FROM THE STORAGE SEAM,
// every one of its four rows ending in a `storage.deleteSetting`, and
// `cacheInventory.test.ts` pairs each row to an exported production purge. There
// is nothing on disk here to delete, so a fifth row would turn that guard red
// for a store that does not exist. The in-memory equivalent of a teardown is the
// `WeakRef` below, which needs no caller discipline and cannot be forgotten.
//
// Off the entry graph (NFR-01). Its only import is a TYPE import, which is
// erased at build and invisible to `entryChunk.test.ts`'s walker.

import type { ObservationEntry } from '../types'

export interface SpeciesIndexEntry {
  name: string
  sciName: string
}

/**
 * Order two species by common name, deterministically on EVERY platform.
 *
 * `<` / `>` on the lowercased string, NEVER `localeCompare`. FR-25 requires the
 * order to be "deterministic and identical on every platform", and
 * `localeCompare` is locale- and ICU-version-dependent across the six shipped
 * targets: JavaScriptCore with Apple ICU on macOS, iOS and iPadOS; V8 with
 * Chromium ICU on Windows, the web and the Pi. Bird names are full of hyphens
 * and apostrophes ("Bay-breasted Warbler", "Wilson's Warbler"), which is exactly
 * where those collations diverge. Code-unit comparison is identical everywhere.
 *
 * The tie-break on the RAW name matters: it makes the output depend only on the
 * SET of pairs and not on their arrival order in the CSV, which is the stronger
 * property and the one QA-24's "same order on two consecutive runs" is written
 * against.
 */
export function compareSpeciesName(a: SpeciesIndexEntry, b: SpeciesIndexEntry): number {
  const x = a.name.toLowerCase()
  const y = b.name.toLowerCase()
  if (x < y) return -1
  if (x > y) return 1
  if (a.name < b.name) return -1
  if (a.name > b.name) return 1
  return 0
}

/**
 * Build the index: one pass, de-duped, sorted. Pure, and unit-testable with no
 * component mounted (NFR-11).
 *
 * EVERY DISTINCT NAME the parse yields, including subspecies and other forms and
 * species that Species Detail hides at its defaults (FR-30). No countability
 * filter, no normalization, no `truncateAtFirstParen`: a user who names a
 * subspecies should reach it, and Species Detail's shipped v1.0.18 reveal does
 * the rest.
 *
 * The accumulator is a `Map`, never an object literal. The keys are CSV-derived
 * external strings, and `.claude/rules/security.md` requires `Object.create(null)`
 * or a `Map` on the write side (NFR-07, QA-62) -- so a row named `__proto__` or
 * `constructor` is an ordinary key here rather than a prototype write. The first
 * scientific name seen for a common name wins.
 */
export function buildSpeciesIndex(observations: ObservationEntry[]): SpeciesIndexEntry[] {
  const byName = new Map<string, SpeciesIndexEntry>()
  for (const o of observations) {
    const name = o.commonName
    if (!name) continue
    if (byName.has(name)) continue
    byName.set(name, { name, sciName: o.scientificName ?? '' })
  }
  return [...byName.values()].sort(compareSpeciesName)
}

// ── The memo ────────────────────────────────────────────────────────────────
//
// A module-scope single slot, keyed on the IDENTITY of the observations array
// rather than on the files epoch.
//
// WHY IDENTITY. `loadEbirdObservations` hands back the same `LoadedEbird` object
// for the whole life of its own cache and replaces it only through
// `clearEbirdObservationsCache()`. So the identity changes exactly when the
// parse changes: no epoch arithmetic, no stale window, and no way for the index
// to describe a file that is gone.
//
// WHY THE CAPACITY+1 RULE DOES NOT APPLY, because it is the first thing a
// reviewer will raise. `.claude/rules/testing.md` (v0.5.85) records that a
// one-slot memo is defeated by two ALTERNATING keys. That cannot happen here:
// there is at most one live observations array in the process, and the previous
// one is unreachable the moment the parse cache is replaced. Two keys cannot
// alternate, so there is no capacity+1 to measure.
//
// WHY `WeakRef` ON THE SOURCE AND A STRONG REFERENCE ON THE INDEX. Without it
// this module would hold a dead `ObservationEntry[]` -- tens of MB on a real
// export -- alive after the user clears their backup, and there is no teardown
// that reaches it (see the `clearDerived.ts` note above). With it the memo
// retains only the derived index (~1,000 small objects, bounded by the number of
// distinct species in one person's export), the source is collectable the
// instant `observationsCache` drops it, and a collected source simply means one
// rebuild. While the parse cache is warm, `deref()` returns the array, so the
// memo hits under exactly the condition it should.
//
// `WeakRef` AVAILABILITY IS CLEARED, by the same check `Object.hasOwn` needed:
// Safari 14.1 / Chrome 84, comfortably under `minimumSystemVersion: "16.0"`,
// `IPHONEOS_DEPLOYMENT_TARGET = 16.0`, and an evergreen WebView2.
// `.claude/rules/security.md` requires that check to be made explicitly at each
// such crossing; it is made here.

let memoSource: WeakRef<ObservationEntry[]> | null = null
let memoIndex: SpeciesIndexEntry[] | null = null

/** Build the index for `observations`, or hand back the one already built for it. */
export function speciesIndexFor(observations: ObservationEntry[]): SpeciesIndexEntry[] {
  if (memoIndex && memoSource?.deref() === observations) return memoIndex
  memoIndex = buildSpeciesIndex(observations)
  memoSource = new WeakRef(observations)
  return memoIndex
}

/**
 * Drop the memo. TEST SEAM ONLY -- there is no production teardown, and there is
 * deliberately no `clearDerived.ts` row calling this (see the header): the memo
 * is released by its own `WeakRef` when the parse cache lets the source go.
 */
export function _resetSpeciesIndexMemoForTests(): void {
  memoSource = null
  memoIndex = null
}
