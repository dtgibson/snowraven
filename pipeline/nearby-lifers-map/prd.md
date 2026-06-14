# PRD — Nearby Lifers Map
**Feature:** nearby-lifers-map
**Date:** 2026-06-14
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview
A new Map Explorer section, "Nearby Lifers," that maps the places where species the user has never recorded were reported recently near a chosen point, with count-badged pins, a mirroring in-view list, and the standard location chooser. It replaces the Nearby Lifers list on the Statistics tab.

## User Stories
> **US-01** — As a birder planning where to go, I want to see on a map the spots near me where birds I've never recorded have turned up recently, so I can decide where to chase a lifer.
> **US-02** — As a birder, I want each pin to show how many of my lifers are at that spot, so I can spot the richest locations at a glance.
> **US-03** — As a birder, I want to open a pin or list row and see exactly which lifers were reported there, when, and on what checklist, so I can judge whether it's worth a trip.
> **US-04** — As a birder, I want the section to open on my saved default location and radius, and let me re-center on my current location or any place I search, so I can explore beyond home.
> **US-05** — As a keyboard or screen-reader user, I want the panel list to mirror the pins and be fully operable without a mouse, so the feature is usable for me.
> **US-06** — As a returning user, I want the old Nearby Lifers list removed from Statistics once this exists, so there's one clear home for it.

## Functional Requirements

*Section & entry*
> **FR-01** — The app shall add a fourth Map Explorer section, "Nearby Lifers," selectable from the existing section selector alongside Sightings, Hotspots, and Media Targets.
> **FR-02** — On selecting the section, the app shall load nearby lifers for the current center and radius automatically when a valid location is available (the saved default on first open), with no separate "Find" click required.

*Data & definition*
> **FR-03** — The app shall define a "nearby lifer" as a species reported within the selected radius of the center in the last 30 days that is not in the user's recorded species (life list from the loaded eBird backup).
> **FR-04** — The app shall source results from the coordinate-bearing recent-observations path (latitude, longitude, location id, location name, observation date, checklist id), not the coordinate-stripped Statistics route.
> **FR-05** — The app shall group results by location: one pin per distinct location, aggregating every nearby-lifer species reported there.
> **FR-06** — The app shall exclude observations with missing or invalid coordinates from both the map and the list.

*Pins & map*
> **FR-07** — Each pin shall display a badge with the count of distinct lifer species at that location.
> **FR-08** — Each pin's color shall reflect the recency tier of the most recent lifer report at that location, consistent with the recency tiers used elsewhere in the app.
> **FR-09** — Clicking a pin shall open a single popup for that location showing the location name and, for each lifer there, the species name (plain name plus favicons, no Species Detail link), its most recent report date, a recency indicator, and a link to the eBird checklist it was reported on.
> **FR-10** — The map shall use the shared map wrapper and one state-driven popup; selecting a pin and selecting its list row shall open the same popup.

*Panel list*
> **FR-11** — The panel shall show an in-view list of the locations whose pins are in the current viewport, each row showing the location, the lifer count there, and the lifer(s) (a single name, or "{n} species" when several).
> **FR-12** — Activating a list row shall select the matching pin, center the map on it, and open its popup.
> **FR-13** — The in-view list shall be ordered nearest-first by distance from the center.

*Location chooser*
> **FR-14** — The section shall open centered on the saved default location and radius from Settings.
> **FR-15** — The section shall provide the standard center controls: "use my location" (device geolocation) and place-name search, each re-centering the section and refreshing results.
> **FR-16** — The section shall provide the standard radius control (the existing 5/10/25/50 mi options) and apply the radius in miles, converting to the units the data source expects, matching the rest of the Map Explorer.
> **FR-21** — The section shall provide a time-range filter (labeled "Time range") with three windows — last day, last week, last 30 days (default: last 30 days) — applied client-side to the already-fetched results by each location's most-recent report date; switching windows requires no additional network request. The pins, count badges, and in-view list all reflect the active window.
> **FR-22** — The existing Media Targets section shall gain the same "Time range" filter (identical control and windows, default last 30 days, client-side), so the Nearby Lifers and Media Targets panels are consistent. Each section keeps its own selected window; nothing else about Media Targets changes.
> **FR-23** — The Nearby Lifers section shall share the Map Explorer's existing map chrome — the base-layer switcher (Map / Satellite / Topo / Trails), the California Breeding Bird Atlas overlay toggle, and the fullscreen / Filters affordances — and shall provide the standard viewport-scoped "in view" keyboard list, so it is consistent with the other map sections. The Sightings-only heatmap is not part of this section.

*States*
> **FR-17** — The app shall show a loading indicator while fetching, an inline error on failure, and a clear "no nearby lifers found" message on an empty result.
> **FR-18** — When no default location is saved, the section shall prompt the user toward setting one rather than failing silently.
> **FR-19** — When the eBird backup is not loaded, the section shall explain that it's needed to identify lifers.

*Statistics removal*
> **FR-20** — Once the section is live, the app shall remove the Nearby Lifers block from the Statistics tab, leaving no dead references.

## Non-Functional Requirements
> **NFR-01 — Accessibility:** The section shall meet the app's WCAG 2.1 AA conventions: explicit aria-labels on the search box, radius control, and any selects; aria-pressed on the section toggle; pins reachable via the keyboard in-view list; one focus-restoring close path for any overlay; colors only via `--sr-*` tokens with the correct text-on-fill families; lifer names through the shared BirdName; checklist links through the shared ChecklistLink with id validation.
> **NFR-02 — Privacy:** No new providers or third-party calls; reuses the eBird endpoints already in the app. No PRIVACY_POLICY change.
> **NFR-03 — Performance:** Pins and list shall stay smooth at the expected scale (tens to low hundreds of locations); the map shall not mount a WebGL context when there are no results.
> **NFR-04 — Platform parity:** The feature shall behave identically on desktop (Tauri) and web/self-hosted; any data-path change is made in both transports.
> **NFR-05 — Compatibility:** Requires a configured eBird API key and a loaded eBird backup; degrades to the FR-17–FR-19 states when either is absent.

## Out of Scope
- New data providers, telemetry, or any privacy-posture change.
- A drawn radius ring on the map.
- Redefining "lifer" beyond the not-on-life-list definition, or looking back further than 30 days (the recency filter, FR-21, narrows *within* the 30-day window; it never extends it).
- Saving a chosen center or radius back to Settings (read-only, like the other sections).
- A heatmap mode for nearby lifers (pins + list only).
- Any change to the existing Sightings or Hotspots sections. (Media Targets gains the shared "Time range" filter for consistency — see FR-22 — but nothing else about it changes.)

## Open Questions
- **OQ-01** — In-view list sort: nearest-first by distance, or most-recent-first? *Default: nearest-first, recency shown per row.*
- **OQ-02** — Popup species order within a location: most-recent first, or alphabetical? *Default: most-recent first.*
- **OQ-03** — Count badge basis: distinct lifer species, or total observations? *Default: distinct species.*
- **OQ-04** — Single lifer at a location shows the species name directly; several show "{n} species" with the list in the popup. *Default: this (mirrors Media Targets).*

## Success Metrics
| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | New section exists | Map Explorer shows a "Nearby Lifers" option; selecting it switches to the section. |
| QA-02 | Auto-load at default | Selecting it with a saved default location loads pins with no separate Find click. |
| QA-03 | Lifer definition | Every species shown is absent from the life list and was reported within the radius in the last 30 days. |
| QA-04 | Coordinates present | Pins sit at the reported locations; coordinate-less results are omitted, never shown at 0,0. |
| QA-05 | Location grouping | One pin per distinct location; a location with multiple lifers shows a single pin. |
| QA-06 | Count badge | Each pin's badge equals the number of distinct lifer species at that location. |
| QA-07 | Popup content | A pin lists each lifer there with name + favicons (no Species Detail link), date, recency, and a working checklist link. |
| QA-08 | List mirrors map | The panel list reflects pins in view; activating a row selects the pin, centers the map, opens the same popup. |
| QA-09 | List sort | The in-view list is ordered nearest-first by distance from the center. |
| QA-10 | Location chooser | "Use my location" and place-search re-center and refresh; the radius control changes the search area. |
| QA-11 | Radius units | A given radius searches the same real-world distance (miles) as the equivalent setting in the other sections. |
| QA-12 | States | Loading, error, empty, no-default-location, and no-backup states each render their intended message, not a blank/broken view. |
| QA-13 | Accessibility | Controls have accessible names; the toggle exposes pressed state; the list is keyboard-operable; axe shows no new violations; contrast passes both themes. |
| QA-14 | Statistics removal | The Nearby Lifers block is gone from Statistics with no dead references. |
| QA-15 | Platform parity | The section behaves the same on desktop and web builds. |
| QA-16 | Time-range filter | The Day / Week / 30-day control narrows the visible spots, counts, and list by most-recent report date; default is 30 days; switching it re-filters with no refetch. |
| QA-17 | Media Targets consistency | The Media Targets panel shows the same "Time range" control and windows and filters its results the same way; the two panels read consistently. |
| QA-18 | Shared map chrome | The base-layer switcher, atlas overlay toggle, fullscreen / Filters, and an in-view keyboard list all work in the Nearby Lifers section as they do in the other modes. |
