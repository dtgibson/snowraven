# QA Report — Windows Geolocation

**Date:** 2026-05-28
**Test Runner:** vitest
**Result:** PASSED (pre-deploy scope) — Windows runtime items confirmed on the Windows 11 machine

## Test Suite Results
246 tests passing, 0 failing (13 files). Frontend `tsc -b` + ESLint clean. macOS `cargo check` clean (Windows module cfg-gated out; `windows` crate not fetched on macOS).

## Acceptance Criteria Verification

| ID | Result | Notes |
|---|---|---|
| QA-01 — Coords when allowed | ⏸ Windows smoke test | Native `get_location` via `windows` Geolocator; confirmed on Windows 11 with location on. |
| QA-02 — Command registered | ⏸ At deploy / Windows | Registered for Windows in `lib.rs`; the CI Windows compile confirms it builds, the smoke test confirms `invoke` resolves. |
| QA-03 — Denied/off handling | ⏸ Windows smoke test | not-Allowed → `permission-denied` → Windows guidance message; verify no crash/hang on Windows 11 with location off. |
| QA-04 — Button restored | ✓ Pass | `CenterPointControl` always renders the button; note removed; radius + address + coords intact (verified web/Mac). |
| QA-05 — Frontend invoke path | ✓ Pass | Windows uses the same `invoke('get_location')` path; `unsupported-platform` guard removed. |
| QA-06 — No dead code | ✓ Pass | `unsupported-platform` and the note are gone; `isWindows()` retained only for the denied message; tsc/lint/build clean. |
| QA-07 — No macOS/web regression | ✓ Pass | macOS `cargo check` clean; web/Mac "Use my location" path unchanged (verified live). |
| QA-08 — Build scoping | ✓ Pass (macOS side) / ⏸ Windows compile at CI | `windows` crate only under the windows target; macOS build unaffected. Windows compile confirmed by the tag CI run. |
| QA-09 — Docs updated | ⏸ Stage 9 | README/HELP "not available on Windows" notes to be removed by The Chronicler. |

## Regression Checks
- Full suite green (246), incl. the retained `isWindows` tests.
- macOS Rust build compiles; Windows module gated out.
- Web/Mac Map Explorer location flow unchanged.

## Known Limitations / Deferred
- QA-01 / QA-03 require the Windows 11 machine (the WinRT permission + position path can't be exercised on macOS/CI).
- The exact `windows` crate version/features and the runtime `Geolocator` behavior are confirmed by the Windows CI compile + the hardware smoke test.

## Convention Flags
- None new.
