# Handoff — species-detail-extended (complete)

**Feature:** Species Detail Extended
**Version shipped:** v0.0.32
**Release:** https://github.com/dtgibson/snowraven/releases/tag/v0.0.32
**Completed:** 2026-05-15

---

## What was built

The Species Detail tab gained five new capabilities, all client-side with no backend changes:

1. **Subspecies merge toggle** — collapses all subspecies variants into a single parent species entry. Aggregates every stat, breeding code, location, comment, and map pin across matching subspecies. Defaults to merged. Toggle switch UI in the toolbar.

2. **Spuh/slash toggle** — hides uncertain identifications (sp. entries and slash species) from the species selector. Defaults to hidden. Second toggle switch in the toolbar.

3. **Top locations card** — ranked list of every location where the species has been observed, sorted by count. Top 10 by default with expand/collapse. Location IDs matching `/^L\d+$/` link to `ebird.org/loc/{id}`.

4. **Sighting locations map** — Leaflet/OpenStreetMap map with one marker per unique lat/lng pair. Auto-fits bounds on species change. Each marker opens a popup with dated checklist links (up to 6 + overflow). `leaflet` and `react-leaflet` added as dependencies.

5. **Embedded recent media** — most recently uploaded Photo, Audio, Video per species embedded via Macaulay Library iframe. Responsive 3-column CSS grid on desktop, single column on mobile. Scrollbars suppressed. Appears at the bottom of the detail view.

The eBird CSV parser (`parseEbirdObservations.ts`) now also reads Location ID, Latitude, and Longitude columns. 24 tests in the parser test suite (up from 18).

---

## Files produced / changed

**Session 1 artifacts (pipeline):**
- `pipeline/species-detail-extended/strategic-brief.md`
- `pipeline/species-detail-extended/prd.md`
- `pipeline/species-detail-extended/schema.md`
- `pipeline/species-detail-extended/design-spec.md`
- `pipeline/species-detail-extended/design.html`

**Session 2 implementation:**
- `frontend/src/components/SpeciesDetail.tsx` — all new features; `ToggleSwitch`, `MapBoundsFitter`, `CoordMarker` added
- `frontend/src/lib/parseEbirdObservations.ts` — reads locationId, latitude, longitude
- `frontend/src/lib/parseEbirdObservations.test.ts` — 24 tests (was 18)
- `frontend/src/types.ts` — `ObservationEntry` extended with 3 new fields
- `frontend/src/globals.css` — `.sr-map-container`, `.sr-media-grid`, `.sr-media-item`, `.sr-media-iframe`
- `frontend/package.json` — leaflet, react-leaflet, @types/leaflet added; version 0.0.32
- `CHANGELOG.md` — v0.0.32 entry

**Context updated:**
- `PRODUCT_CONTEXT.md` — Species Detail section rewritten; 5 new Key Decisions added

---

## Feature is complete

All 9 pipeline stages approved. No open items.

To start the next feature, run `/new-feature`.
