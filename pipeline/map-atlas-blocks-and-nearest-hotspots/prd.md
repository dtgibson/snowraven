# PRD — Map Atlas Blocks & Nearest Hotspots
**Feature:** map-atlas-blocks-and-nearest-hotspots
**Date:** 2026-05-29
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview
Two additions to the Map Explorer: (1) a toggle that overlays California Breeding Bird Atlas block boundaries on the map, rendered for the current viewport, with a block's name shown on click; and (2) an automatic "10 closest unvisited hotspots" list in the Hotspots sidebar.

## User Stories

> **US-01** — As a California atlaser, I want to toggle the breeding atlas block boundaries onto the map, so that I can see official blocks alongside my sightings and nearby hotspots.

> **US-02** — As a user viewing atlas blocks, I want to click a block and see its name, so that I can identify which block I'm looking at.

> **US-03** — As a user away from the map's atlas data (zoomed far out, or outside California), I want clear behavior rather than a frozen or cluttered map.

> **US-04** — As a user browsing hotspots, I want the ten closest hotspots I haven't visited listed automatically, so that I can find new places to bird without scanning the map.

> **US-05** — As a user, I want to click a listed hotspot and have the map move to it, the same way the Media Targets nearest list already works.

## Functional Requirements

**Atlas block overlay**
> **FR-01** — The Map Explorer shall provide a toggle control to show/hide the California atlas block overlay. It shall default to off.
> **FR-02** — When the toggle is on, the app shall render the atlas block boundaries that fall within the current map viewport, and update them as the user pans or zooms.
> **FR-03** — Block boundary data shall be a local, bundled asset (pre-converted once from the official California atlas KML/shapefile). No block data shall be fetched from Google Drive or any external service at runtime.
> **FR-04** — The block data shall be loaded lazily — only when the overlay is first enabled — so it does not affect initial app load.
> **FR-05** — Clicking a rendered block shall display the block's atlas name (quad name + position).
> **FR-06** — When the toggle is on but too many blocks would be in view to render performantly (e.g., zoomed far out), the app shall not draw them all; it shall instead show an unobtrusive hint to zoom in. When the toggle is on but the view is outside California (no blocks), nothing is drawn and no error is shown.
> **FR-07** — Block boundaries shall be visually distinct from existing map pins/heatmap and shall not obscure them (outline style, not heavy fill), using `var(--sr-*)` tokens.

**Nearest unvisited hotspots**
> **FR-08** — In the Hotspots sidebar, below the existing filter/legend buttons, the app shall automatically list up to the 10 closest **unvisited** hotspots, ranked by distance from the current center point.
> **FR-09** — Each list row shall show the hotspot name and its distance (miles, one decimal), matching the Media Targets nearest-10 styling.
> **FR-10** — Clicking a list row shall pan the map to that hotspot (reusing the existing `panTarget`/`MapPanner` mechanism).
> **FR-11** — The list shall recompute whenever a hotspot search completes or the center point changes; if there are no unvisited hotspots, the list section shall be absent (no empty shell).

## Non-Functional Requirements

> **NFR-01 — Performance:** Rendering atlas blocks shall not noticeably degrade map interaction. Only viewport-intersecting blocks are drawn; the full 16,527-block dataset is never rendered at once.
> **NFR-02 — Offline / local-first:** The overlay shall function with no network access once the app is loaded, consistent with the privacy stance (no new runtime third-party dependency).
> **NFR-03 — Cross-platform:** Identical behavior on macOS, Windows, and web/Pi. The block data asset is bundled into the frontend, so it ships in every target.
> **NFR-04 — Bundle size awareness:** The converted block asset shall be as compact as practical (minified GeoJSON / simplified geometry as needed) and lazy-loaded, so it doesn't bloat the initial bundle.
> **NFR-05 — Theming & accessibility:** New controls use `var(--sr-*)` tokens, work in light/dark, and the toggle and list rows are keyboard-operable (`tabIndex={0}`, appropriate ARIA), consistent with the v0.3.28 accessibility pass.

## Out of Scope
- Block coverage/effort tracking (which blocks birded, completeness).
- Atlases other than California.
- Runtime fetching of block data.
- Editing or contributing atlas data.

## Open Questions
- **Block data acquisition & format.** Dave provides the source (KML or shapefile). *Default if unresolved by Stage 5:* The Engineer converts it once to minified GeoJSON (FeatureCollection of block polygons with a `name` property) bundled under the frontend assets; geometry simplified only if size requires.
- **Zoom threshold for drawing blocks.** *Default:* draw when the count of in-view blocks is below a performant cap (Architect/Engineer pick, e.g. a min zoom level or a max-feature count ~300–500); otherwise show the "zoom in" hint (FR-06).
- **Toggle placement & availability across modes.** *Default:* a single overlay toggle in the map controls, available regardless of mode (the blocks are a base geographic overlay). The Designer confirms placement.

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Toggle shows/hides blocks (FR-01) | Toggling on draws CA block outlines in view; toggling off removes them; default off |
| QA-02 | Viewport rendering + update (FR-02) | Panning/zooming over California updates the drawn blocks to the current view |
| QA-03 | Local/offline data (FR-03, NFR-02) | Blocks render with no network; no request to Google Drive or external atlas service at runtime |
| QA-04 | Lazy load (FR-04, NFR-04) | Block data is not loaded until the overlay is first enabled; initial bundle unaffected |
| QA-05 | Block name on click (FR-05) | Clicking a block shows its atlas name |
| QA-06 | Scale / out-of-area handling (FR-06, NFR-01) | Zoomed far out → "zoom in" hint, not thousands of polygons; outside CA → nothing drawn, no error; map stays responsive |
| QA-07 | Visual distinctness (FR-07) | Block outlines are readable over tiles and don't hide pins/heatmap; tokenized; correct in light/dark |
| QA-08 | Nearest-10 unvisited list (FR-08, FR-09) | Hotspots sidebar lists ≤10 closest unvisited hotspots with name + distance, below the filter buttons |
| QA-09 | Click to locate (FR-10) | Clicking a row pans the map to that hotspot |
| QA-10 | Recompute / empty state (FR-11) | List updates on new search/center change; absent when no unvisited hotspots |
| QA-11 | Accessibility (NFR-05) | Toggle + list rows keyboard-operable; tokens used; light/dark correct |

**Verification note:** Atlas-block criteria (QA-01–07) require the converted California data asset in place and a map view over California. The nearest-10 criteria (QA-08–10) are verifiable anywhere hotspot data loads.
