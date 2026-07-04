# QA Report — Calendar View Clarity (v0.5.62)

**Date:** 2026-07-04
**Test Runner:** vitest (frontend) · production build (`tsc -b && vite build`)
**Result:** PASSED

## Test Suite Results

Independent ground-truth run (orchestrator, not the Engineer's self-report):

- `npx vitest run` (full frontend suite) — **113 files, 1410 tests, all passing.**
- `npm run build` (`tsc -b && vite build`) — **exit 0.** `vendor-maplibre` and
  `us-counties` remain separate on-demand chunks (off the entry chunk); the
  `entryChunk.test.ts` guard passed in the full run. The >1100 KB chunk warning
  is the pre-existing, expected maplibre/counties/taxonomy vendor size.
- `npm run typecheck` (`tsc -b`) — clean.
- `npm run lint` (includes build-blocking `react-hooks/purity`) — clean.
- Targeted re-run after two cosmetic cleanups — `Calendar.test.tsx` +
  `calendar.test.ts` = **83 tests passing**, typecheck clean.
- Backend suite not run — no backend files touched (`git status` confirms).

## Change-Brief Verification

| Item | Result | Notes |
|---|---|---|
| Combined ("all years") grid aligns weekday columns to the **current year** | ✓ Pass | `leadYear = combinedView ? CURRENT_YEAR : view.year` → `dayOfWeek(leadYear, month, 1)`. `CURRENT_YEAR` derived from a module-level `SESSION_NOW_MS` (import-time constant), replacing the removed `COMBINED_REF_YEAR = 2000`. New test asserts the combined lead-in equals `dayOfWeek(currentYear, m, 1)` for Jan/Mar/Jul — values that genuinely differ from the old fixed-2000 leads, so the test fails on pre-change behavior. |
| **Feb 29 preserved** in the combined view regardless of current-year leapness | ✓ Pass | `dim = combined && month === 2 ? 29 : daysInMonth(leadYear, month)`. Non-leap 2026 still renders the Feb-29 cell (the README promise); single-year views use real leapness. Weekday lead-in and day count are cleanly decoupled. New test asserts a "29" cell survives in the combined grid. |
| Count / union / sum invariants unchanged (v0.5.61 lock) | ✓ Pass | `calendar.ts` aggregation is byte-identical (only a doc comment changed); `calendar.test.ts` union/sum regression locks untouched and green. Change is layout/geometry only. |
| `MonthGrid` keeps per-cell day-of-month labels | ✓ Pass | Unchanged from v0.5.61. |
| `YearOverview` mini-cells are shading-only (numbers **and** title tooltips removed) | ✓ Pass | `MiniDayCell` now renders bare `aria-hidden` shaded divs; the number span and per-cell `title` are gone. Exact figures remain in the big-grid view and the day popup. |
| `.sr-cal-minimonth` container-query CSS retired | ✓ Pass | `container-type` and the `@container (min-width: 152px)` / `.sr-cal-mininum` block removed; the `.sr-cal-mini-open` hover affordance kept and still wired. No dead rules or dangling classNames either direction. |
| View toggle labels swapped: month-grid → **Compact**, overview → **Large** | ✓ Pass | SegControl options relabeled; internal state moved to density-neutral `'months'`/`'overview'` values so code and label can't drift. Every consumer (`effectiveMode`, grid branch, `expandMonth`, phone force, titles) honors the swap in one direction. |
| Phones keep forcing the month-grid view (now labeled Compact) | ✓ Pass | `effectiveMode = isPhone ? 'months' : viewMode` → `'months'` resolves to the `MonthGrid` branch. |
| Docs + version synced | ✓ Pass | `0.5.62` in both `frontend/package.json` and `src-tauri/tauri.conf.json`; new CHANGELOG entry; README, `docs/HELP.md`, and `website/` (copy + version pill + footer) updated; no stale "reference year" / old-label wording in published docs. `PRIVACY_POLICY.md` / `ACCESSIBILITY.md` correctly unchanged. |

## Adversarial Verification (7 independent read-only lenses)

Each lens tried to make an intended guarantee fail; every finding would have
been independently refuted before counting. **Result: 0 confirmed findings.**

- **combined-alignment** — leap-year safety + count invariants: clean.
- **render-purity** — only module-level clock reads; `CURRENT_YEAR` drives grid
  geometry only, never year selection: clean.
- **swap-completeness** — every mode consumer consistent; no orphaned
  `large`/`compact`/`ViewDensity`/`COMBINED_REF_YEAR`: clean.
- **css-retirement** — bidirectionally clean; hover affordance kept: clean.
- **docs-version** — versions, CHANGELOG, and all three doc surfaces consistent:
  clean.
- **test-integrity** — assertions got *stronger* (mini-cell test inverted to
  assert absence via 3 negative checks); contrast/texture guard tests
  byte-untouched; no assertion weakened to pass: clean.
- **a11y-surface** — the mini-cell accessible name was always on the enclosing
  `MiniMonth <button>`, not the cells, so removing cell text stripped only
  decorative content — no WCAG regression: clean.

## Cosmetic cleanups applied (Case-1 cascade, post-verification)

Three now-stale naming leftovers, fixed and re-verified green:

1. Toggle group `aria-label` "View density" → **"Calendar view"** (visible copy
   had dropped the "density" framing).
2. `globals.css` phone-hide comment said phones show "the Large view" — inverted
   by the swap; corrected to **"the Compact view."**
3. `calendar.test.ts` comment "(the combined ref leap day)" removed — year 2000
   is no longer the combined reference (the assertion itself is a valid,
   unchanged purity check).

## Known Limitations

- The counterintuitive-at-a-glance labeling (the *dense* big month grids are
  labeled "Compact"; the *small* thumbnails are labeled "Large") is the
  deliberate, requested swap — not a defect. Every consumer and all docs honor
  it consistently.
- The `.sr-input-16` iOS-zoom activation caveat carried from v0.5.61 is
  untouched and out of scope here.
