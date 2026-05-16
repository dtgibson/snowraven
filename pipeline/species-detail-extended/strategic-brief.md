# Strategic Brief — Species Detail Extended

## What We're Building

Four additions to the existing Species Detail tab: a subspecies toggle that merges or separates subspecies records, inline embedded media (most recent photo, audio, and video from the Macaulay Library), a ranked location list with eBird hotspot links, and an interactive map showing all sighting locations for the selected species.

## Why Now

Species Detail launched with a solid foundation — sightings stats, media counts, breeding codes, comments. The natural next step is to make it geographically and visually rich. These four additions use data that's already parsed from the eBird backup and ML export; they don't require new backend endpoints or new data sources. The moment is right because the infrastructure is in place and the tab has established user habits.

## The User Problem

A birder reviewing their history with a species can count their sightings but can't easily answer "where have I seen this most?", "what does my most recent photo look like?", or "are these all the same subspecies or a mix?" The current tab answers the first question (total count) but leaves the richer questions unanswered.

## Success Criteria

- Switching the subspecies toggle instantly recalculates all stats — totals, first/last seen, personal best, media counts, breeding codes, comments — without reloading the file
- The most recent photo, audio, and video embed directly in the page using the standard Macaulay Library iframe; only media types the user has recorded appear
- The locations list is sorted by visit count, top 10 visible by default, with a "Show all" expand; each location links to `ebird.org/hotspot/{locationId}` where a hotspot exists
- The map renders all observation coordinates for the selected species as pins on an OpenStreetMap base layer using Leaflet.js; no API key required
- All new sections work correctly at ≤640px viewport width (portrait phone)

## Scope

- **Subspecies toggle:** strips parenthetical subspecies designations in compressed mode (same normalization as the Life List parser) and merges observations under the parent name; toggle in the toolbar; defaults to showing subspecies separately (current behavior)
- **Embedded media:** appears between the Media Statistics card and the Breeding Codes card; uses `<iframe src="https://macaulaylibrary.org/asset/{id}/embed">` embed format; most recent item per type determined by highest catalog ID (catalog IDs are sequential); hidden section when no ML export is loaded
- **Locations list:** new card after the Breeding Codes card; counts unique location names per species observation; links use the "Location ID" column from the eBird CSV; "Show all / Collapse" pattern consistent with other expandable lists
- **Map:** new card after the Locations card; Leaflet.js with OpenStreetMap tiles; pins placed at each unique lat/lng in the species observations; no clustering in v1

## Out of Scope

- Subspecies mixing across different parent species (toggle only applies within the selected species)
- Map clustering or heatmap layers
- Filtering map pins by date range or breeding code
- Location search or autocomplete
- Any backend changes — all four features are client-side
- Desktop-only layouts — every new card and section must work at ≤640px viewport width, following the `.sr-two-col` responsive pattern already established

## Key Decisions

- **Leaflet.js** is the mapping library — no API key, free OpenStreetMap tiles, npm-installable as a React integration via `react-leaflet`
- **Subspecies normalization** uses the same regex as `parseLifeList.ts` — strip everything in parentheses from the common name
- **Most recent media** is determined by highest catalog ID number, not by date parsing — catalog IDs are assigned sequentially by the Macaulay Library
- **Location links** always use `ebird.org/hotspot/{locationId}` — eBird handles public vs. private gracefully; the user knows which locations are theirs
- **All four features are purely client-side** — no new backend endpoints, no new API keys
- **Mobile-first layout:** embedded media iframes use `width: 100%; max-width: 640px` (not fixed pixel widths); the map card has a fixed height (e.g. 300px) that works on both desktop and portrait phone; the locations list is a single column at all breakpoints
