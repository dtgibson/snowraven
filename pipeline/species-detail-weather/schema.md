# Schema — Species Detail Weather

**Feature:** species-detail-weather
**Date:** 2026-09-07
**Stage:** 3 — The Architect
**Source:** strategic-brief.md, prd.md (both approved)

---

## Architect assessment — Frontend only

SnowRaven has no database, no ORM, no migration directory and no server-side
persistence for user data; the app reads a CSV the user uploaded and derives
everything else in memory. This feature adds no table, no column, no document, no
`storage` write, no `clearDerived.ts` row and no `PRIVACY_POLICY.md` change, so
the data-layer answer is **none**.

That classification is honest and it is also not the point of this stage. The
brief's own words are *"the honest first step is to decide the seam"*, and the
seam is real architecture whether or not anything is persisted. The rest of this
file is that decision, its measurements, and the constraints it places on Stage 5.

**No migration is required. No schema file changes. No backend change.**

---

## 1. The decision, in one paragraph

**Publish the derivation through a module-scoped, per-export, WeakRef-keyed memo
that both surfaces' figures come out of, computed by the already-shipped
`computeWeatherStats`, reached by Species Detail through a cheap presence gate and
a post-paint effect, and never through the Statistics worker.** Statistics keeps
reading its variant from `bundle.weather` exactly as it ships today. The card
reads the **all-forms** variant from the new seam. One implementation, two
invocations, two stated bases — and on the reference export the two bases print
**identical figures for every species Statistics can offer** (measured, §4.3).

The feature is **worth building**. None of the brief's three kill criteria fired:

| Kill criterion | Result | Evidence |
|---|---|---|
| A measurable stall opening Species Detail or switching species | **Did not fire** | 0 ms added to the opening commit; 15.67 ms once per export in a post-paint task, against a 20 ms budget; 0.00084 ms per species switch |
| The card conditional on a prior Statistics visit | **Did not fire** | The card never reads the worker bundle. Its only input is the observations array the tab already holds |
| The two surfaces can print different numbers for the same bird and export | **Did not fire** | One aggregation implementation; 158 of 158 shared species byte-identical on the reference export, and every reference-figure denominator equal |

The one figure that deserves a flag rather than a tick is NFR-01's margin: 15.67 ms
against 20 ms is **1.28x**, not the 2x this repo's own testing rules call margin.
That is why the *placement* of the work is a requirement in §5 and not a
suggestion. The budget is met by size **and** by scheduling; a `useMemo` would
meet it on this machine and break it on a Raspberry Pi.

---

## 2. What ships (the seam's shape)

Five modules. Three are new, two are edits to shipped files.

### 2.1 `frontend/src/lib/weatherStatsShared.ts` — NEW. The seam.

The publication point. Entry-safe (its only importers are off App.tsx's static
graph), no `storage` import, no `transport` import, no network call, no write.

```
hasAnyWeatherBlock(observations: readonly ObservationEntry[]): boolean
weatherStatsFor(observations: ObservationEntry[]): WeatherStats
_resetWeatherStatsMemoForTests(): void        // test seam only
```

**`hasAnyWeatherBlock`** — the presence gate. One pass over the observations,
deduping on `submissionId` with a `Set`, testing each distinct checklist comment
with **the identical predicate `computeWeatherStats` uses for its attribution
gate** — `hasSnowravenWeatherBlock(c) || hasRaincrowWeatherBlock(c)` — and
returning on the first hit. Because the predicate is the same one, the gate is
related to `foundCount` by an **implication in the safe direction**, not by an
equivalence: `foundCount > 0` implies the gate, and never the reverse, so the
gate can never miss an export the aggregate would find (§4.4). *(Corrected after
the Stage 7 audit; this section previously said "equivalent", which is false in
one reproducible shape and which put a deletion notice on the guard that closes
it. See §4.4 for the shape and §7 for the disposition.)*

**`weatherStatsFor`** — the memo. A module-scope **single slot** keyed on the
**identity** of the observations array, with a `WeakRef` on the source and a
strong reference on the derived object, following `lib/speciesIndex.ts` exactly:

```
let memoSource: WeakRef<ObservationEntry[]> | null = null
let memoStats: WeatherStats | null = null
```

On a miss it computes, once:

```
const all = filterObservations(observations, true)   // `true` is a LITERAL here
return computeWeatherStats(computeChecklists(all), all)
```

That is the whole derivation. It calls the shipped functions and adds no
aggregation logic of its own.

### 2.2 `frontend/src/lib/useExportWeather.ts` — NEW. The scheduling.

```
useExportWeather(observations: ObservationEntry[], active: boolean): WeatherStats | null
```

Returns `null` until the answer exists, and `null` forever on an export with no
weather blocks. It runs the gate and, only if the gate says yes, the aggregate —
**both in an effect, after paint, never in a render body.** It resets to `null`
synchronously when the observations identity changes, matching the deliberate
synchronous reset `useStatsBundle` already documents. `active` is the tab's
existing "ready and painted" gate, the same role it plays in `useStatsBundle`.

### 2.3 `frontend/src/lib/weatherStats.ts` — EDIT. Two additions, no behaviour change.

```
export const WEATHER_SPECIES_MIN_CHECKLISTS = 10     // FR-09, with its own reason comment
export type SpeciesWeatherState = 'absent' | 'export-below-floor' | 'bird-below-floor' | 'full'
export function speciesWeatherState(s: WeatherStats, birdChecklists: number): SpeciesWeatherState
export function speciesWeatherIndex(s: WeatherStats, normalizedName: string): number   // -1 when absent
```

`speciesWeatherState` is FR-04's single discriminator, tests evaluated in the
stated order. `speciesWeatherIndex` is FR-02 and FR-03's lookup in one place, so
"an absent name means zero, never an error" is a property of a function rather
than of every reader. Neither touches `weatherSectionState`, `computeWeatherStats`
or any shipped constant. `WEATHER_SPECIES_MIN_CHECKLISTS` does **not** import,
derive from, or reference `WEATHER_SECTION_MIN_READABLE`.

### 2.4 `frontend/src/lib/weatherDisplay.ts` — NEW. The shared display vocabulary.

`CONDITION_LABEL`, `CONDITION_DISPLAY_ORDER` and `inDisplayOrder` move here
**verbatim** from `WeatherStatsSection.tsx`, which then imports them. They are
data and a pure helper, so they go in a `.ts`: a non-component export from a
`.tsx` trips `react-refresh/only-export-components`, which is build-blocking in
this repo (the shipped `WeatherSectionIcon` comment records exactly that).

This is not tidiness. FR-20 requires the card's sky rows in the same display
order as the Statistics section's; leaving the order in the section file means
either a second copy of it or an import from a component file. One copy, in a
module both can import.

### 2.5 `frontend/src/components/WeatherSpeciesRow.tsx` — NEW. FR-26's one row.

`SpeciesRow` moves here **verbatim** from `WeatherStatsSection.tsx`, which then
imports it. Its props, its class names, its three states and its comment block
travel unchanged, so `WeatherStatsSection`'s rendered output is byte-identical and
its existing tests pass untouched. It keeps using the global `.sr-wx-*` classes in
`globals.css`; **no CSS is duplicated and none is added by this extraction.**

`SpeciesWeatherCard.tsx` (FR-23) then imports the same component. There is exactly
one implementation of the row in the repo, by construction rather than by
agreement.

---

## 3. The alternatives, and why each was rejected

Every rejection below is on a measurement or on a structural property, not on
taste. Three of the five are attractive enough that the Engineer will meet them
again during the build.

### 3.1 Publish `WeatherStats` from the Statistics worker bundle — REJECTED

The obvious move: `bundle.weather` already exists, so hoist it into a shared store
and let the card read it.

- **It is the brief's second kill criterion wearing a hat.** The bundle exists only
  after `useStatsBundle` has run, which requires the Statistics tab to have been
  mounted and painted (`active`). On a device where Statistics has never been
  opened there is no bundle, and the card would be silently absent — NFR-06's
  exact prohibition, and the failure the brief calls "the app failing to read a
  file it has open, dressed as a coverage statement".
- **A hybrid is worse than either half.** "Read the bundle if it exists, else
  compute" makes the card's numbers depend on *whether* the user visited another
  tab **and** on that tab's `Count all forms` switch — so the same bird on the same
  export prints two different cards depending on browsing history. That is the
  third kill criterion.
- **Publishing both variants costs every Statistics user for a tab they may never
  open.** A second `computeWeatherStats` inside `computeStatsBundle` on the
  all-forms variant adds a measured 9.29 ms + 4.72 ms to *every* Statistics
  request, including the ones from users who never open Species Detail.

### 3.2 Give Species Detail its own worker — REJECTED on the repo's own numbers

- The hand-over is the cost. `statsOffThread.ts` records 34 ms round trip for the
  ~21k-row `structuredClone`, **~17 ms of it unbreakable main-thread
  serialization**, and 19.2 MB held in worker heap. We would be paying ~17 ms of
  main-thread time and 19.2 MB to move **15.67 ms** of main-thread time. That is a
  loss on both axes before the worker has done anything.
- The v1.0.20 rule is explicit that this trade is taken **on measurement**. Taken
  here, it fails.

### 3.3 Share the existing stats session between the two tabs — REJECTED

Hoisting `createStatsSession` to a per-export module so both tabs use one worker
is the only worker shape that would not pay a second copy. It still fails: the
session is created by `useStatsBundle` under its `active` gate, so making the card
depend on it re-introduces §3.1's conditionality; making Species Detail create it
instead pays the 19.2 MB whenever Species Detail is open even if Statistics never
is; and it edits the Statistics data path, which FR-27 forbids.

### 3.4 Parse only the selected species' checklists — REJECTED, and it is not cheap

Named in the brief so it is recognised as not being a shortcut. The per-row
reference figure is *the same band's share of all outings* and the coverage line is
the readable count against *all* checklists. Both are export-wide. This path
produces the bars and **cannot produce the card**, and it would also violate
NFR-02 by putting a parse inside the species-switch gesture.

### 3.5 Build a leaner input than `ChecklistEntry[]` to skip `computeChecklists` — REJECTED

`computeChecklists` is 4.72 ms of the 15.67 ms, and `computeWeatherStats` reads
only four of a `ChecklistEntry`'s seventeen fields (`submissionId`,
`checklistComments`, `speciesCount`, `duration`) — two of which the card does not
even render, because `avgSpecies` and `avgDurationMin` feed the Statistics band
chart and nothing on the card. So a purpose-built 4-field rollup looks free.

**It is the "two implementations" failure in a different costume.** A second
checklist rollup that agrees with `computeChecklists` today is a second rollup that
will disagree later — on the dedupe key, on the `speciesCount` normalizer, on the
`checklistComments ?? ''` fallback — and the disagreement would surface as two
different coverage lines for one export. `computeWeatherStats`'s signature takes
`ChecklistEntry[]`; anything narrower is a lie about the type. **Do not do this,
even though it would buy 4.72 ms.**

---

## 4. The measurements

### 4.1 Method (reproducible by the Tester)

- Machine: the development Mac, quiet — no build, no dev server, no parallel test
  run, nothing else compiling. `.claude/rules/testing.md`'s timing-ratio warning
  applies and was honoured.
- Runtime: **Node v24.18.0**, vitest 4.1.5, default `node` environment (no jsdom).
- Harness: a throwaway `*.test.ts` under `frontend/src/lib/`, run alone with
  `npx vitest run <file>`, reading `data/ebird-backup.csv` with `readFileSync` and
  parsing it with the shipped `parseEbirdObservations`. Three warm-up executions
  before any timed run; each leg timed with `performance.now()` around a complete
  execution; **median of nine** reported with min and max, except the gate (median
  of fifteen) and the two context figures (median of five). The scratch files were
  deleted after the run and are not part of the change.

### 4.2 Census of the reference export, as it stands on this machine today

| Quantity | All-forms (the card's variant) | Countable-only (Statistics' default) |
|---|---|---|
| Observation rows | 21,856 | 21,794 |
| Characters | 7,180,974 | — |
| Checklists | 3,300 | 3,299 |
| Attributed weather blocks (`foundCount`) | 392 | 392 |
| Readable blocks (`readableCount`) | 392 | 392 |
| Unreadable blocks | 0 | 0 |
| Species rows in the published table | 169 | 158 |
| Distinct normalized species in the export | 283 | 268 |

**A discrepancy worth recording rather than hiding.** `statsBundle.ts`'s shipped
docstring states 21,369 rows / 6.93 Mchar / 3,251 checklists / 353 blocks; the file
at `data/ebird-backup.csv` now measures larger on every count. The **control**
settles whether the new numbers are comparable to the shipped ones: the same
`computeWeatherStats` call on the same countable-only variant measured **9.43 ms
(8.92 to 10.14, median of nine)** here against the shipped **9.2 ms (8.4 to 10.1,
median of nine)**. Same call, same shape, overlapping ranges — the machines are
comparable and the figures below sit on the same scale as the ones already written
into the codebase.

### 4.3 The card's path

| Leg | Median | Range | n |
|---|---|---|---|
| `filterObservations(obs, true)` | **0.00 ms** | 0.00 – 0.03 | 9 |
| `computeChecklists(obs)` | 4.72 ms | 4.58 – 5.22 | 9 |
| `computeWeatherStats(checklists, obs)` | 9.29 ms | 9.02 – 10.39 | 9 |
| **Whole chain** | **14.63 ms** | 13.89 – 14.93 | 9 |
| **Cold seam, gate included** | **15.67 ms** | 14.81 – 16.68 | 9 |
| **Warm memo hit** | **0.000 ms** | 0.000 – 0.025 | 15 |

`filterObservations(rawObs, true)` **returns the input array itself** — verified by
identity comparison, not inferred from the source: `filtered === obs` is `true`.
The all-forms variant therefore costs nothing to select, which is a structural
argument for OQ-04's resolution and not merely a convenient one. The
countable-only variant, by contrast, costs 1.40 ms and allocates a 21,794-row copy.

**Context for judging "measurable stall":** the tab already pays
`buildSubspeciesIndex(obs)` at 2.10 ms and a full single pass over the observations
at 0.92 ms, both inside render memos, on every open.

### 4.4 The gate and the absent export

| Shape | Gate cost | Verdict |
|---|---|---|
| Real export (blocks present, short-circuits) | **0.011 ms** (0.009 – 0.053, n=15) | `true` |
| Comments kept, weather blocks stripped (full scan, worst case) | **0.732 ms** (0.716 – 1.066, n=15) | `false` |
| Comments blank (full scan) | **0.053 ms** (0.053 – 0.219, n=15) | `false` |

**Gate implication, verified on all three shapes above:** `gate === true` on the
real export (392 blocks) and `false` on both blockless shapes (0 / 0), which is
the direction that matters — the gate never returns false while blocks exist.

**The converse does NOT hold, measured at Stage 7 over five shapes.** The gate and
the aggregate disagree about *which* row of a submission speaks for it:
`hasAnyWeatherBlock` skips falsy comments before marking a submission seen, so it
tests the first **non-empty** comment, while `computeChecklists` rolls a
submission up on `firstRowBySub` and takes `checklistComments ?? ''`, so it tests
the first row **whatever** it holds. Two shapes therefore diverge:

| Shape | gate | `foundCount` |
|---|---|---|
| Block on the only row | `true` | 1 |
| No block anywhere | `false` | 0 |
| **First row's `checklistComments` empty, a later row of the same submission carries the block** | **`true`** | **0** |
| **First row's `checklistComments` `undefined`, a later row carries the block** | **`true`** | **0** |
| First row carries non-block prose, a later row carries the block | `false` | 0 |

The last row does not diverge because the gate marks the submission seen on that
prose and never reaches the later row. eBird's own export replicates the
checklist-level column onto every row, so this needs a hand-edited or
third-party-generated CSV — which is exactly the input class this project treats
as untrusted. The leaking direction is gate-true / aggregate-empty, so the cost
is one wasted aggregate and a mounted card that renders nothing;
`SpeciesWeatherCard`'s absent branch is what closes it, and it is load-bearing
rather than belt-and-braces for exactly this reason.

**End-to-end cost on an export with no weather blocks, with the gate in front:
0.570 ms** (0.564 – 0.777, n=9), against **6.29 ms** without it (5.28 ms
`computeChecklists` + 1.01 ms `computeWeatherStats`). The gate is what makes
"a user with no weather blocks pays nothing for this feature" a measured statement
rather than a hope: **11x cheaper, and no card component is imported at all.**

### 4.5 Switching species

25 distinct species looked up by `names.indexOf(normalizeSpeciesName(name))`
followed by both axes' max-and-sum reductions: **0.02 ms for all 25**, i.e.
**0.00084 ms per switch**. Zero calls to `computeWeatherStats`. Zero weather blocks
parsed. NFR-02's 1 ms bound is cleared by ~1,190x, and the call-count assertion it
asks for is satisfied structurally: the card's only access to the derivation is the
memo, which computes on the observations identity and never on the selection.

### 4.6 OQ-04 divergence, measured as QA-19 requires

| Figure | All-forms | Countable-only | Delta |
|---|---|---|---|
| Checklists | 3,300 | 3,299 | **1** |
| `readableCount` (the card's stated denominator) | 392 | 392 | **0** |
| Sky axis total (reference-figure denominator) | 389 | 389 | **0** |
| Temperature axis total (reference-figure denominator) | 392 | 392 | **0** |
| Species rows | 169 | 158 | 11 |
| Species present in both with **byte-identical** `checklists`, `byCondition`, `byTempBand` | **158 of 158** | — | **0 differ** |

**On the reference export the card and the Statistics per-species view print the
same numbers for every species Statistics can offer.** The divergence is entirely
in the eleven rows that exist only under all-forms, and every one of them is
`isNonCountableForm === true`:

`goose sp.` (1), `Greater/Lesser Scaup` (2), `gull sp.` (5), `hawk sp.` (1),
`peep sp.` (8), `Rufous/Allen's Hummingbird` (6), `swallow sp.` (9),
`Tree/Violet-green Swallow` (10), `Western/Clark's Grebe` (1),
`woodpecker sp.` (2), `Zonotrichia sp.` (1).

That confirms all three of OQ-04's reasons, and the third one exactly:
**it costs nothing on the ordinary species** — 158 of 158 identical. It also
produces the concrete instance of OQ-04's first reason: **`Tree/Violet-green
Swallow` has 10 readable-block checklists**, so it reaches the card's `full` state
and draws a chart, while being absent from the Statistics picker entirely under
that tab's default. Under the countable-only variant the card would have gone
silent on a bird Species Detail had just offered the user.

The one remaining figure that differs, `totalChecklists` (3,300 vs 3,299), is
**not printed by the card**: FR-06 uses `belowFloorLine(readable)` and FR-14 uses
`speciesLedeParts(onCount, readable)`, both of which are on `readableCount`, whose
delta is zero.

### 4.7 Card-state census — how often the card is a sentence

Over the **283** normalized species selectable on this export, with the export
above its floor:

| State | Species | Share |
|---|---|---|
| `full` (10 or more readable-block checklists) | 58 | 20.5% |
| `bird-below-floor`, 1 to 9 | 111 | 39.2% |
| `bird-below-floor`, 0 (absent from the table) | 114 | 40.3% |
| **Sentence rather than chart** | **225** | **79.5%** |

OQ-01 predicted this and asked for it to be treated as the ordinary case rather
than an edge case. It is: **four species in five get the sentence.** That is the
argument for FR-07's wording being good and quiet, and it is also why OQ-02's
refusal to route anywhere from that state matters — a call to action there would
appear on four birds in five.

---

## 5. How each required property is satisfied structurally

The brief's seven properties, each answered by a mechanism rather than by a rule
someone has to remember.

**1. One derivation, not two implementations.**
`computeWeatherStats` remains the only aggregation in `frontend/src`. The seam
calls it; the card renders only from the seam's output; `WeatherStatsSection`
renders only from `bundle.weather`, which is the same function. `SpeciesRow` and
the sky display order are extracted to one module each (§2.4, §2.5), so the
*rendering* is single-sourced too. A second implementation cannot be introduced
without a new file that computes band counts, which §6's guard looks for.

**2. The whole-export aggregate is required.**
The seam's only input is the whole observations array and its only output is the
whole `WeatherStats`. There is no species-scoped entry point to reach for, because
none exists: `weatherStatsFor` takes no species argument.

**3. Not conditional on a prior Statistics visit.**
The seam imports neither `statsBundle.ts`, `statsOffThread.ts`, `useStatsBundle.ts`
nor `transport.ts` nor `storage.ts`. There is no cached-answer path and therefore
no "missing" branch to fall into. The card's inputs are the observations array and
nothing else. A grep for a read that returns nothing when a cached answer is absent
(QA-24) finds nothing, because there is no cache read.

**4. Switching species is a lookup.**
The memo is keyed on the observations identity, which a species change does not
touch, so a switch cannot reach the compute. The card's per-species work is one
`indexOf` plus reductions over 11 and 7 small integers: 0.00084 ms measured.

**5. Zero cost on an export with no weather blocks.**
The gate decides `absent` in 0.011 ms on a block-bearing export and at most
0.732 ms on one with comments and no blocks, and the aggregate is never computed:
0.570 ms end to end. The card component is never imported, so no chart code is
loaded — NFR-03's structural half.

**6. Nothing new on the entry chunk.**
`entryChunk.test.ts` walks App.tsx's **static** import graph and does not follow
`import()` or `lazy(() => import())`. `SpeciesDetail` is reached only through
`lazy(() => import('./components/SpeciesDetail'))`, so every static import inside
it — including the seam, the hook, `weatherDisplay.ts`, `WeatherSpeciesRow.tsx`
and `SpeciesWeatherCard.tsx` — is off the entry chunk by construction. The guard
must nonetheless **gain assertions naming the new files** (NFR-07), because "it is
off today" is not the same claim as "it is guarded".

**7. OQ-04: the published variant is a function of the export and the bird.**
This is the property most easily satisfied by discipline and most easily lost, so
it is worth being precise about why it holds structurally here.
`weatherStatsFor(observations)` takes **one argument**. There is no `includeSpuh`
parameter to thread, no options object, no default to override; the `true` is a
literal inside the seam, on the line that calls `filterObservations`, in a module
that imports no React and reads no state. A caller *cannot* pass a control value
into it, because there is no parameter that would accept one. That is the
difference between "the call site happens to pass `true`" and "the call site has
nothing else it could pass", and it is why the seam owns the call rather than the
card.

---

## 6. Lifecycle, teardown, and the registries this does and does not join

**No `clearDerived.ts` row, and that is structural rather than an omission.** Every
row in that registry is a durable **document on disk** whose purge ends in a
`storage.deleteSetting`, and `cacheInventory.test.ts` pairs each row to an exported
production purge. There is nothing on disk here, so a row would turn that guard red
for a store that does not exist. This is the case CLAUDE.md's v1.0.20 entry names
directly: *"a derived value held only in memory, keyed on a user data file, is
outside `clearDerived.ts` by design."* **`cacheInventory.test.ts` must be unchanged
by this work** (QA-29 asserts exactly that).

**The teardown is the `WeakRef`, and it needs no caller discipline.** The house
answer for an in-memory derivation, `lib/speciesIndex.ts`, is followed exactly: a
`WeakRef` on the observations array, a strong reference on the derived object. When
`observationsCache` drops the parse — a Settings delete, an iCloud arrival, a
re-upload — the source becomes collectable immediately and the memo cannot describe
a file that is gone. **Nothing has to remember to call anything.**

**The stated residual, and it is smaller than its precedent's.** A `WeakRef`'d memo
still holds its derived value strongly after the source is collectable. Here that
value is bounded by the **band and species counts, never the row count**: 169
species rows of 18 small integers plus 27 band rows, a few tens of KB on the
reference export, and it is replaced on the next `weatherStatsFor` call. It is not
zero and it is not persisted.

**Single slot, and the capacity+1 rule does not apply** — the same reasoning
`speciesIndex.ts` records. There is at most one live observations array in the
process, and the previous one is unreachable the moment the parse cache replaces
it, so two keys cannot alternate and there is no capacity+1 to measure.

**`useFilesEpoch` needs no new wiring.** Species Detail already takes `filesVersion`
and reloads through `loadEbirdObservations`, which hands back a **new array** when
the parse changes. A new array is a memo miss, so a replaced or deleted backup
recomputes with no epoch arithmetic and no stale window. On a delete the tab's
phase leaves `ready`, the array is dropped, and the `WeakRef` releases. **Do not add
an epoch subscription to the seam**; identity already carries the signal, and an
epoch would be a second, weaker source of truth for the same fact.

**The stats worker is untouched.** No `StatsBundle` field is added, so
`BUNDLE_FIELDS` and `isStatsBundle` are unchanged and NFR-12's field-table rule has
nothing to bind to. `STATS_WORKER_IDLE_MS`, the three `STATS_BUDGET_*` constants and
the ~17 ms hand-over are all unaffected, because nothing this feature adds crosses a
worker boundary. **NFR-12 is satisfied vacuously, and that is a point in this
seam's favour rather than a gap** — §3.1 and §3.2 are the designs that would have
had to satisfy it for real.

**No new durable cache, so none of the durable-cache rules apply:** no TTL, no
entry cap, no payload budget, no `order[]` eviction, no in-flight dedupe map, no
purge generation, no `CACHED_GET_PATHS` entry, no `replayStore` document. The
`countyCompletenessCache` family of rules is about documents on disk; this is a
call-frame derivation with a memo in front of it.

---

## 7. Security and the linearity rule

NFR-13 says this work adds no new scan over export text. **That is not quite true
and the exception is the gate**, so it is named here rather than left to the
Auditor to find.

`hasAnyWeatherBlock` is a new pass over export-derived strings. It is linear by
construction and adds no new pattern:

- It calls only the **shipped** `hasSnowravenWeatherBlock` and
  `hasRaincrowWeatherBlock`, whose regexes are already length-bounded and already
  guarded by `commentBlocksRegexBound.test.ts`. **It introduces no regex of its
  own.**
- It contains no `includes`, `indexOf` or `find` over an export-derived needle. The
  only `includes` calls on the path are the shipped ones against module constants
  (`SR_WEATHER_ATTRIB`, `RAINCROW_ATTRIB`), which is a search for a fixed string,
  not a scan inside a loop over export values — the shape v1.0.21 widened the rule
  to catch.
- One pass, one `Set` add per row, at most one predicate call per distinct
  submission. On a block-bearing export it returns on the first hit.
- **The dedupe accumulator is a `Set`, never an object literal**, so a
  `submissionId` of `__proto__` is an ordinary key. The key here is a submission id
  rather than a species name, so the v1.0.22 crash shape is not reachable — but the
  `Set` is what makes that a property rather than an argument about eBird's id
  format.

The Auditor should still run the 10k / 20k / 40k hostile-input growth check over
the gate (QA-31), built to **fail** after consuming the run — a comment-bearing
export with no attribution is exactly that input, and it is the 0.732 ms worst case
measured in §4.4.

---

## 8. What the Engineer must not do

Nine things, each of which would pass a casual review and break a stated property.

1. **Do not put `weatherStatsFor` in a render body or a `useMemo`.** 15.67 ms
   against a 20 ms budget is 1.28x, not margin. A device 1.3x slower than this one
   breaches NFR-01, and the Pi and older iPhones are several times slower. It runs
   in an effect, after paint, in its own task. The scheduling is load-bearing.
2. **Do not thread `includeSpuh` into the seam.** `weatherStatsFor` takes one
   argument and the `true` is a literal on the `filterObservations` line inside it.
   Adding a parameter — even one defaulted to `true` — reopens OQ-04 and makes the
   card's figures a function of somebody's toggle.
3. **Do not read `bundle.weather` from the card, under any condition, including as
   a fast path when it happens to exist.** That is NFR-06's kill criterion and it
   fails intermittently rather than visibly.
4. **Do not build a leaner checklist rollup to save the 4.72 ms.** §3.5.
5. **Do not add a `clearDerived.ts` row**, and do not ship
   `_resetWeatherStatsMemoForTests` as a production purge. `cacheInventory.test.ts`
   must be unchanged, and a `_reset*ForTests` seam shipped as a clear path looks
   correct in a test and clears nothing.
6. **Do not copy `SpeciesRow`, `CONDITION_LABEL` or `CONDITION_DISPLAY_ORDER` into
   the card.** Extract and import. FR-26 is a repo-wide grep, and
   `WeatherStatsSection.tsx`'s rendered output must stay byte-identical.
7. **Do not touch `computeWeatherStats`, `computeChecklists`,
   `filterObservations`, `weatherSectionState`, `WEATHER_SECTION_MIN_READABLE`,
   `WEATHER_BAND_MIN_TO_SHOW`, `statsBundle.ts` or `statsOffThread.ts`.** FR-27
   requires every existing Statistics figure to be unchanged on the reference
   export; the cheapest way to keep that true is to not edit the path.
8. **Do not skip the gate and read `foundCount === 0` off a computed aggregate.**
   It costs 6.29 ms instead of 0.570 ms on an export with no blocks, and it loads
   the aggregate for a user who will never see a card.
9. **Do not reuse `speciesLedeParts` for a bird with zero checklists.** It renders
   "is on 0 of your 392 weather-block checklists", which FR-07 forbids. The
   zero-count wording is a **new** function in `lib/weatherStatsCopy.ts` and
   nowhere else, so it rides the generated corpus sweep (FR-21).

---

## 9. What the Tester can reproduce and assert

Beyond the QA table, these are the checks this stage's decision makes possible and
the numbers to hold them to.

| Check | Assertion |
|---|---|
| Gate implication | For any fixture, `weatherStatsFor(obs).foundCount > 0` implies `hasAnyWeatherBlock(obs)`. The converse is NOT asserted and does not hold: see §4.4's two diverging shapes. A suite asserting equality is asserting a property of its fixtures rather than of the code |
| One aggregation | A repo grep finds exactly one function accumulating per-condition and per-temperature-band checklist counts |
| Two surfaces agree | On one fixture and one species, the card's rendered figures equal the Statistics per-species view's **on the same variant**; and on the reference export, 158 of 158 shared species are byte-identical across the two variants |
| Variant literal | A grep finds `filterObservations(observations, true)` in `weatherStatsShared.ts` and no `includeSpuh` parameter on `weatherStatsFor` |
| Switching is a lookup | A spy on `computeWeatherStats` records **zero** calls across a sequence of species changes |
| Absent costs nothing | With no attributed block in the fixture, `SpeciesWeatherCard` is never imported and the aggregate is never computed |
| Identity resets the memo | A new observations array recomputes; the same array does not |
| Entry chunk | `entryChunk.test.ts` gains assertions for `weatherStatsShared.ts`, `useExportWeather.ts`, `weatherDisplay.ts`, `WeatherSpeciesRow.tsx` and `SpeciesWeatherCard.tsx`, and keeps the three shipped ones |
| `cacheInventory.test.ts` | Unchanged |
| Boundary | A bird on 9 readable-block checklists draws nothing; on 10 it draws. `WEATHER_SPECIES_MIN_CHECKLISTS === 10` with no arithmetic relating it to `WEATHER_SECTION_MIN_READABLE` |

**Timing figures to record at the definition sites**, per NFR-01 and the
`statsBundle.ts` precedent: 15.67 ms cold seam (14.81 to 16.68, median of nine),
of which 4.72 ms `computeChecklists` and 9.29 ms `computeWeatherStats`; 0.000 ms
warm; 0.570 ms on an export with no blocks; 0.00084 ms per species switch; and the
9.43 ms control against the shipped 9.2 ms.

**A note the Tester will need:** the reference export at `data/ebird-backup.csv`
now measures 21,856 rows / 3,300 checklists / 392 readable blocks, not the
21,369 / 3,251 / 353 written into `statsBundle.ts`. Use the census in §4.2 when
reproducing, and expect the older comment to differ.

---

## 10. Data layer summary

| Question | Answer |
|---|---|
| New tables / collections | None |
| New columns / fields | None |
| Migrations | None |
| Persisted documents | None |
| `storage` seam writes | None |
| Durable cache documents | None |
| `clearDerived.ts` rows | None (in-memory, `WeakRef`-released — CLAUDE.md v1.0.20) |
| `CACHED_GET_PATHS` / `replayStore` entries | None |
| Worker payload fields | None (`StatsBundle` and `BUNDLE_FIELDS` unchanged) |
| Network calls / providers / keys | None |
| Backend changes | None |
| `PRIVACY_POLICY.md` | Unchanged |

The feature's entire data layer is one derived object, computed from a file the
app already has open, held for as long as that file is held, and released with it.
