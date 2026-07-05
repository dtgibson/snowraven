# QA Report — Calendar Date Placement (v0.5.63)

**Date:** 2026-07-05
**Test Runner:** vitest (frontend) · production build (`tsc -b && vite build`)
**Result:** PASSED

## Scope verified
Six changes, all frontend-only / offline, developed iteratively with the user
against a live desktop-app preview:
1. Day-of-month numbers removed from the big month grids (Compact) — count-only.
2. Numbers added to the year-overview thumbnails (Large) + the `.sr-cal-minimonth`
   152px container-query legibility floor restored.
3. Cross-view link removed — overview months are non-interactive (no view switch).
4. Overview day cells open the day popup in place (birded days only, mirroring the
   grid; months still don't navigate).
5. Each popup checklist row shows the checklist's time + location (plain text,
   offline).
6. Each popup row shows the checklist's distinct species count (countable by
   default, with-forms via the toggle).
Toggle names, internal values, and the combined-view current-year alignment +
Feb-29 pinning are unchanged.

## Test Suite Results (independent ground-truth)
- `npx vitest run` — **113 files, 1423 tests, all passing** (re-run independently
  at each preview iteration and once more after the verification pass).
- `npm run build` (`tsc -b && vite build`) — clean; the Calendar stays a lazy
  chunk and maplibre/us-counties/taxonomy stay off the entry chunk (the pre-existing
  >1100 KB advisory is those known vendors).
- `npm run typecheck` / `npm run lint` — clean (react-hooks/purity build-blocking
  rule included).
- Guard tests `calendarContrast.test.ts` and `calendarTextures.test.ts` —
  byte-untouched.

## Adversarial verification (8 independent read-only lenses, each with a refuter)
**Result: 0 confirmed findings; 0 unrefuted findings.**

| Lens | Result |
|---|---|
| count-invariants (parts 5&6 additive-only; day counts byte-identical) | ✓ clean (10 checks) |
| feb29-alignment (current-year alignment + Feb-29 unchanged; rewritten tests provably fail on the regressions they replace — mutation-tested) | ✓ clean (10) |
| overview-interactivity (months non-interactive, days open popup, pad/nodata not focusable, no dead button, no other cross-view link) | ✓ clean (10) |
| popup-content (first-row capture, graceful null-time/empty-loc degradation, species-count semantics, year chip, ordering) | ✓ clean (8) |
| data-threading-types (widened `DayCell.checklists` shape consistent across all consumers; tsc catches stale readers) | ✓ clean (13) |
| css-render-purity-offline (container-query restore; no `Date.now()` in render; NO new network / no HotspotLink / no fetch) | ✓ clean (10) |
| security-injection (location/time render as escaped JSX; ChecklistLink `SUBMISSION_ID_RE` guard intact; no new href) | ✓ clean (8) |
| docs-version-test-integrity (0.5.63 in both manifests; CHANGELOG covers all six; docs consistent; no weakened assertion) | ✓ clean (13) |

The feb29-alignment lens mutation-tested the rewritten detection (dropped leap
cell → 28≠29; fixed-year lead → 6≠4 both fail as required) and reverted cleanly;
the working tree was confirmed intact with no leaked probe files afterward.

## Known Limitations
- Under an active single-species filter, each popup row's species count reflects
  the filter (0/1) — consistent with the whole tab being scoped to that species;
  in the normal unfiltered view it is the checklist's full species count.
- The overview day cells are intentionally small (sub-44px) tap targets; the
  overview is desktop/tablet-only (phones force the Compact grid, whose cells carry
  the `.sr-touch-target` sizing), so this doesn't affect the phone tap surface.
- The container-query number-hide below 152px is a CSS `@container` rule not
  observable in jsdom; asserted structurally (span present) + enforced by the CSS.
