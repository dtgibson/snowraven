# QA Report — calendar-refinements batch (v0.5.60)

**Date:** 2026-07-04
**Lane:** Improve (maintain) — Stage 3 (Tester)
**Test Runner:** vitest (frontend) + pytest (backend)
**Result:** PASSED

Three refinements to the shipped Calendar tab: (1) a new **Total count** metric,
(2) the **View** toggle relabel Months→Large / Year→Compact, (3) day-number
rendering in the Compact mini-month cells. Verified against each change's
"What done looks like" in `change-brief.md`, plus a full regression sweep.

---

## Test Suite Results

All five gates green.

| Gate | Command | Result |
|---|---|---|
| Frontend full suite | `npm run test` (vitest run) | **1387 passing, 0 failing** — 112 files |
| Typecheck | `npm run typecheck` (`tsc -b`) | Clean, no errors |
| Lint | `npm run lint` (`eslint .`) | Clean, no warnings |
| Production build | `npm run build` (`tsc -b && vite build`) | **Succeeded** — only the expected `vendor-maplibre` / `ebird-taxonomy` / `us-counties` chunk-size warnings (documented as expected; not failures) |
| Backend regression | `python -m pytest tests/ -q` (via `backend/.venv`) | **178 passing, 0 failing** — 0.75s |

Targeted re-run of the three calendar files (`calendar.test.ts`,
`Calendar.test.tsx`, `calendarContrast.test.ts`): **80 passing, 0 failing**.

Notes:
- The backend suite is a pure regression check for a frontend-only change; it
  stayed at the expected 178 green. (`python` is not on PATH on this machine —
  ran via the project's `backend/.venv/bin/python`.)
- Build entry chunk unaffected — `vendor-maplibre` remains an isolated
  off-entry chunk; Calendar is not a map file.

---

## Acceptance Criteria Verification

### Change 1 — New "Total count" metric

| Criterion | Result | Evidence |
|---|---|---|
| Appears as a 3rd *Show* option | ✓ Pass | `Calendar.tsx:812` SegControl option `{ value: 'total', label: 'Total count' }`; test `Calendar.test.tsx:127` clicks it, asserts `aria-pressed` flips |
| Selecting it repaints cells/tiers/legend | ✓ Pass | `metricCount` `'total'` branch (`calendar.ts:233`) → same `computeCountyTiers`→legend pipeline; test asserts the rich day repaints to 3 individuals |
| Legend "Individuals / day" / combined "Individuals across all years" | ✓ Pass | `legendUnit` `'total'` branch (`Calendar.tsx:367-368`); test asserts `Individuals / day` renders |
| Sub-line switches to individual totals | ✓ Pass | `metricPhrase` `'total'` branch (`Calendar.tsx:777-778`); test asserts `/Individuals recorded each day/` |
| "X"/blank-only day reads 0 (matches Statistics `individualCount`: present-not-counted → 0, NOT 1) | ✓ Pass | `individualsOf(count) = count ?? 0` (`calendar.ts:20-22`), documented as matching `birdingStats individualCount`; tests `calendar.test.ts:324` (`individualsOf(null)→0`) and `:348` (X row contributes 0) |
| Species on two same-day checklists SUMS both | ✓ Pass | SUM accumulation, no de-dup (`calendar.ts:161-167`); test `calendar.test.ts:357` (`speciesCount`=1 but `totalCount`=5) |
| Combined view sums across years | ✓ Pass | Same accumulation over `MM-DD` bucket; test `calendar.test.ts:390` (4+6+5 = 15 across 3 years) |
| "Count spuh, slash & hybrids" toggle IS live for Total count (not disabled) and re-tiers it | ✓ Pass | `formsDisabled = metric === 'checklists' \|\| speciesFilterActive` (`Calendar.tsx:786`) — total NOT added; `metricCount('total')` honors `includeNonCountable` (`calendar.ts:233`); test `Calendar.test.tsx:142` asserts the switch is not disabled under Total count |
| Species-filter + Total count = that species' individuals | ✓ Pass | Filter narrows rows before summing; test `calendar.test.ts:401` (Robin-only = 3+4 = 7) |
| Popup shows all three stat tiles | ✓ Pass | DayPopup renders species + checklists + total tiles unconditionally (`Calendar.tsx:520-533`); `totalNum` honors `includeForms` (`:467`) |

### Change 2 — Rename view toggle Months→Large / Year→Compact

| Criterion | Result | Evidence |
|---|---|---|
| View toggle reads "Large \| Compact" | ✓ Pass | SegControl options `Large` / `Compact` (`Calendar.tsx:875-876`); test `Calendar.test.tsx:152` queries both buttons by name |
| Large = big month grids; Compact = 3×4 thumbnail grid (unchanged behavior) | ✓ Pass | `ViewDensity = 'large' \| 'compact'` (`Calendar.tsx:40`); render branch `density === 'large' ? <MonthGrid…> : <YearOverview…>` (`:913`); test asserts 12 mini-months in Compact |
| "Open →" from a compact mini-month expands to Large and scrolls to that month | ✓ Pass | `expandMonth` → `setDensity('large')` (`Calendar.tsx:694`) + scroll; test `Calendar.test.tsx:166` asserts Large `aria-pressed`=true after clicking "Open March" |
| No stray "Months"/"Year" toggle label or 'months'/'year' value remains | ✓ Pass | Grep confirms enum/state/init/handler/branch all use `large`/`compact`; remaining "year" matches are the separate year-navigation control + `CalendarView` discriminant (correctly untouched); `docs/HELP.md:233`, `README.md:14`, `website/` all say Large/Compact |
| aria-label intact | ✓ Pass | `ariaLabel="View density"` unchanged (`Calendar.tsx:871`) |

### Change 3 — Show day numbers in the Compact mini-cells

| Criterion | Result | Evidence |
|---|---|---|
| Every populated mini-cell shows its count number (`--sr-cal-fg`, tabular-nums) | ✓ Pass | `MiniDayCell` renders `{desc.count}` in `--sr-cal-fg`, `0.5rem`, tabular-nums, line-height 1 (`Calendar.tsx:333, 355`); test `Calendar.test.tsx:170` finds the "3" in the March mini-month |
| Legible at 320px single-column | ✓ Pass | `.sr-cal-year` collapses to `1fr` at ≤640 (`globals.css:1081`), so each mini-month spans full width and cells clear the 152px container floor |
| Present-but-zero mini-cell shows a muted "0" | ✓ Pass | zero-kind branch renders "0" in `--sr-text-muted` (`Calendar.tsx:341-342`) |
| Number reads in textures mode (tier pill) | ✓ Pass | textures pill `rgba(var(--sr-cal-${tier}-rgb),0.9)` behind the number (`Calendar.tsx:350-352`), mirroring the Large cell |
| Number reads in both themes (calendarContrast covers `--sr-cal-fg`) | ✓ Pass | `calendarContrast.test.ts:67` asserts `--sr-cal-fg` ≥ 4.5:1 on every tier in BOTH light and dark |
| 3×4 grid + aspectRatio 1/1 intact | ✓ Pass | `.sr-cal-year: repeat(3, minmax(0,1fr))` (`globals.css:692`); mini-cell `aspectRatio: '1 / 1'` (`Calendar.tsx:329`) |
| ~16px container-query floor degrades a sub-floor cell to shading-only WITHOUT distorting the grid | ✓ Pass | `.sr-cal-minimonth { container-type: inline-size }` + `@container (min-width: 152px) { .sr-cal-mininum > span { display: inline } }` (`globals.css:699, 712-714`) — hides only the number span, never the cell/grid |

### No-regression checks

| Area | Result | Evidence |
|---|---|---|
| Existing Species / Checklists metrics | ✓ Pass | Untouched branches in `metricCount`/`legendUnit`/`metricPhrase`; full calendar.test.ts (union/sum semantics) green |
| Species filter | ✓ Pass | `buildDayCells` filter path unchanged; filter tests green |
| Shading / legend / popup | ✓ Pass | Same `computeCountyTiers`→`--sr-cal` ramp; popup extended additively (3rd tile) |
| Metric / textures / year-nav controls | ✓ Pass | Year-navigation control and "All years" toggle unchanged; Use Textures unchanged |
| calendarContrast guard | ✓ Pass | 80 targeted tests incl. contrast guard green; full suite 1387 green |

---

## Edge Cases Tested

- **All-"X" day** → `totalCount` 0 → renders as the present-but-zero `zero` cell
  (muted "0"), not a blank no-data cell (`calendar.test.ts` present-but-zero +
  `nonZeroMetricCounts` exclusion at `:385`).
- **Non-ASCII digit / malformed dates** → rejected by the explicit ASCII
  `DATE_RE` (`calendar.test.ts:48`), per the 0.5.54 ASCII-class discipline.
- **Combined Feb-29** bucket exists only on a real leap-year row; never merged
  onto Feb-28/Mar-1 (`calendar.test.ts:180, 192`).
- **~20k-row performance** — `buildDayCells` combined < 50ms (`calendar.test.ts:471`).
- **Species filter folds subspecies/form parentheticals** into the parent
  (`calendar.test.ts:242`).
- **Popup `includeForms` variance** — `totalNum` reads with-forms field under the
  toggle / concrete species filter (`Calendar.tsx:467`, `effectiveForms`).
- **Container-query floor** — desktop 3-up narrow panel degrades sub-152px cells
  to shading-only; the exact value stays in the Large view + popup.
- **Docs parity** — `docs/HELP.md`, `README.md`, `website/` (copy + version pill
  + footer) all updated to Large/Compact and Total count; version `0.5.60` in
  BOTH `frontend/package.json` and `src-tauri/tauri.conf.json`; CHANGELOG entry
  present and accurate.

---

## Known Limitations

- **Compact mini-cell numbers are visually verified only at the code/CSS level,
  not by pixel rendering.** The unit tests (jsdom) assert the number renders and
  carries its value; the 152px container-query legibility floor and 320px
  single-column layout are verified by reading the CSS rules and the responsive
  breakpoints, not by a live browser screenshot. This is a coverage boundary of
  the jsdom test environment, not a defect — the code paths are correct and the
  contrast token is AA-guarded in both themes. Low residual risk.
- **Multi-digit Total counts in genuinely sub-floor desktop 3-up cells** degrade
  to shading-only by design (the container-query floor); the exact figure is
  always available in the Large view and the day popup. Intended behavior, noted
  for the record.

---

## Convention Flags

None. The batch reuses established patterns (the `metricCount`→`computeCountyTiers`
pipeline, the `--sr-cal-fg` AA-guarded token, the `.sr-input-16`-style sanctioned
px legibility floor, the container-query-over-viewport-breakpoint approach) — no
new standing rule emerged that isn't already captured in CLAUDE.md.
