# PRD — Windows Geolocation
**Feature:** windows-geolocation
**Date:** 2026-05-28
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview
Implement native location detection on Windows so the Map Explorer's "Use my location" works there, matching macOS and web/Pi. A Windows-gated Rust `get_location` command (via the `windows` crate's `Geolocator`) returns the same `Coords { lat, lng }` contract the macOS command uses, so the frontend treats all platforms uniformly. The v0.4.0 "coming later" degrade is removed.

## User Stories

> **US-01** — As a Windows birder, I want to click "Use my location" and have the map center on where I am, exactly like the Mac app.

> **US-02** — As a Windows user with location turned off, I want a clear message telling me how to enable it, instead of a silent failure or crash.

> **US-03** — As a Mac or web/Pi user, I want my existing location experience to be completely unchanged.

## Functional Requirements

**Native command**
> **FR-01** — A `get_location` Tauri command, gated `#[cfg(target_os = "windows")]`, shall use the `windows` crate's `Geolocation.Geolocator` to obtain the device position and return `Coords { lat, lng }` — the same struct/shape the macOS command returns.
> **FR-02** — The command shall be registered in the invoke handler for Windows (alongside the existing macOS-gated registration).
> **FR-03** — On success the command shall return the current latitude/longitude.
> **FR-04** — When access is not granted or location is unavailable (OS location off, app not allowed, or no fix), the command shall return an `Err(String)`. For the access-denied/off case the error string shall contain `"permission-denied"` so the frontend maps it to the existing `permission-denied` code; other failures map to `unavailable`.

**Frontend**
> **FR-05** — `location.ts` shall call `invoke('get_location')` on Windows (Tauri) the same way it does on macOS; the `unsupported-platform` Windows guard added in v0.4.0 shall be removed.
> **FR-06** — The Map Explorer `CenterPointControl` shall show the "Use my location" button on Windows (the v0.4.0 "coming later" note is removed). Address search, manual lat/lng, and radius remain unchanged.
> **FR-07** — On Windows, a `permission-denied` result shall display a Windows-specific message guiding the user to enable location (e.g. "Turn on location in Windows Settings → Privacy & security → Location, then try again"). The macOS and web denied messages are unchanged.
> **FR-08** — Any now-unused code from the v0.4.0 degrade (the `unsupported-platform` error code if unused elsewhere, the `isWindows()` helper and its tests if unused elsewhere) shall be removed so no dead branches remain.

**Docs**
> **FR-09** — README and `docs/HELP.md` shall be updated to state that "Use my location" works on Windows (removing the "not available on Windows" notes).

## Non-Functional Requirements

> **NFR-01 — Parity by shared contract:** The Windows command returns the identical `Coords` shape and error convention as macOS, so no platform-specific frontend branching beyond the existing `isTauri()` is needed for the happy path.

> **NFR-02 — No regression:** macOS (CoreLocation) and web/Pi (`navigator.geolocation`) location paths are unchanged and continue to work.

> **NFR-03 — Build scoping:** The `windows` crate is added only under `[target.'cfg(target_os = "windows")'.dependencies]`, so macOS/Linux builds don't pull it. The macOS-only crates stay macOS-gated.

> **NFR-04 — Responsiveness:** The location request shall not block the UI indefinitely; a failure or no-fix resolves to an error within a reasonable time so the button doesn't hang in "Locating…".

## Out of Scope
- Mobile (iOS/Android) geolocation.
- Windows code signing.
- Changes to the macOS or web/Pi location implementations.

## Open Questions
- **Async handling.** WinRT `Geolocator` APIs are async. *Default if unresolved by Stage 5:* The Architect chooses (e.g. block on the `IAsyncOperation` off the main thread, or await it); the `get_location` contract is unaffected.
- **Permission model.** For an unpackaged `.exe`, Windows has no per-app prompt — `RequestAccessAsync` reflects the global "Location services" + "Let desktop apps access location" settings. *Default:* treat not-Allowed as `permission-denied` with the Settings guidance (FR-07); confirm exact behavior on the Windows 11 machine.

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Native command returns coords (FR-01–03) | On Windows 11 with location on, "Use my location" recenters the map on the real position |
| QA-02 | Command registered (FR-02) | `invoke('get_location')` resolves on Windows (no "command not found") |
| QA-03 | Denied/off handling (FR-04, FR-07) | With Windows location off, the button shows the Windows-specific guidance message; no crash, no infinite "Locating…" |
| QA-04 | Button restored (FR-06) | On Windows the "Use my location" button is shown (no "coming later" note); radius + address search + manual coords still present |
| QA-05 | Frontend invoke path (FR-05) | Windows uses the same invoke path as macOS; `unsupported-platform` guard gone |
| QA-06 | No dead code (FR-08) | The v0.4.0 degrade code that's now unused is removed; types/lint/build clean |
| QA-07 | No macOS/web regression (NFR-02) | macOS "Use my location" and web `navigator.geolocation` still work |
| QA-08 | Build scoping (NFR-03) | macOS build still compiles; `windows` crate only under the windows target |
| QA-09 | Docs updated (FR-09) | README/HELP no longer say location is unavailable on Windows |

**Verification note:** QA-01 and QA-03 require the Windows 11 machine (allowed → coords; off → guidance). QA-06/07/08 are verifiable on macOS/CI; QA-04/05/09 by code + the Windows smoke test.
