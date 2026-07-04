# QA Report — calendar-tuneup batch (v0.5.61)

**Date:** 2026-07-04
**Test Runner:** vitest + pytest
**Result:** PASSED

## Test Suite Results

All five gates green on the first attempt (run on Hephaestus at `/Users/developer/devwork/snowraven`); the Tester retry loop was not needed.

| Gate | Command | Result |
|---|---|---|
| Frontend full suite | `npm run test` (frontend) | **PASS** — 113/113 test files, **1406/1406 tests**, 0 failed, 17.06s (vitest v4.1.5) |
| Typecheck | `npm run typecheck` (`tsc -b`) | **PASS** — zero errors |
| Lint | `npm run lint` (`eslint .`) | **PASS** — zero errors, zero warnings |
| Build | `npm run build` (`tsc -b && vite build`) | **PASS** — built in 659ms; only the expected >1100 kB advisories (`vendor-maplibre` 272.93 kB gz, `ebird-taxonomy` 472.14 kB gz, `us-counties` 1,039.77 kB gz). New `SpeciesCombobox` emits as its own lazy chunk (4.64 kB / 1.98 kB gz); no maplibre/county entry-chunk regression (`entryChunk.test.ts` green) |
| Backend regression | `python -m pytest tests/ -q` (via `.venv/bin/python`) | **PASS** — **178/178** in 0.77s |

`lib/calendar.ts` and `lib/countyShading.ts` have zero diff. Files verified (working tree, uncommitted): new `frontend/src/components/SpeciesCombobox.tsx` + `SpeciesCombobox.test.tsx` + `frontend/src/lib/useIsPhone.ts`; modified `Calendar.tsx`/`Calendar.test.tsx`, `SpeciesDetail.tsx`, `calendar.test.ts`, `globals.css`; plus version/doc files (`frontend/package.json` at 0.5.61, `src-tauri/tauri.conf.json`, `CHANGELOG.md`, `docs/HELP.md`, `README.md`, `website/index.html`).

## Acceptance Criteria Verification

### Change 1 — Shared `SpeciesCombobox` (Calendar + SpeciesDetail species filter)

| Criterion | Verdict | Evidence |
|---|---|---|
| Typing filters (common+sci in SpeciesDetail; common-only in Calendar) | **Pass** | `SpeciesCombobox.tsx:54-60` substring over `name` + `sciName ?? ''`; Calendar passes `{ name }` only (`Calendar.tsx:865`). Tests: `SpeciesCombobox.test.tsx:47-59`, Calendar "typing filters the option list" — green |
| Arrow/Enter/Escape/Tab keyboard handling | **Pass** (one caveat) | `SpeciesCombobox.tsx:131-148`; Arrow-moves-active, Enter-selects-active, Enter-selects-first, Escape/Tab-close tests green. Caveat: Enter-with-no-active + `allLabel` — see Known Limitations #1 |
| All-species clear row (onChange null, keyboard-reachable) | **Pass** | Synthetic row always first, never filtered (`:64-67`); `chooseRow` → `onChange(null)` (`:95-96`); ArrowDown from −1 reaches idx 0; stable `optionId(0)`. Tests "clearing row calls onChange(null)", "survives a filter", Calendar "All species row clears the filter" — green |
| `useId`-namespaced ids (no collision between instances) | **Pass** | `:48-50`; test asserts distinct `aria-controls` across two instances |
| Calendar selection narrows grid + closes popup | **Pass** | `Calendar.tsx:867` `onChange={n => { setSelectedSpecies(n ?? ''); setPopup(null) }}`; `speciesFilterActive`/`effectiveForms`/`buildDayCells` call unchanged (`:689-702`); "American Robin only" sub-line + forms-toggle-disabled tests green. Popup-close is code-evidence only (minor — see Known Limitations #3) |
| SpeciesDetail behaviorally identical | **Pass** | 1:1 lift: same filter, same `open ? query : selected` display, same key handling, same outside-click `mousedown`, same `scrollIntoView`, same onFocus `select()`; `selectSpecies` (all ~10 resets), `handleToggleMerge`/`handleToggleSpuh`, `displaySpeciesList`, "{N} species" count line untouched (`SpeciesDetail.tsx:85-114, 212-215, 466-483`). Two deliberate deltas: closed-state border token `--sr-border` → `--sr-border-input` (AA form-boundary upgrade) and `.sr-input-16` added |

### Change 2 — Phone forces Large density (`useIsPhone`)

| Criterion | Verdict | Evidence |
|---|---|---|
| `useSyncExternalStore` over matchMedia; no `resize`/`innerWidth` | **Pass** | `useIsPhone.ts:37-38`; MQL `change` subscription with old-Safari `addListener` fallback; `getServerSnapshot` → false. No `resize`/`innerWidth` anywhere in the change |
| Phone: Compact branch never renders; View toggle hidden | **Pass** | `effectiveDensity = isPhone ? 'large' : density` (`Calendar.tsx:813`) drives the `:952` ternary; phone-matchMedia test clicks Compact, asserts zero mini-months + Large cells. Toggle hide: `globals.css:1096` `.sr-cal-view-toggle{display:none}` in the ≤640 block (out of tab order/a11y tree); test asserts the class hook (CSS rule itself verified by inspection — jsdom can't execute media queries) |
| Desktop/tablet unchanged | **Pass** | Non-phone `effectiveDensity === density`; desktop-width test renders 12 mini-months on Compact; `density` state, `ViewDensity`, `expandMonth` untouched |
| Stale compact setting from a wide session renders Large on phone | **Pass** | Phone test sets `density='compact'` and still gets Large — exactly the stale-state scenario |

### Change 3 — Day-of-month corner in every Large cell

| Criterion | Verdict | Evidence |
|---|---|---|
| Every Large cell (data / zero / nodata) shows the day; pad cells stay empty | **Pass** | `nodata` descriptor carries `day` (`Calendar.tsx:275`) and renders `DayCorner` (`:162-163`); zero (`:187`) and data (`:215`) cells render it; pad renders an empty div (`:156-157`). Tests: data cell shows 14 and 3; March-31 nodata cell shows "31" — green |
| Count stays prominent; combined dates keyed by MM-DD | **Pass** | Count remains the centered `0.6875rem` number; corner day is `.sr-cal-daynum` `0.5625rem` (phone `0.6875rem`, rem-sized). Combined `Mar 14 — 3` test asserts both "14" and "3" |
| Legible in textures mode + both themes | **Pass** | `DayCorner` takes the same tier-color pill (`numStyle`) as the count in textures mode (`:199, :215, :237-239`); colors are the existing AA-guarded `--sr-cal-fg`/`--sr-text-muted` tokens (`calendarContrast.test.ts` unchanged, green) |
| `buildDayCells`/`metricCount`/tiering/legend/popup unchanged | **Pass** | `lib/calendar.ts` and `lib/countyShading.ts` zero diff; Calendar.tsx diff touches no Legend/DayPopup lines |
| Combined-union regression test present + green | **Pass** | `calendar.test.ts` new case "combined Species UNION over DIFFERENT species per year": 2023=2, 2024=1, combined=3, `>= max(single years)` |
| Tier-6 clamp only clamps | **Pass** | `Math.min(tiers.tierFor(count), 5)` at the call site (`Calendar.tsx:282`), not in `countyShading.ts`; identity today (every rendered count is in the tiering set) |
| Compact stays count-only | **Pass** | `MiniDayCell` untouched — count-only, date in hover `title` (`:378, :391`) |

### Ride-along — `.sr-input-16` `!important` fix

| Criterion | Verdict | Evidence |
|---|---|---|
| Class binds on the `<input>`; rule wins over inline font-size | **Pass** | `className` lands on the `<input>` (`SpeciesCombobox.tsx:117`); `globals.css:1079` now `font-size: 16px !important` (was inert vs the inline `0.75rem`/`0.875rem` on the same element); scoped to the ≤640 block only |
| App-wide `!important` doesn't break other `.sr-input-16` carriers | **Pass** | Grepped all ~26 call sites (Checklists, LifeList, BreedingCodeList, WeatherForecastPanel, App, SpeciesDetail, Calendar) — all are form controls with sub-16px inline fonts where the class was previously silently inert; the `!important` activates the always-intended 16px in the ≤640 tier only; desktop untouched |

### Cross-cutting regressions

| Criterion | Verdict | Evidence |
|---|---|---|
| Metrics / species-filter / includeForms no regression | **Pass** | `speciesFilterActive` guard, `effectiveForms` forcing, `formsDisabled` byte-identical; all pre-existing calendar tests (QA-13…49) green in the full run |

## Edge Cases Tested

- Combined-mode Species metric with DIFFERENT species per year: UNION (2+1→3), `>= max(single years)` (`calendar.test.ts`).
- Nodata boundary cell (March 31) still renders its day number.
- "All species" clear row survives an active text filter (never filtered out) and is keyboard-reachable (ArrowDown from −1).
- Two combobox instances on one page: `useId`-namespaced listbox ids do not collide.
- Stale `density='compact'` persisted from a wide session: phone still renders Large.
- Old-Safari matchMedia (`addListener`/`removeListener`) fallback path in `useIsPhone`.
- Enter with no active option selects the first filtered row (tested without `allLabel`; see limitation #1).
- Missing `sciName` (`?? ''`) in the filter predicate — Calendar's common-name-only rows.

## Known Limitations

1. ~~**Enter-with-no-active selects the "All species" row in the Calendar, not the typed match.**~~ **RESOLVED after this report** (suggested one-liner applied). `chooseRow`'s Enter fallback is now `query.trim() === '' ? rows[0] : rows.find(r => r.kind === 'species')` (`SpeciesCombobox.tsx:151`): with a non-empty typed query, Enter selects the first **species** row (e.g. "robin" → Enter selects American Robin), not the "All species" clearing row; only an empty query falls back to `rows[0]` (the All row). SpeciesDetail (no `allLabel`) was never affected.
2. **The `.sr-input-16` phone-tier font bump is app-wide, sight-unseen.** The `!important` newly activates 16px at ≤640 on ~25 previously-inert controls (LifeList facet pills, Checklists selects, BreedingCodeList filters, etc.). Correct per the mobile-prep convention, but it is a real visual change on phones verified only by grep, not by a 320px visual pass — dense control rows could get tighter.
3. **Code/CSS-verified-only behaviors (jsdom cannot exercise them):** the Calendar popup-close-on-selection, and the ≤640 `display:none` of the View toggle (the class hook is tested; the media-query rule is inspection-verified).
4. **SpeciesDetail closed-state combobox border token changed** `--sr-border` → `--sr-border-input` — an intentional-looking a11y upgrade (the AA form-boundary token) with a tiny visual delta.

## Convention Flags

None. The batch adheres to the standing conventions checked: no impure render calls, responsive layout lifted to classes (`.sr-cal-view-toggle` hide in the ≤640 tier, rem sizing), `.sr-input-16` used as the sanctioned px exception for the iOS zoom threshold, colors via `--sr-*` tokens with the existing AA guards, no JS `resize`/`innerWidth` (matchMedia + `useSyncExternalStore`), and `lib/calendar.ts`/`countyShading.ts` left untouched.
