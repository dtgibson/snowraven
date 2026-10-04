# Schema - First of Year on Species Detail

**Feature:** species-first-of-year
**Date:** 2026-10-03
**Stage:** 3 - The Architect
**Source:** prd.md (approved), strategic-brief.md

## 1. Path

**Architect assessment - Frontend Only.** No existing schema is touched and none is added. The feature derives per-year first dates and chart points from the observation array the Species Detail tab already holds in memory (`speciesObs`), writes no document, adds no cache, no store, no `clearDerived.ts` row, no backend route and no network request. Read against every user story and functional requirement in the PRD: nothing is created, read from a new place, updated, deleted or related in a new way, and no derived value needs to be stored.

## 2. Confirmation: no data layer changes

No new tables, columns, documents, migrations, settings keys or `docChains` links. The derivation is a `useMemo` over `speciesObs` and is discarded with it. Explicitly: no new setting, no stored document, no `docChains` link, no epoch (`filesChanged`, `keysChanged`, `barChartFilesChanged`), no network, no iCloud Sync change, no backend change, no `PRIVACY_POLICY.md` change, and no Tauri CSP change (nothing new loads: no host, no iframe, no image).

## 3. Existing data used by this feature

### `ObservationEntry` (`frontend/src/types.ts`, produced by `frontend/src/lib/parseEbirdObservations.ts`)

- Fields used: `date` (the trimmed Date cell, stored as-is by `entryFromRow`; the parser does not validate its shape), `submissionId` (the trimmed Submission ID cell; shape-validated only at link time by `ChecklistLink`).
- How used: the derivation reads only these two fields of every in-scope observation. It never reads `count`, `commonName` or any other field.

### `speciesObs` (`frontend/src/components/SpeciesDetail.tsx`, lines 437 to 452)

- The in-scope set: `baseSpeciesObs` (the selected species' rows, folded by `normalizeSpeciesName` when Show subspecies is off, exact `commonName` when on) filtered by `countyFilter` and by `dateRange` with plain string comparison (`o.date < dateRange.from`, `o.date > dateRange.to`). The new memo takes this array and nothing else, so FR-01, FR-05 (US) and FR-09 come from the memo chain rather than from new filtering.

### `sightingsStats` (`computeSightingsStats`, `frontend/src/lib/speciesStats.ts`)

- Not an input. Named here because FR-08's invariant is against it: it returns `null` for an empty `speciesObs`, otherwise `firstObs` is `[...speciesObs].sort((a, b) => a.date.localeCompare(b.date))[0]`, a stable sort, so among equal dates the first row in file order wins. The Sightings card renders only inside `{sightingsStats && (<>...</>)}` (line 982), which is the body state FR-17 ties the section to.

### Existing exports reused

| Export | Module | Used for |
|---|---|---|
| `ChecklistLink` | `frontend/src/components/ChecklistLink.tsx` | every row's date link (FR-15): accessible-name formula, glyph, `SUBMISSION_ID_RE` guard, own new-tab dispatch, plain-text fallback for a junk id |
| `formatDate` | `frontend/src/lib/formatDate.ts` | the row's visible date in the user's format (FR-12); called at render exactly as the First seen cell does |
| `SectionCard`, `SectionHead` | `frontend/src/components/speciesDetail/ui.tsx` | the card register of Sightings and Sightings Over Time (FR-17) |
| `MONTH_ABBR` | `frontend/src/lib/sightingsGraph.ts` | month-axis labels (FR-20); that module's runtime imports are type-only, so it adds no dependency |
| `useIsPhone` | `frontend/src/lib/useIsPhone.ts` | the width tier the chart height is a function of (FR-24), the same hook `PlanResult.tsx` uses for `planChartHeight(withTide, wide)` |
| `--sr-graph-*`, `--sr-border-subtle`, `--sr-text-muted`, `--sr-text` | `frontend/src/globals.css` | every chart and row color (FR-22, NFR-02); no new token is required by default |

Deliberately NOT reused: `daysInMonth` and `isValidCalendarDay` in `frontend/src/lib/calendar.ts`. That module imports `speciesUtils` and `breedingCodes`, and its `isLeapYear` is private. The derivation module carries its own twelve-entry month table so it stays dependency-free, which is what makes QA-05's `Date`-throws test and QA-08's source scan clean. `elapsedDays` / `civilDaysFrom` are not used either: they tolerate `2026-02-30` by design and the feature needs a strict shape check.

## 4. In-memory data model

Field names below are the ones the Engineer uses verbatim.

```ts
// frontend/src/lib/firstOfYear.ts

/** One calendar year's first in-scope observation. Dates are the export's own
 *  YYYY-MM-DD strings; nothing here is a Date object. */
export type FirstOfYearRow = {
  year: number          // Number(date.slice(0, 4)); 0..9999 by the shape check
  date: string          // the well-formed YYYY-MM-DD string, verbatim
  dayOfYear: number     // 1..366, leap-aware (FR-05)
  submissionId: string  // the observation's submissionId, unvalidated; ChecklistLink guards it
}

export function isWellFormedDate(date: string): boolean
export function dayOfYear(date: string): number          // precondition: isWellFormedDate(date)
export function computeFirstOfYear(obs: readonly ObservationEntry[]): FirstOfYearRow[]
// Returns rows ASCENDING by year (rows[0] is FR-08's "earliest year row");
// the section reverses for display. Empty array for zero rows.
```

```ts
// frontend/src/lib/firstOfYearChartGeometry.ts

export type FirstOfYearPoint = {
  year: number
  dayOfYear: number | null   // null = gap year: a position on the axis, no point
}

export type FirstOfYearChartData = {
  points: FirstOfYearPoint[]        // one per integer year in [yearDomain[0], yearDomain[1]]
  yearDomain: [number, number]      // [earliest row year, latest row year]
  yearTicks: number[]               // every integer year in the domain (QA-20)
}

export type MonthTick = { dayOfYear: number; label: string }  // label from MONTH_ABBR

export const FOY_Y_DOMAIN: [number, number] = [1, 366]
export const FOY_TOP_PX = 8
export const FOY_PLOT_PX = 140          // phone tier
export const FOY_WIDE_PLOT_PX = 180     // wide tier
export const FOY_AXIS_LANE_PX = 24      // the year labels' lane under the plot
export const FOY_LABEL_MIN_GAP_PX = 14  // two 11px month labels never closer than this

export function firstOfYearChartHeight(wide: boolean): number   // FOY_TOP_PX + plot + FOY_AXIS_LANE_PX: 172 phone, 212 wide
export function firstOfYearPlotHeight(wide: boolean): number    // FOY_PLOT_PX or FOY_WIDE_PLOT_PX
export function buildFirstOfYearChartData(rows: readonly FirstOfYearRow[]): FirstOfYearChartData
export function monthTicks(plotPx: number): MonthTick[]
export function segmentsOf(points: readonly FirstOfYearPoint[]): Array<[number, number]>
// segmentsOf exists for QA-22: the pairs of consecutive years both carrying a
// point. The chart itself draws breaks with Recharts' `connectNulls={false}`;
// the test asserts the two agree.
```

The "width" FR-24 names is the tier, exactly as `planChartHeight` takes it: `useIsPhone()` false is the wide tier (641px and up), true is the phone tier. The host calls `firstOfYearChartHeight(!isPhone)` for the Suspense fallback and the chart calls the same function for its `ResponsiveContainer` height, so the two cannot disagree.

## 5. Module plan

| File | Role | Imports Recharts | Static import of SpeciesDetail |
|---|---|---|---|
| `frontend/src/lib/firstOfYear.ts` | pure derivation: `isWellFormedDate`, `dayOfYear`, `computeFirstOfYear` | no | yes |
| `frontend/src/lib/firstOfYear.test.ts` | QA-02 to QA-09 (unit), QA-30 (linearity, `frontend/src/test/cpuTiming.ts`), QA-05 (`Date` replaced by a throwing constructor; `TZ` sweep), QA-08 (source scan: no `Date.now`, `new Date(`) | | |
| `frontend/src/lib/firstOfYearChartGeometry.ts` | pure geometry and chart data: heights, year domain and ticks, gap-filled points, month ticks, `segmentsOf` | no | yes (through the section) |
| `frontend/src/lib/firstOfYearChartGeometry.test.ts` | QA-20, QA-21 (both tiers), QA-22, the 10,000-iteration span bound (section 7) | | |
| `frontend/src/components/speciesDetail/FirstOfYearSection.tsx` | the card: `SectionHead`, the date-range note (FR-16), the rows (newest first, `ChecklistLink` per row), the `Suspense` slot with the reserved-height fallback, `const FirstOfYearChart = lazy(() => import('./FirstOfYearChart'))`; returns `null` for zero rows (FR-10); renders the chart slot only at two or more rows (FR-18) | no | yes |
| `frontend/src/components/speciesDetail/FirstOfYearSection.test.tsx` | QA-10 to QA-19, QA-23 (source scan), QA-24, QA-25 (fallback height equals `firstOfYearChartHeight`), QA-26, QA-31 (`fetch` spy); mocks `./FirstOfYearChart` the way `SightingsGraph.test.tsx` mocks `recharts` | | |
| `frontend/src/components/speciesDetail/FirstOfYearChart.tsx` | the ONLY new file that imports `recharts`: `ResponsiveContainer`, `LineChart`, `Line`, `XAxis`, `YAxis`, `CartesianGrid`; wrapper `role="img"` with the one accessible name (FR-23); inner `aria-hidden` + `inert`, `accessibilityLayer={false}`; no `Tooltip`, no handlers (FR-25) | yes | NO (lazy only) |
| `frontend/src/components/speciesDetail/FirstOfYearChart.test.tsx` | QA-22 against the rendered `Line` props (`connectNulls` false, `type` linear, `dataKey` dayOfYear), QA-23, QA-24 (zero focusables), QA-26 | | |
| `frontend/src/components/SpeciesDetail.tsx` | one memo and one mount (section 6) | | |
| `frontend/src/lib/entryChunk.test.ts` | two paired rows (section 8) | | |
| `docs/HELP.md` | one bullet (FR-26) in the Species Detail section list, after the `Media:` bullet and before `Subspecies and Forms:` (the OQ-03 default position); if The Designer moves the section, the bullet moves with it | | |
| `frontend/src/lib/firstOfYearHelpClaims.test.ts` | QA-27: extracts the Species Detail passage of `docs/HELP.md` (heading to next `##`), asserts the bullet exists and states one row per year, the checklist link, the two-year chart rule, and that it follows Show subspecies and the county and date filters; `helpToc.test.ts` stays untouched | | |
| `pipeline/species-first-of-year/held-copy.md` | FR-27: not written by default; if The Designer wants a website or README sentence it is held here, at most one per surface, and never written to `website/`, `README.md`, `appstore/` or `PRIVACY_POLICY.md` | | |

## 6. Where SpeciesDetail.tsx changes

Two edits, nothing else in that file:

1. Beside `sightingsStats` (after line 464):
   ```ts
   const firstOfYear = useMemo(() => computeFirstOfYear(speciesObs), [speciesObs])
   ```
   Dependency on `speciesObs` alone gives FR-09 and NFR-03's "re-runs only when the in-scope observations change" for free, because `speciesObs` is already memoized on species, merge, county and date range.

2. Inside the `{sightingsStats && (<>...</>)}` fragment, immediately after the closing `</div>` of the `sr-two-col` Sightings + Media grid (line 1185) and before the fragment closes (line 1187):
   ```tsx
   <FirstOfYearSection rows={firstOfYear} dateRangeActive={!!dateRange.from || !!dateRange.to} />
   ```
   That is the OQ-03 default: full width, after the Sightings and Media row, before Subspecies and Forms (which sits just outside the fragment). Mounting inside the fragment satisfies FR-17's "every body state in which the Sightings card renders"; the section's own `null` return covers the one state inside that fragment where FR-10 applies (every in-scope date malformed). If The Designer moves the section, it stays inside this fragment.

Props: `rows: FirstOfYearRow[]` (ascending, as derived), `dateRangeActive: boolean`. The section computes `wide = !useIsPhone()` itself and reverses the rows for display. No other prop; the current year is not passed and not read.

## 7. Declared scans over user-file-derived text (NFR-09, QA-33)

This feature adds exactly one scan over user-file content, and one loop driven by a number derived from it. Both are declared here so the security review verifies a claim rather than hunting for one.

### 7.1 `isWellFormedDate(date)` in `frontend/src/lib/firstOfYear.ts`

- Input: `ObservationEntry.date`, the trimmed Date cell stored verbatim by `parseEbirdObservations.ts`, so its length is whatever the row carried.
- Predicate, in order: `date.length === 10`; `charCodeAt(4) === 45` and `charCodeAt(7) === 45` (the hyphens); positions 0 to 3, 5 to 6 and 8 to 9 are ASCII digits (`charCode - 48` in 0..9); `month` in 1..12; `day` in 1..`daysIn(month, year)` where `daysIn` is the table `[31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]` with February 29 when `year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)`.
- Regex equivalent (for the reader; the implementation is the character scan, like `fastCivilDays` in `formatDate.ts`): `/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/` followed by the two range checks. Anchored, fixed width, no quantifier that can backtrack.
- Linearity: the length check runs first and rejects anything but 10 characters in constant time, so the scan touches at most 10 characters per observation whatever the cell holds. The derivation is one pass over the observations, so the whole feature's work over user text is O(n) in observations with a constant of 10 characters per row.
- Malformed row rule (FR-03): a row whose date fails the predicate contributes nothing. It is skipped, never thrown on, never logged, never shown. Consequence for FR-08: `computeSightingsStats` sorts every row, malformed dates included, so when `firstObs.date` is malformed (an empty string sorts first; `2018-02-30` sorts before any 2019 date) the invariant does not apply, exactly as the PRD conditions it. When `firstObs.date` is well formed, the earliest year row is the same observation, because both pick the smallest string in file-order-stable fashion (section 9, tie rule).
- A `yyyy` of `0000` passes the shape check and yields year 0. It is kept rather than specially refused: it is a real four-digit string, harmless to the chart, and refusing it would add a rule the PRD does not state.

### 7.2 The gap-fill loop in `buildFirstOfYearChartData`

- `for (let y = yearDomain[0]; y <= yearDomain[1]; y++)` builds `points` and `yearTicks`. The span is a NUMBER read from user text, so it is in scope of the span rule in `.claude/rules/security.md`.
- Bound: both ends come from well-formed dates, whose year is four digits, so `0 <= y <= 9999` and the loop runs at most 10,000 times regardless of row count or file size. The bound is enforced by the shape check (7.1), which every row passes before it can become a row; the geometry module additionally clamps its inputs to `[0, 9999]` at the point of use so the bound is a property of the geometry module and not only of its caller. Each iteration is one small object allocation; 10,000 Recharts data points render in well under a second and are reachable only by an export carrying dates in year 0000 and year 9999.
- Measured at the security review: the Auditor's worst case (one species carrying a year-0000 and a year-9999 date, which only a hand-edited file can hold) costs about 0.55 s for the first chart draw in jsdom and about 0.7 s for each re-draw on row hover, focus or a width change, bounded and linear in the span, and no code change is recommended.
- Everything else in the geometry module iterates over the rows (at most one per distinct year, so at most 10,000) or over the twelve months.

No other read of user-file text is added. `submissionId` reaches a URL only through `ChecklistLink`'s existing `SUBMISSION_ID_RE` guard. The React `key` of a row is its `year` (a number from a validated string), and no DOM `id` or IDREF is built from any field.

## 8. Entry chunk and lazy loading (NFR-07, QA-25)

- `SpeciesDetail.tsx` is reached only through `lazy(() => import('./components/SpeciesDetail'))` in `App.tsx`, so nothing this feature adds can reach the entry chunk as long as it is imported only from Species Detail. `firstOfYear.ts`, `firstOfYearChartGeometry.ts` and `FirstOfYearSection.tsx` are static imports of `SpeciesDetail.tsx`; all three are dependency-free apart from `react`, `lucide-react`, `ChecklistLink`, `formatDate`, `useIsPhone`, `speciesDetail/ui` and the `MONTH_ABBR` constant.
- `FirstOfYearChart.tsx` is reached only through `import('./FirstOfYearChart')` inside `FirstOfYearSection.tsx` and is the only new file that imports `recharts`.
- State of fact the Engineer and Tester must not overstate: `speciesDetail/SightingsGraph.tsx` is a STATIC import of `SpeciesDetail.tsx` and imports `recharts`, so the `vendor-recharts` chunk is already loaded whenever Species Detail is mounted. The new chart's laziness therefore buys the section's non-chart part a graph free of Recharts (NFR-07's second clause) and keeps the house shape of `PlanChart`; it does not make Recharts load later on this tab than it does today. Write the claim that way in tests and records.
- `entryChunk.test.ts` stays green as it stands. Add two paired rows in the file's convention: `has('components/speciesDetail/FirstOfYearChart.tsx')` is false for the entry closure and the section's source contains the literal `import('./FirstOfYearChart')`; and the chart's own closure contains the `recharts` external while `closureFrom('components/speciesDetail/FirstOfYearSection.tsx')` contains no `recharts` edge and does reach `lib/firstOfYear.ts` and `lib/firstOfYearChartGeometry.ts` (non-vacuity).
- No `modulepreload` of the chart: the existing preload assertion's pattern needs no change, since the chart is a lazy chunk inside an already lazy tab.

## 9. Rules the Engineer can test, one sentence each

- **Smallest date per year (FR-02):** for each year, the row's observation is the one whose `date` string is lexicographically smallest among that year's well-formed dates, compared with `<` on the strings; over fixed-shape `YYYY-MM-DD` strings this is the same order `localeCompare` gives `computeSightingsStats`.
- **Tie rule (FR-02, QA-03):** iterating in file order, an observation replaces the year's kept observation only when its date is strictly smaller, so of two observations sharing the smallest date the first in file order is the row's observation, which is the observation `computeSightingsStats` returns as `firstObs` for the same two rows.
- **Malformed dates (FR-03):** an observation failing `isWellFormedDate` is skipped and can neither create a year nor be a year's observation; a sibling well-formed row in the same year is chosen instead.
- **Year and order from the string (FR-04, NFR-08):** `year` is `Number(date.slice(0, 4))` and no `Date` object is constructed anywhere in `firstOfYear.ts` or `firstOfYearChartGeometry.ts`, so results are byte-identical under any `TZ`.
- **Day of year (FR-05):** `dayOfYear` is the cumulative table `[0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334][month - 1] + day`, plus 1 when `month > 2` and the year is a leap year, giving 2024-02-29 = 60, 2024-03-01 = 61, 2023-03-01 = 60, 2024-12-31 = 366, 2000-03-01 = 61, 1900-03-01 = 60.
- **Gap year (FR-06, FR-19, FR-21):** a year with no well-formed in-scope date has no row; in the chart data it is a point whose `dayOfYear` is `null`, the year axis still spans it, and `connectNulls={false}` draws no segment across it; `segmentsOf` lists exactly the consecutive-year pairs with two non-null points.
- **Current year (FR-07, FR-14):** nothing in the two lib modules or the section reads a clock; the current year is an ordinary row and carries no marker by default.
- **Zero rows (FR-10):** `computeFirstOfYear` returns `[]` and `FirstOfYearSection` returns `null`, so no heading, list, note or wrapper element is in the DOM.
- **Chart threshold (FR-18):** the chart slot (Suspense, fallback, lazy chart) renders only when `rows.length >= 2`; at one row the section renders the heading and the one row and no chart element, placeholder or sentence.
- **Row order (FR-13, OQ-04 default):** the derivation returns rows ascending by year; the section renders `[...rows].reverse()`, so document order is newest year first.
- **Date-range interaction (FR-16):** rows are derived from `speciesObs`, which the tab has already filtered by the date range, so a range starting in March makes the year's first the first in-range date; while `dateRangeActive` is true the section shows the one muted line "First dates within the selected date range." and otherwise shows no line; a county filter alone adds no line; the heading is "First of Year" in every state.
- **Month axis (FR-20):** the y domain is `[1, 366]`; candidate ticks are the twelve month starts at leap-year day numbers `[1, 32, 61, 92, 122, 153, 183, 214, 245, 275, 306, 336]`; `monthTicks(plotPx)` always includes January and December and includes intermediate months at the densest step `k` in `{1, 2, 3, 6}` for which every adjacent pair of chosen ticks is at least `FOY_LABEL_MIN_GAP_PX` apart at `plotPx / 365` pixels per day, falling back to January and December alone; the one-day shift of month starts in a non-leap year is accepted as immaterial at chart scale, per the brief.
- **Year axis (FR-19):** `XAxis` is `type="number"` with `domain={yearDomain}`, `ticks={yearTicks}`, `allowDecimals={false}` and `interval="preserveStartEnd"` so labels never overlap on a long span; the first and last years are always labeled.
- **Height reservation (FR-24):** the Suspense fallback is a `div` whose inline `height` is `firstOfYearChartHeight(wide)` and the chart's `ResponsiveContainer` height is the same call, so the section's measured height is unchanged before and after the chunk resolves.
- **Accessibility (FR-23, NFR-01):** the chart's outer `div` carries `role="img"` and the one `aria-label` ("First of year by day of year, one point per year. The dates are listed above." or The Designer's wording that states both facts); the inner `div` carries `aria-hidden="true"` and `inert`, `LineChart` has `accessibilityLayer={false}`, and no element inside the chart subtree is focusable; each row's date is a `ChecklistLink` and so a `Link` primitive with the default tab stop.
- **Colors (FR-22, NFR-02):** the line and dot use `var(--sr-graph-individuals)`, the grid `var(--sr-border-subtle)`, the tick text `var(--sr-text-muted)`, the dot ring `var(--sr-surface)`; no literal color appears in either new component.
- **Performance (NFR-03):** `computeFirstOfYear` is one pass over `obs` with a `Map<number, ObservationEntry>` keyed by year, then a sort of at most the number of distinct years; the only memo is the one `useMemo` in `SpeciesDetail.tsx`; no module-level cache or memo table is keyed on user content.
- **Network and storage (NFR-04):** the feature's files import nothing from `transport`, `storage`, `replayStore`, `clearDerived` or `lib/icloud`, and render-time `fetch` calls are zero. Stated in the durable form: no third-party request, no new endpoint or host, and no request moved between components.

## 10. What The Designer decides

Defaults are set so the Engineer can build without the answers; each is The Designer's to change, with the test row that follows it named.

- **Placement (OQ-03):** default directly after the Sightings and Media row and before Subspecies and Forms, full width, inside the Sightings fragment. Moving it moves the Help bullet (QA-27) and the mount line (section 6).
- **Row order (OQ-04):** default newest first (QA-13 expects 2024, 2021, 2019). Reversing it is one `reverse()` and one expected-order edit; there is no sort control either way.
- **Chart position and orientation:** default below the rows, full card width, year along the horizontal axis, day of year increasing upward with month labels (FR-19, FR-20 fix the axes; the chart's place relative to the rows is open).
- **Current-year marker (OQ-01):** default none. If added, it reads a module-level session constant, never a render-time clock (QA-14).
- **Tooltip or interaction (OQ-02):** default none (QA-26). Adding one changes FR-25 and QA-26 and needs a keyboard-reachable equivalent or an argument why the rows suffice.
- **Heading icon and copy:** "First of Year" as the heading (FR-16); the lucide icon in `SectionHead` is open (`CalendarDays` is a reasonable default). The date-range note's text is fixed by FR-16 unless The Designer rewords it while keeping it true under a filter.
- **Row markup and typography:** list versus two-column grid, the year's weight, the date's size (`ChecklistLink size="sm"` or `"md"`), spacing at 320px and 200% text scale (QA-29).
- **Chart heights:** the two tier constants in section 4 (172 and 212 total) are defaults; changing them changes nothing in the tests except through `firstOfYearChartHeight`, which both the fallback and the chart read.
- **Point and line styling:** dot radius, stroke width, whether a lone point (a row with gap years on both sides) gets a larger dot so it reads as a point rather than a speck; colors stay on the tokens in section 9.
- **Held copy (FR-27):** default none. One sentence per surface at most, in `held-copy.md`, never written to the published surfaces.

## 11. No data layer work required

The Engineer proceeds directly to the UI and the two pure lib modules. No migrations, no stored document, no seam change.
