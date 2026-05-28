# PRD — Map Location Access
**Feature:** map-location-access
**Session:** 001
**Date:** 2026-05-26
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview
A "Use My Location" button on the Maps tab that detects the user's current GPS coordinates and populates the lat/lng fields. In the Tauri desktop app, the button uses `tauri-plugin-geolocation` to invoke native CoreLocation; in the web app (Pi/browser), it uses `navigator.geolocation`. Once coordinates resolve, the active map mode's fetch triggers automatically if the fields were previously empty.

---

## User Stories

**US-01** — As a birder on the Mac desktop app, I want to click "Use My Location" so the map centers on my current position without me having to look up or type my coordinates.

**US-02** — As a birder on the Pi web app, I want to click "Use My Location" so the browser supplies my current coordinates automatically.

**US-03** — As a birder using any map mode, I want location to populate the existing lat/lng fields so I can further adjust the radius or re-fetch without re-entering everything.

**US-04** — As a birder whose location permission is denied, I want to see an actionable error message so I know exactly how to fix it rather than wondering why nothing happened.

**US-05** — As a birder who just located themselves, I want the map to fetch results automatically so I don't have to click a second button.

---

## Functional Requirements

### Location Button

**FR-01** — The Maps tab sidebar shall include a "Use My Location" button, visible in all three map modes (My Sightings, Hotspots, Media Targets), positioned adjacent to the lat/lng input fields.

**FR-02** — The button shall use a crosshair/locate icon (e.g. `LocateFixed` from lucide-react) with a short text label ("Use My Location" or similar) or a tooltip identifying its purpose.

**FR-03** — While a location request is in progress, the button shall display a loading/spinner state and be disabled to prevent duplicate requests.

**FR-04** — The button shall be re-enabled immediately when a location request completes (success or error).

### Platform Detection and Dispatch

**FR-05** — When running in the Tauri app (`isTauri()` is true), the button shall use `tauri-plugin-geolocation` — calling `requestPermissions()` first, then `getCurrentPosition()`.

**FR-06** — When running in the web app (`isTauri()` is false), the button shall use `navigator.geolocation.getCurrentPosition()`.

**FR-07** — Platform detection shall use the existing `isTauri()` function from `frontend/src/lib/platform.ts` — no direct `window.__TAURI_INTERNALS__` checks in new code.

### Permission Handling (Tauri)

**FR-08** — On the first click after install (or after permission was previously denied and reset), the Tauri app shall trigger the macOS location permission dialog via `requestPermissions()` before calling `getCurrentPosition()`.

**FR-09** — If `requestPermissions()` returns a denied or restricted status, the app shall not call `getCurrentPosition()` and shall display the permission-denied error (see FR-13).

### After Position Resolves

**FR-10** — On a successful position fix, the resolved latitude and longitude shall overwrite the current values in the shared lat/lng state used by all three map modes.

**FR-11** — After populating coordinates, the button shall auto-trigger the active mode's data fetch if the lat/lng fields were empty (or showing default placeholder values) before the button was clicked.

**FR-12** — If coordinates were already populated before the button was clicked, the button shall update them but shall not auto-trigger a fetch — the user triggers the next fetch manually.

### Error Handling

**FR-13** — If location permission is denied, an inline error shall appear below the button reading: "Location access was denied. Grant permission in System Settings → Privacy & Security → Location Services." (Tauri) or "Location access was denied. Allow location access in your browser settings." (web).

**FR-14** — If the position is unavailable (e.g. no GPS fix, device reports error), an inline error shall appear: "Unable to determine your location. Try again or enter coordinates manually."

**FR-15** — If the request times out (no fix within 10 seconds), an inline error shall appear: "Location request timed out. Try again or enter coordinates manually."

**FR-16** — All error messages shall appear inline in the sidebar below the location button and shall clear automatically when a new location request is initiated.

---

## Non-Functional Requirements

**NFR-01 — Platform seam:** All platform branching must use `isTauri()` from `platform.ts`. No `window.__TAURI_INTERNALS__` checks in new code.

**NFR-02 — No new global state:** The button populates the existing lat/lng state already present in `MapExplorer.tsx`. No new context providers or cross-component state.

**NFR-03 — Tauri dependency:** `tauri-plugin-geolocation` must be added to `src-tauri/Cargo.toml` and the plugin registered in the Tauri capabilities file. The `NSLocationWhenInUseUsageDescription` key must be present in the app's `Info.plist` (via Tauri bundle config) for macOS to show the permission dialog.

**NFR-04 — Timeout:** Both the Tauri and web paths shall use a 10-second timeout for `getCurrentPosition`.

**NFR-05 — Accuracy:** No specific accuracy target — default device accuracy is sufficient. High-accuracy GPS is not required.

---

## Out of Scope

- Continuous location tracking or `watchPosition` listeners
- Saving the resolved location as the Settings default (user can do that manually with the existing Save button)
- Any UI changes outside the Maps tab sidebar
- iOS or Android support (comes with the mobile app session)
- A "locate me" feature on any tab other than Map Explorer

---

## Open Questions

None — all decisions are resolved in this document.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Button visible in all three map modes | "Use My Location" button with crosshair icon appears in the sidebar for My Sightings, Hotspots, and Media Targets |
| QA-02 | Tauri — first-use permission dialog | Clicking the button in a fresh Tauri install (or after permission reset) triggers the macOS location permission dialog |
| QA-03 | Tauri — coordinates populate after permission granted | After approving location, lat/lng fields update to valid numeric coordinates |
| QA-04 | Web — browser permission dialog | Clicking the button in the web app shows the browser's geolocation permission prompt |
| QA-05 | Web — coordinates populate after permission granted | After approving location, lat/lng fields update to valid numeric coordinates |
| QA-06 | Auto-fetch when fields were empty | After locating with empty lat/lng fields, the active mode's fetch fires automatically |
| QA-07 | No auto-fetch when fields were populated | After locating with existing lat/lng values, no automatic fetch is triggered |
| QA-08 | Loading state during request | Button shows spinner and is disabled from click until request completes |
| QA-09 | Permission denied — Tauri error message | Denying location permission in Tauri shows the macOS-specific error message inline |
| QA-10 | Permission denied — web error message | Denying location permission in browser shows the browser-specific error message inline |
| QA-11 | Position unavailable error | Simulated position error shows "Unable to determine your location" message inline |
| QA-12 | Error clears on new attempt | Clicking the button again after an error clears the previous error message |
