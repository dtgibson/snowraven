# PRD — Map Explorer
**Feature:** map-explorer
**Session:** 001
**Date:** 2026-05-22
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

Map Explorer is a new tab that exposes the geographic dimension of a user's eBird data across three distinct view modes: personal sightings with real-time filters, a nearby hotspot overlay with visited/unvisited/personal classification, and a media targets finder that cross-references the user's coverage gaps with recent eBird reports near a specified location.

---

## User Stories

**US-01** — As a birder with an eBird backup stored in Settings, I want to see all my personal observations as pins on an interactive map, so that I can understand the geographic spread of my birding history at a glance.

**US-02** — As a birder, I want to filter my sightings by species, date range, county, breeding code tier, and media coverage, so that I can explore specific subsets of my records geographically.

**US-03** — As a birder, I want to toggle between a pin view and a heatmap of my sightings, so that I can see which areas I've birded most intensively.

**US-04** — As a birder with an eBird API key, I want to see nearby public eBird hotspots coded by whether I've visited them, so that I can quickly identify new sites to explore.

**US-05** — As a birder, I want to see my personal (private) eBird locations shown as a distinct third category alongside public hotspots, so that I understand my private sites in geographic context.

**US-06** — As a birder trying to improve my media coverage, I want to find where my target species (those I have no media of) have been recently reported near a location I choose, so that I can plan targeted outings.

**US-07** — As a birder, I want to use my device's location to set a center point for Hotspot and Media Targets views, so that I don't have to enter coordinates manually.

---

## Functional Requirements

### View Mode Control

**FR-01** — The tab shall display three view mode buttons at the top of the content area: "My Sightings", "Hotspots", and "Media Targets". Only one mode is active at a time.

**FR-02** — The map shall persist across mode switches — the same Leaflet instance shall be retained so viewport position and zoom are not lost when the user switches modes.

---

### My Sightings Mode

**FR-03** — On entering My Sightings mode, the app shall load all observations from the stored eBird backup and place one marker per unique `locationId` on the map, weighted by observation count at that location. Map bounds shall auto-fit to all loaded markers.

**FR-04** — My Sightings mode shall include a collapsible filter panel with the following controls:
- Species: searchable single-select dropdown (all species in the backup)
- Date range: from/to date inputs (same `DateRangeState` pattern used in other tabs)
- County: single-select dropdown (populated from unique counties in the backup; hidden when no county data is present)
- Breeding code tier: segmented control — All / Possible / Probable / Confirmed
- Media filter: visible only when ML export is stored; options — Any / Has Photo / Has Audio / Has Video / No Media (species-level filter: shows locations where the species has the selected media status in the ML export)

**FR-05** — Applying any filter shall update visible markers in real time. All filtering is client-side — no network request is triggered by filter changes.

**FR-06** — My Sightings mode shall include a Pins / Heatmap segmented control in the map toolbar. In Heatmap mode: pins are hidden; the `HeatmapLayer` component from Species Detail is used, weighted by observation count at each coordinate. In Pins mode: the heatmap layer is removed and markers are shown. The toggle resets to Pins when a new file loads.

**FR-07** — Clicking a sighting pin shall open a Leaflet popup showing: location name, total observation count at that location, date of most recent observation, and up to 5 species seen there. If more than 5 species are recorded at that location, show "+N more species".

**FR-08** — If no eBird backup is stored in Settings, My Sightings mode shall render the shared `SetupRequired` component with title "eBird Backup Required", appropriate body text, and an `onGoToSettings` callback.

---

### Hotspot Overview Mode

**FR-09** — Hotspot Overview mode shall display a center point control and a radius selector before showing any hotspots. The center point control consists of a "Use my location" button and two numeric inputs for manual latitude/longitude entry. The browser Geolocation API shall only be invoked when the user explicitly clicks "Use my location". The app shall never call the Geolocation API automatically on mount, on mode switch, or for any reason other than a direct button press. The radius selector offers four options: 5 mi / 10 mi / 25 mi / 50 mi (default: 25 mi).

**FR-10** — Pressing "Find Hotspots" shall call the backend endpoint `GET /map/hotspots` with `lat`, `lng`, and `dist` parameters. The endpoint calls the eBird API `GET /v2/ref/hotspot/geo?lat={lat}&lng={lng}&dist={dist}&back=30&fmt=json` and returns the hotspot list to the frontend.

**FR-11** — Each returned hotspot shall be classified client-side into one of three categories:
- **Visited** — the hotspot's `locId` appears in the user's stored eBird backup location IDs
- **Unvisited** — the hotspot's `locId` does not appear in the backup
- **No backup** — if no eBird backup is stored, all hotspots are shown without visited/unvisited classification and a notice explains that storing a backup enables this feature

**FR-12** — Personal locations shall be derived client-side from the stored eBird backup: location IDs from the backup that do not appear in the eBird hotspot API response, filtered to those whose coordinates fall within the search radius. These are displayed as a fourth pin category.

**FR-13** — Each pin category shall use a distinct combination of color AND SVG icon shape rendered via Leaflet `DivIcon`, so the distinction is accessible without relying on color alone:
- **Visited hotspot:** green background + checkmark (✓) glyph
- **Unvisited hotspot:** blue/muted background + binoculars glyph (two filled circles side by side)
- **Personal location:** amber background + star (★) glyph
- **No-backup state:** single neutral style for all hotspot pins

**FR-14** — Clicking a visited hotspot pin shall open a popup showing: hotspot name, number of distinct species the user has recorded there (derived from backup), date of most recent visit, and a link to `ebird.org/hotspot/{locId}`.

**FR-15** — Clicking an unvisited hotspot pin shall open a popup showing: hotspot name and a link to `ebird.org/hotspot/{locId}`.

**FR-16** — Clicking a personal location pin shall open a popup showing: location name, total observation count, and date of most recent observation.

**FR-17** — A legend shall be displayed beneath the map identifying each active pin category with its color and icon combination.

**FR-18** — If the eBird API key is not configured in Settings, Hotspot Overview mode shall show the amber key notice (same pattern as Weather tab) with a "Go to Settings →" link. The center point controls shall remain visible but "Find Hotspots" shall be disabled.

---

### Media Targets Mode

**FR-19** — Media Targets mode shall display the same center point control and radius selector as Hotspot Overview (FR-09), including the same geolocation consent requirement: the Geolocation API is invoked only on explicit button press.

**FR-20** — The center point value shall persist when switching between Hotspot Overview and Media Targets within the same session.

**FR-21** — When both an eBird backup and ML export are stored, the target species list shall be automatically derived as: species present in the eBird backup whose total media count (photo + audio + video) in the ML export is zero, plus species in the backup that do not appear in the ML export at all. This list shall be shown as a read-only summary chip ("47 target species").

**FR-22** — When no ML export is stored, the user shall see a searchable multi-select input to manually choose target species from all species in the eBird backup.

**FR-23** — Pressing "Find Recent Sightings" shall call the backend endpoint `GET /map/recent-obs` with `lat`, `lng`, `dist`, and `codes` (comma-separated eBird species codes for all target species).

**FR-24** — The `/map/recent-obs` endpoint shall resolve species codes server-side using the existing taxonomy cache (`_by_com` dict in `taxonomy.py`). Species not found in the cache shall be silently skipped. The endpoint calls `GET /v2/data/obs/geo/recent?lat={lat}&lng={lng}&dist={dist}&back=14&fmt=json`, filters to the requested codes, groups by `(speciesCode, locId)`, and returns a summarised list.

**FR-25** — Each unique (species, location) pair shall be shown as one pin on the map, labeled with the species common name.

**FR-26** — Clicking a media target pin shall open a popup showing: species name, location name, date of most recent observation at that location, and count of checklists reporting it.

**FR-27** — If the derived or manual target species list is empty, the mode shall display the message: "You already have media for every species in your eBird backup." No fetch shall be made.

**FR-28** — If the eBird API key is not configured, Media Targets mode shall show the amber key notice with a "Go to Settings →" link.

---

### Backend Endpoints

**FR-29** — New FastAPI endpoint `GET /map/hotspots` shall accept query params `lat: float`, `lng: float`, `dist: int`. It shall call the eBird API using the key from `os.environ["EBIRD_API_KEY"]`, return the hotspot JSON array, and respond 401 if no key is configured.

**FR-30** — New FastAPI endpoint `GET /map/recent-obs` shall accept query params `lat: float`, `lng: float`, `dist: int`, `codes: str` (comma-separated species codes). It shall call the eBird recent geo observations endpoint, filter and group results as described in FR-24, and respond 401 if no key is configured.

**FR-31** — Both endpoints shall use `httpx.AsyncClient` (consistent with existing eBird endpoints) with a 10-second timeout. eBird API errors shall be propagated as 502 responses with a descriptive `detail` field.

---

## Non-Functional Requirements

**NFR-01 — Accessibility:** Hotspot and personal location pins must use both color and icon shape/glyph to distinguish categories. No information shall be conveyed by color alone. The legend (FR-17) must include both color and icon representation.

**NFR-02 — Performance:** My Sightings filtering (FR-05) must be entirely client-side. Heatmap layer updates must complete within 500ms for backups up to 10,000 observations.

**NFR-03 — Security:** The eBird API key must never be returned to the browser or included in frontend network requests. All eBird calls go through the FastAPI proxy. Both new endpoints shall return 401 (not 500) when the key is absent.

**NFR-04 — No new npm packages:** Map rendering uses Leaflet and leaflet.heat (already installed). Custom pin icons use `L.divIcon` with inline SVG strings. No additional Leaflet plugin packages.

**NFR-05 — Colors:** All colors use `var(--sr-*)` CSS custom properties. New tokens: `--sr-map-visited`, `--sr-map-unvisited`, `--sr-map-personal`, `--sr-map-target`. Add to both `:root` and `[data-theme="dark"]` in `globals.css`.

**NFR-06 — Error handling:** eBird API errors in Hotspot and Media Targets modes display an inline error message; they do not unmount the tab or clear the map.

**NFR-07 — Map instance reuse:** The Leaflet map instance is created once and reused across mode switches (FR-02). Mode-specific marker layers are added and removed without destroying the map.

**NFR-08 — Location consent:** The app shall never access device location without express user initiation. No geolocation call shall occur except in direct response to the user clicking the "Use my location" button. This applies across all three view modes and all session states. The button label must clearly indicate what clicking it will do.

---

## Out of Scope

- Real-time or live observation feeds from eBird
- Route planning, turn-by-turn directions, or driving time estimates
- Saving, exporting, or sharing map views
- Weather overlays on the map
- Configuring the recent-observations lookback period (fixed at 14 days in v1)
- Marker clustering (can be added in a maintain session if overlapping pins become an issue)
- Map tile provider selection (OpenStreetMap via Leaflet default)

---

## Open Questions

**Q-01:** When no eBird backup is stored and Hotspot Overview is used, should personal location pins be shown?
→ Default: no personal pins without a backup. The notice in FR-11 ("No backup" state) explains that storing a backup enables visited classification and personal locations.

**Q-02:** Geolocation failure or denial handling.
→ Default: "Use my location" button shows an inline error "Location unavailable — enter coordinates manually." Manual inputs are always shown and usable regardless of geolocation availability.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | My Sightings loads | eBird backup stored → markers appear on map; bounds auto-fit to data |
| QA-02 | Species filter | Select a species → only pins at that species' observed locations remain |
| QA-03 | Date range filter | Set a date range → only pins with observations in range remain |
| QA-04 | Breeding code tier filter | Select "Confirmed" → only pins at locations with ≥1 confirmed breeding code observation |
| QA-05 | Media filter | ML export stored; select "No Media" → only pins for species with zero ML media |
| QA-06 | Heatmap toggle | Click Heatmap → pins hidden, heatmap renders; click Pins → reverts |
| QA-07 | Sighting pin popup | Click a pin → popup shows location name, obs count, recent date, species list |
| QA-08 | My Sightings setup screen | No eBird backup → SetupRequired shown; "Go to Settings" navigates to Settings tab |
| QA-09 | Hotspot fetch | Enter center + radius, click Find Hotspots → pins appear on map |
| QA-10 | Pin classification | Visited = green + checkmark; unvisited = blue + binoculars; personal = amber + star |
| QA-11 | Visited popup | Click visited pin → shows name, species count, last visit date, eBird link |
| QA-12 | Legend shown | Hotspot mode after fetch → legend below map shows all active categories |
| QA-13 | No key — hotspot | eBird key absent → amber notice shown; Find Hotspots button disabled |
| QA-14 | Media targets auto-derive | Backup + ML export stored → target list shown; fetch button enabled |
| QA-15 | Empty target list | User has media for all species → friendly message shown; no fetch |
| QA-16 | Media targets manual select | No ML export → multi-select input shown; selecting species enables fetch |
| QA-17 | Recent obs fetch | Target species + center + radius → pins appear per (species, location) pair |
| QA-18 | Target pin popup | Click pin → shows species name, location, recent date, checklist count |
| QA-19 | No key — media targets | eBird key absent → amber notice shown; Find Recent Sightings button disabled |
| QA-20 | Center point persists | Set center in Hotspot mode → switch to Media Targets → same lat/lng present |
| QA-21 | Geolocation consent | App load → no geolocation call made; click "Use my location" → geolocation invoked |
| QA-22 | Geolocation denial | Deny permission → inline error shown; manual inputs remain usable |
| QA-23 | Mode switch preserves viewport | Pan/zoom in My Sightings → switch to Hotspots → map center and zoom unchanged |
