# QA Report — tab-improvements batch (v0.5.59)

- **Date:** 2026-07-04
- **Test Runner:** vitest + pytest
- **Result:** PASSED

## Test Suite Results

| # | Gate | Result | Numbers |
|---|------|--------|---------|
| 1 | Frontend full suite (`npm run test`) | PASS | 1374 passed / 0 failed, 112 files |
| 2 | Typecheck (`npm run typecheck` = `tsc -b`) | PASS | 0 errors |
| 3 | Lint (`npm run lint`) | PASS | 0 errors / 0 warnings |
| 4 | Build (`npm run build` = `tsc -b && vite build`) | PASS | built in 649ms; only expected chunk-size warnings (us-counties 3.79MB, ebird-taxonomy 1.74MB, vendor-maplibre 1.03MB) — not failures |
| 5 | Backend (`pytest tests/ -q`) | PASS | 178 passed in 0.76s (run via `backend/.venv/bin/python`) |

All five gates green. Version confirmed at `frontend@0.5.59` in the build header.

## Acceptance Criteria Verification

### Change 1 — Sighting-duration line on Named Birds rows

| Criterion | Result | Evidence |
|---|---|---|
| Duration line present + correct across same-day / multi-day / multi-month (plural) / multi-year | Pass | `formatSightingDuration` (`formatDate.ts:200`) with Y/M/D 30-day borrow; tests cover "1 day", "5 days", "3 mos."/"1 mo.", "2 yrs.", "1 yr. 2 mos." (`formatDate.test.ts:208–245`) |
| Returns `''` on bad input, never throws | Pass | `if (!a\|\|!b) return ''`; test at `formatDate.test.ts:239–244` (null, `''`, `not-a-date`) |
| Pure / render-safe (no `new Date()` / `Date.now()` in render) | Pass | Built on `parseParts` (lexical) + integer arithmetic; operates on fixed strings only |
| Named Birds tab otherwise unchanged | Pass | `NamedBirdRow.tsx:71–79` adds a second `<span>` (0.6875rem, `--sr-text-muted`) inside the existing wrapping group; truthiness-guarded so no stray empty line; sighting count / date range / map untouched |

### Change 2 — Per-species filter on the Calendar tab

| Criterion | Result | Evidence |
|---|---|---|
| `<select>` "All species" default; narrows grid / tiers / legend / popup | Pass | `selectedSpecies` state (`Calendar.tsx:561`) threaded into `buildDayCells` memo (:618), `nonZeroMetricCounts`→tiers (:623), `monthDescriptors` (:636), and `DayPopup` (:892) |
| Species metric = presence; Checklists metric = recording-count | Pass | Filter drops non-matching rows before bucketing (`calendar.ts:134`); tests: filtered day speciesCount=1 (:226), checklistCount counts only checklists recording that species (:239) |
| Spuh toggle disabled + `effectiveForms` neutralization (filtered spuh shows own presence) | Pass | `formsDisabled = … \|\| speciesFilterActive` (:746); `effectiveForms = speciesFilterActive ? true : includeForms` (:614) forces with-forms so a selected spuh renders its own presence, not all-zero; test :192–205 |
| Combined cross-year filtering works | Pass | `calendar.test.ts:251–260` (union speciesCount=1, checklistCount=2 across years, other species excluded) |
| "All species" restores exact prior behavior | Pass | `undefined` filter path is byte-identical; regression test :207–216 (explicit-undefined === all) |
| `aria-label` present on the select (+ iOS zoom guard) | Pass | `aria-label="Filter the calendar to one species"` + `.sr-input-16` (`Calendar.tsx:779–780`) |

### Change 3 — Labels/Dots marker-style toggle on Map Explorer lifer/target panels

| Criterion | Result | Evidence |
|---|---|---|
| Locator dot rendered at anchor in BOTH panels | Pass | 11px `aria-hidden` round span, `tierColors().bg` fill + white ring, in `NearbyLiferMarkers.tsx:79` and `TargetMarkers.tsx:94` |
| Labels/Dots `SegControl` per panel (aria-label + aria-pressed) | Pass | Two SegControls (`MapExplorer.tsx:1807` "Target marker style", :1959 "Lifer marker style"); `SegControl` emits `aria-pressed` (`MapSidebarUI.tsx:24`) + role=group when labeled |
| Dots mode hides label, keeps focusable `<button>` + aria-label + popup | Pass | Label span `display: dots ? 'none'` while `<button aria-label=…>` and popup unchanged; tests lock this (`NearbyLiferMarkers.test.tsx:135–156`, `TargetMarkers.test.tsx:83–103`) |
| Cluster "{n} species" label intact | Pass | `${loc.count} species` / `${group.length} species` retained; aria-label "{n} nearby lifers/target species at {loc}" |
| `escHtml` XSS guard preserved on TargetMarkers | Pass | `dangerouslySetInnerHTML={{__html: labelHtml}}` still built via `escHtml(pin.comName)` + `MEDIA_ICONS` (`TargetMarkers.tsx:71,97`); only visibility gated |
| Adequate tap target in dots mode (≤640 tier) | Pass | `sr-touch-target sr-map-icon-btn-touch` → `min-height:2.75rem` + `min-width:2.5rem` (`globals.css:1039,1043`) |

### Cross-cutting regression checks

| Criterion | Result | Evidence |
|---|---|---|
| No regression to calendar metric / textures / year-nav | Pass | Metric SegControl, textures, year nav, combined-mode, present-but-zero popup all still tested green (`Calendar.test.tsx`) |
| No regression to other map marker layers | Pass | Change is additive to Lifer/Target DOM markers only; GL sighting/hotspot/atlas/county layers untouched; `key` now folds `markerMode` for clean remount |

### Polish note (in-scope, minimal, low-risk)

`Calendar.tsx` DayPopup — the "Spuh / slash / hybrids included in the species count" note now renders only when the include-forms toggle is genuinely ON **and** no concrete species is selected. Added `showFormsNote` prop to `DayPopup` (~line 397); line 472 keys off `showFormsNote` instead of `includeForms` (which was `effectiveForms=true` under a filter, forcing the meaningless note); call site (line 891) passes `showFormsNote={includeForms && !speciesFilterActive}`. No count changed — `speciesNum`/`speciesLabel` still key off the `includeForms` prop (= `effectiveForms`), correct because normalization folds forms into the parent under a filter. Pure display-note gate, consistent with the existing `speciesFilterActive` semantics in the file (lines 605–613, 739–740, 743).

## Edge Cases Tested

- Duration formatter on bad input (`null`, `''`, `not-a-date`) → returns `''`, never throws.
- Duration singular/plural boundaries: "1 day"/"5 days", "1 mo."/"3 mos.", "1 yr."/"2 yrs.", compound "1 yr. 2 mos.".
- Calendar filter set to a spuh/slash entry → renders its own presence (not all-zero) via `effectiveForms` neutralization.
- Calendar "All species" (undefined filter) proven byte-identical to explicit-undefined via regression test.
- Combined cross-year mode with a species filter → correct union counts, other species excluded.
- Two same-named counties across states remain correctly separated (composite key) — unaffected by this batch, re-verified green.
- Dots mode marker keeps a focusable `<button>` with `aria-label` and working popup (no loss of keyboard/AT access).
- `escHtml` XSS guard on target-marker labels preserved under the new visibility gating.
- Present-but-zero calendar day popup still rendered/tested green.

## Known Limitations

- **Duration month-borrow is a fixed 30-day approximation (intended display rounding, not a bug).** Edge example: Jan 31 → Mar 1 computes days = 1−31+30 = 0 → months borrow to read "1 mo." rather than "1 mo. 1 day". The label is deliberately approximate for near-month-boundary spans.
- **Marker-mode `key` no longer includes `markerMode` (FIXED).** An earlier revision folded `markerMode` into both call sites' `key`, which fully remounted the marker set on every Labels↔Dots toggle — dismissing any open popup and re-running the `fitBounds` effect (the map re-framed to the pins). That was corrected: `markerMode` is now a prop only, kept out of the remount `key`, so toggling Labels↔Dots is a clean in-place restyle — no refit, and an open popup is preserved. The 12 marker tests are green, and the prop-not-key rule is promoted to CLAUDE.md's map conventions.
- Chunk-size warnings on `us-counties` (3.79MB), `ebird-taxonomy` (1.74MB), and `vendor-maplibre` (1.03MB) are the known/expected on-demand chunks (`chunkSizeWarningLimit` = 1100), not build failures.
