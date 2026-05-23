# Change Brief — Map Tab Centering + Target Label Readability

## What is changing

Two targeted improvements to Map Explorer. First, clicking the Hotspots or Media
Targets tab button will now center and zoom the map to the user's saved default
location (if one is set), using the same `DefaultCenterSetter` mechanism that already
handles centering on initial load. Currently the map stays frozen at whatever zoom the
Sightings fitBounds left it at. Second, media target label pills get a white border and
stronger box-shadow, so they stand out clearly from OSM map tiles regardless of the
tile color underneath — particularly relevant for the "old" tier (light mint green,
#A8D4BB) which blends into light backgrounds.

## Why now

User reported that the expected centering behavior was absent when switching tabs, and
that species name text on target labels is hard to distinguish from the map. Both are
quality issues in a recently shipped feature.

## User-facing impact

- Switching to Hotspots or Media Targets re-centers the map to the saved default
  location/zoom (same behavior already present on initial app load).
- Media target species-name pills gain a white outline and deeper shadow, making them
  visually distinct from map tiles.

## Decisions touched

None. `DefaultCenterSetter` was established in the mobile-map-explorer fix session.
The label pill styling is new inline CSS within an existing divIcon — no prior decision
governs it.

## What done looks like

- Clicking "Hotspots" or "Media Targets" from the sightings view re-centers the map to
  the saved lat/lng at the appropriate zoom.
- Media target pills are clearly legible on light OSM tiles, including the old-tier
  (mint green) pins.
- `npm run build` passes clean.
