# schema.md — Calendar Tab (The Architect, Stage 3)

- **Feature:** calendar-tab
- **Date:** 2026-07-03
- **Stage:** 3 — The Architect (frontend-only path)
- **Source:** prd.md (43 FR / 10 NFR / 47 QA), strategic-brief.md

---

## Architect assessment

**Frontend Only — no data-layer change: every count derives from the already-parsed
backup via `observationsCache`; no tables, migrations, routes, or persisted settings.**

The Calendar tab reads the same parse-once `ObservationEntry[]` that Checklists,
Statistics, Map Explorer, and Species Detail already consume through
`loadEbirdObservations()` (`lib/observationsCache.ts`). It computes twelve month
grids of per-day counts entirely in the browser, in pure memoized passes. It adds:

- **No** backend route, provider, bundled dataset, or network call (FR-43 / NFR-08).
  `PRIVACY_POLICY.md` needs no change.
- **No** persisted setting — the selected view/metric/textures **and the two additive
  controls (view-density Months\|Year, FR-44; count-spuh/slash/hybrids, FR-45)** are all
  session `useState` (FR-34 / NFR-09). No `storage.setSetting` for calendar state.
- **No** database, migration, or schema of any kind (there is no DB in this app).
- **No** map/maplibre static import (FR-43); the tab is `React.lazy`-loaded.

The only durable-file edits are frontend source + the CSS token block in `globals.css`
(a new `--sr-cal-1..5` ramp + `--sr-cal-fg`, added to **both** `:root` and
`[data-theme="dark"]`).

Everything below is a build plan the Engineer can implement without re-deciding.

---

## 1. TOKEN / CONTRAST STRATEGY — the load-bearing decision

### Decision: **Option (a) — a new, purpose-built calendar ramp `--sr-cal-1..5`**, 5 classes, theme-identical deep-green fills, with a single WHITE on-cell number (`--sr-cal-fg`) in both themes.

Option (b) — reusing `--sr-county-1..10` verbatim — is **rejected as impossible to
make AA-safe** for a number-bearing cell, proven by the numbers below. This is the
decision the new `calendarContrast.test.ts` guard (NFR-05) will assert.

### Why option (b) cannot work (the numbers)

The `--sr-county-N` ramp is byte-identical in both themes (asserted by
`countyContrast.test.ts`) because it only ever sits on the always-light Positron
basemap and **carries no on-fill text** (the guard file itself says so). Its ten fills
span a very wide luminance range — L ≈ 0.739 (tier 1 `#C3E8D1`, near-white) down to
L ≈ 0.082 (tier 10, dark) — precisely so adjacent tiers clear 1.2:1 on the basemap.
That wide span is fatal for on-cell text:

- For a number to reach 4.5:1 against a fill, the fill's relative luminance must be
  **≤ 0.183 for a white number**, or **≥ 0.175 for a black number**. A fill in the
  narrow band `0.175 < L < 0.183` can take **neither**.
- County **tier 7** is `#358758` (`-rgb: 53,135,88`), L = 0.188 — the dead-zone tier.
  A dark number (`#0F1117`) gives **4.28:1**; a light number (`#F4F4F5`) gives
  **4.02:1**; even pure white (`#FFFFFF`) gives **4.41:1**. **None reaches 4.5:1.** A
  black/white *crossover* (dark number on light tiers, light number on dark tiers)
  still fails at tier 7 — its best of the two is 4.28:1.

Measured minima of every candidate single number color across all 10 county tiers:

| Number color | min contrast over county tiers 1–10 | AA? |
|---|---|---|
| `#0F1117` (sr-text light) | 2.36 (tier 10) | FAIL |
| `#F4F4F5` (sr-text dark) | 1.21 (tier 1) | FAIL |
| `#FFFFFF` | 1.33 (tier 1) | FAIL |
| `#052E16` (deep green) | 1.87 | FAIL |
| black/white crossover | 4.28 (tier 7) | FAIL |

So reusing the county ramp for a **number-bearing** cell cannot pass AA at 10 classes
by any text-color rule. The "identical across themes is a benefit here" framing is
retracted (FR-22 already retracts it).

### Why 10 classes with ANY single-hue ramp is the wrong target

The AA constraint and the 1.2:1-adjacency constraint pull in opposite directions:

- **AA** wants every fill packed into one luminance band far from the number color.
- **Adjacency** wants the fills spread across a wide luminance span.

At **10 classes** a deep ramp packed low enough for a white number (all L ≲ 0.13)
compresses to ~**1.10:1** adjacency — the tiers blur. (The county ramp only hits
1.2:1 by spanning L 0.74→0.08, which reintroduces the dead zone.) Verified: two
theme-specific 10-class ramps *can* pass AA (min 5.5–5.8:1) but only at ~1.10:1
adjacency — below the app's 1.2:1 legibility floor. **10 classes is not achievable
for a number-bearing cell without sacrificing adjacency.** This is why the calendar
uses a reduced class count (OQ-05 permits it).

### The chosen ramp: `--sr-cal-1..5` (deep green, theme-identical, white number)

Reducing to **5 classes** lets both constraints pass with margin. The fills are deep
enough that a single **white** number clears AA on all five, in **both** themes
(fills and number are identical across themes, so there is exactly one contrast pair
per tier — no crossover, no theme fork, no fragility). This is the milestone-badge
lesson (0.5.44) applied cleanly: deep tiles + one re-tuned on-tile text color, guarded
at the token.

Add to **both** `:root` and `[data-theme="dark"]` in `globals.css` (identical values
in each — but they still go in both blocks, and the guard checks both):

```
/* Calendar day-shade ramp — deep green, identical in both themes, sized so a
   WHITE on-cell number clears 4.5:1 on EVERY tier (unlike --sr-county-N, whose
   light top tiers carry no on-fill text). 5 classes so >=1.2:1 adjacency ALSO
   holds (10 deep classes compress below that floor). Number color: --sr-cal-fg. */
--sr-cal-1: #357E56;  --sr-cal-1-rgb: 53,126,86;
--sr-cal-2: #2A6847;  --sr-cal-2-rgb: 42,104,71;
--sr-cal-3: #205238;  --sr-cal-3-rgb: 32,82,56;
--sr-cal-4: #163D29;  --sr-cal-4-rgb: 22,61,41;
--sr-cal-5: #0C271A;  --sr-cal-5-rgb: 12,39,26;
--sr-cal-fg: #FFFFFF;   /* on-cell number, on any data tier, both themes */
```

Measured properties (the exact assertions the `calendarContrast.test.ts` guard makes):

| Tier | Fill | L | White-number contrast |
|---|---|---|---|
| 1 | `#357E56` | 0.164 | **4.92:1** ✅ |
| 2 | `#2A6847` | 0.108 | 6.63:1 ✅ |
| 3 | `#205238` | 0.066 | 9.03:1 ✅ |
| 4 | `#163D29` | 0.037 | 12.11:1 ✅ |
| 5 | `#0C271A` | 0.016 | 15.90:1 ✅ |

- **min on-cell-number contrast = 4.92:1** (tier 1) — clears 4.5:1 in both themes.
- **min adjacency = 1.313:1** (1.347 / 1.363 / 1.341 / 1.313) — clears the 1.2:1 floor.
- monotonic light→dark; every `-rgb` triplet present (the DOM crosshatch reads these).

**Number text-color rule (unambiguous):** the day number on **any** data tier is
`var(--sr-cal-fg)` (= `#FFFFFF`) in **both** themes. **There is no crossover tier** —
one number color serves all five tiers because the ramp never enters the light band
that would force dark text. (This is the whole point of choosing a deep,
theme-identical ramp over the county ramp.)

**Class count = 5.** OQ-05 permits reducing below the county's 10; the AA + adjacency
math above *requires* it for a number-bearing cell. `computeCountyTiers` takes a
`maxClasses` param (default `COUNTY_CLASS_COUNT = 10`), so the calendar simply calls it
with `maxClasses = 5` (see §2b). The day counts feeding the tiers are integers, so the
legend's `min = breaks[i-1] + 1` integer semantics are inherited unchanged (FR-21).

### Non-tier cell styles (also token-bound, also guarded)

- **No-data day** (zero valid checklists, FR-14): blank cell. Fill = `transparent`
  (shows the panel `--sr-surface`), a faint `1px solid var(--sr-border-subtle)`
  outline so the empty slot is still visible as a day. No number, non-interactive.
- **Present-but-zero data day** (Species metric, ≥1 checklist but 0 countable species,
  FR-14/OQ-01): fill = `var(--sr-surface-subtle)`, number `"0"` in
  `var(--sr-text-muted)`. Verified AA of that pair: **4.80:1 light**
  (`#6B6B74` on `#F4F4F5`), **5.81:1 dark** (`#A1A1AA` on `#27272A`). Visually
  distinct from both the transparent blank cell and any green data tier.
- **"Today" outline** (optional, OQ-04): a `2px solid var(--sr-accent)` ring, purely
  decorative, only in the current-year single-year view. Derived once from
  module-level `SESSION_NOW_MS` in a pure helper (NFR-02/NFR-09). Omit if it
  complicates layout — it is not a requirement.

The `calendarContrast.test.ts` guard also re-asserts the present-but-zero pair and the
legend-text pair in both themes (see §5).

---

## 2. PURE MODULE DECOMPOSITION

Two new pure files (unit-tested, React-free) plus a reuse of `computeCountyTiers`.

### 2a. `frontend/src/lib/calendar.ts` — the day-bucket derivation (new)

All date handling is **lexical/component-based** — never `new Date(str)` (which would
timezone-shift, FR-08/QA-08). Concrete types and signatures:

```ts
// ObservationEntry is defined in types.ts (observationsCache.ts re-imports it from
// there); import it from '../types', NOT from the cache module.
import type { ObservationEntry } from '../types'
import { normalizeSpeciesName, isNonCountableSpecies } from './speciesUtils'

export type CalendarMetric = 'species' | 'checklists'

/** Single-year: bucketKey is 'YYYY-MM-DD'. Combined: bucketKey is 'MM-DD'. */
export type CalendarView =
  | { kind: 'year'; year: number }
  | { kind: 'combined' }

/** One populated day. Only days with >=1 valid checklist get a DayCell; a day with
 *  none is simply absent from the map (→ rendered as a blank no-data cell, FR-14). */
export interface DayCell {
  /** 'YYYY-MM-DD' (year view) or 'MM-DD' (combined view). */
  bucketKey: string
  /** Distinct COUNTABLE species (normalized, non-countable EXCLUDED — the FR-10 /
   *  spuh-toggle-OFF value). Year view: that date's set size. Combined view: the
   *  cross-year UNION set size (FR-17). */
  speciesCount: number
  /** Distinct species INCLUDING non-countable forms (spuh/slash/hybrid counted — the
   *  FR-45 spuh-toggle-ON value). speciesCountWithForms >= speciesCount always. Same
   *  year=set-size / combined=cross-year-union semantics as speciesCount. Kept per day
   *  so the toggle re-reads WITHOUT re-parsing (NFR-01). */
  speciesCountWithForms: number
  /** Distinct submissionIds over RAW rows. Year view: that date's count. Combined
   *  view: the SUM across years (FR-18). A spuh-only checklist still counts (FR-11).
   *  Unaffected by the include-non-countable toggle (Checklists is metric-only, FR-45). */
  checklistCount: number
  /** submissionId → the full 'YYYY-MM-DD' date that checklist was logged on. Drives
   *  the popup's ChecklistLink rows (year-labeled in combined mode, FR-38/OQ-07).
   *  Newest-first ordering is applied at render from these dates. */
  checklists: { submissionId: string; date: string }[]
}

/** All populated day buckets for a view, built in ONE pass (NFR-01). Key = bucketKey. */
export type DayCellMap = Map<string, DayCell>

/** THE single-pass derivation. One loop over observations; per bucket it accumulates
 *  TWO Set<normalizedName>s — a countable-only set (→ speciesCount) and an all-names
 *  set that also admits spuh/slash/hybrid (→ speciesCountWithForms) — plus a
 *  Map<submissionId,date>. No per-cell rescans, no computeChecklists-then-regroup.
 *  Malformed-date rows are dropped per row (FR-12); a checklist still lands on the date
 *  its valid rows carry. The two species sets are built in the SAME pass so the FR-45
 *  spuh toggle re-reads without re-parsing (NFR-01) — buildDayCells itself takes no
 *  toggle flag; metricCount/nonZeroMetricCounts select which species field to read. */
export function buildDayCells(observations: ObservationEntry[], view: CalendarView): DayCellMap

/** Distinct years with >=1 VALID dated observation, ascending. The navigable set
 *  (FR-31). Never includes a year with no valid data; no SESSION_NOW_MS read. */
export function dataYears(observations: ObservationEntry[]): number[]

/** Most-recent data year = Math.max(dataYears). Default initial view (FR-33). No
 *  current-date reference. Returns null when there are zero valid dated obs. */
export function defaultYear(observations: ObservationEntry[]): number | null

/** Prev/next data year, skipping gap years (FR-32). Returns null at the ends. */
export function adjacentDataYear(years: number[], current: number, dir: -1 | 1): number | null

/** The active-metric count of a DayCell (species vs checklists). The Species branch
 *  honors the FR-45 include-non-countable-forms toggle: includeNonCountable=false reads
 *  cell.speciesCount (countable only, default), true reads cell.speciesCountWithForms.
 *  The Checklists branch IGNORES includeNonCountable (metric-only, FR-45) and always
 *  returns cell.checklistCount. */
export function metricCount(cell: DayCell, metric: CalendarMetric, includeNonCountable: boolean): number

/** Non-zero active-metric counts across a DayCellMap — the input to computeCountyTiers
 *  (present-but-zero data days contribute 0 and are excluded from the tiering set,
 *  FR-20). Threads includeNonCountable through metricCount so turning the spuh toggle ON
 *  re-tiers over the with-forms Species range and a former present-but-zero day enters
 *  the non-zero tiering set (FR-45). */
export function nonZeroMetricCounts(
  cells: DayCellMap,
  metric: CalendarMetric,
  includeNonCountable: boolean,
): number[]
```

Helpers (also `calendar.ts`, all pure, arithmetic — **no `new Date()`**, NFR-02):

```ts
/** Real length of a month (1-based month). Arithmetic leap rule, FR-15/QA-15. */
export function daysInMonth(year: number, month: number): number

/** Lexical shape + real-calendar-day guard. FR-12: rejects '', '2024-13-40',
 *  '2023-02-30', non-ASCII digits ('٢٠٢٤-...'). Uses an EXPLICIT ASCII digit class
 *  /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/ (NOT \d) so a Unicode-digit date fails even though
 *  JS \d happens to be ASCII-only — this mirrors the 0.5.54 ASCII-class discipline
 *  and makes the intent unmistakable. There is NO python twin (frontend-only), so the
 *  0.5.54 rust-regex \d hazard does not literally apply, but the explicit class is
 *  cheap and matches the QA-12 non-ASCII-digit fixture. */
export function isValidDateString(s: string): boolean

/** (y,m,d) real-calendar-day check: month 1..12, day 1..daysInMonth(y,m). */
export function isValidCalendarDay(year: number, month: number, day: number): boolean

/** Slice a valid 'YYYY-MM-DD' into components lexically (no Date parse). */
export function dateParts(s: string): { year: number; month: number; day: number }

/** Pure arithmetic day-of-week (Sakamoto/Zeller), 0=Sunday..6=Saturday — NO new Date().
 *  Single-year months key on dayOfWeek(year, m, d); combined months key on
 *  dayOfWeek(2000, m, d) (the fixed reference leap year, FR-16 / OQ-08 Sunday-first). */
export function dayOfWeek(year: number, month: number, day: number): number
```

**Aggregation semantics baked into `buildDayCells`:**

- **Year view** (`bucketKey = 'YYYY-MM-DD'`): each valid-dated row for the target year
  is bucketed by its full date. `speciesCount` = countable-`Set<normalizedName>` size
  after excluding `isNonCountableSpecies` (FR-9/FR-10); `speciesCountWithForms` = the
  all-names-`Set<normalizedName>` size that ALSO admits spuh/slash/hybrid (the FR-45
  toggle-ON value; both sets accumulated in the one pass); `checklistCount` = distinct
  `submissionId` over **raw** rows of that date (FR-11 — a spuh-only checklist still
  counts). Same-day multi-checklist species dedup once (FR-9).
- **Combined view** (`bucketKey = 'MM-DD'`): every valid-dated row across all years is
  bucketed by its `MM-DD`. `speciesCount` = size of the cross-year **union** countable
  set (FR-17 — a species seen on Jan-12 in three years counts **once**);
  `speciesCountWithForms` = the same cross-year union over the all-names set (spuh/slash/
  hybrid included, FR-45). `checklistCount`
  = **sum** of distinct submissionIds across years (FR-18 — three years × 2 checklists
  = 6). Because eBird submission ids are globally unique, a per-bucket
  `Set<submissionId>` that spans years has a size that legitimately equals the sum, so
  one `Set<submissionId>` mechanism serves both views — the "union vs sum" asymmetry
  lives ONLY in the species side (a `Set<normalizedName>` truly de-duplicates a repeat
  species; a `Set<submissionId>` never de-duplicates a distinct checklist). This
  internal consistency is why one pass suffices. The `02-29` bucket exists whenever any
  leap-year Feb-29 row lands in it, and is never merged onto Feb-28/Mar-1 (FR-19).

**Grid geometry (rendered by the component from these helpers):**

- Single-year month: `daysInMonth(year, m)` cells + leading blanks from
  `dayOfWeek(year, m, 1)` (0 = Sunday, Sunday-first weeks per OQ-08).
- Combined month: aligned to the **fixed reference leap year 2000** (FR-16) — weekday
  columns and leading blanks use `dayOfWeek(2000, m, d)`, and February always renders
  **29** cells. This is a render-time detail; `buildDayCells` only produces the
  `MM-DD → DayCell` map, and the component lays those onto the 2000 reference grid.

### 2b. Tier integration — **reuse `computeCountyTiers` as-is** (do NOT lift)

**Decision: import `computeCountyTiers` and its `CountyTiers` type directly from
`lib/countyShading.ts` and call it with `maxClasses = 5`.** Verified signature:
`computeCountyTiers(nonZeroValues: number[], maxClasses = COUNTY_CLASS_COUNT): CountyTiers`
(`countyShading.ts:167`). `CountyTiers` exports `breaks`, `tierFor(value) → 0..N`, and
`legend: { tier, min, max }[]` with integer `min = breaks[i-1] + 1` semantics
(`:145–151`, `:188`). It is pure and domain-agnostic (equal-count quantile breaks, ties
collapse to fewer classes via the dedupe loop, empty input → `{ breaks: [], tierFor: () => 0, legend: [] }`
`:170` — the FR-23 no-crash path). FR-21 explicitly blesses importing it as-is; lifting
it to a neutrally-named module is churn for zero behavior change and would touch the
county call-site + `countyShading.test.ts`.

```ts
import { computeCountyTiers, type CountyTiers } from './countyShading'
const tiers = computeCountyTiers(nonZeroMetricCounts(cells, metric), 5) // 5 classes
```

The only "county"-named symbol the calendar borrows is this pure function; its name is
a cosmetic wart the PRD accepts (FR-21 coupling note). The **ramp tokens** are NOT
reused — the calendar uses its own `--sr-cal-N` (§1), mapped from `tiers.tierFor(n)`.

If a reviewer later insists on a neutral name, the one-line re-export is
`export { computeCountyTiers as computeQuantileTiers }` — but this schema chooses the
zero-churn as-is import.

### 2c. `frontend/src/lib/calendarTextures.ts` — the DOM crosshatch density spec (new)

Reuses **only the monotonic density *shape*** from `countyTextures.ts` (the PRD's
sole sanctioned reuse, FR-27) — i.e. the `HatchSpec { gapPx, lineWidthPx }` shape and
the `countyHatchDensity(tier) = lineWidthPx / gapPx` proxy — re-tuned for a ~40px DOM
cell and 5 tiers. It **does NOT import** the MapLibre sprite path (see the No-reuse
ledger). See §3 for the CSS.

```ts
export type CalTier = 1 | 2 | 3 | 4 | 5
export const CAL_TIERS: CalTier[] = [1, 2, 3, 4, 5]

export interface CalHatchSpec { gapPx: number; lineWidthPx: number }

/** Re-tuned for a ~40px cell (the county HATCH px are tile-scale, FR-27 caveat). gap
 *  shrinks 9→3, weight rises 1.0→1.8 — the SAME monotonic-density shape as county. */
export const CAL_HATCH: Record<CalTier, CalHatchSpec> = {
  1: { gapPx: 9,   lineWidthPx: 1.0 },
  2: { gapPx: 7,   lineWidthPx: 1.1 },
  3: { gapPx: 5.5, lineWidthPx: 1.3 },
  4: { gapPx: 4,   lineWidthPx: 1.5 },
  5: { gapPx: 3,   lineWidthPx: 1.8 },
}

export function calHatchSpec(tier: CalTier): CalHatchSpec { return CAL_HATCH[tier] }

/** Pure ink-coverage proxy (lineWidth / gap) — the guard metric, strictly increasing
 *  across tiers (the countyHatchDensity analogue). */
export function calHatchDensity(tier: CalTier): number {
  return CAL_HATCH[tier].lineWidthPx / CAL_HATCH[tier].gapPx
}

/** SIMPLIFIED single-direction (45°) hatch for the FR-44 Year-Overview mini-cell (~7px).
 *  A full 45°/135° crosshatch clogs a tiny cell to mud, so the thumbnail drops the second
 *  diagonal and tightens the gap 5→2px / weight 1.0→1.2px. It is the SAME monotonic-density
 *  SHAPE (a deliberate, logged thumbnail-scale simplification of CAL_HATCH — see decisions.md),
 *  sourced from this same table so the big-cell and mini-cell curves cannot diverge and the
 *  ONE calHatchDensity monotonic guard (QA-26) covers both. */
export const CAL_MINI_HATCH: Record<CalTier, CalHatchSpec> = {
  1: { gapPx: 5,   lineWidthPx: 1.0 },
  2: { gapPx: 4,   lineWidthPx: 1.0 },
  3: { gapPx: 3.2, lineWidthPx: 1.0 },
  4: { gapPx: 2.6, lineWidthPx: 1.1 },
  5: { gapPx: 2,   lineWidthPx: 1.2 },
}

/** Ink-coverage proxy for the mini hatch — also strictly monotonic across tiers, so the
 *  same density guard shape (QA-26) applies to the thumbnail encoding. */
export function calMiniHatchDensity(tier: CalTier): number {
  return CAL_MINI_HATCH[tier].lineWidthPx / CAL_MINI_HATCH[tier].gapPx
}
```

Measured big-cell density: 0.111 / 0.157 / 0.236 / 0.375 / 0.600 — strictly monotonic, min
adjacency ratio **1.41:1** (comfortably above the county test's `MIN_ADJ_RATIO = 1.12`
floor). The mini-cell density (0.200 / 0.250 / 0.313 / 0.423 / 0.600) is **also** strictly
monotonic — `calendarTextures.test.ts` asserts monotonicity for **both** `calHatchDensity`
and `calMiniHatchDensity` (QA-26/QA-48), so neither the big nor the thumbnail encoding can
silently flatten.

---

## 3. CROSSHATCH CSS TECHNIQUE (FR-27)

### Decision: **`repeating-linear-gradient`** (two stacked layers, 45° + 135°), NOT inline SVG `<pattern>`.

Rationale:

- It is a pure inline-style / CSS technique — no extra DOM nodes, no `<svg>` per cell
  (a calendar can render **366 cells × 12 months**; an SVG `<pattern>` def per cell,
  or even one shared `<pattern>` referenced by hundreds of `fill`s, is heavier and
  awkward to color from CSS vars per tier).
- Colors come straight from `--sr-cal-N-rgb` tokens on the element, so the crosshatch
  **follows the theme automatically** — no canvas regeneration, **no `data-theme`
  MutationObserver** (NFR-06 explicitly forbids that machinery here; it belonged to
  the MapLibre sprite path).
- A crosshatch = two `repeating-linear-gradient`s composited: one at `45deg`, one at
  `135deg`, each a hard-edged stroke-then-gap. Line width and gap are the `CAL_HATCH`
  `lineWidthPx` / `gapPx` for the tier, so the *cell density is sourced from the shared
  spec* — the single source of truth (FR-27/FR-28).

Per-tier inline background for a data cell in textures mode (a thin `calHatchCss(tier)`
in `calendarTextures.ts`, so cell and legend swatch call the identical source):

```ts
// stroke = solid to lineWidthPx, then transparent to gapPx; two diagonals + a faint
// tier-color underlay (residual color cue, FR-25). rgb = the tier's --sr-cal-N-rgb.
export function calHatchCss(tier: CalTier): { background: string; backgroundColor: string } {
  const { gapPx, lineWidthPx } = CAL_HATCH[tier]
  const rgb = `var(--sr-cal-${tier}-rgb)`
  const stroke = `rgba(${rgb}, 0.85)`
  const stop = `${lineWidthPx}px`, tile = `${gapPx}px`
  return {
    // faint underlay keeps a residual hue cue; density carries the tier
    backgroundColor: `rgba(${rgb}, 0.12)`,
    background: [
      `repeating-linear-gradient(45deg,  ${stroke} 0 ${stop}, transparent ${stop} ${tile})`,
      `repeating-linear-gradient(135deg, ${stroke} 0 ${stop}, transparent ${stop} ${tile})`,
    ].join(', '),
  }
}
```

The **legend swatch** in textures mode calls the **same** `calHatchCss(tier)` /
`calHatchSpec(tier)`, so the swatch density can never drift from the cell (FR-28 /
QA-27) — the `CountyDensitySwatch` precedent, DOM-CSS edition.

**Number legibility in textures mode:** the day number still uses `--sr-cal-fg` (white).
The sparse tier-1 lattice (0.12-alpha underlay over the theme surface) is the worst case
for a white number. Because textures mode is the *alternative to color for colorblind
users* and the exact count is **always** in the popup (NFR-03/QA-46), color-on-cell
legibility is not itself an AA blocker. As a defensive minimum, the `DayCellButton`
renders the number on a small solid backing chip (or a `--sr-text-shadow`-token halo)
in textures mode so it reads over the open lattice — a design nicety, not a guarded
contract. The tier information itself is carried by density (guarded), not by the number.

**Guard:** `calendarTextures.test.ts` asserts `calHatchDensity` is strictly monotonic
across tiers 1..5 with adjacency ≥ a floor (mirrors `countyTextures.test.ts`'s
`MIN_ADJ_RATIO`, FR-27/QA-26).

---

## 4. COMPONENT TREE + WIRING

### 4a. Files to create

| File | Role |
|---|---|
| `frontend/src/components/Calendar.tsx` | The tab component (`export function Calendar`). Phase-state machine, view/metric/textures `useState`, memoized derivation, legend, month grids, popup orchestration. |
| `frontend/src/lib/calendar.ts` | Pure derivation + date helpers (§2a). |
| `frontend/src/lib/calendarTextures.ts` | Pure density spec + `calHatchCss` (§2c/§3). |

Subcomponents live **inside `Calendar.tsx`** (like Checklists.tsx's `DateLink`,
`ChecklistRow`, etc.) so `react-refresh/only-export-components` stays happy and the
file is self-contained: `MonthGrid`, `DayCellButton`, `CalendarLegend`, `DayPopup`,
and — for the FR-44 Year Overview — `YearOverview` and `MiniMonth` (with a
number-free `MiniDayCell`). (Split into `components/calendar/` files only if
`Calendar.tsx` grows unwieldy — not required.)

### 4b. Tab registration (compiler-mandatory sites, FR-01)

- **`lib/tabLayout.ts`**:
  - add `'calendar'` to the `ConfigurableTab` union (`:1`);
  - add `'calendar': 'Calendar'` to `TAB_LABELS` (`:24`, exhaustive
    `Record<ConfigurableTab, string>` → **tsc-mandatory**);
  - add `'calendar'` to `DEFAULT_TAB_ORDER` (`:12`). **Position:** append after
    `'birding-stats'` (Statistics) so it reads as a sibling temporal lens — e.g.
    `['weather', 'birding-stats', 'calendar', 'species-detail', ...]`. (Any position
    is contractually fine; this is the sensible default. `KNOWN_TABS = new Set(DEFAULT_TAB_ORDER)`
    `:58` derives from `DEFAULT_TAB_ORDER`, so **no separate `KNOWN_TABS` edit**.)
  - `parseLayout`'s auto-append loop (`:83–86`) already appends any `DEFAULT_TAB_ORDER`
    member missing from a saved order — **no code change** needed for FR-02; a
    pre-existing saved layout gains `'calendar'` appended (QA-02).
- **`App.tsx`**:
  - add `'calendar': <CalendarDays size={14} strokeWidth={2.5} aria-hidden="true" />`
    to `TAB_ICONS` (`:104`, exhaustive `Record<ConfigurableTab, React.ReactNode>` →
    **tsc-mandatory**). Import `CalendarDays` from `lucide-react` (a real export,
    `lucide-react.d.ts:3423`; not currently in the App.tsx import list — add it).
  - add `'calendar'` to `DEFERRED_TABS` (`:135`, FR-03).
  - add the lazy import + thunk beside the others (`:46–51` pattern):
    ```ts
    const importCalendar = () => import('./components/Calendar')
    const Calendar = lazy(() => importCalendar().then(m => ({ default: m.Calendar })))
    ```
    and add `void importCalendar().catch(() => {})` to the idle-warm effect (`:400–406`).
  - add a `role="tabpanel"` block mirroring the Checklists panel (`:1117–1133`):
    ```tsx
    <div role="tabpanel" id="panel-calendar" aria-labelledby="tab-calendar"
         aria-label="Calendar" className="sr-panel"
         style={{ display: activeTab === 'calendar' ? 'flex' : 'none',
                  flexDirection: 'column', padding: '40px 24px 24px' }}>
      {mountedTabs.has('calendar') && (
        <Suspense fallback={<TabLoading label="Loading calendar…" />}>
          <Calendar onGoToSettings={() => setActiveTab('settings')}
                    filesVersion={filesVersion}
                    onOpenSpecies={navigateToSpeciesDetail} />
        </Suspense>
      )}
    </div>
    ```
    (`onOpenSpecies` is passed for FR-42 completeness even though v1's popup lists
    checklists, not species — it costs nothing and future-proofs a species row.)

### 4c. Load phase-state machine (the Checklists.tsx pattern, FR-04)

**Note — this ADAPTS the Checklists pattern, it does not copy its tag set verbatim.**
The real `Checklists.tsx` phase (`:41`) is `loading-saved | setup-required | error | ready`
and has **no dedicated `empty` tag** (it folds "empty" into a `ready` with empty
observations). FR-07 / QA-07 require an honest "No dated observations found" state, so
the calendar adds an explicit `empty` tag — a deliberate enhancement demanded by the
PRD, not a divergence from the reference. The reused-verbatim parts are the
`cancelled`-flag guard, the `storage.getFilesStatus()` → `status.ebird` check, and the
`filesVersion`-keyed effect (`Checklists.tsx:415–444`).

```ts
type Phase =
  | { tag: 'loading' }                                   // calendar-local name
  | { tag: 'setup-required' }
  | { tag: 'empty' }                                     // backup loaded, zero valid dated obs (FR-07)
  | { tag: 'error'; message: string }
  | { tag: 'ready'; observations: ObservationEntry[] }
```

A `useEffect` keyed on `filesVersion` runs the async load (NOT a memo — FR-04):
`storage.getFilesStatus()` → no `status.ebird` ⇒ `setup-required` (renders
`SetupRequired` from `components/SetupRequired.tsx` with `EBIRD_BACKUP_STEPS` from
`components/setupCopy.tsx`, FR-05); else `loadEbirdObservations()`; null/throw ⇒
`error` (FR-06); then compute `dataYears(observations)` — empty ⇒ `empty` (FR-07);
else `ready`. Use the `cancelled` flag guard exactly as Checklists does. A persistent
polite live region announces loading (NFR-03), `role="alert"` for error.

### 4d. Session-only state (FR-34/FR-44/FR-45, `useState` — no storage seam)

```ts
export type ViewDensity = 'months' | 'year'                        // FR-44

const [view, setView]     = useState<CalendarView>({ kind: 'year', year: 0 }) // reseeded on ready
const [metric, setMetric] = useState<CalendarMetric>('species')   // Species default, FR-29
const [textures, setTextures] = useState(false)                    // default OFF, FR-25
const [density, setDensity]   = useState<ViewDensity>('months')    // Months default, FR-44
const [includeForms, setIncludeForms] = useState(false)            // default OFF, FR-45
```

`view.year` is seeded from `defaultYear(observations)` when the phase transitions to
`ready` (FR-33 — `Math.max(dataYears)`, no `SESSION_NOW_MS`), in the same
`filesVersion` effect that sets `ready`. **None** of these five is persisted through the
storage seam — no `storage.setSetting` for view / metric / textures / density /
includeForms (QA-31/QA-48/QA-49). The `includeForms` toggle is **Species-only**: it is
rendered dimmed + inert whenever `metric === 'checklists'` (`aria-disabled`, not a tab
stop, `pointer-events:none`, early-return on any activation — FR-45), and its VALUE has no
effect on the Checklists branch of `metricCount` regardless.

### 4e. Memoized derivation (NFR-01)

```ts
const cells = useMemo(
  () => (phase.tag === 'ready' ? buildDayCells(phase.observations, view) : new Map<string, DayCell>()),
  [phase, view],
)
// includeForms is Species-only, so it is only load-bearing when metric==='species';
// threading it here re-tiers the Species grid when the spuh toggle flips (FR-45). It has
// no effect on the Checklists branch of nonZeroMetricCounts/metricCount.
const tiers = useMemo(
  () => computeCountyTiers(nonZeroMetricCounts(cells, metric, includeForms), 5),
  [cells, metric, includeForms],
)
```

`buildDayCells` re-runs only on a **view** change (year ⇄ combined ⇄ other year) — the
`density` (Months | Year, FR-44) toggle is a **pure render-layout choice over the SAME
`cells`/`tiers`, so it does NOT re-run either memo** (the Year Overview lays the same
`DayCellMap` onto mini-month grids). `computeCountyTiers` re-runs on a **metric** OR a
**spuh-toggle (`includeForms`)** change over the already-built `cells` (re-tier without
re-deriving). None reads the file — QA-41's no-re-read assertion holds because
`loadEbirdObservations`/`storage.readFile` are called only in the `filesVersion` effect
(§4c), never in these memos (and NOT on a metric / year / density / includeForms toggle).
No impure calls in either memo (NFR-02).

### 4f. Controls, grids, legend, popup

- **Metric toggle** — the shared `SegControl` (`components/map/MapSidebarUI.tsx`) with
  Species | Checklists options; it carries `aria-pressed` per option (or the local
  `SortSeg` pattern from Checklists). Species selected by default (FR-29). Pass an
  `ariaLabel` ("Day metric"). Switching to **Checklists** dims + disables the FR-45 spuh
  settling row (and its value stops mattering, since the Checklists branch ignores it);
  switching back to **Species** re-enables it.
- **View navigation** — Prev / [year or "All years"] / Next, plus an "All years"
  toggle. Prev/Next call `adjacentDataYear` (skips gaps, FR-32); disabled at ends
  (real `disabled`). "All years" sets `view = { kind: 'combined' }`. The active view is
  labeled in text (FR-35/QA-32).
- **Use Textures toggle** — the shared `ToggleSwitch` (`components/ui/ToggleSwitch.tsx`,
  `label="Use Textures"`), default OFF (FR-25). Sits at the right end of the primary row.
- **View-density toggle (FR-44)** — a **second `SegControl`** (`ariaLabel="View density"`,
  `aria-pressed` per option) with **Months | Year** (each an icon + label: a grid glyph
  for Months, a 2×2-square glyph for Year). **Months default** (`density` state, §4d);
  selecting **Year** swaps the `MonthGrid` container for the `YearOverview`. It is a
  render-layout choice only — it does not re-derive `cells`/`tiers` (§4e).
- **Count-spuh/slash/hybrids toggle (FR-45)** — a small `ToggleSwitch`
  (`label="Count spuh, slash & hybrids"`, `role="switch"`) on its **own full-width
  settling row at the bottom of the control strip**, below the primary controls (FR-46),
  with an inline caption *"Spuh / slash / hybrid forms aren't countable species; off by
  default."* Default OFF (`includeForms` state). When `metric === 'checklists'` the whole
  settling row is dimmed (≈45% opacity) and inert (`aria-disabled="true"`, `tabindex="-1"`,
  `pointer-events:none`, plus an early-return in the change handler). Flipping it ON drives
  `metricCount`/`nonZeroMetricCounts` to read `speciesCountWithForms`, re-tiering the
  Species grid and converting present-but-zero days to real tiered days (FR-45); the view
  sub-line appends ", spuh/slash/hybrids included" and the popup species label becomes
  "species (incl. forms)".
- **Header layout (FR-46)** — the four primary controls sit on **one graceful wrapping
  row** (the `.sr-action-row` / wrapping-flex convention, lifted to a class — a flex
  spacer pushes View + Use Textures to the right), and the spuh toggle sits on its own
  settling row beneath. Verified single-line at 1280px / 1024px, stacking on a phone with
  no overflow (QA-50).
- **Twelve `MonthGrid`s (density = 'months', the default)** — laid out with a
  self-collapsing responsive grid class (NFR-07): a container `.sr-grid-auto` (driven by
  `--sr-grid-min`) so twelve pages tile on desktop and stack toward one column on a phone.
  Each month is a 7-column weekday grid; leading blanks from `dayOfWeek`. **No inline
  `display:grid`** — lift to a class per the responsive convention. Wrap a month in
  `.sr-scroll-x` only if it can exceed viewport width at 200% scale (size cells in rem,
  never rem→px).
- **`YearOverview` (density = 'year', FR-44)** — renders the SAME twelve months as
  `MiniMonth` thumbnails in a **3-column × 4-row** grid whose `grid-template-columns` is
  **lifted to a responsive class** (not inline) reflowing **3 → 2 (≤1024px) → 1 (phone)**
  (NFR-07 — no page horizontal scroll at 320px). Each `MiniMonth` is a real `<button>`
  (`aria-label="Open {Month} in the month view"`, visible focus ring; hover/focus reveals a
  muted-accent "Open →" affordance) whose activation sets `density='months'` and
  scrolls/focuses that month's big card into view (store per-month card refs; honor
  reduced-motion for the scroll). Its inner `MiniDayCell`s reuse the same tier from
  `tiers.tierFor` but render **NO number** — a **data day** takes `var(--sr-cal-${tier})`
  (or the simplified `CAL_MINI_HATCH` 45° hatch in textures mode), a **no-data day** keeps
  the faint `--sr-border-subtle` outline, a **present-but-zero day** takes
  `var(--sr-surface-subtle)` with a `title` tooltip ("birded · 0 countable" — no room for a
  "0"). By default the mini day cells are presentational (`title` tooltips); the optional
  per-day popup extension (FR-44) makes them buttons calling the same `openPopup` handler as
  the big cells. Textures / metric / year / All-years / legend all apply unchanged in this
  density.
- **`DayCellButton`** — a real `<button>` (NFR-04/QA-42) for a **data day**; a
  non-focusable `<div role="presentation" aria-hidden>` (or `tabIndex={-1}`) for a
  **no-data day** so it is not a tab stop (FR-39/QA-36). Fill: `var(--sr-cal-${tier})`
  (color mode) or `calHatchCss(tier)` (textures mode); number `var(--sr-cal-fg)`.
  Present-but-zero → `var(--sr-surface-subtle)` + `var(--sr-text-muted)` "0". Visible
  focus ring. Respects the ~44px touch posture in the ≤640 tier where density allows
  (`.sr-touch-target` or a min-size in that tier, NFR-07).
- **`CalendarLegend`** — reads `tiers.legend`; labels its unit via a calendar
  `METRIC_META`-style map (the `COUNTY_METRIC_META` precedent — never a bare number,
  FR-24/QA-24):
  - year + species → `"species / day"`; year + checklists → `"checklists / day"`;
  - combined + species → `"species ever recorded on this day"` (union);
  - combined + checklists → `"checklists across all years"` (sum).
  Swatches are solid `--sr-cal-N` tiles in color mode, `calHatchCss(tier)` density
  swatches in textures mode (FR-28), same source as the cells.
- **`DayPopup`** — one popup at a time (FR-41), replacing on new open. Shows the
  formatted date (`formatDate` from `lib/formatDate.ts`, pref-aware), **both** counts
  (species + checklists, regardless of active metric, FR-36) — the **species** stat honors
  the FR-45 `includeForms` toggle (reads `speciesCountWithForms` when ON, labeled "species
  (incl. forms)" with a small qualifier line; the checklist stat never changes) — and the
  checklist list via **`ChecklistLink`** (`components/ChecklistLink.tsx` — props
  `submissionId` (required), `label?`, `size?`, `compact?`, `title?`, `style?`; junk id
  → plain text via `SUBMISSION_ID_RE`, FR-37 — never a hand-rolled anchor).
  Combined-mode: each row labeled with its year (newest-first, OQ-07), and the two
  totals **each labeled with their aggregation** — Species "N species ever recorded on
  Mar 3" (union), Checklists "N checklists across M years" (sum) (FR-38/QA-35).
  Closable by Escape / Close button / backdrop, all through **one close path that
  restores focus to the activating day cell** (FR-40/QA-37 — the app overlay
  focus-restore convention; store the activating button ref, focus it on close).
  z-index above the map's controls (`z-index: 1200`, the overlay convention).

### 4g. Purity note (NFR-02)

The only "now" reference is the optional OQ-04 "today" highlight, read from a
module-level `const SESSION_NOW_MS = Date.now()` at the top of `Calendar.tsx` (the
`MapExplorer.tsx` / `regionDownload.ts` / `useCountyCompleteness.ts` pattern) and
consumed only in a pure "is this the today cell" comparison in render — never
`Date.now()`/`new Date()` in a render body or memo. `daysInMonth`/`dayOfWeek`/
`isValidCalendarDay` are arithmetic. The default-year path never touches
`SESSION_NOW_MS` (FR-33).

---

## 5. TEST-FILE PLAN

| File | Kind | Covers (QA) |
|---|---|---|
| `frontend/src/lib/calendar.test.ts` | pure unit | **QA-08** (timezone-safe lexical dates — a `YYYY-03-14` row buckets to March 14; the code never calls `new Date(str)`, plus a year-boundary fixture), **QA-09** (same-day species dedup once), **QA-10** (`isNonCountableSpecies` excludes `Gull sp.`/`A/B`/`Mallard x American Black Duck`; normal/soundscape counted), **QA-11** (checklist dedup by submissionId; spuh-only checklist still = 1), **QA-12** (malformed dates `''`, `2024-13-40`, `2023-02-30`, non-ASCII digits excluded, not rolled; multi-row checklist with one bad row still counts on its valid rows' date), **QA-15** (`daysInMonth`: Feb 29 in 2024, 28 in 2023), **QA-16/QA-19** (combined Feb-29 bucket always present; aggregates only real leap-year Feb-29; blank when none), **QA-17** (combined Species = cross-year **union**, 1 not 3), **QA-18** (combined Checklists = **sum**, 6), **QA-20** (present-but-zero day never in the non-zero tiering set — with `includeNonCountable=false`), **QA-21** (ties/few-distinct → fewer classes, no empty/duplicate ranges — over `computeCountyTiers` at maxClasses 5), **QA-23** (all-equal/degenerate view → empty breaks, no crash), **QA-29** (`dataYears`/`defaultYear` = `Math.max`, current-year only if it has data, no `SESSION_NOW_MS`), **QA-30** (`adjacentDataYear` skips gap years; null at ends), **QA-49** (`metricCount`/`nonZeroMetricCounts` with `includeNonCountable` **BOTH true and false**: OFF → the spuh-only day's Species = 0 and it is absent from the non-zero tiering set; ON → that day's Species = its `speciesCountWithForms` (>0) and it enters the tiering set; the **Checklists** branch returns `checklistCount` **identically** regardless of the flag; and `buildDayCells` populates `speciesCountWithForms >= speciesCount` per cell, in both year and combined views), **QA-45** (the NFR-10 omnibus — all edge cases above, incl. the includeNonCountable ON/OFF cases), **QA-41** (perf: `buildDayCells` on a synthetic ~20k-row fixture completes < 50 ms via `performance.now()`). |
| `frontend/src/lib/calendarTextures.test.ts` | pure unit | **QA-26** (`calHatchDensity` strictly monotonic across tiers 1..5, adjacency above a floor — the `countyTextures.test.ts` analogue with its `MIN_ADJ_RATIO`) **AND** (QA-48) `calMiniHatchDensity` (the FR-44 simplified Year-Overview hatch) strictly monotonic across the same tiers, so the thumbnail encoding can't flatten either. |
| `frontend/src/lib/calendarContrast.test.ts` | parse-the-tokens | **QA-22 / QA-47 / NFR-05** — the NEW guard the county test omits: parse `--sr-cal-1..5`(+`-rgb`) and `--sr-cal-fg` out of BOTH `:root` and `[data-theme="dark"]` in `globals.css`; assert (1) the ramp is monotonic light→dark, (2) adjacency ≥ 1.2:1, (3) **the `--sr-cal-fg` number ≥ 4.5:1 against EVERY tier fill in BOTH themes** (the assertion `countyContrast.test.ts` does NOT make), (4) the present-but-zero pair (`--sr-text-muted` on `--sr-surface-subtle`) ≥ 4.5:1 in both themes, (5) the legend text (`--sr-text` on `--sr-surface`) ≥ 4.5:1 both themes, (6) `-rgb` triplets present. Reuse the `contrast`/`lum`/`block`/`hexOf` helpers verbatim from `countyContrast.test.ts` (copy — they're tiny and file-scoped; keep the file-scoped `/// <reference types="node" />` + `fs` read of `globals.css`, since vitest stubs CSS `?raw`). |
| `frontend/src/lib/tabLayout.test.ts` (extend existing) | pure unit | **QA-02** (a saved order missing `'calendar'` gets it appended by `parseLayout`; rest of order/hidden unchanged). Add `'calendar'` to any exhaustiveness fixture. |
| `frontend/src/lib/entryChunk.test.ts` (extend) | build-inspection | **QA-40 / OQ-09** — add a Calendar-specific assertion: `Calendar.tsx` and its static import subtree are NOT in App.tsx's static closure (Calendar is `lazy()`), and no calendar file statically imports maplibre/`SnowMap`/`SightingsMap`. The existing walker already asserts App.tsx's static graph has no map module; this makes the FR-43 promise explicit rather than incidental. |
| `frontend/src/components/Calendar.test.tsx` | component (per-file `// @vitest-environment jsdom` docblock) | **QA-03** (deferred mount / stays mounted — a light render test), **QA-05/06/07** (setup-required / error / empty states), **QA-13** (12 grids Jan–Dec, leading blanks, a known-year weekday spot check), **QA-14** (blank vs data vs present-but-zero cell), **QA-24** (legend labels its unit, updates on view/metric change), **QA-25/QA-28** (metric toggle default Species, `aria-pressed`, re-shades; textures persist across metric/view switch), **QA-32** (view label), **QA-33/QA-34** (popup: both counts + `ChecklistLink` rows; junk id → plain text), **QA-35** (combined popup labels union vs sum + per-year rows), **QA-36** (no-data cell not a tab stop, opens no popup; present-but-zero opens its popup), **QA-37/QA-38** (Escape/Close/backdrop close + focus restore; second popup replaces first), **QA-42** (day cells are `<button>`s, keyboard-activatable), **QA-43** (renders both themes, tokens only), **QA-44** (spot-check responsive class presence), **QA-48** (View toggle defaults Months / `aria-pressed`; selecting **Year** renders 12 `MiniMonth` `<button>`s in the 3×4 Year-Overview with **no day numbers**, preserving the three cell states + honoring textures via the mini hatch; clicking a mini-month flips density back to Months; density switch preserves metric/year/textures), **QA-49** (spuh toggle defaults OFF on its own settling row; ON re-numbers/re-tiers a present-but-zero day and updates the legend + popup species label; the Checklists count is unchanged; under the Checklists metric the row is dimmed + inert / not a tab stop / activation ignored; no `storage.setSetting`), **QA-50** (primary controls on one wrapping row, spuh toggle on its own settling row beneath — structural/DOM assertion). If jsdom mounts get heavy, keep this test thin and lean on the pure `calendar.test.ts` for logic. **This file mounts NO recharts**, so the `afterAll(() => new Promise(r => setTimeout(r, 120)))` recharts-timer rule does NOT apply here. |

QA rows with no dedicated test are satisfied structurally: **QA-01** (build fails
without `TAB_LABELS`/`TAB_ICONS` entries — the `tsc -b` gate is the test), **QA-04**
(no-second-parse — the memo/effect structure + the `entryChunk`/component spy),
**QA-39** (no species rendered in v1 popup — honored by construction), **QA-46**
(color-never-sole — the popup always shows exact counts; asserted via the component
popup test + the textures monotonic guard).

---

## Reuse ledger

| Piece | Reuses (real symbol) |
|---|---|
| Backup access | `loadEbirdObservations()` — `lib/observationsCache.ts` (no re-parse) |
| Row shape | `ObservationEntry` (`.date`, `.submissionId`, `.commonName`, `.scientificName`, `.county`) — defined in **`types.ts`** (the cache re-imports it from there) |
| Species normalize / countable filter | `normalizeSpeciesName`, `isNonCountableSpecies` — `lib/speciesUtils.ts` |
| Quantile tiers + legend math | `computeCountyTiers`, `CountyTiers` — `lib/countyShading.ts` (imported as-is, `maxClasses = 5`) |
| Crosshatch density *shape* only | the monotonic `lineWidth/gap` model from `countyHatchDensity`/`HATCH`/`HatchSpec` — re-tuned in new `calendarTextures.ts` (NOT imported) |
| Checklist links | `ChecklistLink` (+ `SUBMISSION_ID_RE` guard, label-aware name) — `components/ChecklistLink.tsx` |
| Setup affordance | `SetupRequired` — `components/SetupRequired.tsx`; `EBIRD_BACKUP_STEPS` — `components/setupCopy.tsx` |
| Load phase machine | the `loading → setup-required \| ready \| empty \| error` pattern (adapted from Checklists' `loading-saved \| setup-required \| error \| ready`, which has no `empty` tag; the `cancelled`-flag + `getFilesStatus` + `filesVersion`-effect are reused verbatim) — `components/Checklists.tsx` |
| Date formatting | `formatDate` (pref-aware) — `lib/formatDate.ts` |
| Tab seam | `ConfigurableTab`, `TAB_LABELS`, `DEFAULT_TAB_ORDER`, `parseLayout` auto-append — `lib/tabLayout.ts`; `TAB_ICONS`, `DEFERRED_TABS`, `React.lazy`+`Suspense`, `TabLoading` — `App.tsx` |
| Segmented / toggle controls | `SegControl` (`components/map/MapSidebarUI.tsx`, `aria-pressed` + `ariaLabel`) — used TWICE (metric = Species\|Checklists, view-density = Months\|Year, FR-44) — or local `SortSeg` (Checklists); `ToggleSwitch` (`components/ui/ToggleSwitch.tsx`) — used TWICE (Use Textures, and the small-variant "Count spuh, slash & hybrids" spuh toggle, FR-45) |
| Non-countable predicate (spuh toggle) | `isNonCountableSpecies` (`lib/speciesUtils.ts`) — gated by the FR-45 `includeNonCountable` flag threaded through `metricCount`/`nonZeroMetricCounts`; `buildDayCells` keeps both a countable and an all-forms species set per day |
| "now" for optional today | module-level `SESSION_NOW_MS = Date.now()` read in pure helpers — `MapExplorer.tsx` / `lib/regionDownload.ts` / `lib/useCountyCompleteness.ts` precedent |
| Contrast-guard scaffold | `contrast`/`lum`/`block`/`hexOf` helpers + the `fs`-read-of-`globals.css` pattern — copied from `lib/countyContrast.test.ts` |
| Responsive layout | `.sr-grid-auto` (+`--sr-grid-min`) / self-collapsing grid, `.sr-scroll-x`, `.sr-touch-target`, `.sr-input-16` — `globals.css` |

## No-reuse ledger (explicitly NOT reused)

The entire **MapLibre sprite/canvas path** in `lib/countyTextures.ts` is NOT used by
the calendar:

- `countyHatchImageData()` → `ImageData` — **not used** (DOM CSS gradients instead).
- `map.addImage(...)` / `fill-pattern` — **not used** (no MapLibre layer exists here).
- `countyHatchPixelRatio()`, `countyHatchTierForImage()`, `COUNTY_HATCH_IMAGE_ID`,
  the `styleimagemissing` net — **not used** (no map, no sprites).
- the `data-theme` **MutationObserver** that re-registers sprites — **not present** in
  any calendar file (NFR-06/QA-26/QA-43 — DOM CSS follows the theme via `--sr-*` vars
  automatically; there is nothing to regenerate).
- **`--sr-county-N` ramp tokens** — NOT reused as fills (the calendar has its own
  `--sr-cal-1..5`); only the pure `computeCountyTiers` *function* is shared.
- **No** map/maplibre module (`SnowMap`, `SightingsMap`, `react-map-gl/maplibre`,
  `CountyLayer`) is imported anywhere reachable from the calendar (FR-43/NFR-08).
- **No** `Date`-object date parsing (`new Date(str)`) — lexical/arithmetic only.
- **No** `computeChecklists(filterObservations(...))` reuse — checklist counts are over
  RAW rows in `buildDayCells` (FR-11), so a spuh-only checklist still counts.

---

## Summary for the Engineer

**Token strategy (the load-bearing call): a NEW purpose-built `--sr-cal-1..5` deep-green
ramp, theme-identical, with a single WHITE on-cell number (`--sr-cal-fg = #FFFFFF`).**
Reusing `--sr-county-1..10` is provably impossible for a number-bearing cell — county
tier 7 (`#358758`, L=0.188) is a dead zone where neither a light nor a dark number
clears 4.5:1 (best 4.28:1, even pure white only 4.41:1), and no 10-class single-hue ramp
can satisfy BOTH the 4.5:1 on-number rule AND the 1.2:1 adjacency floor at once (the two
pull apart). The chosen 5-class deep ramp clears both with margin (min on-number
**4.92:1** at tier 1, min adjacency **1.313:1**, identical in light and dark, so no
crossover fragility); it maps from the reused pure `computeCountyTiers(counts, 5)`.

**Risks to watch:** (1) all date handling MUST be lexical/component-based — a stray
`new Date(dateStr)` reintroduces the timezone day-shift QA-08 forbids (verified at the
two offset extremes); (2) the combined-view union-vs-sum asymmetry (species union,
checklists sum) must be built in the ONE `buildDayCells` pass and surfaced with explicit
aggregation labels in the popup/legend so the two are never conflated; (3) the DOM
crosshatch is `repeating-linear-gradient` with **no** MutationObserver/sprite/`addImage`;
(4) [additive] the FR-45 spuh toggle is **Species-metric-only** — `buildDayCells` must
build BOTH species sets in the one pass and `metricCount`'s Checklists branch must ignore
`includeNonCountable`, or a metric/toggle interaction leaks (the QA-49 both-flags test is
the tripwire); (5) [additive] the FR-44 Months\|Year density is a **pure render-layout
choice** that must NOT re-derive `cells`/`tiers`, its 3×4 grid must reflow via a **lifted
class** (not inline) 3→2→1, and its Year-Overview mini-cells drop numbers and use the
simplified single-direction `CAL_MINI_HATCH` (still monotonic, guarded alongside
`CAL_HATCH`). The new `calendarContrast.test.ts` (adding the ≥4.5:1 on-number assertion the
county guard omits) and `calendarTextures.test.ts` (monotonic density for **both** the big
and mini hatches) are the token-level tripwires that keep a future ramp edit from silently
breaking AA or flattening the density curve.
