# QA Report — Frivolous Lists

**Date:** 2026-06-15
**Test Runner:** vitest (frontend) + pytest (backend)
**Result:** PASSED

## Test Suite Results
- Frontend: **932 vitest tests passing**, 0 failing (75 files; includes the new `frivolousLists.test.ts`, 21 cases).
- Backend: **129 pytest passing**, 0 failing (feature is frontend-only; backend unchanged — run to mirror CI).
- Lint (`eslint`, incl. `react-hooks/purity`) clean; `tsc -b` + `vite build` green from a cold compile.
- The Rainbow Warrior matching was independently re-verified by a brute-force oracle over 3500 randomized instances (1825 exercising a forced double) with no counterexamples.

## Acceptance Criteria Verification

| ID | Result | Notes |
|---|---|---|
| QA-01 Section placement | ✓ Pass | Renders as the final `SectionCard` after the optional Media section; live-verified. |
| QA-02 Jump nav | ✓ Pass | "Frivolous Lists" appended to the section jump-nav (after Media); `sectionSlug` id matches. |
| QA-03 Avian American contents | ✓ Pass | All 22 names render via `<BirdName>` in the given order (test: order preserved). |
| QA-04 California Dreamer contents | ✓ Pass | All 7 names render via `<BirdName>` in the given order. |
| QA-05 Checkmarks | ✓ Pass | Recorded → green check; unrecorded → no check and no Species Detail link. (Refinement: unrecorded now also show eBird/BoW favicons.) |
| QA-06 Normalized matching | ✓ Pass | Subspecies entry (e.g. "American Robin (eastern)") still ticks (unit test). |
| QA-07 Progress count | ✓ Pass | Each name-list shows the correct `recorded / total`. |
| QA-08 List completion badge | ✓ Pass | Badge shows only when the whole list is recorded (unit test for complete + incomplete). |
| QA-09 Rainbow order & rows | ✓ Pass | Seven rows in red→violet order, each with swatch + color name. |
| QA-10 Whole-word color match | ✓ Pass | "Red-tailed Hawk" fills red; "Reddish Egret", "Black Redstart", "American Redstart", "Common Yellowthroat" do not (unit tests). |
| QA-11 Earliest-first-seen | ✓ Pass | A color shows the earliest-logged matching species, with that sighting's date/location; oracle-verified. |
| QA-12 Multi-color bird | ✓ Pass | A bird filling two colors is assigned distinctly where possible (avoid doubles); shares only when unavoidable, then shows its earliest. Oracle-verified. |
| QA-13 Rainbow links | ✓ Pass | Name → Species Detail (`onOpenSpecies`); date → eBird checklist (`ChecklistLink`, `SUBMISSION_ID_RE`-guarded); live-verified. |
| QA-14 Empty color | ✓ Pass | A color with no match shows a blank ("— no {color} bird yet"), no link (unit test). |
| QA-15 Rainbow completion badge | ✓ Pass | Badge shows when all seven colors are filled (unit test). |
| QA-16 No new network | ✓ Pass | Computed from already-loaded observations; the 29 hardcoded names ride the EXISTING `/taxonomy/codes` batch — no new request, route, or provider. |
| QA-17 Purity / lint / build | ✓ Pass | eslint (incl. `react-hooks/purity`), `tsc -b`, and build all green; logic is pure with no `Date.now()` / `new Date()` (dates are immutable backup values). |

## Edge Cases Tested
- Empty backup (nothing checked, all rainbow blank); a species seen only as a subspecies; spuh/slash/" x " hybrid names excluded from color matching; determinism under input reordering when two species tie on date + submission id; one bird filling two colors when it's the sole option (forced double) vs. distinct alternative available; two species matching the same two colors assigned distinctly; a forced double showing the color's earliest bird.

## Known Limitations
- A pre-split eBird export (e.g. "Northern Goshawk" before the American Goshawk split) won't tick the corresponding row until the export is re-downloaded — accepted (OQ-01); no legacy-name alias map in v1.

## Convention Flags
- The brute-force-oracle + adversarial-lens verification of non-trivial pure assignment/matching logic (used here for the rainbow matching) caught three subtle bugs that unit tests alone missed. Worth considering as a standing practice for any future combinatorial/assignment logic. (Stage 9 to decide whether this belongs in CLAUDE.md.)
