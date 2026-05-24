# Feature Complete — Map Explorer Improvements

**Completed:** 2026-05-23
**Version:** v0.1.8
**Feature:** map-explorer-improvements

---

## What Was Built

Two targeted improvements to the Map Explorer tab.

**Media Target Type Filter:** When Media Targets results are loaded, four filter pills appear in the sidebar — All, Photo, Audio, Video. Selecting one or more type pills narrows the map pins and nearest-10 list to species missing those specific media types, using AND logic. The species count updates live. The filter resets when "Find Recent Sightings" is clicked.

**Hotspot Radius Fix:** Personal location pins in Hotspots mode now correctly clip to the selected radius. The bug was that both eBird API fetch calls were passing the radius in miles, but the eBird API expects km — causing public hotspots to appear within a ~60% smaller area while personal pins (which used a correct miles-to-miles haversine comparison) bled outside. Both fetch calls now convert with `Math.round(radius * 1.60934)`.

As a side fix, three pre-existing `react-hooks/set-state-in-effect` lint errors were resolved, restoring CI to green for the first time since v0.1.6.

---

## All Artifacts and Files Produced

**Pipeline artifacts:**
- `pipeline/map-explorer-improvements/strategic-brief.md`
- `pipeline/map-explorer-improvements/prd.md`
- `pipeline/map-explorer-improvements/schema.md`
- `pipeline/map-explorer-improvements/design-spec.md`
- `pipeline/map-explorer-improvements/design.html`

**Modified source files:**
- `frontend/src/components/MapExplorer.tsx` — `targetTypeFilter` state; two-pass `displayedTargetPins` useMemo; `distKm` conversion in both fetch calls; filter pills JSX; species count label; empty state text; `set-state-in-effect` fix
- `frontend/src/App.tsx` — `set-state-in-effect` fix (`fetchKeyStatus` wrapper)
- `frontend/src/components/LifeList.tsx` — `set-state-in-effect` fix (`setFilterIsTarget` wrapper)
- `frontend/package.json` — v0.1.8
- `CHANGELOG.md` — v0.1.8 entry
- `PRODUCT_CONTEXT.md`, `DECISIONS.md`, `ROADMAP.md` — context updated

---

## Feature Complete

This feature is fully deployed. v0.1.8 is live at https://github.com/dtgibson/snowraven/releases/tag/v0.1.8.

To start the next feature, run `/new-feature`.
