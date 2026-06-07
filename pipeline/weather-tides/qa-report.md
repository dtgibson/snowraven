# QA Report — weather-tides

**Date:** 2026-06-07
**Test Runner:** vitest (frontend) + pytest (backend)
**Result:** PASSED

## Test Suite Results

- Frontend: **468 tests** passing (34 files) — +33 from the tide work
  (tideStations, tide compute/parse/interp/window, tideFormatter).
- Backend: **102 tests** passing — +9 (tide router: success, predicted fallback,
  subordinate interpolation, too-far, outside-US, force override, not-found,
  invalid id, missing key).
- Build clean, lint clean (both frontend + backend suites green together).

## Acceptance Criteria Verification (prd.md) — incl. live NOAA checks

| Criterion | Result | Notes |
|---|---|---|
| One action renders weather + tide | ✓ Pass | `Promise.all` in handleLookup; independent state per box |
| Level + Observed/Predicted, hi/lo, rising/falling, station+distance, MLLW, attribution, Copy | ✓ Pass | Live: SF Golden Gate gauge → **Observed**, 3.41–3.59 ft, all lines present |
| Predicted fallback when no observed | ✓ Pass | Live: Albany → **Point Isabel** (0.8 mi, subordinate) → **Predicted** via hi/lo interpolation, 4.1–4.6 ft rising |
| Nearest station is actually nearest | ✓ Pass | The reported Albany bug fixed — Point Isabel (0.8 mi) not Richmond (5.6 mi) |
| > 25 mi error + override | ✓ Pass | Live: Denver → **too-far**; force override returns the station |
| Outside-US error + override | ✓ Pass | Live: London → **outside-us** (by US-region test, not distance); force override returns nearest US |
| Tide failure doesn't affect weather | ✓ Pass | Independent state; tide error → muted line, weather unaffected |
| Both runtimes, no new key | ✓ Pass | FastAPI route + Tauri service; keyless NOAA |
| "Copy Weather and Tide Together" — one SnowRaven attribution | ✓ Pass | `buildCombined`: weather attribution stripped, NOAA credit inline, one SnowRaven line |
| Docs/version | ✓ Pass | PRIVACY (NOAA), HELP, README, CHANGELOG; 0.5.17 in both version files |

## Edge Cases Tested

- Subordinate (prediction-only) stations — the common coastal case — interpolate
  a level from the hi/lo curve (verified live + unit test). Reference/gauge
  stations use continuous/observed.
- "Turned during your checklist" flagged when an H/L falls inside the window.
- `epochMin` is calendar-correct across month boundaries (interpolation fraction).
- NOAA error bodies (HTTP 200 with `{error}`) parsed correctly; no-data → fallback.

## Known Limitations

- For a far override station in a different timezone, the displayed times use the
  station's local clock (lst_ldt); for the in-range case (same tz) this matches
  the checklist. Acceptable for an explicit override edge.
- When a tide turns during the checklist, prev/next can both read as the same
  kind (e.g. "Previous low / Next low" with a high in between) — accurate, and the
  "turned during" note explains it.
- "Outside US" uses coarse bounding boxes (offline, no eBird-country dependency);
  a point just across a land border could misclassify, recoverable via override.

## Convention Flags

None. The feature mirrors the weather path and the established seams.
