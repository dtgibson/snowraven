# Bug Brief — location-links-broken

**Reported:** 2026-05-20
**Component:** SpeciesDetail.tsx — Top Locations card

## What's broken

Location names in the Top Locations card link to `ebird.org/loc/{locationId}` for any location whose ID matches `/^L\d+$/`. This URL works for public hotspots but fails for personal/private locations, which have no public-facing page on eBird.

## Root cause

The eBird CSV export uses the same `L\d+` ID format for both public hotspots and personal locations. The code cannot distinguish them from CSV data alone. The `isHotspot` variable is a misnomer — it only validates the ID format, not whether the location is actually a public hotspot.

## Fix

Remove all location hyperlinks. Render every location name as plain `<span>` text. The location name and sighting count remain visible; the broken link is gone.

## Scope

One change in one file:
- `frontend/src/components/SpeciesDetail.tsx` — remove the `isHotspot` conditional in the Top Locations render; always render `<span>` instead of `<a>`
- The `LOCATION_ID_RE` constant and `isHotspot` variable can be removed entirely if nothing else uses them

## Out of scope

- Adding a backend call to verify whether a location is a public hotspot
- Any other tab or component
