# Calendar tab (v0.5.58)

A new top-level **Calendar** tab that lays out a year of the birder's own eBird
data as twelve monthly grids — a wall calendar's twelve pages — with a count on
each day, relative green shading, a colorblind crosshatch mode, year navigation,
an all-years-combined view, a Year-Overview density, an include-non-countable-forms
toggle, and a click-into-checklists day popup. Frontend-only, offline, zero new
network calls, providers, backend routes, or bundled data.

## What's in it

- **Twelve month grids** for a single year, each day cell carrying a count —
  **species-seen-that-day** or **checklists-that-day**, by a `SegControl` toggle
  (species default). Days are shaded green by their count relative to the active
  view (five quantile tiers via the reused `computeCountyTiers(counts, 5)`), with a
  legend that names its unit and a day popup that links each checklist through the
  shared `ChecklistLink`.
- **Year navigation** across every year the backup covers (gap years skipped,
  disabled at the ends) plus an **All years** combined grid — species become a
  cross-year distinct-species **union**, checklists a **sum**, and February always
  keeps its Feb 29 cell (aligned to the fixed reference leap year 2000 for stable
  weekday columns).
- **Use Textures** (colorblind) mode — each tier becomes a DOM
  `repeating-linear-gradient` crosshatch whose density rises with the tier, reading
  the `--sr-cal-N-rgb` tokens so it follows the theme with no sprites/observer.
- **Additive requirement A — View density (Months | Year) + Year Overview.** A
  second `SegControl` swaps the big month grids for a 3×4 grid of mini-month heatmap
  thumbnails (number-free; a simplified single-direction hatch in textures mode);
  clicking a mini-month flips back to Months and scrolls to that month.
- **Additive requirement B — "Count spuh, slash & hybrids".** A low-emphasis
  `ToggleSwitch` (default OFF) on its own settling row that optionally admits
  non-countable forms into the **Species** metric only, re-tiering the grid and
  turning present-but-zero days into real numbered days; dimmed and inert under the
  Checklists metric.
- **Additive requirement C — header layout.** The four primary controls sit on one
  gracefully-wrapping row; the spuh toggle settles on its own full-width row beneath.

## Architecture / reuse

- **Pure `lib/calendar.ts`** — the single-pass `buildDayCells` derivation (two
  species sets per bucket so the spuh toggle re-reads without re-parsing), plus
  lexical/arithmetic date helpers (`daysInMonth` / `dayOfWeek` / `isValidDateString`
  — never `new Date(str)`, no timezone day-shift). `dataYears` / `defaultYear` /
  `adjacentDataYear` / `metricCount` / `nonZeroMetricCounts`.
- **Pure `lib/calendarTextures.ts`** — the `CAL_HATCH` / `CAL_MINI_HATCH` density
  spec (the monotonic `lineWidth/gap` shape from `countyTextures`, re-tuned; the
  MapLibre sprite path is NOT imported) + `calHatchCss` / `calMiniHatchCss`.
- **New `--sr-cal-1..5` + `--sr-cal-fg` ramp** in both `:root` and
  `[data-theme="dark"]` — deep green, theme-identical, white on-cell number ≥4.5:1
  on every tier (the county ramp can't carry on-fill text at AA; schema §1).
- Reuses `computeCountyTiers`/`CountyTiers`, `loadEbirdObservations`,
  `isNonCountableSpecies`/`normalizeSpeciesName`, `ChecklistLink`, `SetupRequired`,
  `formatDate`, and the tab-layout / lazy-tab seams.
- **Lazy-loaded**, map-free: no calendar file statically imports maplibre /
  `SnowMap` / `SightingsMap` / `CountyLayer`; `entryChunk.test.ts` now asserts this.

## Tests

- `lib/calendar.test.ts` — lexical dates, same-day dedup, non-countable exclusion,
  checklist dedup, malformed dates (incl. non-ASCII digits), leap years, combined
  union-vs-sum, Feb-29, tiering degenerate cases, `dataYears`/`adjacentDataYear`,
  the `includeNonCountable` ON/OFF matrix, and a 20k-row perf bound.
- `lib/calendarTextures.test.ts` — strict monotonic density for BOTH the big and
  mini hatches.
- `lib/calendarContrast.test.ts` — parses the real tokens and asserts the white
  number ≥4.5:1 on every tier in both themes, ramp monotonicity/adjacency, the
  present-but-zero and legend pairs.
- `lib/tabLayout.test.ts` — updated order + the QA-02 auto-append.
- `lib/entryChunk.test.ts` — Calendar-off-entry-chunk + map-free assertions.
- `components/Calendar.test.tsx` — phase gates, twelve grids, legend, metric /
  view-density / textures / spuh toggles, the day popup (both counts + link + focus),
  combined labels, and the settling-row layout.

## Gates

- `npm run typecheck` — pass
- `npm run lint` — pass
- `npm run test` — full suite pass (1343 tests, incl. 89 new/affected)
- `npm run build` — pass; `Calendar` is its own lazy chunk and `vendor-maplibre` is
  absent from `dist/index.html`'s modulepreload.

## Version / docs

Version bumped to **0.5.58** in `frontend/package.json` and
`src-tauri/tauri.conf.json`; `CHANGELOG.md`, `docs/HELP.md`, `README.md`, and the
`website/` showcase (feature row + version pill/footer) updated. No
`PRIVACY_POLICY.md` change (no new network/provider). Backend untouched.
