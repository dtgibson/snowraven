# PRD — Calendar Tab

- **Feature:** calendar-tab
- **Date:** 2026-07-03
- **Stage:** 2 — The Planner
- **Source:** strategic-brief.md (approved)

---

## Feature Overview

A new top-level **Calendar** tab that lays out a year of the birder's own eBird data
as twelve monthly grids (like a wall calendar's twelve pages), each day cell carrying
a count — species-seen-that-day or checklists-that-day, by a user toggle — relatively
color-shaded (with a colorblind crosshatch-density alternative), navigable across every
year the backup covers plus an all-years-combined view, and clicking a day opens a
popup with that day's summary and links to its eBird checklists. A **view-density toggle
(Months | Year)** switches between the twelve big month grids and a 3×4 Year-Overview of
mini-month heatmap thumbnails, and a low-emphasis **"Count spuh, slash & hybrids"** toggle
lets the Species metric optionally include non-countable forms. It is frontend-only,
offline, and adds zero new network calls, providers, backend routes, or bundled data.

---

## User Stories

- **US-01** — As a birder, I want to see a year of my birding as twelve familiar month
  grids with a number on each day, so that I can grasp the shape of my birding year —
  the busy weeks and the quiet stretches — at a glance.
- **US-02** — As a birder, I want to switch each day's number between "species I saw
  that day" and "checklists I submitted that day," so that I can read either how *good*
  a day was or how *much* I went out.
- **US-03** — As a birder, I want each day shaded by its count relative to the year on
  screen, so that busy and quiet days are legible without reading every number.
- **US-04** — As a colorblind or low-vision birder, I want a texture mode that encodes a
  day's level as crosshatch density instead of color, so that I can read the calendar
  without depending on hue or brightness.
- **US-05** — As a birder, I want to page back and forward through every year my data
  covers (and skip years I have no data for), so that I can compare one year to another.
- **US-06** — As a birder, I want an all-years-combined view that folds every year into
  one twelve-month grid, so that I can see which calendar days I reliably bird across my
  whole history (e.g. recurring migration weeks).
- **US-07** — As a birder, I want to click any day and get that day's summary plus
  working links to that day's eBird checklists, so that I can jump straight from a
  calendar day to the outings behind it.

---

## Functional Requirements

### A. Tab registration & entry

- **FR-01** — The app shall add a new top-level configurable tab, **Calendar**, to the
  tab system via the `lib/tabLayout.ts` seam: a new `ConfigurableTab` id (`'calendar'`),
  an entry in `TAB_LABELS` (`'Calendar'`), and a position in `DEFAULT_TAB_ORDER`. It
  shall NOT be added to `visibleTabs`/`hidden` special-casing beyond the normal tab
  contract. **Note (compiler-mandatory sites):** `TAB_LABELS` (`tabLayout.ts`) *and*
  `TAB_ICONS` (`App.tsx`) are both exhaustive `Record<ConfigurableTab, …>` types, so
  adding `'calendar'` to the `ConfigurableTab` union WITHOUT adding a matching entry to
  each is a `tsc -b` build failure (not a runtime gap). Both entries — the label and the
  tab icon — are required for the build to pass, not merely for completeness.
- **FR-02** — The app shall rely on the existing `parseLayout` auto-append behavior so
  that users with a previously-saved tab layout gain the Calendar tab appended to their
  order (the Named Birds / Checklists precedent), without resetting or reordering their
  saved layout.
- **FR-03** — The app shall wire the Calendar tab into `App.tsx` as a lazy-loaded
  (`React.lazy` + `Suspense`) deferred tab (added to `DEFERRED_TABS`), mounting on first
  open and staying mounted thereafter, consistent with the other data tabs, with a
  labeled `TabLoading` fallback and a tab icon (`TAB_ICONS['calendar']`, per FR-01).
- **FR-04** — The Calendar tab shall read the parsed eBird backup exclusively through the
  shared `loadEbirdObservations()` (`lib/observationsCache.ts`); it shall NOT re-read or
  re-parse the CSV itself. It shall load observations in a `useEffect` keyed on
  `filesVersion` (the `Checklists.tsx` phase-state-machine pattern:
  `loading → setup-required | ready | empty | error`), **NOT** via a synchronous
  `useMemo` — `loadEbirdObservations()` is async and cannot be read from a memo. The pure
  day-bucket derivation (FR-08 … FR-19) runs in a `useMemo` over the *already-resolved*
  `observations` array, re-deriving when the resolved observations, the active view, or
  the active metric change.

### B. Empty / not-loaded / setup states

- **FR-05** — When no eBird backup is loaded (`loadEbirdObservations()` returns null),
  the app shall render the shared setup-required affordance (`SetupRequired` with
  `EBIRD_BACKUP_STEPS`, the pattern used by Checklists / Named Birds), not an empty grid.
- **FR-06** — While the backup is loading/parsing, the app shall show a loading state
  (announced per the app's live-region convention); on a parse/read error it shall show
  an inline error, not a blank or partial grid.
- **FR-07** — When a backup is loaded but contains zero usable dated observations, the
  app shall show an honest empty state ("No dated observations found") rather than a
  blank twelve-month grid or a crash.

### C. Data model — what a day's counts mean

- **FR-08** — The app shall derive all day counts from the parsed observations' local
  `date` field (`ObservationEntry.date`). The parser stores this field **verbatim and
  unvalidated** — it is trimmed only (`cols[dateIdx]?.trim() ?? ''`), so the standard
  eBird export supplies `YYYY-MM-DD` but the parser does NOT guarantee that shape; the
  Calendar module owns validation (FR-12). The app shall treat the string as the
  observation's own local date and shall NOT apply any timezone conversion, `Date`-object
  parsing that could shift the day, or device-timezone adjustment (a checklist logged on
  2026-03-14 must land on March 14 regardless of the viewing device's timezone).
  Date-string handling shall be lexical/component-based — the year/month/day come from
  slicing the string, and the combined-mode bucket key is the lexical `MM-DD` (see FR-16).
- **FR-09** — For the **Species** metric, a day's count shall be the number of *distinct
  species* observed on that date, where "species" is the normalized species name
  (`normalizeSpeciesName`, subspecies parentheticals folded to the parent) and a species
  seen on multiple checklists that same day counts **once** (dedup by normalized name
  across all of that day's rows).
- **FR-10** — The Species metric's distinct-species count shall **exclude non-countable
  forms** — spuh (`… sp.`), slash (`A/B`), and hybrids (`… x …`) — via the shared
  `isNonCountableSpecies` (`lib/speciesUtils.ts`), matching the app's canonical
  life-list-count predicate; soundscape and normal species are included.
- **FR-11** — For the **Checklists** metric, a day's count shall be the number of
  *distinct `submissionId`s* among **all raw dated observation rows** for that day —
  i.e. dedup `submissionId` directly over the *unfiltered* observations, applying the
  same dedup-by-`submissionId` rule as `computeChecklists` but NOT reusing
  `computeChecklists(filterObservations(...))`. **Rationale (critic C-2/F-3):** every
  existing caller feeds `computeChecklists` *spuh-filtered* observations, so a checklist
  whose only rows are spuh/slash/hybrid would vanish from its output; a real birding
  outing still counts as one checklist even if its only species is `Gull sp.`. The count
  is therefore over raw rows, and a checklist with zero countable species still adds 1 to
  its day's Checklists count.
- **FR-12** — A malformed or empty `date` value shall be excluded from all day counts and
  never coerced onto a neighboring day (the app's "out-of-range dates excluded, not
  rolled" precedent). Because the parser does no date validation (FR-08), the Calendar
  module shall itself apply an explicit shape + real-calendar-day guard — a lexical
  `^\d{4}-\d{2}-\d{2}$` match followed by an `isValidCalendarDay(y, m, d)` check (month
  1–12, day within that month's real length including the leap rule) — before a row is
  bucketed. It shall NOT rely on the parser or on `formatDate` (which tolerates junk and
  returns `''` rather than throwing) to reject a bad date. **Per-row rule:** a
  malformed-date row is dropped individually; the checklist it belongs to still counts on
  the date carried by its *valid-dated* rows. A submission with NO valid-dated row
  contributes to no day.

### D. The twelve-month grid

- **FR-13** — For the active view (a specific year, or all-years-combined), the app shall
  render twelve month grids (January–December). In **single-year** mode each month is a
  standard weekday-columned calendar with correctly-placed day cells (leading blanks for
  the first week), so it reads as twelve wall-calendar pages. Combined-mode weekday
  placement is defined in FR-16.
- **FR-14** — Each day cell shall display the active metric's count for that day. A day's
  "no-data vs data" status is decided by **whether it has ≥1 valid checklist** (FR-11/
  FR-12), NOT by the active metric's count:
  - A day with **zero valid checklists** is a **no-data day** — it renders as an
    **empty/blank cell** (no number, no shade tier, no popup, non-interactive per FR-39),
    visually distinct from any shaded day-with-data.
  - A day with **≥1 valid checklist** is a **data day** and is interactive (opens a
    popup, FR-36) even when the *active metric's* count is 0. This can happen only in the
    Species metric: a day whose every observed name is spuh/slash/hybrid has
    Checklists ≥ 1 but distinct-countable-Species = 0 (the FR-10 exclusion). Such a day
    shall render as a **data day with count 0** — it displays "0", is interactive, and is
    shaded at a distinct minimal treatment (see FR-20: it is a data day but is not in the
    non-zero tiering set, so it uses a dedicated "present-but-zero" cell style, not the
    blank no-data style and not a tier-1 fill). It is NOT blank.
  This resolves the earlier "zero vs no-data can't co-occur" claim, which held only for
  the Checklists metric (critic C-4).
- **FR-15** — In a single-year view, the app shall render the twelve months of that
  specific calendar year, with February sized to that year's actual length (28 or 29
  days) via the pure `daysInMonth(year, month)` helper (arithmetic leap rule, no
  `new Date()`, NFR-02).
- **FR-16** — In the all-years-combined view, the app shall render a canonical
  twelve-month calendar keyed by the lexical `MM-DD` string, which **always includes
  February 29** (the `02-29` cell is always present in combined mode, populated only by
  leap-year rows). Because combined mode represents no single real year, its weekday
  placement is defined explicitly: **combined months are aligned to a fixed reference
  leap year (2000)** for weekday columns and leading blanks, so every month has a stable,
  deterministic layout and the Feb-29 cell has a defined weekday slot. (Feb always shows
  29 cells in combined mode.) Each `MM-DD` cell aggregates that calendar day across all
  years per FR-17/FR-18. *(Critic F-5/C-8: the combined bucket key and the weekday
  reference are stated so two builders can't fork on `MM-DD` vs Date objects, or on which
  reference year defines weekday columns.)*

### E. All-years-combined aggregation semantics

- **FR-17** — In all-years-combined mode, a `MM-DD` cell's **Species** count shall be the
  count of *distinct species (normalized, non-countable excluded) ever seen on that
  month/day across all years* — a **distinct-species union across years**, NOT a sum of
  per-year species counts. Concretely: for each `MM-DD` bucket, accumulate a
  `Set<normalizedName>` over every year's rows on that month/day (excluding
  non-countable), and the count is that set's size. (Rationale: summing would double-count
  a species seen on Jan 12 in three different years as "3 species"; the union answers the
  real combined question "how many different species have I ever recorded on January 12?"
  and keeps the Species metric's meaning consistent between single-year and combined
  views.)
- **FR-18** — In all-years-combined mode, a `MM-DD` cell's **Checklists** count shall be
  the **sum** of distinct checklists across all years on that month/day (checklists are
  events, not a set to union — three years each with two Jan-12 checklists is legitimately
  six checklists). The combined semantics (union vs sum) shall be surfaced in the UI/popup
  (FR-24, FR-38) so the two metrics are not conflated.
- **FR-19** — In all-years-combined mode, the **Feb 29** (`02-29`) cell shall aggregate
  only the actual Feb-29 observations from leap years in the data; it shall render as an
  empty no-data cell when the user has never birded a Feb 29 (never blank-suppressed,
  never merged onto Feb 28 or Mar 1).

### F. Relative shading

- **FR-20** — Each **data day with the active metric's count > 0** shall be shaded into a
  tier by its count **relative to the range of the active view**: in single-year mode the
  tiering is computed over that year's own non-zero day counts; in all-years-combined mode
  it is computed over the combined `MM-DD` counts. Re-normalization shall happen whenever
  the active view or the active metric changes, so the shading always reads meaningfully
  for exactly what is on screen. A **no-data day** is unshaded/blank (FR-14). A **data day
  whose active-metric count is 0** (FR-14's present-but-zero case) is not in the non-zero
  tiering set and receives the dedicated present-but-zero cell style, not a data tier.
- **FR-21** — The tiering shall reuse the app's data-driven quantile tier model
  (`computeCountyTiers` / equal-count breaks, `lib/countyShading.ts`): tiers over the
  non-zero day counts, ties/small datasets collapsing to fewer classes (never empty or
  duplicate ranges), and a `tierFor(value) → 0..N` mapping where 0 = no data. The reused
  `computeCountyTiers` is pure and domain-agnostic (equal-count quantile breaks, ties
  collapse, empty input → `tierFor` returns 0 everywhere), and its legend uses an
  **integer-count** assumption (`min = breaks[i-1] + 1`) — valid here because day counts
  are integers. **Coupling note (critic F-2):** `computeCountyTiers` lives in the
  county-named `lib/countyShading.ts`; the Designer may either import it as-is (acceptable —
  it is pure) or lift it to a neutrally-named `lib/` module both consume. Either way the
  legend math (`+1` integer semantics) is inherited, not reinvented.
- **FR-22** — The shading ramp shall reuse the existing green county fill VALUES
  (`--sr-county-1..10` and their `-rgb` triplets). **However — critical correction
  (critic C-1/F-2, the 0.5.44 milestone-badge landmine):** those tokens are asserted
  byte-identical in both themes in `countyContrast.test.ts` *precisely because they only
  ever sit on the always-light Positron basemap* ("basemap-anchored"), and that guard
  explicitly states the county fills carry **no on-fill text**. The calendar cell instead
  sits on the app's **theme-flipping `--sr-surface`** and **carries a number on the
  fill**. Reusing the ramp verbatim is therefore NOT automatically safe. The calendar
  SHALL do ONE of:
  - **(a)** introduce a **calendar-specific ramp** with genuinely different light/dark
    fill values, added to BOTH `:root` and `[data-theme="dark"]`; or
  - **(b)** reuse the `--sr-county-N` fill values but **prove**, via a new
    parse-the-tokens guard analogous to `countyContrast.test.ts`, that the on-cell number
    color stays ≥ 4.5:1 against **every** tier fill in **BOTH** themes (the county ramp's
    dark tiers 7–10 are ~1.21:1 adjacent and were never validated for on-fill text — a
    number on those tiers may fail 4.5:1).
  A `:root` light-tinted value SHALL NOT be reused verbatim in `[data-theme="dark"]` for a
  cell that also carries a number. Any new calendar token goes in both themes before use
  and is added to the contrast guard. The false "identical across themes is a benefit
  here" framing is retracted.
- **FR-23** — When the active view has zero non-zero day counts (an all-blank view — only
  reachable transiently, since a navigable view is guaranteed to have data per FR-31), the
  app shall render no shaded cells and shall not crash (empty breaks → `tierFor` returns 0
  everywhere).
- **FR-24** — The tab shall render a legend that shows what the shade tiers mean for the
  active view (the count range each tier covers), consistent with the county overlay
  legend, and the legend shall update when the view or metric changes. The legend shall
  **label its unit** for the active metric and view, reusing the `COUNTY_METRIC_META`-style
  title pattern, so a tier range is never a bare number — e.g. single-year: "species / day"
  or "checklists / day"; combined: "species ever recorded on this day" (union) or
  "checklists across all years" (sum). *(Critic C-10.)*

### G. Colorblind crosshatch-density (Use Textures) mode

- **FR-25** — The tab shall provide an opt-in **Use Textures** toggle (default OFF,
  session-only, no persistence) that, when on, renders each **data-day** cell's tier as a
  crosshatch whose **density rises monotonically with the tier**, conceptually mirroring
  the county texture DENSITY model: one 45°/135° crosshatch motif whose line spacing (and,
  at the dense end, line weight) encodes the tier, with a faint tier-color underlay
  retained as a residual color cue.
- **FR-26** — The texture mode shall convey the same tier information as the color ramp
  without depending on hue or brightness, and shall keep working across the Species ⇄
  Checklists metric switch and across year / combined navigation.
- **FR-27 (rendering technique — corrected, critic F-1)** — The calendar renders its
  crosshatch as a **DOM CSS technique** (a `repeating-linear-gradient` at 45°/135°, or an
  inline SVG `<pattern>`), **NOT** via the MapLibre canvas-sprite path. `lib/countyTextures.ts`
  is a MapLibre-only module end to end (`countyHatchImageData()` → `ImageData` →
  `map.addImage()` → `fill-pattern`, with a `data-theme` MutationObserver re-registering
  sprites); **none** of that sprite/`ImageData`/`addImage`/MutationObserver machinery is
  reused by the DOM calendar and it shall be explicitly declared not reused. The ONLY
  reuse from `countyTextures.ts` is the pure density model — the `HATCH` spec table and
  `countyHatchDensity()` / `countyHatchSpec()` — as the **single source of the monotonic
  density curve** (the pattern by which `CountyDensitySwatch` imports the shared spec so
  the legend can't drift). The density curve shall be guarded by a strict-monotonic
  density test analogous to `lib/countyTextures.test.ts` (a pure `density(tier)` proxy
  strictly increasing across tiers), so the colorblind encoding cannot silently flatten.
  **Magnitude caveat:** the `HATCH` px values (gap 20→5, weight 0.75→1.30) are tuned for
  MapLibre tile scale, not a ~40px DOM cell, so the Designer may **re-tune the magnitudes**
  for the cell size — the binding requirement is the *monotonic density curve and its
  guard*, not the literal `HATCH` numbers verbatim.
- **FR-28** — The tab's legend shall reflect the active mode: color swatches when Textures
  are off, matching density swatches when on. The legend swatch's density geometry shall be
  derived from the **same** density source the cells use (the `countyHatchSpec` /
  shared-spec precedent), so the legend can never drift from the cells.

### H. Metric toggle

- **FR-29** — The tab shall provide a Species / Checklists metric toggle as a segmented
  control that carries `aria-pressed` on its options; **Species is the default** metric.
- **FR-30** — Switching the metric shall re-label every day cell, re-tier and re-shade
  every day relative to the active view (FR-20), and update the legend and the popup's
  emphasis, with no page reload and no loss of the current year / combined selection.

### I. Year navigation & combined view

- **FR-31** — The tab shall provide back / forward navigation across the years present in
  the backup, plus a distinct **All years** option. The set of navigable years shall be
  exactly the distinct years for which the user has at least one **valid** dated
  observation (FR-08/FR-12). The current calendar year is included in the navigable set
  ONLY if it has ≥1 valid dated observation; it is **never** added merely to host a
  "today" highlight (OQ-04). *(Critic C-6.)*
- **FR-32** — Year navigation shall **skip years with no data**: pressing "previous" /
  "next" shall move to the previous / next *year that has data* (never landing on an empty
  dead-end year that lies in a gap), and the back/forward affordances shall be disabled (or
  hidden) at the ends of the available-years range.
- **FR-33** — The initial year shown on first mount shall be the **most recent year that
  has data** — i.e. `Math.max(...dataYears)`, which needs **no** current-date reference and
  is purity-safe by construction (it does NOT read `SESSION_NOW_MS`; only the optional
  OQ-04 "today" highlight does). It is not All years and not a hardcoded calendar year.
  *(Critic F-6: keep `Date.now()`/`SESSION_NOW_MS` out of the default-year path.)*
- **FR-34** — The active view (selected year or All years), the metric toggle, and the Use
  Textures toggle shall be **session-only state** (`useState`, not persisted through the
  storage seam), matching the county overlay's session-scoped controls. No new persisted
  setting shall be added for v1.
- **FR-35** — The current view shall be clearly labeled (e.g. the year, or "All years") so
  the user always knows which range the counts and shading describe.

### J. Click-a-day popup

- **FR-36** — Clicking (or activating via keyboard, NFR-04) a **data-day** cell (FR-14)
  shall open a popup for that day showing, at minimum: the date (formatted via the app's
  pref-aware `formatDate`), the day's **species count** and **checklist count** (both
  metrics, regardless of which is the active grid metric), and the list of that day's
  checklists.
- **FR-37** — Each checklist in the popup shall be rendered through the shared
  `components/ChecklistLink.tsx` — never a hand-rolled anchor — so the `SUBMISSION_ID_RE`
  shape guard, the label-aware accessible name, and the new-tab behavior are inherited. A
  row whose submission id fails the guard shall render as plain text (never a styled 404
  link), per the shared component's contract. The submission id passed is the real `S…`
  value carried on every observation row.
- **FR-38** — In **single-year** mode, the popup's checklist list shall be that specific
  date's checklists, and its species/checklist counts are that day's own counts (shown
  without an aggregation qualifier). In **all-years-combined** mode, activating a `MM-DD`
  cell shall:
  - list the checklists for that month/day **across all years**, each row labeled with its
    year (or full date) so the user can tell them apart (each via `ChecklistLink`,
    newest-year-first, OQ-07); and
  - show the combined counts **each explicitly labeled with its aggregation** — the Species
    total as a *union* ("14 species ever recorded on Mar 3") and the Checklists total as a
    *sum* ("6 checklists across 3 years") — so the union-vs-sum distinction (FR-17/FR-18)
    is unambiguous in the popup, plus the per-year checklist rows. *(Critic C-5.)*
- **FR-39** — A no-data day cell shall not open a popup (nothing to show); it shall be inert
  to activation and not a tab stop (or otherwise clearly non-interactive), so an empty cell
  never opens an empty popup. (A present-but-zero *data* day, FR-14, IS interactive and
  opens a popup listing its checklists.)
- **FR-40** — The popup shall be closable by Escape, a Close control, and (if a backdrop is
  used) backdrop click, all routed through one close path that restores focus to the
  activating day cell (the app's overlay focus-restore convention).
- **FR-41** — Only one day popup shall be open at a time; opening another day's popup
  replaces it.

### K'. View density (Months | Year) — *additive requirement, approved at design stage*

- **FR-44** — The tab shall provide a **view-density toggle** — a `SegControl` with
  **Months | Year** options (each an icon + label, carrying `aria-pressed`,
  `ariaLabel="View density"`) — on the primary controls row. **Months is the default**
  (`useState<'months' | 'year'>('months')`, session-only, not persisted — FR-34), and
  renders the twelve big month grids (FR-13). Selecting **Year** renders the **Year
  Overview**: all twelve months as small heatmap thumbnails in a **3-column × 4-row**
  grid, laid out with a responsive class (lifted, not inline — NFR-07) that reflows
  **3-wide desktop → 2-wide at ≤1024px → 1-wide at phone width**. View density is
  orthogonal to the metric, year, All-years, and Textures selections — all of which still
  apply unchanged in the Year Overview (the shade legend still labels its unit, FR-24).
  - Each **mini-month** is a real focusable `<button>` (`aria-label="Open {Month} in the
    month view"`, visible focus ring, ~44px-posture where feasible) containing a small
    month label and a compact 7-column Sunday-first (OQ-08) weekday mini-grid; its day
    cells reuse the **same 5-tier ramp** (`--sr-cal-1..5`) as the big view.
  - **Day numbers are dropped at thumbnail size** — the shading/texture is the entire
    signal (WCAG 1.4.1 is still satisfied because the exact counts remain in the day popup
    and, in texture mode, in the density encoding — NFR-03). The three day-cell states are
    preserved but number-free: a **data day** takes its tier fill; a **no-data day** keeps
    a faint `--sr-border-subtle` outline (so year gaps still read); a **present-but-zero
    data day** takes the `--sr-surface-subtle` fill with a `title` tooltip carrying its
    "birded · 0 countable" meaning (no room for a "0").
  - **Texture mode is honored in the Year Overview** with a **simplified single-direction
    (45°) hatch** whose spacing still tightens **monotonically** with the tier (a full
    45°/135° crosshatch clogs a ~7px cell). The mini spec is **sourced from the same shared
    density table** as the big-view crosshatch (FR-27) so the two curves cannot diverge and
    the monotonic-density guard (FR-27/QA-26) covers both.
  - **Click-to-expand:** activating a mini-month (click or keyboard) switches the density
    back to **Months** and scrolls/focuses that month's big card into view — the primary
    click-to-expand affordance. Activating an individual tiny day to open the day popup
    (via the same `openPopup` handler / `DayPopup`) is a permitted nice-to-have extension;
    when built, the inner day cells become buttons like the big view, otherwise they are
    presentational with `title` tooltips.

### K''. Include-non-countable-forms toggle — *additive requirement, approved at design stage*

- **FR-45** — The tab shall provide a **"Count spuh, slash & hybrids"** `ToggleSwitch`
  (`role="switch"`, small variant, session-only `useState`, **default OFF** — FR-34) on
  its **own low-emphasis full-width settling row at the bottom of the control strip**,
  below the primary controls (FR-46) — a low-emphasis refinement of the Species count,
  placed there so it never pushes the primary controls around. Its meaning:
  - **OFF (default):** the Species metric **excludes** non-countable forms — spuh
    (`… sp.`), slash (`A/B`), and hybrids (`… x …`) — via `isNonCountableSpecies`, exactly
    the base FR-10 behavior. A day whose only extra records are non-countable therefore has
    Checklists ≥ 1 but countable Species = 0 — the present-but-zero "0" cell (FR-14).
  - **ON:** each distinct non-countable name counts as a species in the **Species metric
    ONLY**. Turning it on **raises some day counts**, so the Species grid **re-tiers /
    re-shades** relative to the new range (FR-20), a former present-but-zero "0" day
    **converts into a real numbered, tiered data day** (it is no longer present-but-zero),
    and the **legend endpoints and the day popup's species count update** to reflect the
    included forms. The view sub-line appends ", spuh/slash/hybrids included" and the
    popup's species stat is labeled "species (incl. forms)" so the number's meaning is
    never ambiguous.
  - **Species-metric only — Checklists is unaffected.** A checklist counts as one outing
    regardless of whether its species are countable (base FR-11), so the toggle changes
    nothing about the Checklists metric. When **Checklists is the active metric** the whole
    settling row is **de-emphasized (≈45% opacity) and made inert** —
    `aria-disabled="true"`, removed from the tab order (`tabindex="-1"`),
    `pointer-events:none`, and an early-return guard so a stray activation is ignored.
    Switching back to Species re-enables it.
  - **Threading (implementation-binding):** `buildDayCells` (and/or `metricCount` /
    `nonZeroMetricCounts`) shall take an `includeNonCountable: boolean` parameter so the
    Species count re-reads **without re-parsing** (the derivation keeps both a
    countable-species set and a full-forms set per day, or re-derives the Species side over
    the already-built buckets — NFR-01's no-re-read contract holds). The pure unit tests
    shall cover both the ON and OFF outcomes (QA-49 / QA-45).

- **FR-46** — The header shall lay the **primary controls** (Species | Checklists metric
  toggle, year navigator + All years, Months | Year density toggle, Use Textures) on **one
  clean row that wraps gracefully at every width** (verified single-line at 1280px and
  1024px, stacking to their own rows on a phone with no overflow / no orphan wrapping — the
  `.sr-action-row` / wrapping-flex convention, lifted to a class), with the FR-45 spuh
  toggle on its **own settling row beneath** — so the primary controls stay a clean,
  stable row and the low-emphasis refinement never reflows them.

### K. Reuse & non-duplication

- **FR-42** — Every user-facing bird name that may appear (e.g. if the popup ever lists
  species) shall render through `<BirdName>` per the app convention; the tab shall not
  hand-roll name + favicon markup. (v1's popup lists checklists, not species; this
  requirement binds any species rendering that the Designer adds.)
- **FR-43** — The tab shall not introduce any new outbound network call, backend route,
  provider, bundled dataset, telemetry, or persisted setting. All data is derived from the
  already-loaded backup. `PRIVACY_POLICY.md` requires no change. The tab shall be
  `React.lazy`-loaded from `App.tsx` (FR-03) and shall statically import **no** map/maplibre
  module (`SnowMap`, `SightingsMap`, `react-map-gl/maplibre`, `CountyLayer`, etc.), so the
  entry-chunk guard (`lib/entryChunk.test.ts`) stays green. *(Accuracy note, critic F-8:
  `entryChunk.test.ts` today guards **App.tsx's static graph**, not a `calendar` path — a
  well-behaved lazy Calendar tab that imports no map code keeps it green incidentally. The
  real standing check is "Calendar is `lazy()` and imports no `SnowMap`/`SightingsMap`/
  maplibre"; consider extending `entryChunk.test.ts` with a Calendar-specific assertion if
  mechanical enforcement is wanted — see OQ-09.)*

---

## Non-Functional Requirements

- **NFR-01 (Performance)** — Deriving all day buckets for a view (single year or combined)
  shall run in a **single memoized pass** over the parse-once observations — one loop that
  builds a `Map<bucketKey, DayCell>` where each `DayCell` holds `{ speciesSet, checklistIds
  set / list }` — **no per-cell scans of the full backup, and no `computeChecklists`-then-
  regroup double scan**. The derivation SHALL complete in **< 50 ms on a 20k-row backup**,
  measured with `performance.now()` around the pure derivation (or a perf unit test).
  Re-tiering on a metric/view toggle SHALL be a memoized recompute over the already-built
  buckets and SHALL **not** re-read or re-parse the file — asserted by spying that
  `loadEbirdObservations` / `storage.readFile` is not called on a metric or year toggle.
  *(Critic C-7: "no visible stall" replaced with an observable budget + a no-re-read
  assertion.)*
- **NFR-02 (react-hooks/purity)** — No impure call (`Date.now()`, `new Date()`, etc.) shall
  run in a render body, `useMemo`, or `useCallback`. The default-year choice (FR-33) needs
  no current-date reference at all. If a "today" reference is needed only for the optional
  OQ-04 highlight, it shall use the module-level `SESSION_NOW_MS` constant read into pure
  helpers (the `MapExplorer.tsx` pattern: `const SESSION_NOW_MS = Date.now()` at module
  top), or be computed in an event handler / effect. `daysInMonth` uses the arithmetic leap
  rule, not `new Date()`. The build's `react-hooks/purity` and `tsc -b` gates shall pass.
- **NFR-03 (Accessibility — WCAG 2.1 AA)** — The tab shall meet the app's AA bar: the
  metric toggle and any segmented/pill controls carry `aria-pressed`; the Use Textures
  toggle and year controls carry accessible names; result/loading/error states are
  announced via polite live regions / alerts; and the shading conveys information that is
  also available non-visually (the popup's exact counts and, in texture mode, the density
  encoding) so meaning is never color-only (WCAG 1.4.1 Use of Color).
- **NFR-04 (Keyboard operability)** — Every interactive day cell shall be a real focusable
  control (a `<button>`, not a clickable `<div>`) reachable and activatable by keyboard
  (Enter/Space), with a visible focus ring; the popup shall be keyboard-operable and
  focus-managed per FR-40. Non-interactive (no-data) cells shall not be tab stops.
- **NFR-05 (Contrast)** — Because the calendar cell sits on the theme-flipping
  `--sr-surface` and **carries a number on the fill** — unlike the always-light basemap the
  `--sr-county-*` ramp was tuned for — the calendar SHALL introduce (or reuse-and-prove per
  FR-22) a tier ramp whose **on-cell number stays ≥ 4.5:1 against every tier fill in BOTH
  themes**, guarded by a new parse-the-tokens contrast test analogous to
  `countyContrast.test.ts` (monotonic ramp, ≥ 1.2:1 adjacent, **and** the new on-cell-text
  ≥ 4.5:1 assertion — which `countyContrast.test.ts` does NOT currently make because the
  county fills carry no on-fill text). This guard runs in both themes and blocks a
  regression at the token level, not at the user's eyes (the 0.5.44 milestone post-mortem).
- **NFR-06 (Theming)** — The tab shall render correctly in both light and dark themes using
  only `var(--sr-*)` tokens (no hardcoded hex/rgb in component files). Because the crosshatch
  is a DOM CSS technique (FR-27), its colors come from `--sr-*` / `--sr-*-rgb` tokens on the
  DOM element and follow the theme automatically — there is no canvas-sprite regeneration
  and thus **no `data-theme` MutationObserver** in the calendar (that machinery belonged to
  the MapLibre sprite path, which is not reused).
- **NFR-07 (Responsive)** — The twelve-month layout shall reflow cleanly from a ~320px phone
  to a large desktop and hold at 200% in-app text scale, using the app's shared responsive
  `.sr-*` layout classes (lifted to classes, not inline `display`/grid) — e.g. a
  self-collapsing month grid so the twelve pages stack toward one column on a phone and tile
  on desktop. No element shall leak page horizontal scroll at 320px; wide content scrolls
  within its own `.sr-scroll-x` container. Touch targets on dense day cells shall respect the
  ~44px posture in the ≤640 tier per the mobile-prep conventions where feasible without
  breaking the calendar's density.
- **NFR-08 (Offline / zero-network)** — The tab shall function fully offline; it makes no
  network calls of its own. It shall not statically import any map/maplibre module (FR-43).
- **NFR-09 (Session-purity of "now")** — Any use of the current date (only the optional
  OQ-04 "today" highlight) shall be deterministic within a session and shall not re-render or
  shift mid-session; it is derived once from `SESSION_NOW_MS`. The default-year choice does
  not depend on "now" (FR-33).
- **NFR-10 (Testability)** — The day-bucket derivation, the year-set / navigation, the
  `daysInMonth` / `isValidCalendarDay` helpers, and the combined-mode aggregation (union vs
  sum) shall live in a pure, unit-tested module (the `lib/checklistsTab.ts` /
  `lib/countyShading.ts` precedent), covering the edge cases in this PRD (leap day,
  no-data-year skip, same-day dedup, non-countable exclusion, malformed-date exclusion,
  spuh-only-checklist counting, present-but-zero data day, union-vs-sum), independent of the
  React component.

---

## Out of Scope

- Editing, adding, or annotating any eBird data — the tab is strictly read-only.
- Week, day, or agenda/list drill-down layouts, or any granularity other than the twelve
  month grids (a day popup is the only drill-in).
- Any non-eBird data on the calendar (weather/tide overlays, media, breeding codes); the
  day metric is species OR checklists only.
- Non-count day metrics (individual-bird totals, effort hours, distance).
- Year-over-year trend charts or any statistics beyond the grid views. *(The Year-Overview
  density added at design stage — FR-44 — is a compressed re-rendering of the **same**
  twelve month grids as thumbnails, not a new statistic or trend chart; it is in scope.)*
- Persisting the selected year, metric, textures, view-density, or count-forms choice
  across sessions — all session-only `useState` for v1 (FR-34/FR-44/FR-45).
- Export, printing, sharing, or a "print calendar" layout.
- Any new network call, provider, backend route, bundled dataset, or telemetry.
- Highlighting/annotating "life first" days or milestone days (not requested; may be a
  future enhancement).

---

## Open Questions

Each carries a **default assumption** to use if Stage 5 does not resolve it.

- **OQ-01 — Zero-count vs no-data cell rendering.** For eBird data a day either has ≥1 valid
  checklist or none. **Default (revised per critic C-4):** a **no-data day** (zero valid
  checklists) renders blank, non-interactive, unshaded (FR-14); a **data day with an
  active-metric count of 0** (only spuh/slash/hybrid observed, so Checklists ≥ 1 but
  countable Species = 0) is NOT blank — it shows "0", is interactive, opens its popup, and
  uses a dedicated present-but-zero cell style. State in the legend/help that blank = no
  birding that day, and that a "0" cell = birded that day but no countable species (Species
  metric). *(The earlier "data-but-zero can't occur" wording was true only for Checklists;
  the FR-10 exclusion creates it for Species.)*
- **OQ-02 — Combined-mode Species aggregation (union vs sum).** **Default (decided):**
  distinct-species **union** across years (FR-17) for Species; **sum** for Checklists
  (FR-18). Both explicitly labeled in the popup (FR-38) so they are not conflated. Stage 5
  may only change this with an explicit rationale.
- **OQ-03 — Default initial view.** **Default:** most-recent year with data (FR-33), not All
  years. (Alternative worth Stage-5 consideration: default to All years for the "whole
  history" first impression; rejected by default because a single recent year is the more
  legible, lower-cognitive-load first screen and matches "the shape of *this* year.")
- **OQ-04 — "Today" highlight.** Whether to visually mark the current calendar day (only
  when the active year is the current year, which per FR-31 only exists in the navigator if
  it has data) is unspecified. **Default:** add a subtle, token-based "today" outline on the
  current day in the current-year view only; it is purely decorative (no count/behavior
  change) and derives the date once from `SESSION_NOW_MS` (NFR-02/NFR-09). Keep it out of
  the default-year path (FR-33). If it complicates the design, omit it — it is not a
  requirement.
- **OQ-05 — Tier count for the day ramp.** The county ramp is 10 classes. **Default:** reuse
  10 classes via `computeCountyTiers` for consistency; Stage 5/Designer may reduce the class
  count for a calendar day cell if 10 proves visually indistinguishable at cell size,
  provided the chosen calendar ramp and its contrast guard (FR-22/NFR-05) stay in lockstep.
  *(Note: if FR-22 option (a) is taken — a calendar-specific ramp — the class count is a
  free choice; if option (b) — reusing `--sr-county-N` — reducing below 10 just uses a
  subset of the guarded tokens.)*
- **OQ-06 — CSS mechanism for the crosshatch.** **Resolved to CSS by FR-27** (the MapLibre
  sprite path does not apply to DOM cells). The remaining sub-choice is
  `repeating-linear-gradient` vs inline SVG `<pattern>`; **Default:** the Designer chooses
  between those two DOM techniques. The binding requirement is the monotonic density encoding
  (sourced from `countyHatchDensity`/`HATCH`), its guard test (FR-27), and legend-cannot-drift
  (FR-28). *(Critic F-1: the earlier "canvas sprite vs CSS" framing implied the sprite path
  was viable; it is not — retracted.)*
- **OQ-07 — Popup checklist ordering/labeling in combined mode.** **Default:** in combined
  mode, list the month/day's checklists grouped/labeled by year (newest year first), each via
  `ChecklistLink`; in single-year mode, order the day's checklists by time then id. Stage 5
  may refine ordering.
- **OQ-08 — Week start (Sunday vs Monday).** Unspecified. **Default:** Sunday-first weeks (US
  convention, matching the app's primarily-US audience and default date format); not
  user-configurable in v1. Applies to both single-year months and the combined-mode reference
  layout (FR-16).
- **OQ-09 — Mechanically enforce Calendar-off-entry-chunk?** `entryChunk.test.ts` guards
  App.tsx's static graph, so a lazy Calendar with no map imports is safe *incidentally*, not
  by an explicit assertion (critic F-8). **Default:** extend `entryChunk.test.ts` with a
  Calendar-specific assertion (the calendar module and its map-free import subtree are not in
  App.tsx's static closure) so the FR-43/NFR-08 promise is enforced, not merely true. Cheap
  and consistent with the existing test's intent; Stage 5 may skip it if deemed redundant.
  *(Critic-suggested; low cost, so adopted as the default rather than deferred.)*

---

## Success Metrics

Every FR and NFR maps to ≥1 QA row. Each row is an exact, observable pass condition.

| QA ID | Verifies | Pass condition (observable) |
|---|---|---|
| QA-01 | FR-01 | A **Calendar** tab appears in the tab bar labeled "Calendar" with its own `ConfigurableTab` id; `TAB_LABELS['calendar'] === 'Calendar'`, `'calendar'` is in `DEFAULT_TAB_ORDER`, and `TAB_ICONS['calendar']` is defined — a build with the union member but a missing `TAB_LABELS`/`TAB_ICONS` entry fails `tsc -b` (compiler-mandatory sites). |
| QA-02 | FR-02 | A stored layout that predates the tab, when parsed, has `'calendar'` appended to its order (unit test on `parseLayout` with a saved order missing `calendar`), and the rest of the saved order/hidden set is unchanged. |
| QA-03 | FR-03 | The Calendar tab is in `DEFERRED_TABS`, mounts on first open (not first paint), stays mounted after switching away and back (state preserved), shows a labeled loader while its chunk loads, and shows its tab icon. |
| QA-04 | FR-04, NFR-01 | With the backup already parsed by another tab, opening Calendar triggers no second CSV read/parse (it hits `observationsCache`); the load runs in a `filesVersion`-keyed effect (phase-state machine, not a memo), and changing `filesVersion` re-derives. |
| QA-05 | FR-05 | With no eBird backup stored, the tab shows the shared `SetupRequired` (eBird backup steps), not a grid. |
| QA-06 | FR-06 | While loading, a loader/announced state shows; on a forced read/parse error, an inline error shows — never a blank/partial grid. |
| QA-07 | FR-07 | With a backup that has no valid dated observations, the tab shows an explicit "no dated observations" empty state. |
| QA-08 | FR-08, FR-12, NFR-02 | A checklist dated `YYYY-03-14` lands on March 14 with the device timezone set to the two offset extremes — `Pacific/Kiritimati` (UTC+14) and `Etc/GMT+12` / `Pacific/Pago_Pago` (UTC−12/−11) — with no cell shifting by a day. No `Date.now()`/`new Date()` runs in render/memo (lint `react-hooks/purity` passes; grep shows only `SESSION_NOW_MS`/handlers). |
| QA-09 | FR-09 | A species seen on 3 checklists on one date contributes **1** to that day's Species count (unit test on the pure derivation with a same-day, multi-checklist fixture). |
| QA-10 | FR-10 | A day whose only "extra" rows are `Gull sp.`, `A/B`, and `Mallard x American Black Duck` does **not** count them toward the Species metric (excluded via `isNonCountableSpecies`); a normal/soundscape species is counted. |
| QA-11 | FR-11 | A day with 2 distinct `submissionId`s shows a Checklists count of **2** (not the row count). A day whose only checklist contains solely a `Gull sp.` row shows **Checklists = 1** (spuh-only checklists still count — derivation is over RAW rows, not `computeChecklists(filterObservations(...))`). |
| QA-12 | FR-12 | A row with an empty or malformed `date` (`''`, `2024-13-40`, `2023-02-30`, non-ASCII digits) contributes to no cell and is not rolled onto a neighbor; a multi-row checklist with one malformed row still counts on the date its valid rows carry (unit test on the lexical + `isValidCalendarDay` guard). |
| QA-13 | FR-13 | For a chosen year the tab renders 12 month grids Jan–Dec, each with correct leading blanks and correct day counts per weekday column (a "March 1 falls on weekday X" spot check for a known year). |
| QA-14 | FR-14, OQ-01 | A day with no valid checklist renders blank, unshaded, non-interactive. A day with data renders a number + shade. A Species-metric day whose only species are spuh/slash/hybrid renders "0", is interactive, and uses the present-but-zero style — visually distinct from both the blank cell and a shaded data tier. |
| QA-15 | FR-15 | In single-year mode, February shows 29 cells for a leap year (2024) and 28 for a non-leap year (2023), via the arithmetic `daysInMonth` (no `new Date()`). |
| QA-16 | FR-16 | In all-years-combined mode, February always shows a `02-29` cell (present even in a dataset whose most recent years are non-leap); combined months align to the fixed 2000 reference for weekday columns, so every month (incl. Feb 29) has a deterministic weekday slot. |
| QA-17 | FR-17 | Combined Species: a species seen on Jan-12 in three different years contributes **1** to combined Jan-12 Species (union), not 3 (unit test with a cross-year same-day-same-species fixture). |
| QA-18 | FR-18, FR-24 | Combined Checklists: three years each with 2 checklists on Jan-12 give a combined Jan-12 Checklists count of **6** (sum); the legend/popup labels combined Checklists as a sum. |
| QA-19 | FR-19 | Combined Feb-29 aggregates only real leap-year Feb-29 rows; with no Feb-29 data the `02-29` cell is blank no-data, not merged onto Feb 28 / Mar 1 (unit + render test). |
| QA-20 | FR-20 | Switching from a busy year to a quiet year re-tiers the same absolute count differently (N species is a high tier in a sparse year, a low tier in a dense year); combined mode tiers over the combined range; a present-but-zero data day is never assigned a data tier. |
| QA-21 | FR-21 | The day tiering uses the quantile break model: a dataset with ties/few distinct values collapses to fewer classes with no empty/duplicate legend ranges (unit test reusing the `countyShading` break logic; legend `min = breaks[i-1]+1` integer semantics honored). |
| QA-22 | FR-22, NFR-05 | The cells use only `var(--sr-*)` tokens (no hardcoded colors in the component); a new parse-the-tokens contrast test asserts the on-cell **number** color ≥ 4.5:1 against **every** tier fill in **both** themes (light and dark) and is green — whether the calendar reuses `--sr-county-N` (option b) or a new calendar ramp (option a). A `:root` light-tinted value reused verbatim in dark for a number-bearing cell fails this test. |
| QA-23 | FR-23 | A view whose day counts are all equal/degenerate renders without crashing and without invalid tiers (empty-breaks path). |
| QA-24 | FR-24 | A legend is present, labels its unit for the active metric/view (never a bare number), and its ranges update when the year or metric changes; in combined mode it reads "…ever recorded" (species, union) / "…across all years" (checklists, sum). |
| QA-25 | FR-25, FR-26 | Turning on Use Textures (default OFF) renders each data-day tier as a crosshatch whose density rises with tier; textures persist across a Species⇄Checklists switch and a year⇄combined switch; toggling off restores the color view. |
| QA-26 | FR-27 | A `density(tier)` guard test asserts strict monotonic increase across tiers (analogous to `countyTextures.test.ts`, sourced from `countyHatchDensity`/`HATCH`) and is green. Inspection confirms the crosshatch is a **DOM CSS** technique (`repeating-linear-gradient`/SVG `<pattern>`) — no `map.addImage`/`ImageData`/`countyHatchImageData` and no `data-theme` MutationObserver in the calendar code. |
| QA-27 | FR-28 | The legend swatches switch to density swatches when Textures are on, and the swatch density geometry is derived from the same shared spec the cells use (swatch and cell densities match by construction — no drift). |
| QA-28 | FR-29, FR-30, NFR-03 | The metric toggle defaults to Species, carries `aria-pressed`, and switching it re-labels + re-shades every cell and updates the legend without losing the selected year/combined view. |
| QA-29 | FR-31, FR-33 | The tab opens on the most-recent year that has data (`Math.max(dataYears)`, no `SESSION_NOW_MS` read in that path); the navigable set equals the distinct valid-data-years, and the current calendar year is present only if it has data (unit test on the year-set derivation). |
| QA-30 | FR-32 | With a data gap (e.g. data in 2019 and 2023, nothing 2020–2022), pressing previous from 2023 lands on 2019 (skips empty years); back/forward disable at the ends. |
| QA-31 | FR-34, NFR-09 | Selected year, metric, and textures are `useState` only — a relaunch/reopen resets them (no storage-seam write for these), verified by no `storage.setSetting` call for calendar view state. |
| QA-32 | FR-35 | The active view label reads the year (or "All years") and matches the data being shown. |
| QA-33 | FR-36 | Activating a data-day opens a popup showing the formatted date, both the species count and the checklist count, and the day's checklist list. |
| QA-34 | FR-37 | Every checklist row in the popup is a `ChecklistLink` (opens `ebird.org/checklist/{id}` in a new tab with the shared accessible name); a fixture row with a junk id renders as plain text, not a link. |
| QA-35 | FR-38, OQ-07 | In combined mode, activating a `MM-DD` cell lists that month/day's checklists across years, each labeled with its year/date; the popup counts are **each labeled with their aggregation** — Species as a union ("N species ever recorded on …") and Checklists as a sum ("N checklists across M years"). Single-year popup counts show the day's own counts without an aggregation qualifier. |
| QA-36 | FR-39 | Activating (click or keyboard) a no-data cell opens no popup and the cell is not a tab stop; a present-but-zero data cell DOES open its popup. |
| QA-37 | FR-40, NFR-04 | The popup closes via Escape, a Close control, and backdrop (if present), each restoring focus to the activating day cell; the popup content is keyboard-operable. |
| QA-38 | FR-41 | Opening a second day's popup replaces the first (only one open at a time). |
| QA-39 | FR-42 | Any bird name rendered by the tab/popup goes through `<BirdName>` (no hand-rolled name+favicon) — verified by inspection/test if species are shown; N/A-but-honored if v1 popup shows only checklists. |
| QA-40 | FR-43, NFR-08, OQ-09 | No new network request originates from the tab (network panel clean while using it offline); `entryChunk.test.ts` stays green (Calendar is lazy and pulls in no maplibre/map module); `PRIVACY_POLICY.md` unchanged. If OQ-09 is adopted, a Calendar-specific `entryChunk.test.ts` assertion is present and green. |
| QA-41 | NFR-01 | On a ~20k-row backup the pure derivation of a view completes in **< 50 ms** (measured via `performance.now()` / a perf test); toggling metric or year does **not** call `loadEbirdObservations`/`storage.readFile` (spy asserts no re-read/re-parse). |
| QA-42 | NFR-04 | Day cells are `<button>`s (not clickable `<div>`s), reachable by Tab with a visible focus ring, activatable by Enter/Space; no-data cells are not tab stops. |
| QA-43 | NFR-06 | The tab renders correctly in light and dark themes with only `var(--sr-*)` tokens; the DOM crosshatch colors follow the theme via CSS vars with no stale-color textures and no MutationObserver. |
| QA-44 | NFR-07 | At 320px width and 200% text scale, the twelve months reflow (stack toward one column) with no page horizontal scroll and no overlapping rows; wide content scrolls within its own `.sr-scroll-x` container. |
| QA-45 | NFR-10, FR-12, FR-15, FR-16 | The pure derivation module has unit tests covering: same-day species dedup, non-countable exclusion, per-day checklist dedup, spuh-only-checklist counting, present-but-zero data day, malformed-date exclusion (incl. non-ASCII digits and `2023-02-30`), `daysInMonth`/leap behavior, combined Feb-29, no-data-year skip, and union-vs-sum combined aggregation. |
| QA-46 | NFR-03 (1.4.1) | With Use Textures OFF and simulated color-vision deficiency, a user can still obtain each day's exact level via the popup counts (color is never the sole carrier of information); with Textures ON, tier is legible without hue. |
| QA-47 | NFR-05 | The new both-themes on-cell-text contrast guard is a checked-in test file (parse-the-tokens, analogous to `countyContrast.test.ts` but adding the ≥4.5:1 on-fill-number assertion the county guard omits); it fails if a tier ramp is edited to break AA in either theme. |
| QA-48 | FR-44 | The **View** toggle defaults to **Months** (`aria-pressed`); selecting **Year** renders the **Year Overview** — twelve mini-month thumbnails in a **3×4** grid, each a `<button>` with **no day numbers** (shading is the signal), preserving the three cell states (data tier / faint-outline no-data / `--sr-surface-subtle` present-but-zero) and honoring texture mode with the **simplified single-direction hatch** (sourced from the same monotonic density table, QA-26). The grid **reflows 3→2→1** at desktop / ≤1024px / phone with no page horizontal scroll at 320px. **Clicking a mini-month** switches density back to Months and scrolls/focuses that month's big card; the metric / year / All-years / textures / legend selections are unchanged by the density switch. |
| QA-49 | FR-45 | The **"Count spuh, slash & hybrids"** toggle defaults **OFF** (`role="switch"`, own settling row). **OFF:** a day whose only extra records are spuh/slash/hybrid shows Species **0** (present-but-zero cell) — base FR-10. **ON:** those forms are counted in the **Species** metric, that day now shows a **real number + data tier** (no longer "0"), the grid **re-tiers/re-shades**, and the **legend endpoints + the day popup's species count** reflect the included forms (labeled "species (incl. forms)"). The **Checklists metric is unaffected** by the toggle in either state. Under the **Checklists** metric the whole settling row is **dimmed + inert** (`aria-disabled`, not a tab stop, activation ignored). Unit tests cover `buildDayCells`/`metricCount` with `includeNonCountable` **both true and false**. Session-only (no `storage.setSetting`). |
| QA-50 | FR-46 | The primary controls (metric, year nav + All years, Months\|Year, Use Textures) render on **one clean wrapping row** — verified single-line at 1280px and 1024px and stacking to their own rows at 320–375px with no overflow — and the spuh toggle sits on its **own full-width settling row beneath** the primary row (never inline with them). |

---
