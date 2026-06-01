# Change Brief — heatmap-coverage

## What is changing
Improve the My Sightings heatmap in the Map Explorer so it conveys density and clustering, not just fuzzy dots:
1. **Better defaults** — increase the `leaflet.heat` radius and blur (and refine intensity scaling / gradient as needed) so neighboring sightings merge into a readable density gradient instead of tight isolated blobs.
2. **Intensity/spread slider** — a control in the My Sightings panel (shown in heatmap mode) that scales the heatmap's spread live, letting the user adjust coverage to taste and compensate for how pixel-radius reads at different zoom levels.

## Why now
The heatmap currently uses a small fixed footprint (`radius: 25, blur: 15`), so it barely extends past each point and adds little over the pin view — it doesn't show the relationships between sightings, which is the whole point of a heatmap.

## User-facing impact
Yes (intended): the heatmap covers more area and reads as a density surface; a new intensity slider appears in My Sightings heatmap mode. No change to pins mode, other map modes, or any other tab.

## Lane note
On the New Feature boundary (new control), but kept in Improve: it's a design refinement of an existing feature with no new data, screen, or flow needing strategy/PRD discipline. Revisit if it grows mid-build.

## Decisions touched
None.

## Key facts (verified)
- Heatmap: `HeatmapLayer` in `MapExplorer.tsx` (~line 259) via `L.heatLayer(points, { radius: 25, blur: 15, maxZoom: 17 })`.
- Points: `heatPoints` = `locations.map(l => [lat, lng, min(count/20, 1)])` (~line 313). Per-point intensity from sighting count.
- Display toggle: `displayMode: 'pins' | 'heatmap'` (the slider shows only in heatmap mode).
- `leaflet.heat` is already a dependency; no new dep needed.

## What done looks like
- In heatmap mode, nearby sightings blend into a continuous density gradient that shows clustering; coverage is noticeably broader than today.
- A keyboard-operable, token-styled intensity slider in the My Sightings panel changes the heatmap spread live; default gives the improved look without touching it.
- Pins mode and all other map behavior unchanged; tests/build green.
