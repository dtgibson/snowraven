# Strategic Brief — Map Explorer Enhancements

## What We're Building
Four targeted improvements to the Map Explorer tab: address-based location input, interactive legend toggles on Hotspots, clickable checklist links and recency-tiered pins on Media Targets, and a ranked list of the ten nearest media targets sorted by distance.

## Why Now
The Map Explorer was just shipped and is in active use. These additions address the first real friction points: entering a location is harder than it needs to be, the legend is display-only when it could be interactive, the Media Targets popup has no way to act on a sighting, and the sidebar gives no ranked or recency-filtered view of what's actually close and fresh.

## The User Problem
A birder planning a trip wants to center the map on a place they know by name, isolate hotspot categories visually, open an eBird checklist directly from a media target pin, and immediately understand which targets are worth chasing — both by proximity and by how recently the species was seen. A sighting from 28 days ago carries very different weight than one from yesterday, and sightings older than 30 days aren't actionable.

## Success Criteria
- Typing a place name and pressing Enter centers the map on that location without requiring lat/lng
- Clicking a Hotspots legend row hides or shows that pin category; clicking again restores it
- Media Targets pins are color-coded by recency tier (≤7 days / ≤15 days / ≤30 days); pins older than 30 days are excluded
- A toggle switches between showing all pins (within 30 days) and only the most recent pin per species (one location per species — the one with the freshest sighting)
- The most recent checklist for each (species, location) pair is a clickable link in the popup
- The Media Targets sidebar shows the ten nearest targets ranked by distance from the center point

## Scope
- Address geocoding: new `GET /nominatim/search` backend endpoint; text input above lat/lng fields on Hotspots and Media Targets modes
- Hotspot legend row click toggles pin category visibility; hidden categories shown with reduced opacity in the legend
- Media Targets recency: three pin color variants of `--sr-map-target` (bright / medium / faded) corresponding to ≤7 / ≤15 / ≤30 days; backend filters to `back=30` (already the case via eBird API default); filtering happens client-side from `recentDate`
- Media Targets toggle: "All" shows all pins within 30 days; "Most Recent" shows one pin per species — the location with the most recent `recentDate`
- `subId` captured in backend grouping; most recent checklist linked in the popup
- Nearest-10 sidebar list sorted by distance from center point; shows species, location, distance, and recency tier indicator

## Out of Scope
- Autocomplete or typeahead on the address field
- Multiple checklist links per popup (most recent only)
- Recency filtering on Hotspots or My Sightings
- Any change to the My Sightings mode

## Key Decisions
- Three CSS tokens for target pin recency variants added to `globals.css` (both themes)
- Nominatim geocoding proxied through the existing `backend/routers/nominatim.py` (reuses rate limiter)
- Recency tier calculated client-side from `recentDate` string; no backend change needed for this
- `subId` already in eBird API response; backend grouping captures the `subId` from the most recent observation
- "Most Recent" mode is per-species deduplication — one pin per species, not one pin per location
