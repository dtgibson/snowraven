# PRD — Species Detail Extended
**Feature:** species-detail-extended
**Session:** 001
**Date:** 2026-05-15
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

Four additions to the Species Detail tab: a subspecies toggle that merges or separates subspecies observations, inline embedded media showing the user's most recent photo/audio/video for the selected species, a ranked locations list with eBird hotspot links, and an interactive Leaflet map of all observation coordinates. All four are client-side only; no backend changes are required.

---

## User Stories

**US-01** — As a birder, I want to toggle subspecies grouping so I can see either granular per-subspecies data or a complete aggregate view of a parent species.

**US-02** — As a birder, I want to see my most recent photo, audio, and video embedded directly on the page so I can recall what the bird looked and sounded like without leaving the app.

**US-03** — As a birder, I want to see which locations I've visited a species most often so I know where to find it.

**US-04** — As a birder, I want to click a location name and go directly to its eBird hotspot page so I can see current community sightings at that spot.

**US-05** — As a birder, I want to see all my sighting locations on a map so I can understand the geographic spread of my observations.

---

## Functional Requirements

### Subspecies Toggle

**FR-01** — The toolbar shall include a toggle button labelled "Show subspecies" (active, default) / "Merge subspecies" (inactive). Clicking it switches between the two modes. The button's visual state shall clearly indicate the current mode.

**FR-02** — In merge mode, the species selector shall display only normalized parent species names. Normalization strips the trailing parenthetical: `"Yellow-rumped Warbler (Myrtle)"` → `"Yellow-rumped Warbler"`. Duplicate normalized names are collapsed to one entry. The original sort order (taxonomic / A–Z) is preserved.

**FR-03** — In merge mode, when a parent species is selected, all statistics (observation count, individual count, first/last seen, personal best, media counts, breeding codes, comments, locations, map pins) shall aggregate all observations whose normalized common name matches the selected name.

**FR-04** — In show-subspecies mode (default), behavior is identical to the current implementation — exact common name match only.

**FR-05** — The toggle state shall reset to show-subspecies (default) when the user loads a new file or clicks "Load different file." It shall persist when the user switches between species.

### Embedded Media

**FR-06** — When the ML export is loaded (`hasML === true`) and the selected species has at least one catalog item for a given media type, an Embedded Media section shall appear between the Media Statistics card and the Breeding Codes card.

**FR-07** — The Embedded Media section shall display at most one embed per media type (Photo, Audio, Video). Only types with a non-zero count for the selected species appear. Types with zero items are omitted entirely.

**FR-08** — Each embed shall use: `<iframe src="https://macaulaylibrary.org/asset/{catalogId}/embed" title="Most recent [type] of [species name]" allowfullscreen>`. The catalog ID used shall be the numerically highest catalog ID of that media type among the selected species' observations (highest ID = most recently uploaded to ML).

**FR-09** — Embeds shall use `width: 100%`, `max-width: 640px`, height `480px`, `loading="lazy"`, and `frameBorder="0"`.

**FR-10** — When no ML export is loaded, the Embedded Media section shall not appear — no empty state, no placeholder.

**FR-11** — Catalog IDs shall be validated as numeric strings (matching `/^\d+$/`) before use in an iframe src. Non-matching IDs are skipped.

### Locations

**FR-12** — A Locations card shall appear after the Breeding Codes card. It shall list unique location names for the selected species, sorted by observation count descending.

**FR-13** — The Locations card shall show the top 10 locations by default. When the total unique location count exceeds 10, a "Show all N locations" button shall appear below the list. Clicking it expands to the full list. A "Show top 10" button then collapses it. The button shall not appear if there are 10 or fewer unique locations.

**FR-14** — Each location row shall display the location name and count. If the location's ID matches `/^L\d+$/`, the name shall be an `<a>` link to `https://ebird.org/hotspot/{locationId}` with `target="_blank"` and `rel="noreferrer"`. Otherwise the name renders as plain text.

**FR-15** — Location data requires one new field on `ObservationEntry`: `locationId: string`. The parser shall read the "Location ID" column and populate this field. Missing or empty values default to an empty string.

### Map

**FR-16** — A Map card shall appear after the Locations card. It shall render a Leaflet.js interactive map using OpenStreetMap tiles (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`), with attribution.

**FR-17** — The map shall place one marker per unique lat/lng coordinate pair among the selected species' observations. Duplicate coordinates (same lat/lng across multiple observations) render as a single marker.

**FR-18** — On initial render and whenever the selected species changes, the map shall fit its bounds to the set of unique coordinate pairs. If only one unique coordinate exists, the map shall center on it at zoom level 12.

**FR-19** — The map card shall have a height of 300px on viewports ≤640px and 380px on wider viewports.

**FR-20** — Map data requires two new fields on `ObservationEntry`: `latitude: number | null` and `longitude: number | null`. The parser shall read "Latitude" and "Longitude" columns; rows where either is absent or non-numeric default to null.

**FR-21** — The map shall only render for the selected species; it does not appear in the "no species selected" state.

---

## Non-Functional Requirements

**NFR-01 — Mobile:** All new cards shall render without horizontal overflow on viewports ≤640px. No fixed pixel widths wider than the viewport. Iframe and map widths use `width: 100%`.

**NFR-02 — Performance:** Iframes shall carry `loading="lazy"` to defer network requests until the section scrolls into view.

**NFR-03 — Security:** Location IDs shall be validated against `/^L\d+$/` and catalog IDs against `/^\d+$/` before use in any URL or src attribute. Invalid values render as plain text or are skipped.

**NFR-04 — Leaflet compatibility:** `leaflet/dist/leaflet.css` shall be imported in the component. Leaflet default marker icons shall be patched for Vite compatibility by setting `iconUrl`, `iconRetinaUrl`, and `shadowUrl` to the Leaflet CDN paths on `L.Icon.Default`.

**NFR-05 — Accessibility:** Each iframe shall have a descriptive `title` attribute: `"Most recent [Photo|Audio|Video] of {speciesName}"`.

**NFR-06 — Colors:** All new UI elements shall use `var(--sr-*)` CSS custom properties — no hardcoded hex values.

---

## Out of Scope

- Map marker popups or click interactions
- Map clustering or heatmap layers
- Filtering map pins by date, breeding code, or location
- Subspecies toggle affecting other tabs
- Any backend changes

---

## Open Questions

**OQ-01 — Map marker on duplicate coordinates:** Multiple observations at the same lat/lng produce one marker. Should the marker indicate count in any way?
*Default if unresolved:* Single plain marker, no count indicator.

**OQ-02 — Subspecies toggle placement:** Main toolbar or near species selector?
*Default if unresolved:* Main toolbar, between "Load different file" and the expand toggle.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Subspecies toggle present | Toggle button visible in toolbar in ready state |
| QA-02 | Merge mode collapses selector | File with "Warbler (Myrtle)" and "Warbler (Audubon's)" shows single "Warbler" entry in merge mode |
| QA-03 | Merge mode aggregates totals | Checklist count in merge mode equals sum of all matching subspecies checklist counts |
| QA-04 | Toggle resets on file load | Toggle returns to "Show subspecies" after loading a new file |
| QA-05 | Embedded media appears with ML | Species with Photo records shows a Photo iframe when ML export is loaded |
| QA-06 | Correct catalog ID used | Iframe src contains the numerically highest catalog ID for that type |
| QA-07 | Embedded media hidden without ML | No Embedded Media section when only eBird CSV is loaded |
| QA-08 | Iframe security | A catalog ID not matching `/^\d+$/` does not appear in any iframe src |
| QA-09 | Locations card shows top 10 | Species with 15 unique locations shows 10 rows by default |
| QA-10 | Locations expand / collapse | "Show all 15 locations" expands list; "Show top 10" collapses it |
| QA-11 | Valid location link | Location with ID "L1234567" renders a link to ebird.org/hotspot/L1234567 |
| QA-12 | Invalid location no link | Location with empty or malformed ID renders as plain text |
| QA-13 | Map renders | Selecting a species with lat/lng data renders a Leaflet map with ≥1 marker |
| QA-14 | Map fits bounds | Switching species updates map to fit new species' observation coordinates |
| QA-15 | Mobile layout | On 390px viewport, no horizontal scroll; all new cards display within viewport |
| QA-16 | Map height responsive | Map card is 300px tall on ≤640px viewport, 380px on wider |
| QA-17 | Leaflet CSS loaded | Map tiles render correctly; no broken tile or missing icon errors in console |
