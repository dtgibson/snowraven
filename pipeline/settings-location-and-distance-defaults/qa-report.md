# QA Report — settings-location-and-distance-defaults

**Date:** 2026-06-07
**Test Runner:** vitest (frontend)
**Result:** PASSED

## Test Suite Results

- Frontend: **435 tests passing**, 0 failing (31 files) — +7 from the new
  `describeLocationError` branch tests.
- Backend untouched (no Python in the diff); the 93-test backend suite from the
  prior stage stands as the regression baseline.
- Build clean, lint clean.

## Acceptance Criteria Verification (change-brief.md)

| Criterion | Result | Notes |
|---|---|---|
| Settings "Use my location" detects + fills lat/lng | ✓ Pass | `handleDetectMapLocation` calls `getCurrentLocation()`, sets `toFixed(5)`; Locating… state + inline error |
| Detect reuses the existing geolocation helper | ✓ Pass | Same `getCurrentLocation` as `MapExplorer.handleUseMyLocation` — no new geolocation path |
| Error messages shared, not duplicated | ✓ Pass | `describeLocationError` in `lib/location.ts` used by both Settings (:970) and MapExplorer (:1195); the inline 20-line switch is gone; `isWindows` moved into the helper |
| Map default radius = 5 mi | ✓ Pass | `MapExplorer` `useState(5)` (was 25); 5 is a RadiusControl option so it highlights |
| Saved default radius still wins | ✓ Pass | load effect `setRadius(data.dist)` unchanged (:836) |
| Settings radius field defaults to 5 | ✓ Pass | `useState('5')`; load effect overrides with saved dist (:839); Clear resets to '5' (:956) |
| Helper has unit coverage | ✓ Pass | 7 tests over every `LocationError.code` + web/tauri/Windows permission branches |

## Edge Cases Tested

- Each `LocationError` code maps to the right message; tauri+Windows vs tauri+macOS
  vs web permission-denied all branch correctly (mocked `isWindows`).
- Saving a home location no longer requires typing a radius (field pre-filled 5).
- A previously-saved default distance loads over the 5 default (no regression to
  existing users' saved preferences).

## Known Limitations

- The actual geolocation grant (real GPS / OS permission) can only be exercised
  in a real browser or the signed desktop build — verified by Dave on the running
  app, not by the headless/jsdom suite.

## Convention Flags

None. The change consolidates duplicated logic into `lib/location.ts`, which
already owns the geolocation seam.
