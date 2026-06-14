# QA Report — Nearby Lifers Map

**Date:** 2026-06-14
**Test Runner:** vitest (frontend) + pytest (backend)
**Result:** PASSED

## Test Suite Results
- Frontend: **911 passing, 0 failing** (74 files) — includes new `lib/nearbyLifers.test.ts` (18) and `components/map/NearbyLiferMarkers.test.tsx` (5).
- Backend: **126 passing, 0 failing** — includes new `tests/test_map_router.py` (the relaxed `/map/recent-obs` codes-optional contract); obsolete `/stats/nemesis` tests removed.
- Frontend typecheck clean, eslint clean, production build OK.

## Acceptance Criteria Verification

| Criterion | Result | Notes |
|---|---|---|
| QA-01 New section exists | ✓ Pass | "Nearby Lifers" appears in the mode bar; selecting it switches to the section (live-verified). |
| QA-02 Auto-load at default | ✓ Pass | Selecting it with a saved default loads pins, no Find click (live-verified). |
| QA-03 Lifer definition | ✓ Pass | `nearbyLifers.test` covers the not-on-life-list filter; backend `back=30`. |
| QA-04 Coordinates present | ✓ Pass | `nearbyLifers.test` skips null/NaN coords; mapService + buildNearbyLifers both guard — no 0,0 pins. |
| QA-05 Location grouping | ✓ Pass | `nearbyLifers.test` group-by-locId; one pin per location (live-verified). |
| QA-06 Count badge | ✓ Pass | Pin chip shows "{n} species" for several (the count) / the name for one; `NearbyLiferMarkers.test` asserts both. |
| QA-07 Popup content | ✓ Pass | `NearbyLiferMarkers.test`: lifers listed by name + favicons (no Species Detail link), recency, date, checklist link (now showing the id). |
| QA-08 List mirrors map | ✓ Pass | InViewMarkerList + lifted selection; row activates the pin, centers, opens the same popup (live-verified; matches the audited in-view pattern). |
| QA-09 List sort | ✓ Pass | `nearbyLifers.test` nearest-first sort; lifersInView preserves it. |
| QA-10 Location chooser | ✓ Pass | Reuses AddressSearch + CenterPointControl + RadiusControl; use-my-location / search re-center + refetch (live-verified). |
| QA-11 Radius units | ✓ Pass | `handleFindLifers` applies `Math.round(radius*1.60934)` km like the other sections (true miles). |
| QA-12 States | ✓ Pass | Loading / error / empty / no-default / no-backup each render their message (live-verified; no-backup + no-default point to Settings). |
| QA-13 Accessibility | ✓ Pass | aria-labels on search + SegControls (aria-pressed), keyboard in-view list, `--sr-*` tokens, BirdName/ChecklistLink; eslint clean. (Full axe scan is The Auditor's stage.) |
| QA-14 Statistics removal | ✓ Pass | Nearby Lifers block + "Other Statistics" card + nav entry removed; grep shows no dangling refs; 911 tests pass. |
| QA-15 Platform parity | ✓ Pass | `/map/recent-obs` relaxed identically in backend `map.py` and Tauri `mapService.ts`; `/stats/nemesis` removed from both; tests pass on both. |
| QA-16 Time-range filter | ✓ Pass | `nearbyLifers.test` isWithinWindow boundaries (1/7/30); displayedLiferLocations re-filters client-side, no refetch (live-verified). |
| QA-17 Media Targets consistency | ✓ Pass | Media Targets Time Range now offers Day / Week / 30 days from the same shared control + predicate (live-verified). |
| QA-18 Shared map chrome | ✓ Pass | Base-layer switcher, atlas overlay toggle, fullscreen / Filters, and in-view list all present in the new section (live-verified). |

## Edge Cases Tested
- Empty result and all-filtered-out (no nearby lifers) → empty message, no WebGL context churn.
- Single lifer vs many at a location → name chip vs "{n} species" chip (both tested).
- Records missing coordinates → skipped, never plotted at 0,0.
- isWithinWindow inclusive boundaries at exactly 1 / 7 / 30 days, same-day, future, and malformed dates.

## Known Limitations
- The desktop (Tauri) `getRecentObs` no-codes path is verified by transport-parity and the live web path; it is exercised in a desktop build at release time (desktop builds are produced on the Mac, not this VM).
- Each lifer appears at its single most-recent location (eBird `/data/obs/geo/recent` returns one record per species) — an intentional design decision recorded in `schema.md`, not a defect.
