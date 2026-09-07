# Schema — weather-stats

**Feature:** weather-stats
**Date:** 2026-09-06
**Stage:** 3 — The Architect
**Source:** prd.md (approved), strategic-brief.md (approved)
**Config read:** `pipeline.config.json` (existing — `react-vite-tailwind` / `python-fastapi`, tokens at `frontend/src/globals.css`, vitest). Not created, not modified.

---

## Architect assessment — Incremental

**Not frontend-only, and not by a hair.** The obvious reading is frontend-only:
nothing is written to disk, no backend route moves, no network call is added,
`PRIVACY_POLICY.md` is untouched (NFR-07). But this feature introduces a new
derived record shape and **carries it across the worker boundary**. FR-32 puts
the derivation inside `computeStatsBundle`, which runs in `statsWorker.ts` and
is structured-cloned back to the main thread, and FR-33 makes clone-safety a
requirement rather than a property. A new field on `StatsBundle` is a change to
this app's actual data layer, and it lands in the one place where getting the
shape wrong hangs a surface permanently rather than drawing a wrong chart.

**Incremental, then**, extending three existing structures:

- `StatsBundle` / `BUNDLE_FIELDS` in `lib/statsBundle.ts` — gains one field and
  one table row (FR-32).
- `lib/commentBlocks.ts` — gains a span export and loses its private span loop
  to it (FR-01). This is a refactor of shipped, hardened, byte-golden-pinned
  code, which is why section 6 is the longest in this document.
- `lib/weatherFormatter.ts` — gains two `export` keywords on tables that already
  exist, so the parser reads the vocabulary rather than copying it.

**This app has no database.** Persistent state is files under
`AppLocalData/data/` behind the `storage` seam plus a handful of durable JSON
caches, and **this feature adds nothing to either** (section 5, stated
explicitly because "derived, cached, and keyed on the user's export" is exactly
the shape that normally earns a `clearDerived.ts` row, and this one must not
have one). The value of this document is therefore the record shapes, the
worker payload contract, and the span-finder refactor.

---

## 1. The parsed weather record

### 1.1 Where the parse lives, and why it is its own module

**`frontend/src/lib/weatherBlockParse.ts`** (new), separate from
`lib/weatherStats.ts` (new, section 2 and 3). Three reasons:

1. **Grammar and policy fail differently.** The parser is a grammar over text
   the formatters emit; it is verified against real export shapes and its tests
   build fixtures by calling the real formatters, which is the discipline
   `.claude/rules/weather-tide.md` already requires. Banding is a judgment
   (FR-19's midpoint rule, FR-18's two constants, both flagged as open questions
   OQ-03/OQ-04). Splitting them means a band boundary can move without touching
   a single parse test, and a formatter change breaks parse tests without
   touching banding.
2. **FR-35 needs a module to name.** The rule file's `paths` frontmatter gains
   the parser specifically, and its marker-vocabulary warning names the READER.
   A parser fused into a statistics aggregator makes that a vaguer sentence than
   it should be.
3. The deferred runs (tide blocks, moon phase as an axis) need the parser and
   not the aggregation.

**Standing rule for this feature: `weatherBlockParse.ts` imports only
`lib/commentBlocks.ts`, `lib/commentText.ts` and `lib/weatherFormatter.ts`.** No
React, no `transport`, no `storage`, no component. It is a pure text function.

### 1.2 `WeatherRecord`, field by field

Every field is independently present or absent (FR-10). **Absent is `null` in
every case, never a default, never a sentinel number, never an empty string.**
That uniformity is what makes "wholly unreadable" a single cheap check rather
than thirteen special cases.

```ts
// lib/weatherBlockParse.ts

/** A range as the block writes it. `low === high` for a single-value block
 *  (`formatRange` collapses an agreed range), so a consumer never branches on
 *  which form the block used. */
export interface WeatherRange { low: number; high: number }

/**
 * One weather block, parsed. PARTIAL BY CONTRACT (FR-10): a null field means
 * "this block did not yield this field", and every other field still counts.
 * Never a default — `dayNight: null` is not "day", `condition: null` is not
 * the 🌡️ fallback (which is a real value the formatter emits).
 */
export interface WeatherRecord {
  /** The canonical glyph from CONDITION_EMOJI, WITH its shipped presentation
   *  (ten carry U+FE0F, ⛅ does not), so rendering it reproduces the block.
   *  Matching is VS-insensitive (FR-04); the stored value is canonical. */
  condition: ConditionEmoji | null
  /** FR-05. null when the span carried no emoji header at all. */
  dayNight: 'day' | 'night' | null
  /** °F, FR-06. Rejected (null) outside -80..140 or when low > high. */
  temperature: WeatherRange | null
  /** Beaufort ORDINALS 0..8, not words and never mph (FR-07). A single-label
   *  wind gives min === max. Three or more labels are possible; min and max are
   *  the ends of the run, and the labels between them are not retained because
   *  no figure reads them. */
  wind: { minIndex: number; maxIndex: number } | null
  /** Percent, FR-08. Rejected outside 0..100 or when low > high. */
  cloudCover: WeatherRange | null
  /** FR-09, parsed not charted. Cardinals in the order the block lists them;
   *  one unrecognized token makes the whole field null (FR-07's rule, applied
   *  to the same ` - ` run grammar). */
  windDirection: string[] | null
  /** FR-09. Percent, bounds as cloudCover. */
  humidity: WeatherRange | null
  /** FR-09. °F, bounds as temperature. */
  dewPoint: WeatherRange | null
  /** FR-09. The block's own local-time string ("6:42 AM"), trimmed, NOT parsed.
   *  A time with no date and no zone is not a moment; the run that charts it
   *  decides what to do about that, and inventing a Date here would bake in a
   *  wrong answer. */
  sunrise: string | null
  sunset: string | null
}

/**
 * Did this block yield anything at all? FR-15's "wholly unreadable" test, as
 * ONE function, driven by a compiler-checked field table so a field added to
 * WeatherRecord and forgotten here is a build error rather than a block that
 * quietly counts as unreadable. Same device as BUNDLE_FIELDS, same reason.
 */
export function hasAnyWeatherField(r: WeatherRecord): boolean

const RECORD_FIELDS: Record<keyof WeatherRecord, true> = { /* … */ }

/** THE ENTRY POINT. Pure, read-only, never throws (FR-12). Decodes internally
 *  (FR-02) and returns the all-null record for a comment with no weather span. */
export function parseWeatherBlock(rawComment: string): WeatherRecord

/** The all-null record, frozen at module scope. Returned for "no span", so the
 *  no-block path allocates nothing. */
export const EMPTY_WEATHER_RECORD: WeatherRecord
```

`parseWeatherBlock` returns a record rather than `WeatherRecord | null` on
purpose: FR-15 needs "found but yielded nothing" to be a countable state, and a
`null` return collapses it with "no span found". The aggregation distinguishes
the two by calling the FR-13 gate first (section 3).

### 1.3 The grammar: what bounds a value, and what makes a field absent

**Span first, never lines (FR-03).** `parseWeatherBlock` decodes once, calls
`findBlockSpans` (section 6), and takes the **first span whose `kind` is
`'weather'` or `'combined'`** (FR-11) by an explicit indexed loop with an early
break, not `Array.prototype.find` — QA-34 greps the new modules for
`includes` / `indexOf` / `find`, and an explicit loop makes that grep clean
instead of arguable.

**Inside the span, one label scan, then slice between boundaries.** One global
regex pass over the span text collects `{ label, valueStart }` for all eight
labels, in the shipped `STRONG_MARKER_RE` shape and with its ordering rule
(`wind direction` before `wind`, because alternation is first-match). A value
runs from just past its colon to **the smallest of: the next label's start, the
attribution's start, the span's end**. Two hard requirements:

- **The whitespace before the colon is length-bounded** (`[^\S\n]{0,8}:`), not
  `\s*:`. The formatter emits exactly one space. `\s*` followed by a `:` that
  can fail is the exact backtracking shape the superlinear-regex sweep removed
  six times, and NFR-03 requires it bounded rather than argued about.
- **`lastIndex` is reset before the scan and the zero-length guard is kept**,
  reusing the shipped `allMatchRanges` helper rather than a fresh `matchAll` —
  a stale `lastIndex` on a module-level `/g` regex already made the strip fail
  order-dependently once.

**The number grammar, one rule for all five numeric fields.** Trim the value.
Split on the literal `' - '` (space hyphen space) and **only** that: it is what
`formatRange` emits, and it is what keeps a negative endpoint (`-5 - 12°F`)
unambiguous. Zero separators means a single value, `low = high`. Two or more
separators in a numeric field makes the field null. Then, per endpoint:

1. Remove the expected unit suffix (`°F` or `%`) if present. The unit is
   optional because a round trip can drop it; it is never assumed when a
   *different* unit is present.
2. The remainder must match `/^-?\d{1,4}(?:\.\d{1,2})?$/` — fully bounded, no
   quantifier that can backtrack. **A `°C` block leaves a `C` behind and the
   field goes null**, which is the point: silently reading Celsius as
   Fahrenheit is a wrong number rather than a missing one.
3. `Number()` only after that regex passes. `Number('')` is `0` and `Number(' ')`
   is `0`, so an unguarded parse turns an empty value into a real reading.
4. Plausibility (FR-06 / FR-08): endpoints inside the field's bounds, and
   `low <= high`. Temperature and dew point: -80..140. Cloud cover and humidity:
   0..100. Out of bounds makes **that field** null and nothing else (FR-10).

**The emoji header.** Take the span's leading emoji run and walk its code points
with `Set` lookups: the first `CONDITION_EMOJI` member (VS16-stripped for the
lookup) is the condition; the presence of any of the eight moon glyphs makes it
night. `dayNight` is `'night'` if a moon glyph appears, `'day'` if a condition
glyph appears and no moon glyph does, and `null` if neither appears (FR-05 —
not defaulted). The walk stops early once both a condition and a moon are
found, and is O(1) per code point either way.

**Wind and wind direction share the run grammar**: split on `' - '`, map each
token through a `Map` keyed on the lowercased word, and **one unrecognized
token makes the field null** (FR-07). `minIndex` / `maxIndex` are the min and
max of the mapped ordinals, not the first and last, so a hand-reordered block
still bands correctly.

### 1.4 The closed sets are single-sourced, not copied

`.claude/rules/weather-tide.md` requires the marker vocabulary to stay synced
with the formatters, and a reader is a strictly harder consumer than a detector.
So the parser **imports** rather than restates:

```ts
// lib/weatherFormatter.ts — three new export keywords, no new logic, no changed
// output. The byte-golden parity tests are unaffected: nothing they compare moves.

/** The closed 11-value condition set, in conditionEmoji()'s own branch order.
 *  This array is the INDEX contract for every weather figure (section 3.2). */
export const CONDITION_EMOJI = ['⛈️','🌦️','🌧️','❄️','🌫️','☀️','🌤️','⛅','🌥️','☁️','🌡️'] as const
export type ConditionEmoji = typeof CONDITION_EMOJI[number]

/** The nine Beaufort words in ordinal order, derived from the existing BEAUFORT
 *  table so the two cannot drift. */
export const BEAUFORT_WORDS = BEAUFORT.map(([, label]) => label)

export const CARDINALS = [ /* existing, now exported */ ]
```

**Two guard tests ride with this, and they are not optional.**

- `conditionEmoji()` must return a member of `CONDITION_EMOJI` for every OWM id
  in its documented ranges, asserted by calling the real function across those
  ranges plus an out-of-range id for the `🌡️` fallback. Declaring the array
  next to the function is not the same as tying them together, and a drift here
  is a whole condition group silently missing from the chart.
- The VS16-stripped lookup map must have **exactly 11 entries**. All eleven base
  code points differ today, but a collision would silently merge two conditions
  into one bar, and the test costs one line.

The moon set is eight literals in `weatherBlockParse.ts` rather than an import,
because `MOON_NORTH` / `MOON_SOUTH` are two orderings of the same eight glyphs
and what the parser needs is the *set*. State that in a comment at the
definition site and assert set equality against the union of the two shipped
arrays, so a future ninth glyph reaches the parser.

---

## 2. Banding: policy, in `lib/weatherStats.ts`

Bands are pure functions taking a parsed value and returning an index. They are
exported and unit-tested independently of both the parser and the component.

```ts
// lib/weatherStats.ts

/** FR-19. Midpoint via the repo's bankersRound (weatherFormatter.ts), so the
 *  half-degree tie rule is INHERITED rather than invented — the same rounding
 *  the formatter used when it wrote the block. Exactly one band, never every
 *  band the range overlaps. */
export function tempBandIndex(r: WeatherRange): number   // 0..6

export const TEMP_BANDS = [
  'Below 32°F', '32 to 44°F', '45 to 54°F', '55 to 64°F',
  '65 to 74°F', '75 to 84°F', '85°F and up',
] as const
```

Boundaries on the rounded midpoint `m`: `m < 32` → 0; `32..44` → 1; `45..54` → 2;
`55..64` → 3; `65..74` → 4; `75..84` → 5; `m >= 85` → 6. Band 1 is thirteen
degrees wide and the rest are ten. That is the PRD's table verbatim and it is
kept verbatim; a band table that looks tidier is a different feature.

```ts
/** FR-20. floor((min + max) / 2) over Beaufort ordinals. The tie resolves
 *  DOWNWARD because the formatter emits a de-duplicated set: one gusty hour
 *  contributes a whole extra label carrying the same weight as an hour that
 *  lasted the outing, which makes the high end of a run the least
 *  representative end. */
export function windBandIndex(w: { minIndex: number; maxIndex: number }): number  // 0..8

/** OQ-02: SHIPPED AND TESTED, NOT CHARTED, and not in the payload either.
 *  Five bands mirroring OWM's own 800-804 tiers (0-10, 11-25, 26-50, 51-84,
 *  85-100), midpoint-assigned like temperature — so charting it later is the
 *  same axis as the condition chart, which is precisely OQ-02's reason for not
 *  charting it now. Charting it is then a component plus one aggregation line,
 *  with no parser change. */
export function cloudBandIndex(r: WeatherRange): number  // 0..4
```

**The two thresholds (FR-18), with their reasons in the code, and neither
imports the other's twin:**

```ts
/** Below this the section declines to chart: a distribution across eleven
 *  conditions built on four checklists is four checklists wearing a chart. */
export const WEATHER_SECTION_MIN_READABLE = 5

/** Below this a band shows its count and no derived average, because an average
 *  of seven outings reads as a finding and is noise. DELIBERATELY the same
 *  value as RATINGS_MIN_TO_SHOW in lib/mediaStats.ts, and deliberately NOT an
 *  import of it: two independent judgments that happen to agree, and coupling
 *  them would make a future change to one silently move the other. */
export const WEATHER_BAND_MIN_TO_SHOW = 8
```

---

## 3. The aggregate: `WeatherStats`

### 3.1 The payload

```ts
// lib/weatherStats.ts

/** A distribution row. `index` is the row's position in its canonical band
 *  array and is the ONLY identifier a DOM id may be built from (NFR-05): a
 *  condition emoji or a band label in an id can carry characters that cannot
 *  resolve as an IDREF, which silently switches off the announcement the id
 *  exists for. It is carried explicitly rather than read off array position so
 *  the Designer can reorder rows for display without breaking section 3.2. */
export interface WeatherDistRow {
  index: number
  /** The canonical key: a ConditionEmoji, a TEMP_BANDS entry, a Beaufort word.
   *  Display copy is the component's; this is the data value. */
  key: string
  /** FR-23: present even at zero. Dropping a band makes the distribution lie. */
  checklists: number
}

/** An axis that also carries the FR-24 / FR-25 pair. */
export interface WeatherBandRow extends WeatherDistRow {
  /** Mean ChecklistEntry.speciesCount. null below WEATHER_BAND_MIN_TO_SHOW. */
  avgSpecies: number | null
  /** Mean duration in minutes over the band's checklists with a non-null
   *  duration. null when the band is below the floor OR when durationCount is. */
  avgDurationMin: number | null
  /** FR-25: the duration figure's OWN denominator, which can be smaller than
   *  `checklists` and must be rendered. */
  durationCount: number
}

export interface WeatherStats {
  // ── Coverage (FR-14, FR-15) ────────────────────────────────────────────
  /** Every checklist in the export — FR-14's M. */
  totalChecklists: number
  /** FR-13's attribution gate matched. */
  foundCount: number
  /** Found AND the parser returned at least one field — FR-14's N. */
  readableCount: number
  /** Found AND no field at all — FR-15's K. Carried rather than derived so the
   *  invariant found === readable + unreadable is assertable. */
  unreadableCount: number
  /** OQ-04. Median of (high - low) over readable checklists with a temperature,
   *  LOWER median on an even count so the reported figure is a span that
   *  actually occurred rather than an interpolation. null when none. */
  medianTempSpanF: number | null

  // ── Distributions (FR-21, FR-23) ───────────────────────────────────────
  /** 11 rows, always all 11, aligned to CONDITION_EMOJI. */
  byCondition: WeatherBandRow[]
  /** 7 rows, aligned to TEMP_BANDS. */
  byTempBand: WeatherBandRow[]
  /** 9 rows, aligned to BEAUFORT_WORDS. Distribution only: FR-24 puts species
   *  and duration on temperature and condition, and the payload carries exactly
   *  what the section renders. */
  byWindBand: WeatherDistRow[]
  /** FR-22. day + night === denominator, by construction. */
  dayNight: { day: number; night: number; denominator: number }

  // ── Per species (FR-28, NFR-02) ────────────────────────────────────────
  species: {
    /** Sorted. Only species on at least one readable-block checklist. Index i
     *  addresses both count arrays below. */
    names: string[]
    /** [i][j] — checklists carrying condition j on which species i appears. */
    byCondition: number[][]
    /** [i][j] — the same over temperature bands. */
    byTempBand: number[][]
  }
}

export type WeatherSectionState = 'absent' | 'below-floor' | 'full'

/** ONE discriminator, read by BOTH the jump-nav entry and the card, so FR-16's
 *  "the section does not render AND its nav entry does not appear" cannot
 *  half-happen. The shipped Media entry evaluates `rawMlRows.length > 0` in two
 *  places; this is that pattern with the duplication removed. */
export function weatherSectionState(s: WeatherStats): WeatherSectionState

/** THE ENTRY POINT. Pure, clone-safe in and out (FR-33). */
export function computeWeatherStats(
  checklists: readonly ChecklistEntry[],
  filteredObs: readonly ObservationEntry[],
): WeatherStats
```

**Denominators (FR-21).** Each axis sums to the readable checklists carrying
*that* field, and those totals differ — a checklist can have a temperature and
no wind. The component renders each axis's own sum; nothing in the payload
pretends they are one number. Three invariants, each owed a test:

- `sum(byCondition[].checklists)` === readable checklists with a condition
- `sum(byTempBand[].checklists)` === readable checklists with a temperature
  (this is also QA-18's proof that midpoint banding assigns exactly one band)
- `dayNight.day + dayNight.night === dayNight.denominator`

**Counts are checklists, never observation rows (FR-28).** A species with three
rows on one checklist (a spuh row, a subspecies row, the species row) contributes
1. The tally therefore dedupes on `(normalizeSpeciesName(commonName),
submissionId)` before incrementing, using the same normalizer the rest of the tab
uses so the species list matches the life list.

**One deviation from FR-32's letter, stated rather than slipped in.** FR-32 names
two calls from `computeStatsBundle` (`computeWeatherStats(checklists)` and "the
per-species tally"). This design ships **one** exported entry point taking both
inputs, with the per-species tally as a module-private second pass over a
per-checklist index the first pass already built. The reason is NFR-01: two
independent entry points would each have to locate and parse every block, which
doubles the only real cost this feature adds, against a 20 ms budget. FR-32's
substantive requirements — the derivation joins the bundle, the field is added to
**both** the interface and `BUNDLE_FIELDS` — are met in full. Flagged to the
Engineer and to QA so it reads as a decision, not a miss.

### 3.2 Row alignment is a contract, not a coincidence

`species.byCondition[i][j]` addresses `byCondition[j]`, and
`species.byTempBand[i][j]` addresses `byTempBand[j]`. That alignment is the
whole reason the per-species data can be flat number arrays instead of keyed
objects, and it is exactly the kind of implicit coupling that breaks when
someone reorders a band table for display. **Owed a test**: for a fixture with
a known species, assert that the species row's non-zero entry sits at the index
whose `key` is the expected condition, read through `byCondition[j].key` rather
than through a hard-coded position.

The component reads rows by `row.index`, not by array position, so a display
reordering is free.

### 3.3 Detection cost, and why it is bounded by blocks and not by checklists

The aggregation calls the FR-13 gate (`hasSnowravenWeatherBlock ||
hasRaincrowWeatherBlock`) on the raw comment, then `parseWeatherBlock` on the
same raw comment. Both decode. That is up to five `decodeEntities` calls on one
comment, which looks careless until you notice where the cost falls: the gate's
first call is `hasWeatherBlock`, which bails on an empty comment and otherwise
costs one decode plus eight `includes`, and **everything after the gate runs
only on comments that actually carry a block** — 308 of them on this user's
reference export, against ~21,856 observation rows.

So the redundancy is bounded by the block-bearing count, not the checklist count,
and NFR-01's measurement will say so. **The named remedy if the 20 ms budget is
threatened** is a `parseWeatherFromSpan(decoded, span)` export letting the
aggregation decode once and pass the decoded string down. It is a contingency,
not built speculatively, and the Engineer should reach for it only on a
measurement.

---

## 4. The worker boundary

### 4.1 The bundle field and the table

```ts
// lib/statsBundle.ts
export interface StatsBundle {
  // …existing sixteen fields, unchanged…
  /** The Weather section's whole derivation (FR-32). Bounded by band and
   *  species counts, never by the row count (NFR-02). */
  weather: WeatherStats
}

const BUNDLE_FIELDS: Record<keyof StatsBundle, true> = {
  // …existing sixteen rows…
  weather: true,
}
```

One call inside `computeStatsBundle`, after `checklists` and `filtered` exist:

```ts
weather: computeWeatherStats(checklists, filtered),
```

`isStatsBundle` gains **nothing**. Its per-field `undefined`/`null` loop is
driven by `Object.keys(BUNDLE_FIELDS)`, so adding the table row is the entire
validation change. FR-32 is explicit that the check stays structural, and that
matches the shipped posture: this predicate exists to catch a worker that did
not send a bundle, not one that computed wrong numbers.

### 4.2 The trap: a legitimately empty field must never be null

**This is the single most important sentence in this document.** FR-16 hides the
section when nothing was found, and the instinctive way to express that is for
`computeWeatherStats` to return `null` when `foundCount === 0`. Do not.

`isStatsBundle` rejects a bundle when any table field is `undefined` **or
`null`**. A `null` `weather` would therefore fail validation on **every** reply
for **every** user with no weather blocks. `computeStatsWithFallback` would
reject, `useStatsBundle` would fall back to the main thread, and the tab would
compute the whole chain on the thread that paints — **forever, silently, on the
users the worker exists for**, with every figure correct and no test red.
CLAUDE.md names this failure shape directly ("a `!b[field]` check rejects a
legitimately-zero empty bundle and causes the exact hang"); this is its sibling,
one level up, where the consequence is a permanent performance regression rather
than a spinner.

So: **`weather` is always a `WeatherStats` object.** Absence is
`foundCount === 0` inside it, and `weatherSectionState` turns that into
`'absent'`. Two consequences fall out and both are wanted:

- `EMPTY_STATS_BUNDLE` is `computeStatsBundle([], …)`, so
  `computeWeatherStats([], [])` must return the zero-shaped object — all 11, 7
  and 9 rows present at zero, empty species arrays, `medianTempSpanF: null` —
  and not throw on empty input.
- QA-28's second half ("a reply missing the field is rejected and the tab falls
  back rather than hanging") is satisfied by the shipped predicate, and the test
  that proves it should assert the **zero-block** bundle *passes* as well as
  that a field-stripped one fails. One without the other is the trap above.

### 4.3 Clone shape, and the budget note that must not go stale

The payload is plain arrays, numbers, strings and one nested object. **No `Map`
and no `Set`**, though the bundle already carries two Maps and could carry more:
dense small-integer arrays clone faster and index-address directly, which is
what NFR-05 wants anyway.

Size, at NFR-02's bound: 27 rows plus `species.names.length × 18` numbers. At
3,000 species that is 54,000 small integers, and it does not move when the
observation count does — which is QA-33's test (same species set, 1x and 4x
rows, same serialized size). If a measurement ever objects, the fallback is one
flat `number[]` with a documented stride; do not reach for it without one.

**Two comments must be updated, not just added.** NFR-01 requires the new
derivation's measurement at its definition site in `weatherStats.ts`. It also
requires that `STATS_BUDGET_*` be re-derived rather than left stale — and
`computeStatsBundle`'s own docstring carries the figure those constants were
derived from ("Measured on the reference export (21,856 rows, 7.18 Mchar):
44-56 ms"). That sentence becomes wrong the moment this lands. Restate it with
the new measurement in the same commit, whether or not the 20 ms budget is
exceeded; a stale measurement is how a budget stops meaning anything.

---

## 5. Nothing is persisted, and it must not join the purge registry

**No file, no setting, no durable cache, no `replay.json` entry, no
`CACHED_GET_PATHS` addition, no `storage` call of any kind.** The new modules
import neither `lib/storage.ts` nor `lib/transport.ts`, and QA-13's grep for
`storage.` and `setSetting` in the new modules must come back empty.

**And it does NOT get a `lib/clearDerived.ts` row.** Every row in `TEARDOWNS` is
a durable document on disk whose purge ends in a `storage.deleteSetting`, and
`cacheInventory.test.ts` pairs each row to an exported production purge. A row
for a value that has no document would fail there immediately, for a store that
does not exist. The registry is for documents, and this feature creates none.

**The in-memory question, answered rather than waved past.** CLAUDE.md v1.0.20
says a derived value held only in memory and keyed on a user data file owes
either a `WeakRef` on its source or an explicit terminate-on-clear statement
plus a test. This feature owes **neither**, because it introduces no new holder:

- The parsed observations are held by the stats worker, bounded by
  `STATS_WORKER_IDLE_MS`, and torn down when the export identity changes —
  `useStatsBundle`'s session effect is keyed on `observations` and disposes in
  its cleanup, so clearing the file disposes the worker. That chain is shipped
  and documented at its definition site.
- The bundle is React state in `BirdingStats`, replaced on every reply and reset
  to `null` when the export goes away.

This feature adds fields to an object that already has a governed lifetime. **The
Engineer must not introduce a module-scoped cache of parsed records** — a
`Map<submissionId, WeatherRecord>` at module scope would be a new holder keyed on
the user's file with no teardown, and would turn a "no rule applies" into "three
rules apply and none is wired". If a memo becomes necessary, it lives inside
`computeWeatherStats`'s call frame and dies with it.

---

## 6. The shared span finder

### 6.1 The new export

```ts
// lib/commentBlocks.ts

export type BlockKind = 'weather' | 'tide' | 'combined'

/** Half-open [start, end) offsets into decodeEntities(rawComment) (FR-02). */
export interface BlockSpan { start: number; end: number; kind: BlockKind }

/**
 * Every block span in a comment, in document order. THE ONE SPAN
 * IMPLEMENTATION IN THIS CODEBASE (FR-01): stripWeatherTideBlocks builds its
 * output from this, and weatherBlockParse.ts reads its spans. A second span
 * finder is the defect this export exists to prevent.
 */
export function findBlockSpans(rawComment: string): BlockSpan[]
```

Internally, one private worker so nothing decodes twice on either path:

```ts
function spansInDecoded(decoded: string, wx: boolean, tide: boolean): BlockSpan[]
```

`findBlockSpans` decodes, runs the two detectors, and delegates.
`stripWeatherTideBlocks` decodes once, runs the two detectors once, and
delegates to the same private function — so the public shape FR-01 mandates
costs the strip nothing.

### 6.2 What the refactor must preserve, item by item

This is hardened code with three post-mortems behind it. The extraction moves
lines; it changes no behavior. Every one of these is load-bearing:

1. **`if (!rawComment) return ''`** stays in the strip, ahead of everything.
2. **The detector gate stays in front of the scan.** `findBlockSpans` returns
   `[]` when neither detector fires, and the strip's `return decoded.trim()` for
   that case is unchanged. The gate is what keeps a blockless comment cheap and
   what stops `ATTRIB_END_RE` from firing on ordinary prose.
3. **The `pos` walk is copied exactly**: `ATTRIB_END_RE.lastIndex = 0` before the
   loop, `pos = attribEnd` after each span, and the explicit
   `ATTRIB_END_RE.lastIndex = attribEnd` reassignment. That reassignment looks
   redundant next to `exec`'s own advance and is not: it is what makes the
   next search start after the consumed span rather than inside it.
4. **The precomputed scans stay precomputed.** `markerRanges` and `emojiIdxs` are
   computed once and searched with `lastInWindow` / `firstAtOrAfter` binary
   searches. Recomputing them per attribution is the quadratic shape a security
   review already removed once.
5. **`blockStart`'s full fallback chain** is unchanged: last emoji run in
   `[from, markerIdx)`, else one collapsed-line segment back if it is non-empty,
   at most 80 characters, and does not end in `.`/`!`/`?`, else `markerIdx`.
   The 80 and the sentence-punctuation test are the fix for a real export bug.
6. **The attribution-less fallback** (`spans.length === 0 &&
   markerRanges.length >= 2`) moves into `spansInDecoded` intact, including its
   bounded trailing-value regex.
7. **The output normalization stays in the STRIP, not in the span finder**: the
   `/^[ \t]+$/gm` blanking, the `/\n{3,}/g` collapse, and the final `.trim()`.
   These are the strip's contract with the Checklists tab. A span finder that
   normalized would be a span finder that lied about offsets.

### 6.3 `kind`, including the span that has no attribution

For an attribution-bearing span, `kind` is decided by which alternative matched
(FR-01). **Add named capture groups to `ATTRIB_END_RE`** — `(?<combined>…)`,
`(?<weather>…)`, `(?<tide>…)` — and read `m.groups`. Adding groups changes no
match semantics, which is the property that matters when the pattern is pinned
by a byte-golden corpus. If a named group turns any shipped test red, fall back
to inspecting the (already length-bounded) `m[0]`, and say so in a comment.

For the **attribution-less fallback span** there is no alternative to read, so
`kind` comes from the detectors that fired on the whole comment: weather only →
`'weather'`, tide only → `'tide'`, both → `'combined'`. That is the only
evidence available and it is honest about being coarser. State it at the
definition site, because it is exactly the sort of thing a later reader assumes
is uniform.

**The parser treats `'combined'` as weather-bearing and `'tide'` as not**
(FR-11). A comment with only a tide span yields the empty record and counts as
neither found nor unreadable, since the FR-13 gate never fires on it.

### 6.4 The byte-golden proof, in the order it has to happen

FR-34 and QA-02 require byte-identical strip output, and
`.claude/rules/weather-tide.md` requires re-verification against a real export
because **all three shipped strip bugs were invisible to formatter-fixture
tests**. Comparing "before and after" needs the before to exist as an artifact,
so the sequence is:

1. **Before touching `commentBlocks.ts`**, generate a golden file from the
   *current* implementation over the whole existing fixture corpus plus a
   redacted real-export sample, and commit it. This is the only commit in which
   the goldens may be regenerated.
2. Land the refactor. The golden test must pass with the file untouched.
   **A regenerated golden in the refactor commit is the refactor failing
   silently**, and the commit history is what makes that visible; say so in the
   test's header comment.
3. Re-verify against the user's full backup for zero residue, per the rule.

Add `commentBlocksSpans.test.ts` for the new export: spans are non-overlapping
and ascending, offsets index the decoded string (assert
`decoded.slice(start, end)` contains the attribution), each `kind` is correct
for a SnowRaven weather block, a RainCrow weather block, a standalone tide
block, a combined block, and an attribution-less block, and a comment with two
weather blocks yields two spans of which the parser takes the first.

---

## 7. Module layout

### 7.1 New files

| File | Owns |
|---|---|
| `frontend/src/lib/weatherBlockParse.ts` | `WeatherRecord`, `WeatherRange`, `parseWeatherBlock`, `hasAnyWeatherField`, `EMPTY_WEATHER_RECORD`, the moon set, the VS16-insensitive condition lookup. Grammar only. |
| `frontend/src/lib/weatherStats.ts` | `WeatherStats`, `WeatherDistRow`, `WeatherBandRow`, `computeWeatherStats`, `weatherSectionState`, `tempBandIndex` / `windBandIndex` / `cloudBandIndex`, `TEMP_BANDS`, and the two FR-18 constants. Policy and aggregation. |
| `frontend/src/components/WeatherStatsSection.tsx` | The section body (FR-30). Charts, the coverage line, the confound sentence, the `SpeciesCombobox` view, the backlog pointer. |
| `frontend/src/lib/weatherBlockParse.test.ts` | The grammar, against fixtures built by calling the real formatters. |
| `frontend/src/lib/weatherStats.test.ts` | Banding, denominators, the three sum invariants, thresholds, row alignment, the zero-input bundle. |
| `frontend/src/lib/commentBlocksSpans.test.ts` | `findBlockSpans` (section 6.4). |
| `frontend/src/lib/commentBlocksStripGolden.test.ts` + its golden fixture | The byte-golden corpus (section 6.4). |
| `frontend/src/lib/weatherStatsLinearity.test.ts` | NFR-03 / QA-34 (section 8). |

### 7.2 Modified files

| File | Change |
|---|---|
| `lib/commentBlocks.ts` | `BlockKind`, `BlockSpan`, `findBlockSpans`, private `spansInDecoded`; `stripWeatherTideBlocks` rebuilt on it. Named groups on `ATTRIB_END_RE`. No new imports. |
| `lib/weatherFormatter.ts` | Three exports: `CONDITION_EMOJI`, `ConditionEmoji`, `BEAUFORT_WORDS`, `CARDINALS`. No logic change, no output change. |
| `lib/weatherFormatter.test.ts` | The two drift guards from section 1.4. |
| `lib/statsBundle.ts` | One interface field, one `BUNDLE_FIELDS` row, one call; the stale measurement comment restated. |
| `components/BirdingStats.tsx` | ~15 lines: the import, `const weatherState = weatherSectionState(b.weather)`, the split nav array, the conditional `SectionCard`. Well inside QA-27's 40. |
| `components/Weather.tsx` (backlog area) | OQ-05: one line of copy pointing at the Statistics Weather section, using the existing in-app navigation. |
| `.claude/rules/weather-tide.md` | `paths` gains `frontend/src/lib/weatherBlockParse*.ts` and `frontend/src/lib/weatherStats*.ts`; the marker-vocabulary warning names the READER explicitly (FR-35). |
| `docs/HELP.md`, `README.md`, `website/`, `CHANGELOG.md`, `frontend/package.json`, `src-tauri/tauri.conf.json` | FR-35's sweep and the four-file version set. |

The nav insert, concretely, keeping `NAV_SECTIONS` a plain array:

```ts
const NAV_SECTIONS = [ /* …through 'Data Quality' */ ]
const NAV_SECTIONS_TAIL = ['Highlights & Records', 'Breeding Stats']

const navSections = [
  ...NAV_SECTIONS,
  ...(weatherState !== 'absent' ? ['Weather'] : []),
  ...NAV_SECTIONS_TAIL,
  ...(rawMlRows.length > 0 ? ['Media'] : []),
  'Frivolous Lists',
]
```

**The backlog pointer needs a route out of the tab.** `BirdingStats` already
takes `onGoToSettings={() => setActiveTab('settings')}`; add `onGoToWeather={()
=> setActiveTab('weather')}` beside it in `App.tsx` and thread it to the
section. One prop, exactly parallel to a shipped one. The tab's user-facing name
is `TAB_LABELS['weather']` = "Weather" (NFR-06 — never a component name).

### 7.3 Entry chunk

**No new `entryChunk.test.ts` assertion is required**, and the reason is
structural rather than lucky. `BirdingStats` is `lazy()`-loaded in `App.tsx:73`,
so everything reachable only through it is already off the entry chunk;
`statsWorker.ts` is its own chunk by construction. Neither new lib module nor
the new component is reachable from App.tsx's static graph.

**The invariant that keeps that true, stated so it can be checked:** nothing on
App.tsx's static import graph may import `lib/weatherStats.ts`,
`lib/weatherBlockParse.ts`, or `components/WeatherStatsSection.tsx`.

One import deserves a note. `weatherStats.ts` imports `bankersRound` (FR-19) and
`weatherBlockParse.ts` imports the vocabulary, both from
`lib/weatherFormatter.ts`. **`weatherFormatter.ts` has zero imports of its own**
— it is a leaf — so this is a leaf-to-leaf edge costing the stats and worker
chunks ~200 lines and dragging nothing transitively. It does couple the stats
worker chunk to the weather formatter, which is the correct direction: the
reader depends on the writer's vocabulary, which is exactly what
`.claude/rules/weather-tide.md` wants.

If the Engineer wants belt and braces, adding the three new paths to
`entryChunk.test.ts`'s existing forbidden list is one line and free. Optional.

---

## 8. Linearity (NFR-03)

Every scan in both new modules is linear by construction, and the construction
is: `Set` and `Map` lookups only, one global pass per pattern with `lastIndex`
reset, bounded quantifiers, and no `includes` / `indexOf` / `find` inside any
loop over export text.

The three hostile shapes QA-34 needs, each built so the pattern **fails after
consuming the run** rather than matching at the first start position:

1. **Numeric near-miss.** `Temperature: ` + `'5'.repeat(N)` + `°C` — the bounded
   `/^-?\d{1,4}…$/` rejects at length 5 rather than after consuming N digits,
   which is itself the point of bounding it.
2. **Emoji run with no member.** A header run of N non-condition, non-moon
   pictographs. Linear by the per-code-point `Set` lookup, with no early exit
   available, so it is the honest worst case for the header walk.
3. **Attribution spam.** `'weather generated by <a '.repeat(N)` with no closing
   `</a>` — the shape whose unbounded ancestor was measured at 4.00x per
   doubling in the superlinear sweep, re-run here because the refactor touches
   that pattern.

Measure at 10k / 20k / 40k and require roughly 2x per doubling, per the shipped
`normalizeSpeciesNameParity.test.ts` methodology: min of five complete runs, a
distinct input per run. Per `.claude/rules/testing.md`, judge a timing-ratio
suite only from a run with nothing else compiling.

---

## 9. What does NOT change, confirmed in writing

- **`lib/birdingStats.ts`.** Not one function. `computeQuality`'s weather
  counting stays exactly as shipped, and the new section's `foundCount` must
  equal its `anyWeatherCount` on the same data (QA-08) because both call the
  same two detectors, not because one reads the other.
- **The Weather Backlog's denominator.** It uses the looser label-based
  `hasWeatherBlock` and keeps it. The two figures differ deliberately, and
  `docs/HELP.md` says so (QA-08).
- **`stripWeatherTideBlocks`'s output**, byte for byte (section 6.4).
- **The Python formatter**, `backend/`, and every route. Zero backend work.
- **`PRIVACY_POLICY.md`.** No network call, no provider, nothing written.
- **The moon-phase algorithm and its byte-golden parity.** The parser reads moon
  glyphs; it does not compute a phase, and it must not.
- **The tab navigation.** No new tab, no change to `tabLayout.ts`.
- **`lib/clearDerived.ts` and `cacheInventory.test.ts`** (section 5).
- **`CACHED_GET_PATHS`, `replayStore`, and every durable cache.**

---

## 10. Flags

**For the Designer**

1. **The 🌡️ condition is a real group and needs an honest label.** It is
   `conditionEmoji`'s fallback for an OWM id outside the documented ranges, so
   a checklist can genuinely land there. It is not "missing" (that is `null` and
   is excluded from the denominator). Something like "Other" or "Unclassified",
   never "Unknown weather", which reads as a parse failure.
2. **Display order is yours; the index is not.** `CONDITION_EMOJI` is pinned in
   `conditionEmoji()`'s branch order (storm → drizzle → rain → snow → fog →
   clear → four cloud tiers → other) as the wire contract. Rows carry `index`
   explicitly, so ordering them by sky clarity or by count costs nothing. Say
   which you want and the component sorts on read.
3. **A zero band still draws (FR-23), and a thin band draws its count with no
   average (FR-26).** Those are two visually different "nothing here" states on
   the same chart and they must not look alike: one means "you have never birded
   in this", the other means "you have, and it is too few to average".
4. **Three denominators can be on screen at once** and they legitimately differ:
   the coverage line's N, each axis's own sum (FR-21), and each duration
   figure's own count (FR-25). Design for that rather than around it.
5. **`SpeciesCombobox` is required (FR-28)**, sizes `sm` / `md` / `panel`. Its
   listbox and `aria-activedescendant` shape is already correct; a new picker
   would owe all of it again.
6. **Wind is nine bands, temperature is seven, condition is eleven.** Eleven bars
   at 320px is the hardest layout problem in the section.

**For the Engineer**

1. **Read section 4.2 before writing `computeWeatherStats`.** A `null` `weather`
   field for a user with no blocks silently disables the worker for exactly the
   users it exists for, and nothing goes red. The field is always an object.
2. **Section 6.4's order is not a suggestion.** Commit the goldens from the
   *pre-refactor* implementation first, in their own commit. A golden
   regenerated in the same commit as the refactor proves nothing.
3. **One entry point, not two (section 3.1).** This deviates from FR-32's
   phrasing on purpose and for a measured reason. Both of FR-32's substantive
   requirements are met. Tell QA.
4. **`avgDurationMin` is null when `durationCount < WEATHER_BAND_MIN_TO_SHOW`,
   not only when the band's checklist count is.** FR-26 keys the refusal on the
   band's checklist count; FR-25 gives the duration figure its own, smaller
   denominator. Averaging three durations inside a twenty-checklist band is the
   noise the constant exists to refuse. The denominator stays visible either
   way. This goes one step past FR-26's letter and squarely with its intent;
   raise it if QA reads it as a miss.
5. **Update `computeStatsBundle`'s "44-56 ms" docstring** in the same commit
   (section 4.3). NFR-01 forbids leaving it stale, and it is the figure the
   three `STATS_BUDGET_*` constants were derived from.
6. **No module-scoped cache of parsed records** (section 5). A `Map` at module
   scope keyed on `submissionId` would be a new in-memory holder keyed on the
   user's data file with no teardown, and would pull in three CLAUDE.md rules
   this feature currently owes nothing to.
7. **`weatherFormatter.ts` gains export keywords only.** No logic, no output, no
   moon-phase line. The byte-golden parity with `backend/formatters/weather.py`
   and `weatherFormatter.golden.py` must be untouched.
8. **The `°C` rule is deliberate** (section 1.3): an unexpected unit makes the
   field null rather than reading it as Fahrenheit. A wrong number is worse than
   a missing one, and that is this whole feature's posture.
