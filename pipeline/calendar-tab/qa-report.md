# QA Report — Calendar Tab

## Header

| Field | Value |
|---|---|
| **Date** | 2026-07-03 |
| **Feature** | Calendar tab |
| **Test Runners** | vitest (frontend unit/component), pytest (backend regression) |
| **Result** | **PASSED** |

All five verification gates are green (1343 frontend unit tests + typecheck + lint + production build + 178 backend tests). No acceptance criterion is failing. The residual items are verification-debt Known Limitations on structurally-implemented contracts — not test failures.

---

## Test Suite Results

| Gate | Command | Result | Detail |
|---|---|---|---|
| 1 — Frontend unit suite | `npm run test` (`vitest run`) | **PASS** | 111 test files / **1343 passed, 0 failed**; 10.53s. Whole suite, not just calendar files. |
| 2 — Frontend typecheck | `npm run typecheck` (`tsc -b`) | **PASS** | Clean, no diagnostics. |
| 3 — Frontend lint | `npm run lint` (`eslint .`) | **PASS** | Clean, no warnings or errors. |
| 4 — Frontend production build | `npm run build` (`tsc -b && vite build`) | **PASS** | `✓ built in 640ms`. New tab code-split as an on-demand chunk: `Calendar-RhilcssM.js 27.38 kB │ gzip 7.54 kB`. Only warnings are the known pre-existing >1100 kB chunk notices (`us-counties.json`, `ebird-taxonomy`, `vendor-maplibre`) — not failures. |
| 5 — Backend suite | `pytest tests/ -q` | **PASS** | **178 passed, 0 failed**; 0.74s. Frontend-only feature; backend regression check green. |

**Environment note (not a test failure):** the backend suite was run via the project venv (`backend/.venv/bin/python`). Bare `python`/`python3` on this machine (Homebrew 3.11) lack pytest and are not the pytest-equipped interpreter. This is an environment quirk of the runner, not a code or test defect.

**Fixes applied during verification:** None. Everything was green on the first pass — no test needed updating for the new `calendar` tab (existing `DEFAULT_TAB_ORDER` / tab-count assertions already account for it), and there were no `react-hooks/purity` or `noUnusedParameters` breaks.

---

## Acceptance Criteria Verification

Legend: **Verified** = pinned by a passing assertion; **Structural** = guaranteed by construction (type system, grep-confirmed absence, single-state) and confirmed by inspection but not asserted by a dedicated test; **Gap** = a named pass condition not exercised by a test (recorded as a Known Limitation).

| QA | Status | Evidence / gap |
|---|---|---|
| QA-01 | Verified | `tabLayout.ts` adds the union member / `TAB_LABELS` / `DEFAULT_TAB_ORDER`; `App.tsx` adds `TAB_ICONS`. Exhaustive `Record<ConfigurableTab,…>` → `tsc -b` enforces. `tabLayout.test.ts` order fixtures include `calendar`. |
| QA-02 | Verified | `tabLayout.test.ts` — pre-Calendar saved layout gets `calendar` appended, visible, rest unchanged. |
| QA-03 | Structural | Lazy import, `DEFERRED_TABS` membership, mount-gate, `TabLoading`. Sound but no test asserts mount-persistence / state preservation. |
| QA-04 | Gap | Effect is `filesVersion`-keyed, derivation in `useMemo` — structurally correct, but no spy asserts `loadEbirdObservations` is called only once (not re-called on the `observationsCache` hit). |
| QA-05 | Verified | `Calendar.test.tsx` — no backup → "eBird Backup Required". |
| QA-06 | Gap | Loading `role="status"` and error `role="alert"` paths exist in source, but no test exercises the error phase (forced null → inline alert). |
| QA-07 | Verified | `Calendar.test.tsx` — bad-date-only dataset → "No dated observations found". |
| QA-08 | Verified (structural core) | Bucketing is pure string-slicing; grep confirms zero `new Date` in `calendar.ts`/`Calendar.tsx`; `isValidDateString` uses `[0-9]` ASCII class; `calendar.test.ts` asserts lexical bucketing. No `TZ=Etc/GMT+12` test is set, but since no `Date` is constructed from the date string the bucket cannot shift — timezone-safety is structurally guaranteed. |
| QA-09 | Verified | `calendar.test.ts` — same species / 3 checklists → 1. |
| QA-10 | Verified | `calendar.test.ts` — spuh/slash/hybrid excluded from `speciesCount`, counted in `withForms`. |
| QA-11 | Verified | `calendar.test.ts` — spuh-only checklist → `checklistCount:1`, `speciesCount:0` (high-risk item, asserted over raw rows); plus submissionId dedup. |
| QA-12 | Verified | `calendar.test.ts` — `''`, `2024-13-40`, `2023-02-30`, non-ASCII digits rejected; malformed row dropped per-row, checklist still lands on valid rows' date. |
| QA-13 | Partial | 12 month names asserted; `dayOfWeek` unit-tested. Gap: no grid-placement spot check ("March 1 falls on weekday X" / leading-blank count). |
| QA-14 | Verified | `Calendar.test.tsx` — data cell shows number; present-but-zero shows "0", interactive, distinct aria/style. |
| QA-15 | Verified | `calendar.test.ts` — Feb 29/28 via arithmetic `daysInMonth`, incl. 1900/2000 rules. |
| QA-16 | Verified | `calendar.test.ts` — combined `02-29` exists only with real leap row; `dayOfWeek(2000,…)` reference tested. |
| QA-17 | Verified | `calendar.test.ts` — cross-year same-species → union = 1, not 3 (high-risk item confirmed). |
| QA-18 | Verified | `calendar.test.ts` — 3 years × 2 → sum = 6 (high-risk item confirmed); legend/popup sum label tested in component. |
| QA-19 | Verified | `calendar.test.ts` — no Feb-29 data → no `02-29` bucket; never merged onto 28 / Mar-1. |
| QA-20 | Verified | `calendar.test.ts` — present-but-zero excluded from tiering set; re-tiering across ranges via `nonZeroMetricCounts`. |
| QA-21 | Verified | `calendar.test.ts` — `computeCountyTiers([3,3,3,5,5],5)` collapses, no dup/empty ranges, ascending breaks. |
| QA-22 | Verified | `calendarContrast.test.ts` — `--sr-cal-fg` white ≥4.5:1 on every tier in BOTH themes (genuine `>=4.5`; tier-1 = 4.92:1). Strongest guard in the set. |
| QA-23 | Verified | `calendar.test.ts` — empty / all-equal → no crash, valid tiers. |
| QA-24 | Verified | `Calendar.test.tsx` — legend labels unit, updates on metric change; combined "ever recorded". |
| QA-25 | Partial | Textures toggle + persists across metric switch tested. Gap: no assertion that ON actually renders crosshatch on cells (density curve unit-tested separately). |
| QA-26 | Verified (structural) | `calendarTextures.test.ts` strict-monotonic density; grep confirms no `map.addImage`/`ImageData`/MutationObserver (DOM `repeating-linear-gradient` only). |
| QA-27 | Verified | `calendarTextures.test.ts` — legend swatch + cell both derive from the same `CAL_HATCH` spec via `calHatchCss`; no-drift by construction. |
| QA-28 | Verified | `Calendar.test.tsx` — Species default + `aria-pressed`; re-label/re-shade + legend on switch without losing view. |
| QA-29 | Verified | `calendar.test.ts` — `dataYears` distinct/valid/ascending, `defaultYear = Math.max`, no SESSION_NOW; component defaults to 2025. |
| QA-30 | Partial | `adjacentDataYear` gap-skip / null-at-ends tested (pure logic). Gap: no component test asserting prev/next buttons are actually disabled at range ends. |
| QA-31 | Verified | `Calendar.test.tsx` — toggling metric/year/forms → `setSetting` never called (session-only). |
| QA-32 | Verified | `Calendar.test.tsx` — year label; "All years" combined label. |
| QA-33 | Verified | `Calendar.test.tsx` — data cell → popup with both counts + ChecklistLink. |
| QA-34 | Partial | Valid `S100` → `/checklist/S100` link asserted. Gap: junk-id → plain-text half not exercised here (inherited from `ChecklistLink`'s own tests). |
| QA-35 | Verified | `Calendar.test.tsx` — combined popup: "species ever recorded" (union) + exact "checklists across 2 years" (distinct-contributing-years; catches whole-span regression). |
| QA-36 | Partial | Present-but-zero opens popup (tested). Gap: no-data cell being inert / non-tab-stop is structural (`aria-hidden`, `pointer-events:none` div), not asserted. |
| QA-37 | Partial | Escape and Close-button close asserted. Gap: backdrop-click close and focus-restore-to-activating-cell (`openerRef`/rAF path) not asserted. |
| QA-38 | Gap | Single-popup / replace-on-open is structurally true (single `popup` state) but untested. |
| QA-39 | N/A (honored) | v1 popup lists checklists, not species; no bird names rendered. Correctly out of scope. |
| QA-40 | Verified | `entryChunk.test.ts` — Calendar not in App static graph; no maplibre/SnowMap/SightingsMap/CountyLayer in the Calendar subtree. |
| QA-41 | Partial | Perf half verified: `calendar.test.ts` — 20k rows `< 50ms`. Gap: no-re-read/no-re-parse-on-toggle half not verified (same as QA-04). |
| QA-42 | Partial | Day cells are real `<button>`s, no-data are `aria-hidden` divs (structural). Gap: no test asserts button-ness / non-tab-stop / Enter-Space activation. |
| QA-43 | Verified | `calendarContrast.test.ts` parses real tokens both themes; source uses only `var(--sr-*)`; no MutationObserver (grep). |
| QA-44 | Gap | Responsive reflow (320px, 200% scale, no h-scroll): `.sr-cal-*` classes exist and follow convention, but no test and no evidence of a manual viewport pass in the examined artifacts. |
| QA-45 | Verified | `calendar.test.ts` covers the full enumerated edge list (dedup, non-countable, checklist dedup, spuh-only, present-but-zero, malformed incl. non-ASCII & `2023-02-30`, leap, combined Feb-29, gap-skip, union-vs-sum). |
| QA-46 | Partial | Popup exposes exact counts non-visually (tested); texture legibility covered by density guard. CVD-simulation is inherently manual. Acceptable. |
| QA-47 | Verified | `calendarContrast.test.ts` is the checked-in parse-the-tokens guard adding the ≥4.5:1 on-fill assertion county omits. |
| QA-48 | Verified | `Calendar.test.tsx` — Year default Months, 12 mini-month buttons, no day numbers, click-to-expand flips back to Months. Partial: "3→2→1 reflow" and "textures honored in mini" not asserted (mini density unit-tested). |
| QA-49 | Verified | `calendar.test.ts` — `includeNonCountable` tested both TRUE and FALSE on `metricCount`/`nonZeroMetricCounts` (high-risk ON/OFF, covered both ways). Component: default OFF, dimmed+inert under Checklists, re-tiers ON, session-only. |
| QA-50 | Partial | `Calendar.test.tsx` — spuh toggle in a different `.sr-wrap-flex` container than the primary controls. Gap: "single-line at 1280/1024px, stacks at 320–375px, no overflow" has no width-based verification. |

---

## Edge Cases Tested

Covered by `calendar.ts`/`calendarTextures.ts` unit suites and the `Calendar.tsx` component suite:

- **Timezone bucketing safety** — date bucketing is pure string-slicing with zero `Date` construction (grep-confirmed); a bucket cannot shift under any `TZ`.
- **Checklist / species dedup** — same species across 3 checklists → 1 species; dedup by `submissionId`.
- **Non-countable exclusion** — spuh/slash/hybrid excluded from `speciesCount`, counted in `withForms`; `includeNonCountable` toggle exercised both ON and OFF.
- **Spuh-only checklist** — yields `checklistCount:1`, `speciesCount:0` (asserted over raw rows).
- **Malformed dates** — `''`, `2024-13-40`, `2023-02-30`, non-ASCII digits — all rejected per-row; the checklist still lands on valid rows' date.
- **Leap-day handling** — Feb 29/28 via arithmetic `daysInMonth` incl. 1900 (non-leap) / 2000 (leap) century rules; combined `02-29` bucket appears only with a real leap-year row, never merged onto Feb 28 / Mar 1.
- **Union vs. sum** — cross-year same-species union = 1 (not 3); multi-year sum = 6 (3 years × 2); "checklists across N years" uses distinct-contributing-years.
- **Empty / all-equal metric arrays** — no crash, valid tiers; quantile breaks collapse without duplicate or empty ranges.
- **Present-but-zero cells** — excluded from the tiering set, still interactive, render "0" with distinct aria/style.
- **Year navigation gaps** — `adjacentDataYear` skips missing years, returns null at range ends; `defaultYear = Math.max(dataYears)`.
- **Contrast** — white `--sr-cal-fg` ≥4.5:1 on every tier in both light and dark themes.
- **Performance** — 20,000-row dataset buckets in `< 50ms`.
- **Entry-chunk isolation** — Calendar is code-split off the App static import graph; no maplibre/map components leak into first paint.

---

## Known Limitations

**Reconciled 2026-07-03 (closeout):** The three most-defensible gaps below (QA-04/QA-41 no-re-read spy, QA-06 error phase, QA-37 popup focus-restore / backdrop close) plus the QA-38 single-popup case were subsequently CLOSED with mutation-verified tests before ship — `Calendar.test.tsx` grew 15 → 22 tests and the full suite is 1351 passing. They are struck through and annotated below; the remaining items are genuine, still-open verification debt.

These are coverage gaps on real, structurally-implemented contracts. None is a test failure and none indicates a likely shipped bug — they are verification debt. Ranked by defensibility of adding a guard:

1. ~~**QA-04 / QA-41 — no "no re-read / no re-parse on toggle" spy.**~~ **CLOSED (closeout).** Now asserted: `loadEbirdObservations` is called once across several metric/year/textures/forms toggles (mutation-verified).
2. ~~**QA-06 — the error phase is never tested.**~~ **CLOSED (closeout).** The `role="alert"` inline-error path (mock → null) is now exercised.
3. ~~**QA-37 — popup focus-restore and backdrop close unverified.**~~ **CLOSED (closeout).** Backdrop-click close and focus-restore to the activating day cell (`openerRef` + rAF) are now asserted; QA-38 single-popup / replace-on-open is asserted too.
4. **QA-42 / QA-36 — keyboard operability and no-data inertness are structural-only.** No test asserts day cells are `<button>`s, that no-data cells aren't tab stops, or Enter/Space activation. Given the AA keyboard contract, at least one assertion is warranted.
5. **QA-13 — grid placement not spot-checked.** Only the 12 month names are asserted. `dayOfWeek` is unit-tested, but a wrong `buildMonthCells` lead-blank count would pass all current tests; the PRD asks for a "March 1 falls on weekday X" placement check.
6. **QA-44 / QA-50 — responsive/layout claims have no verification.** The `.sr-cal-*` reflow classes exist and follow convention, but "no horizontal scroll at 320px / single-line at 1280–1024px / stacks on phone / 200% text scale" is asserted nowhere and there is no evidence of a manual viewport pass in the examined artifacts. These are the standing mobile lenses in CLAUDE.md; worth an actual render check before the mobile posture is claimed.

Lower-priority (structurally guaranteed, untested here, reasonable to leave to inherited/component-level guarantees): QA-34 junk-id → plain-text half, QA-03 mount-persistence, QA-25 textures-render-on-cell, QA-30 nav-button disabled-at-ends. (QA-38 single-popup replacement was closed at closeout — see item 3.)

---

## Convention Flags

None. The new tab code uses only `var(--sr-*)` color tokens, adds a checked-in parse-the-tokens contrast guard (`calendarContrast.test.ts`) that makes a real ≥4.5:1 on-fill assertion in both themes, keeps the bucketing path free of `new Date` (purity + timezone-safety), uses `[0-9]` ASCII classes for date validation, code-splits off the entry chunk (locked by `entryChunk.test.ts`), and threads settings through the session-only path with no `setSetting` writes. No CLAUDE.md convention violation was observed.
