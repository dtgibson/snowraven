# QA Report — Weather & Tide: Current & Predict

**Date:** 2026-06-13
**Test Runner:** vitest (frontend) + pytest (backend)
**Result:** PASSED

## Test Suite Results
- Frontend (vitest): **889 passing**, 0 failing (72 files). Includes new `forecastSlice.test.ts` (TS↔Python tier/adapter parity) and `WeatherForecastPanel.test.tsx` (state machine: Current happy path, location-failure fallback, beyond-range).
- Backend (pytest): **131 passing**, 0 failing. Includes new `test_forecast.py`, `test_weather_at.py`, `test_tide_at.py`.
- Lint/typecheck/build (frontend) and ruff (backend) all clean — the full CI mirror is green.

## Acceptance Criteria Verification

| ID | Criterion | Result | Notes |
|---|---|---|---|
| QA-01 | Buttons present at bottom of Weather tab, both platforms | ✓ Pass | Verified in the running web app; mounted in App.tsx for both web and desktop (transport seam). |
| QA-02 | Current happy path: live weather + tide | ✓ Pass | Live: device location → `/weather/at` (current) + `/tide/at` (now). |
| QA-03 | Current denied → friendly error + place-entry fallback | ✓ Pass | Covered by component test (location-failure → Predict panel preset to now). |
| QA-04 | Predict reveals location (search + pin), date, time | ✓ Pass | Panel renders all inputs; location defaults to current when available. |
| QA-05 | Predict place search resolves and returns weather+tide | ✓ Pass | Nominatim `/nominatim/search` → coords → lookup. Live 200. |
| QA-06 | Pin precision: nearest station tracks the spot | ✓ Pass | Live: SF (37.806,-122.465)→Golden Gate 0.05 mi; San Diego (32.72,-117.16)→Broadway 0.9 mi. |
| QA-07 | In-range hourly (≤48h): weather for the hour + tide | ✓ Pass | Live: `resolution: current/hourly`. |
| QA-08 | Mid-range daily (48h–8d): labeled daily summary + tide | ✓ Pass | Live: +4 days → `resolution: daily`, "Temperature: 57 - 68°F", summary high 68/low 51, isDaily true. |
| QA-09 | Beyond range (>8d): predicted tide + "no forecast" note, no weather | ✓ Pass | Live: +11 days → `out-of-range`, formatted null, summary null; UI shows the amber gap note and still renders tide. |
| QA-10 | Dual output: readable summary + copy-ready block matching the checklist format | ✓ Pass | Copy block reuses the existing formatter (byte-consistent); summary rendered separately. |
| QA-11 | Independent sources: one fails, the other still shows | ✓ Pass | `Promise.all` with a per-source catch; component test exercises out-of-range weather with tide present. |
| QA-12 | Tide notices: >25 mi too-far, non-US outside-us, override | ✓ Pass | Live: London→outside-us; inland Kansas→too-far (661 mi). Override re-fetches with force. |
| QA-13 | Times in the location's tz + the user's date-format pref | ✓ Pass | Current resolves "now" in the location tz (fixed during verification — was using the device clock); labels flow through `formatDate`. |
| QA-14 | Cross-platform parity (desktop + web) | ✓ Pass | Web (FastAPI) verified live; desktop (Tauri TS) covered by the TS↔Python parity tests over identical fixtures + the mirrored service implementations. |
| QA-15 | Accessibility: names, keyboard, announced states | ✓ Pass | Accessible names on all controls; lat/lng keyboard route with min/max bounds; result live-region announcement; region/heading/group roles. |
| QA-16 | No regression to the existing checklist lookup | ✓ Pass | Existing `/weather/{id}` and `/tide/{id}` routes and formatters byte-unchanged; pre-existing 877 frontend / 110 backend tests still green. |

## Edge Cases Tested
- Forecast tier boundaries (current / hourly ≤48h / daily 48h–8d / out-of-range >8d) — unit-tested both runtimes with identical fixtures.
- Coordinate input hardening (empty/invalid field never silently becomes 0,0; out-of-bounds rejected) — from the adversarial review.
- Tide-override race (a slow override never overwrites a since-replaced result) + surfaced error + loading state.
- Route shadowing: `/weather/at` and `/tide/at` are not captured by the `{checklist_id}` routes (backend tests assert the guard; TS transport orders the exact match first).
- NOAA future-date predictions return unchanged (labeled "Predicted"); "now" returns "Observed" gauge data when available.

## Known Limitations
- The copy-ready block reuses the shared tide formatter, so a tide that turns inside the 1-hour Current/Predict window still reads "(turned during your checklist)" even though there's no checklist. Deliberate — keeps the block byte-identical to the checklist lookup; the on-screen summary uses neutral "(turning)". (Owner reviewed and chose to keep it.)
- The desktop (Tauri) path was verified by parity tests and mirrored code, not a live desktop run on this VM. The transport contract and formatters are shared, so behavior matches the live-verified web path.

## Convention Flags
- A new backend route's path prefix must be added to the vite dev proxy (`frontend/vite.config.ts`). The `/tide` prefix was missing, so `/tide/at` (and, latently, the existing checklist tide) hit the SPA fallback in vite-dev instead of the backend. Worth a standing check: "added a backend route → add its prefix to the vite proxy."
