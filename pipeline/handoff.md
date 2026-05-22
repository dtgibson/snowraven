# Pipeline Handoff — map-explorer-enhancements (complete)

## What was built

Five enhancements to the Map Explorer tab, shipped as v0.0.44.

**Address geocoding** — both Hotspots and Media Targets sidebars now have a "Search by place name" input that resolves addresses via Nominatim, populates the lat/lng fields, and immediately triggers a fetch. New `GET /nominatim/search` backend endpoint shares the existing rate lock and User-Agent.

**Hotspot legend toggles** — each legend row (Visited, Unvisited, Personal) is a clickable button. Clicking hides that pin category at 40% opacity; clicking again restores it. All categories reset to visible on each new fetch. `hiddenKinds` Set state in the component.

**Media Targets recency tiers** — pins are now color-coded by three green shades: fresh (≤7 days, `--sr-map-target-fresh`), mid (8–15 days, `--sr-map-target-mid`), old (16–30 days, `--sr-map-target-old`). The eBird `back` parameter was extended from 14 to 30 days. Pins older than 30 days are excluded by the API.

**Last 30 Days / Last Week toggle** — segmented control in the Media Targets sidebar filters pins client-side with no network call. "Last Week" shows all pins where `recentDate` is within 7 days (not one-per-species deduplication — all qualifying locations shown).

**Checklist link in popup** — each target pin popup shows "View checklist {subId} →" when `subId` matches `/^S\d+$/`. The backend now captures `subId` from the most-recent observation in each `(speciesCode, locId)` group.

**Nearest-10 sidebar list** — ranked by haversine distance (reusing the existing `distanceMiles()` helper). Each row: tier dot, species name, location name, distance in miles. Clicking a row sets `panTarget` state; `MapPanner` child inside `MapContainer` calls `map.panTo()`.

## Artifacts produced

**Session 1 (planning):**
- `pipeline/map-explorer-enhancements/strategic-brief.md`
- `pipeline/map-explorer-enhancements/prd.md`
- `pipeline/map-explorer-enhancements/schema.md`
- `pipeline/map-explorer-enhancements/design-spec.md`
- `pipeline/map-explorer-enhancements/design.html`

**Session 2 (implementation):**
- `backend/routers/map.py` — `back=30`, `subId` capture
- `backend/routers/nominatim.py` — `GET /nominatim/search` endpoint
- `frontend/src/globals.css` — four new `--sr-map-target-*` tokens
- `frontend/src/components/MapExplorer.tsx` — all frontend changes
- `CHANGELOG.md` — v0.0.44 entry
- `PRODUCT_CONTEXT.md` — Map Explorer section updated
- `DECISIONS.md` — five new decision entries

## Feature status

Complete. v0.0.44 released on GitHub. All 189 tests pass (67 backend, 122 frontend).

## Starting the next feature

Run `/new-feature` to begin the next pipeline session.
