# PRD — Map Explorer Enhancements
**Feature:** map-explorer-enhancements
**Session:** 001
**Date:** 2026-05-22
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

Five targeted enhancements to the Map Explorer tab that improve location input, visual interactivity, actionability of sightings data, and spatial prioritization for trip planning. Together they transform the Map Explorer from a passive viewer into a tool a birder can act on directly.

---

## User Stories

> **US-01** — As a birder, I want to type a place name or address to center the map, so that I don't have to look up and manually enter lat/lng coordinates.

> **US-02** — As a birder exploring hotspots, I want to click a legend row to hide or show that category of pins, so that I can visually isolate the hotspot types I care about.

> **US-03** — As a birder on the Media Targets view, I want each pin to show how recently the species was reported at that location, so that I can tell at a glance which sightings are still actionable.

> **US-04** — As a birder planning a chase, I want to toggle between "all target pins within 30 days" and "one pin per species — the most recent location," so that the map is not cluttered when I just want the freshest lead for each bird.

> **US-05** — As a birder, I want to click directly from a target pin's popup to the eBird checklist that recorded the sighting, so that I can see exactly what was seen and where.

> **US-06** — As a birder, I want to see a sidebar list of the ten nearest media targets sorted by distance from the current center point, so that I can immediately identify which targets are closest and freshest without scanning every pin.

---

## Functional Requirements

### Address Geocoding

> **FR-01** — The backend shall expose a new `GET /nominatim/search?q={address}` endpoint that forwards the query to the Nominatim search API and returns an array of results, each with `display_name`, `lat`, and `lon`.

> **FR-02** — In both Hotspots mode and Media Targets mode, a text input labeled "Search by place name" shall appear above the lat/lng coordinate fields in the sidebar. Pressing Enter or clicking a Search button submits the query.

> **FR-03** — If the geocode request returns one or more results, the app shall use the first result's `lat`/`lon` to populate the lat/lng fields and immediately trigger a data fetch using those coordinates.

> **FR-04** — If the geocode request returns no results, an inline error message shall be displayed: "No location found. Try a different search term."

> **FR-05** — If the geocode request fails (network error or non-200 response), an inline error message shall be displayed: "Location search failed. Try again or enter coordinates manually."

> **FR-06** — The address input field shall be cleared after a successful geocode. The lat/lng fields shall show the resolved coordinates.

### Hotspot Legend Toggles

> **FR-07** — Each row in the Hotspots mode legend (Visited, Unvisited, Personal) shall be clickable. Clicking a row toggles visibility of that pin category.

> **FR-08** — When a legend row's category is hidden, its pins shall not render on the map.

> **FR-09** — A hidden legend row shall be visually distinguished from a visible one — the icon and label shall render at reduced opacity (approximately 40%) when hidden.

> **FR-10** — All three categories shall be visible by default on each new Hotspots fetch.

### Media Targets — Recency Tiers

> **FR-11** — The backend `GET /map/recent-obs` endpoint shall use `back=30` (30 days) instead of the current 14. Observations older than 30 days are excluded by the eBird API.

> **FR-12** — The backend grouping for `GET /map/recent-obs` shall capture the `subId` from the observation with the most recent `obsDt` in each `(speciesCode, locId)` group and include it in the response as `subId`.

> **FR-13** — Client-side, target pins shall be color-coded by three recency tiers derived from `recentDate`:
> - **Tier 1 (≤7 days):** bright variant — token `--sr-map-target-fresh`
> - **Tier 2 (≤8–15 days):** medium variant — token `--sr-map-target-mid`
> - **Tier 3 (≤16–30 days):** faded variant — token `--sr-map-target-old`
>
> Pins with `recentDate` older than 30 days shall be excluded entirely.

> **FR-14** — Three new CSS tokens shall be added to `globals.css` — `--sr-map-target-fresh`, `--sr-map-target-mid`, `--sr-map-target-old` — defined in both `:root` (light) and `[data-theme="dark"]` (dark). The existing `--sr-map-target` token shall remain unchanged (used by the legend color swatch).

### Media Targets — All / Most Recent Toggle

> **FR-15** — A segmented toggle ("Last 30 Days" / "Last Week") shall appear in the Media Targets sidebar above the results list. Default is "Last 30 Days."

> **FR-16** — In "Last 30 Days" mode, all pins that pass the 30-day recency filter shall be shown — one pin per `(speciesCode, locId)` group.

> **FR-17** — In "Last Week" mode, only pins where `recentDate` is within the past 7 days shall be shown. Pins older than 7 days are hidden. Multiple pins for the same species at different locations are all visible if each had a sighting within 7 days.

> **FR-18** — Switching between "Last 30 Days" and "Last Week" shall re-filter the already-fetched data client-side, with no new network request.

### Media Targets — Checklist Link

> **FR-19** — The popup for each target pin shall include a clickable link labeled "View checklist" that opens `https://ebird.org/checklist/{subId}` in a new tab.

> **FR-20** — The link shall only render if `subId` is a non-empty string matching `/^S\d+$/`. If `subId` is absent or invalid, no link is shown (no error state).

### Nearest-10 Sidebar List

> **FR-21** — The Media Targets sidebar shall display a ranked list of the ten nearest targets, sorted by haversine distance from the current lat/lng center point (ascending — closest first).

> **FR-22** — Each item in the nearest-10 list shall show: species common name, location name, distance in miles (one decimal place, e.g. "3.2 mi"), and a recency tier indicator (a small colored dot using the same tier tokens as the pins).

> **FR-23** — Clicking a sidebar list item shall pan the map to that pin, consistent with the existing Hotspots sidebar click behavior.

> **FR-24** — The nearest-10 list shall update whenever the displayed pins change — on a new fetch, on filter change, or when the All/Most Recent toggle is switched.

> **FR-25** — If fewer than ten pins are displayed, the list shall show however many are available (no padding, no placeholder rows).

---

## Non-Functional Requirements

> **NFR-01 — Rate limiting:** The new `GET /nominatim/search` endpoint shall share the existing `_rate_lock` and Nominatim rate-limiting infrastructure in `nominatim.py` (≤1 request/second to OSM). No additional rate-limiting code is needed.

> **NFR-02 — XSS:** All strings from external API responses rendered into map popups or sidebar list items shall pass through the existing `escHtml()` guard. This includes `display_name` from Nominatim, `comName`, `locName`, and any other eBird-sourced strings.

> **NFR-03 — Nominatim attribution:** The `GET /nominatim/search` endpoint must include `User-Agent: SnowRaven/1.0` in all requests to OSM, matching the existing `POST /nominatim/counties` behavior.

> **NFR-04 — Secure context:** The address geocoding input shall function on both HTTP and HTTPS deployments. It does not depend on `window.isSecureContext`.

> **NFR-05 — CSS tokens:** All new colors shall use the `var(--sr-*)` CSS custom property system. No hardcoded hex or RGB values in component files.

> **NFR-06 — No new dependencies:** All enhancements use existing packages (Leaflet, react-leaflet, httpx). No new npm or Python packages shall be added.

---

## Out of Scope

- Autocomplete or typeahead suggestions on the address input
- Multiple checklist links per popup (most recent only, per the strategic brief)
- Recency tiers, filtering, or toggles on Hotspots or My Sightings modes
- Any change to My Sightings mode
- Address geocoding on My Sightings mode
- Reverse geocoding (the existing `POST /nominatim/counties` is unchanged)
- Persisting the All/Most Recent toggle state across sessions or fetches

---

## Open Questions

None — all decisions are resolved in this document.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Address geocoding — success | Typing "Yosemite National Park" and pressing Enter centers the map near lat 37.74, lng -119.57; lat/lng fields update to the resolved coordinates |
| QA-02 | Address geocoding — no result | Typing a gibberish string shows the "No location found" error inline; lat/lng fields are unchanged |
| QA-03 | Address geocoding — shared between modes | The address input appears in both Hotspots and Media Targets sidebars |
| QA-04 | Hotspot legend toggle — hide | Clicking the Visited legend row removes all Visited pins from the map; the Visited row renders at reduced opacity |
| QA-05 | Hotspot legend toggle — restore | Clicking the Visited row again (while hidden) restores all Visited pins; the row returns to full opacity |
| QA-06 | Hotspot legend toggle — independent | Hiding Visited does not affect Unvisited or Personal pins |
| QA-07 | Hotspot legend toggle — resets on fetch | After a new Hotspots fetch, all three categories are visible again |
| QA-08 | Recency tier coloring | Loading Media Targets with data spanning multiple recency windows shows pins in three distinct colors; a pin dated within 7 days uses the bright variant; a pin dated 16–30 days uses the faded variant |
| QA-09 | Recency exclusion | Pins with `recentDate` older than 30 days do not appear on the map |
| QA-10 | Last 30 Days / Last Week toggle — Last 30 Days | "Last 30 Days" mode shows all pins with a `recentDate` within 30 days, including multiple pins for the same species at different locations |
| QA-11 | Last 30 Days / Last Week toggle — Last Week | "Last Week" mode shows only pins with a `recentDate` within 7 days; pins from 8–30 days ago are hidden; multiple same-species pins at different locations are still visible if each qualifies |
| QA-12 | Toggle — no network request | Switching between Last 30 Days and Last Week does not trigger a new fetch (no loading spinner) |
| QA-13 | Checklist link — present | A target pin popup for a record with a valid `subId` shows "View checklist" link that opens `ebird.org/checklist/{subId}` in a new tab |
| QA-14 | Checklist link — absent | A target pin popup where `subId` is missing or not matching `/^S\d+$/` shows no link and no error |
| QA-15 | Nearest-10 list — ranking | The sidebar list shows items sorted by ascending distance from the center point; the closest item is first |
| QA-16 | Nearest-10 list — content | Each list item shows species name, location name, distance (e.g. "3.2 mi"), and a tier dot |
| QA-17 | Nearest-10 list — click | Clicking a sidebar list item pans the map to that pin |
| QA-18 | Nearest-10 list — updates | Switching between All and Most Recent updates the nearest-10 list to reflect the currently visible pins |
| QA-19 | Backend `back=30` | The `GET /map/recent-obs` endpoint sends `back=30` to eBird (verify via network tab or backend log) |
| QA-20 | Backend `subId` capture | The `GET /map/recent-obs` response includes a `subId` field on each grouped result |
