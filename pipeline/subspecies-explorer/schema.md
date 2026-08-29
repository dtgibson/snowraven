# Schema - Subspecies Explorer

**Feature:** subspecies-explorer
**Date:** 2026-08-29
**Stage:** 3 - The Architect
**Path:** Frontend Only - no data layer changes required

## Path

**Frontend Only.** This is an established project (Incremental would apply if any
store changed, but none does). The app's data layer is the user's eBird backup CSV,
parsed in memory into `ObservationEntry[]` and shared across tabs through a
module-level parse cache; durable state lives in JSON documents behind the storage
seam, not a database. This feature reads the already-parsed rows, computes derived
tallies in memory, and persists nothing. Checked against every FR: no new records,
no new reads beyond fields already parsed, no new endpoint, no new stored document,
no new setting. The PRD's Out of Scope list itself excludes persisting the
explorer's open state or any new cache document, and FR-06 makes the open state
explicitly ephemeral.

## Confirmation

Assessed against the PRD: no database changes, no migrations, no new tables or
columns, no new persisted documents, and no new network paths are needed.

Explicitly, for downstream verification:

- **No migrations.** There is no database in this app; nothing to migrate.
- **No new stores.** No new file behind `storage.ts`, no new cache document, no
  `localStorage`, no change to `CACHED_GET_PATHS`, `EBIRD_GATED_PATHS`, or the
  replay store. The storage seam is untouched.
- **No new network paths.** No new backend route, no Vite proxy addition, no
  transport change. The taxonomy-order call the species selector already makes
  (`transport.post('/taxonomy/codes', ...)` in `SpeciesDetail.tsx`) is existing
  page behavior the explorer merely inherits ordering from; the explorer itself
  adds zero requests, satisfying NFR-01 as verifiable at the transport seam.
- **No backend change at all.** The entire feature is frontend derivation plus UI.

## The FR-13 verification (load-bearing finding)

**The Planner's assumption does NOT hold.** FR-13 assumes the default merged
view's per-species aggregate excludes non-countable variant rows. It does not.

The verified truth, from the real code:

- `frontend/src/components/SpeciesDetail.tsx`, `speciesObs` memo (around line 317):
  in merged mode the aggregate is
  `phase.observations.filter(o => normalizeSpeciesName(o.commonName) === selectedSpecies)`,
  then the county/date filter. **There is no `isNonCountableForm` exclusion.**
- The Sightings section's "Checklists" figure (around line 833) is
  `sightingsStats.total`, which `computeSightingsStats` in
  `frontend/src/lib/speciesStats.ts` defines as `speciesObs.length`.
- Therefore a non-countable row whose trailing parenthetical folds to the selected
  species (the PRD's own example: an undescribed form of that species) IS counted
  in the merged Sightings figure, while FR-02 forbids it from the breakdown's rows
  and denominator. The component's own comment (around line 238) documents the
  shape: "Brewster's Warbler (hybrid)" collapses under merge to a key that reads
  exactly like a species.

Consequence: for any view containing at least one non-countable row folding to the
selected species, the breakdown total defined by FR-02/FR-11 is strictly less than
the Sightings Checklists figure. QA-13's pass condition as written ("the breakdown
total equals the Sightings section's Checklists figure") is unsatisfiable on such a
fixture without violating FR-02. FR-13 itself anticipated this and mandates
surfacing the conflict rather than silently changing either number; this document
is that surface, and the hand-back flags it for the gate.

**Design response (the exact identity to build and test):** the breakdown
computation also tallies the excluded rows, so the relationship becomes a testable
invariant instead of a fuzzy parity claim:

```
breakdown.total + breakdown.nonCountableCount === speciesObs.length
                                              === Sightings "Checklists" figure
```

QA-13 should be restated to assert this identity, with equality of the two
displayed figures holding exactly when `nonCountableCount === 0` (the overwhelmingly
common case; most exports contain no non-countable name that folds to a plain
species). The existing merged view is not changed (FR-21); the breakdown does not
absorb the non-countables (FR-02). Both numbers stay honest and the delta is
accounted for.

## Existing data used by this feature

### The in-memory parsed backup (the only data source)

- **Where it lives:** `frontend/src/lib/observationsCache.ts` holds a module-level
  cache `{ text, observations }` of the parsed eBird backup, populated via
  `loadEbirdObservations()` (parsing off-thread in
  `frontend/src/lib/observationsWorker.ts`, falling back to synchronous
  `parseEbirdObservations`). It is invalidated by `clearEbirdObservationsCache()`
  when the stored file changes. Species Detail receives it as
  `phase.observations` on its ready phase (`SpeciesDetail.tsx`, auto-load effect
  around line 190). **A new upload produces a new array reference**, which is what
  FR-22's full recomputation keys on.
- **Row type:** `ObservationEntry` in `frontend/src/types.ts` (line 57). Fields
  this feature reads:
  - `commonName` - the RAW reported name, trimmed but untruncated
    (`parseEbirdObservations.ts` line 97). This is the input to both
    classification and folding.
  - `date` - `YYYY-MM-DD` string, compared lexically by the existing filters.
  - `county` - `string | null`, compared by equality to the county filter.
  - Nothing else is needed. `submissionId`, counts, and coordinates are not
    inputs; the percentage basis is observation rows (one CSV row is one report,
    FR-09), which is array length, not any field.

### The shared fold and countability rule (reuse, never reinvent)

- **Fold from raw form name to parent species:** `normalizeSpeciesName` in
  `frontend/src/lib/speciesUtils.ts` (line 217). Strips one trailing
  parenthetical ("Dark-eyed Junco (Oregon)" to "Dark-eyed Junco"), memoized with
  bounded admission-controlled caches. This is the exact fold the merged view
  already uses, which is what makes the parity identity above exact.
  **Not** `truncateAtFirstParen` (line 268) - that is the CSV parsers' first-paren
  cut and deliberately a different function; using it here would break parity.
- **Countability:** `isNonCountableForm` in `frontend/src/lib/speciesUtils.ts`
  (line 450), applied to the RAW `commonName`. Its taxonomy-backed sets plus the
  shape rule are the single source of the FR-01 classification (ISSF groups,
  intergrades, domestic types countable; hybrids, spuhs, slashes, undescribed
  forms not). NFR-06 prohibits any new classification rule; none is introduced.

### Species Detail page state the feature composes with

All in `frontend/src/components/SpeciesDetail.tsx`:

- `selectedSpecies: string | null` (line 86) - in merged mode this is a
  normalized species name.
- `mergeSubspecies: boolean` (line 88, default `true`) - merged mode is
  `mergeSubspecies === true`; the "Show subspecies" toggle renders as
  `checked={!mergeSubspecies}`. FR-19: the explorer control and breakdown render
  only when `mergeSubspecies` is true (and phase is ready).
- `showSpuh: boolean` (line 89) - the "Show all forms" toggle. It must not be an
  input to any explorer computation (FR-20); the contracts below take no such
  parameter, making inertness structural.
- `countyFilter: string | null` (line 91) and
  `dateRange: { from: string; to: string }` (line 92, empty string means
  unbounded) - the filters. The breakdown does NOT re-implement them: it consumes
  the existing `speciesObs` memo (line 317), which already applies exactly these
  filters to exactly the merged row set. FR-14 filter parity with the other
  sections is then true by construction, not by duplication.
- `sortedSpeciesList` (memo at line 232) - the selector's order (taxonomic via
  `taxonOrders` when the existing `/taxonomy/codes` response has arrived,
  alphabetical fallback otherwise). FR-05's list order is defined as this order,
  restricted to qualifying species. Note FR-16 is already satisfied by the
  existing selector: in merged mode keys are normalized names, so a species
  recorded only as forms still has a selectable key, and `countableKeys` includes
  it because its form is countable.
- `selectSpecies(name)` (line 118) - the selection path FR-06 requires; choosing
  from the explorer list calls the same function the selector calls, so "selects
  exactly as the selector would" is the same code path, not a parallel one.

## Derived-data contracts (the data layer of this feature)

Both contracts belong in one new pure module (suggested:
`frontend/src/lib/subspeciesExplorer.ts`), no React, no I/O, unit-testable, with
one shared per-row classification. Names are suggestions; the contracts are the
requirement.

### Shared row classification (one rule, used by both contracts)

For a row's trimmed raw `commonName`:

1. `parent = normalizeSpeciesName(commonName)`
2. If `isNonCountableForm(commonName)`: class **nonCountable** (excluded from rows
   and denominators everywhere, tallied for the parity ledger under `parent`).
3. Else if `parent !== commonName`: class **form** under `parent`, with the form's
   display name being the full raw `commonName` (FR-17).
4. Else: class **plain** under `parent` (a species-level report).

The `parent !== commonName` comparison is safe because `parseEbirdObservations`
stores `commonName` trimmed; no whitespace-only difference can misclassify a plain
row as a form.

### Contract A - full-backup index (once per loaded backup)

```
buildSubspeciesIndex(observations: ObservationEntry[]): SubspeciesIndex

SubspeciesIndex: Map<parentName, {
  formCounts: Map<rawFormName, number>   // countable form rows only
  plainCount: number                      // species-level rows
  nonCountableCount: number               // rows folding here that FR-02 excludes
}>
```

- **Qualification (FR-03):** a species qualifies for the explorer list when its
  entry has `formCounts.size >= 1`. Computed from the FULL backup, never filtered
  (FR-08); the county/date filters and both toggles are not inputs.
- **List content (FR-05):** for each qualifying species, each form's share is
  `formCount / (plainCount + sum(formCounts))` over the full backup. Order:
  species in `sortedSpeciesList` order (merged mode); forms by share descending,
  ties alphabetical.
- **Empty explorer (FR-07):** zero qualifying keys.
- **FR-15 basis:** a selected species with no qualifying index entry gets the
  one-line empty state, distinct from FR-14's filtered-to-zero state (which
  applies when the species qualifies but the current filter leaves no rows).
- **Memoization:** one `useMemo` keyed on the `phase.observations` array
  reference. The reference changes only when a new backup is loaded (the
  observations cache guarantees this), so FR-22's recompute-on-reload and
  NFR-02's once-per-load both fall out of reference identity. QA-26's
  instrumentation counts invocations of this function.

### Contract B - filtered breakdown (once per species/filter change)

```
computeSpeciesBreakdown(speciesObs: ObservationEntry[]): Breakdown

Breakdown: {
  rows: Array<{ kind: 'form' | 'plain', name: string, count: number, pct: number }>
  total: number               // plainCount + sum of countable form counts (FR-11)
  nonCountableCount: number   // the FR-13 parity delta vs speciesObs.length
}
```

- **Input:** the page's EXISTING `speciesObs` memo, unmodified. Same rows the
  Sightings section aggregates, so the parity identity is exact and FR-14's
  filter behavior is inherited, not reimplemented.
- **Rows (FR-09, FR-10, FR-16):** one row per countable form, count descending
  then alphabetical; a single `plain`-kind row ("no form noted") pinned last,
  present only when `plainCount > 0`. Row counts sum exactly to `total` (FR-11).
- **Percentage display contract (FR-12):** computed from exact counts; displayed
  to one decimal; any nonzero row displays at least 0.1; the rounding residue
  (positive or negative, including residue created by the 0.1 floor) is absorbed
  by the largest row so displayed values sum to exactly 100.0; a single row
  displays 100%. This shaping is part of the contract and belongs in the pure
  module so QA-12's uneven-rounding fixture tests it directly.
- **Empty states:** `total === 0` with a qualifying index entry means the FR-14
  filtered-to-zero honest zero state; `total === 0` (or no forms anywhere) with
  no qualifying entry means the FR-15 empty state. The distinction is made via
  Contract A, mirroring how the PRD separates the two.
- **Memoization:** one `useMemo` keyed on the `speciesObs` reference, exactly like
  the existing `sightingsStats` memo beside it. `speciesObs` already recomputes
  only on phase/species/merge/filter changes, so NFR-02's once-per-species-or-
  filter-change is inherited from the page's existing memo chain.

### Rendering notes carried into the contracts (not component design)

- Every `name` emitted (species names in the list, raw form names, the parent
  species name) is rendered through the shared `BirdName` component per NFR-06;
  the contracts emit strings and never markup.
- The "no form noted" row's label is display copy, not a bird name; it renders as
  plain text, matching the convention's exception for names that function purely
  as form controls.
- The explorer's open/closed state is ephemeral component state (FR-06); it never
  touches the storage seam.

## Known divergence corner (documented for QA)

A merged-mode key with ZERO countable rows can be selectable when "Show all forms"
is on (the existing `displaySpeciesList` gate; e.g. a hybrid whose name folds to a
species-shaped key). Such a key never qualifies for the explorer list; selecting
it shows the FR-15 empty state while the Sightings figure is nonzero. This is the
same FR-13 divergence class, fully accounted for by the identity
`total (0) + nonCountableCount (N) === speciesObs.length (N)`. No special case is
needed; it is stated here so a QA fixture exercising it reads the numbers
correctly.

## No data layer work required

The Engineer can proceed directly to the derivation module and UI. No migrations
exist or are needed, no stores are added or changed, no backend files are touched.
The new code is one pure derivation module plus Species Detail UI, governed by the
contracts above.
