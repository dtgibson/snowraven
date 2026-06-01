# Strategic Brief — Map Atlas Blocks & Nearest Hotspots

## What We're Building
Two additions to the Map Explorer:
1. A toggle that superimposes **California Breeding Bird Atlas blocks** (official boundaries) over the map, rendering the blocks in the current view, with a block's name shown on click.
2. In the Hotspots sidebar, an automatic **"10 closest unvisited hotspots"** list below the existing filter/legend buttons.

## Why Now
The Map Explorer is SnowRaven's exploration hub, and both additions sharpen the core "where should I go birding" question. Atlas blocks let a California atlaser see official block boundaries in context; the nearest-unvisited list turns the existing hotspot data into an immediate "closest places you haven't been" answer instead of hunting the map.

## The User Problem
- An atlaser working the California Breeding Bird Atlas can't see block boundaries alongside their own sightings and nearby hotspots — they have to cross-reference a separate atlas map.
- The Hotspots view shows all nearby hotspots as pins, but finding the *closest ones you haven't visited yet* means scanning the map by eye.

## Success Criteria
- A toggle in the Map Explorer overlays California atlas block boundaries; turning it off removes them. Blocks render for the current map view and update as you pan/zoom.
- Clicking a block shows its atlas name.
- The overlay works offline (data is bundled, no runtime third-party fetch) and adds no new external dependency at runtime.
- The Hotspots sidebar shows up to 10 nearest unvisited hotspots, ranked by distance, below the filter buttons, updating with each hotspot search.
- Each listed hotspot shows its name and distance and lets the user locate it on the map (consistent with the existing nearest-10 list in Media Targets).
- macOS, Windows, and web/Pi all behave the same.

## Scope
- California atlas block overlay: bundled block boundary data (converted once from the official KML/shapefile), a toggle control, viewport-based rendering, block name on click.
- Nearest-10 unvisited hotspots list in the Hotspots sidebar, reusing the existing `distanceMiles` helper and nearest-10 pattern.

## Out of Scope
- Block **coverage/effort** tracking (which blocks you've birded, completeness) — a much larger, data-heavy feature.
- Atlases for states other than California (architecture may generalize later; v1 is California only).
- Runtime fetching of block data from Google Drive or any atlas service.

## Key Decisions
- **Bundle the block data as a pre-converted, compact local asset** (KML/shapefile → GeoJSON, one-time), keeping the feature offline-capable and consistent with the local-first / no-new-third-party-call privacy stance. Dave will provide the source file.
- **Render only blocks in the current viewport** — 16,527 statewide polygons can't all draw at once; viewport-based rendering keeps it fast and is where the blocks are useful.
- **v1 is California-specific**, by the data; the toggle simply shows nothing outside California.
- **Nearest-10 unvisited** reuses the proven Media Targets nearest-10 pattern for consistency.

## Reference
California Breeding Bird Atlas blocks: https://ebird.org/atlascalifornia/about/blocks — 16,527 blocks (~3×3 mi, USGS 7.5' quad / 6), named by quad + position; KML + shapefile downloads via Google Drive. Dave will provide the source data file directly.
