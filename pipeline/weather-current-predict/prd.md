# PRD — Weather & Tide: Current & Predict
**Feature:** weather-current-predict
**Date:** 2026-06-13
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview
Two buttons at the bottom of the Weather tab. **Current** returns live weather and tide for the user's device location and the present moment in one tap. **Predict** lets the user pick a place, date, and time and returns the forecast weather and predicted tide for that single moment. Both render a readable at-a-glance summary and keep the existing copy-ready block available. This sits alongside the existing checklist lookup, which is unchanged.

## User Stories
> **US-01** — As a birder about to head out, I want to tap "Current" and see the weather and tide where I am right now, so I can decide whether and where to go without leaving SnowRaven.
> **US-02** — As a birder planning ahead, I want to enter a place, date, and time in "Predict" and see the forecast weather and tide for that moment, so I can plan around conditions.
> **US-03** — As a birder timing a tide for a specific mudflat, I want to drop a pin on the exact spot, so the tide comes from the nearest station to *that* spot, not a distant default.
> **US-04** — As a user looking at a far-future date, I want tide shown even when no weather forecast reaches that far, with a clear note about the gap, so I'm never shown a fabricated forecast.
> **US-05** — As a user, I want a readable summary plus the option to copy the familiar formatted block, so I can both glance and paste or share.
> **US-06** — As a user whose device location is unavailable or denied, I want a clear message and a way to enter a place instead, so "Current" failing doesn't dead-end me.

## Functional Requirements

*Entry points*
> **FR-01** — The Weather tab shall show two buttons, "Current" and "Predict," at the bottom of the page, available whether or not a checklist lookup has been run.
> **FR-02** — Both buttons shall work on the desktop app and the web/self-hosted build.

*Current*
> **FR-03** — Activating "Current" shall obtain the user's device location using the app's existing location capability, with no manual entry on the happy path.
> **FR-04** — The app shall then fetch and display live weather and the current tide for that location and the present moment.
> **FR-05** — If device location can't be obtained (denied, unavailable, timed out, or insecure web context), the app shall show the existing friendly location-error message and offer to enter a place instead, rather than failing silently.

*Predict — inputs*
> **FR-06** — Activating "Predict" shall reveal inputs for a location, a date, and a time, for a single chosen moment.
> **FR-07** — The location input shall support a place-name search that resolves to coordinates and a map pin the user can place or move to fine-tune the exact spot.
> **FR-08** — The location shall default to the user's current location when available; the user may override by search or pin.
> **FR-09** — The date and time shall default to a sensible near-future value and accept any present-or-future moment.

*Predict — results and the forecast gap*
> **FR-10** — On submit, the app shall fetch and display the forecast weather (when within range) and the predicted tide for the chosen place and moment.
> **FR-11** — Tide shall be shown for any chosen moment the tide source supports, well beyond the weather horizon.
> **FR-12** — The weather forecast range shall reflect the provider's real horizon (about 8 days); the app shall not promise weather beyond it.
> **FR-13** — Forecast resolution (confirmed during PRD review): within about 48 hours, weather shall reflect the chosen hour; from about 48 hours to about 8 days, the app shall show the day's forecast summary, clearly labeled as a daily summary rather than an exact-hour reading.
> **FR-14** — When the chosen moment is beyond the weather horizon (about 8 days), the app shall omit weather and show a clear note that no forecast reaches that far — never an extrapolated or fabricated forecast. Tide shall still be shown.

*Output*
> **FR-15** — Each result (Current and Predict) shall present a readable at-a-glance summary of weather and tide.
> **FR-16** — Each result shall also make the existing copy-ready weather/tide block available via a copy action, in the same format as the checklist lookup.
> **FR-17** — Weather and tide shall be fetched and shown independently — if one source fails or is unavailable, the other shall still display.
> **FR-18** — Tide results shall carry the same nearest-station name and distance, "Observed/Predicted" labeling, and "too far (>25 mi)" / "outside US" soft notices with override, as the existing tide feature.

*Consistency*
> **FR-19** — Dates and times shall honor the user's date-format preference and the location's local timezone.
> **FR-20** — Units shall match the existing output (°F, mph, ft MLLW).

## Non-Functional Requirements
> **NFR-01 — Privacy:** No new third-party service and no new data collection. Current/Predict reuse already-disclosed providers (OpenWeather, NOAA CO-OPS, OpenStreetMap/Nominatim) and the existing device-location capability. The local-first, no-server, no-telemetry posture is unchanged; PRIVACY_POLICY.md is reviewed and updated only if provider usage actually changes.
> **NFR-02 — Cross-platform parity:** Both lookups shall work on desktop (Tauri services) and web/Pi (FastAPI) through the existing transport seam, with equivalent output.
> **NFR-03 — Accessibility:** All new controls (buttons, place search, date/time inputs, map pin) shall meet the app's WCAG 2.1 AA conventions — accessible names, full keyboard operability including a keyboard route to set the Predict location, visible focus, and announced loading/error states.
> **NFR-04 — Resilience:** Network calls reuse existing timeouts; weather and tide run concurrently and independently; Nominatim's 1 request/second etiquette is preserved.
> **NFR-05 — Output parity:** The copy-ready block reuses the existing weather and tide formatters so pasted output stays byte-consistent with the checklist lookup. No second formatter.
> **NFR-06 — No regression:** The existing checklist-based weather/tide lookup is unchanged.

## Out of Scope
- Multi-hour or multi-day forecast windows or comparison views (single moment only).
- Saved or favorite locations.
- Alerts, notifications, or "good conditions" monitoring.
- Any "best time to go" ranking or recommendation.
- Arbitrary *past*-time lookups at a chosen place (the historical path stays checklist-based).
- Unit changes or a metric toggle.
- Any change to the existing checklist lookup.

## Open Questions
> **OQ-01 — Past moments in Predict.** Allow choosing a past time at a place? **Default if unanswered:** no — Predict is present/future; past lookups stay out of scope for v1.
> **OQ-02 — "Current" fallback shape.** When device location fails, just message, or reveal the place-entry input set to "now" so the user can continue? **Default:** show the friendly error and reveal the place entry preset to the current time.
> **OQ-03 — Summary vs block visibility.** **Default:** readable summary visible; copy-ready block available via a copy button (mirrors today's affordance), optionally behind a show/hide.
> **OQ-04 — Pin interaction.** **Default:** tap-to-place with a draggable pin, centered on the current or searched location.

*(Resolved during review: forecast resolution beyond 48 hours — show the labeled daily summary for the 48h–8day window; see FR-13.)*

## Success Metrics
| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Buttons present | "Current" and "Predict" render at the bottom of the Weather tab on desktop and web, before any checklist lookup. |
| QA-02 | Current happy path | With location granted, "Current" shows live weather and current tide for the device location. |
| QA-03 | Current denied | With location denied/unavailable, "Current" shows the friendly error and offers a place-entry fallback; no silent failure. |
| QA-04 | Predict inputs | "Predict" reveals location (search + pin), date, and time; location defaults to current location when available. |
| QA-05 | Predict place search | Entering a place name resolves to it and returns weather + tide there. |
| QA-06 | Pin precision | Moving the pin to a specific coastal spot changes the nearest tide station/distance accordingly. |
| QA-07 | In-range hourly (≤48h) | A Predict time within about 48 hours shows weather for that hour plus tide. |
| QA-08 | Mid-range daily (48h–8d) | A Predict time three to eight days out shows a clearly-labeled daily forecast summary plus tide. |
| QA-09 | Beyond range (>8d) | A Predict time beyond about 8 days shows predicted tide and a clear "no forecast this far out" note, with no weather values. |
| QA-10 | Dual output | Each result shows a readable summary and a copy action whose pasted text matches the checklist-lookup format. |
| QA-11 | Independent sources | If weather fails but tide succeeds (or vice versa), the other still displays. |
| QA-12 | Tide notices | >25 mi shows the "too far" notice with override; non-US shows "outside US"; override reveals the tide. |
| QA-13 | Timezone/format | Times use the location's local timezone and the user's date-format preference. |
| QA-14 | Cross-platform parity | Current and Predict produce equivalent output on desktop and web. |
| QA-15 | Accessibility | New controls have accessible names, are keyboard-operable (including setting the Predict location), and announce loading/error. |
| QA-16 | No regression | The existing checklist weather/tide lookup behaves exactly as before. |
