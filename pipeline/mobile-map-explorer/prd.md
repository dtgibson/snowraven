# PRD — Mobile Map Explorer
**Feature:** mobile-map-explorer
**Session:** 001
**Date:** 2026-05-22
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

Two improvements to the Map Explorer tab: a mobile-responsive layout that fills the screen with a map and overlays the filter sidebar on demand, and a default map location stored in Settings that pre-fills coordinates and radius on every visit.

---

## User Stories

**US-01** — As a birder using my phone, I want the map to fill the full screen, so I can browse pins without the sidebar blocking the view.

**US-02** — As a birder on mobile, I want a button to open the filter panel, so I can change settings or trigger a new search without permanently losing map space.

**US-03** — As a birder on mobile, I want to close the filter panel after making my selections, so the map returns to full screen for browsing.

**US-04** — As a birder who always works near the same location, I want to save my home coordinates in Settings, so the Map Explorer opens at my patch without re-entering them each session.

**US-05** — As a birder, I want to clear my saved default location, so I can reset the Map Explorer to blank defaults.

---

## Functional Requirements

### Mobile Layout

**FR-01** — On viewport widths ≤640px, the Map Explorer shall render the map full-width with no sidebar visible by default.

**FR-02** — On viewport widths ≤640px, a "Filters" button shall appear floating over the map (bottom-right corner) that opens the sidebar as an overlay.

**FR-03** — When the sidebar is open on mobile, it shall render as a full-height panel overlaid on top of the map, not pushing the map aside.

**FR-04** — The sidebar overlay shall include a close button in its header. Tapping outside the overlay shall also dismiss it.

**FR-05** — Map query state (pins, results, active mode) shall be fully preserved when the sidebar is opened or closed.

**FR-06** — On viewport widths >640px, the layout shall be identical to the current implementation — no changes.

### Default Map Location

**FR-07** — The Settings tab shall include a "Default Location" section with three inputs: Latitude, Longitude, and Radius (miles). A Save button commits the values. A Clear button removes them.

**FR-08** — Saving shall call `POST /settings/map-defaults` with `{lat, lng, dist}`. On success, the section shall display a confirmation that the defaults were saved.

**FR-09** — On mount, the Map Explorer shall call `GET /settings/map-defaults`. If defaults exist, they shall pre-populate the lat, lng, and radius fields for all three map modes.

**FR-10** — If no defaults are saved (404 or null response), the Map Explorer shall fall back to its current behavior (empty fields or the built-in placeholder values).

**FR-11** — The Clear button in Settings shall call `DELETE /settings/map-defaults` and reset the section to the empty state.

---

## Non-Functional Requirements

**NFR-01 — Compatibility:** The desktop layout (viewport >640px) shall be pixel-identical to the current implementation.

**NFR-02 — Performance:** The sidebar toggle shall operate without any network request — purely client-side state.

**NFR-03 — Accessibility:** The floating Filters button shall have an accessible `aria-label` ("Open map filters"). The close button inside the sidebar shall have `aria-label="Close filters"`.

**NFR-04 — Validation:** The `/settings/map-defaults` POST endpoint shall validate: `lat` is a float in [−90, 90], `lng` is a float in [−180, 180], `dist` is a positive integer. Invalid input returns 422.

---

## Out of Scope

- Any changes to the desktop layout or sidebar width
- Per-mode defaults (one saved location applies to all three map modes)
- Animated slide-in transitions on the sidebar overlay
- Browser geolocation API ("use my location" button)
- Saving other map state (active mode, species filter selection)

---

## Open Questions

**OQ-01** — Should the Map Defaults section appear above or below the Default Files section in Settings?
*Resolved: below Default Files (bottom of the Settings page).*

**OQ-02** — Should the overlay sidebar on mobile show a translucent backdrop behind it?
*Default assumption: yes — a semi-transparent dark overlay behind the panel to visually separate it from the map and signal that tapping outside closes it.*

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Mobile layout — map fills full width | At ≤640px viewport, map occupies 100% width with no sidebar visible on load |
| QA-02 | Filters button visible on mobile | Floating "Filters" button visible in bottom-right corner of map on ≤640px |
| QA-03 | Sidebar opens on toggle | Tapping Filters shows the sidebar panel overlaid on the map |
| QA-04 | Sidebar closes on close button | Tapping the sidebar's close button dismisses the panel |
| QA-05 | Sidebar closes on backdrop tap | Tapping the backdrop outside the panel dismisses it |
| QA-06 | Query state preserved across toggle | Pins/results remain on map after opening and closing sidebar |
| QA-07 | Desktop layout unchanged | At >640px, sidebar and map layout matches pre-feature behavior exactly |
| QA-08 | Default location saves | Entering lat/lng/dist in Settings and clicking Save persists values to server |
| QA-09 | Default location loads | Reloading the page and navigating to Map Explorer shows saved values pre-filled |
| QA-10 | Default location applies to all modes | All three mode panels (My Sightings, Hotspots, Targets) show saved lat/lng/dist |
| QA-11 | Default clear works | Clicking Clear in Settings removes the saved defaults; Map Explorer reverts to empty |
| QA-12 | No default — fallback behavior | With no default saved, Map Explorer behaves identically to pre-feature |
