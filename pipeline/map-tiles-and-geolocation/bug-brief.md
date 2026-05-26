# Bug Brief — Map Tiles and Geolocation

## What is broken

**Bug 1 — Grey map:** The Map Explorer tab shows a grey map with only a tiny
tile sliver in the top-left corner. Leaflet initializes inside a `display:none`
tab panel and calculates the container as 0×0, so it only requests tiles for a
zero-size viewport. When the tab becomes visible, Leaflet never re-checks its
container dimensions, so tiles never fill the visible area.

**Bug 2 — GPS detect button:** "Use my location" fails on the Pi at
`http://birdnetpi:1620`. Browsers block `navigator.geolocation` on non-secure
HTTP origins (except `localhost`). The current error handler shows a generic
"Location unavailable" message with no explanation, leaving the user confused.

## Steps to reproduce

Bug 1:
1. Load SnowRaven (any tab active on load)
2. Click Map Explorer tab
3. Observe grey map

Bug 2:
1. Load SnowRaven at `http://birdnetpi:1620`
2. Click Map Explorer → Hotspots or Media Targets
3. Click "Use my location" — nothing happens, or error with no HTTPS explanation

## Expected behavior

Bug 1: Map fills the container with OpenStreetMap tiles on first tab visit.

Bug 2: On HTTP origins, immediately show a clear message — "Location requires a
secure connection (HTTPS). Enter coordinates manually." On HTTPS or localhost,
geolocation proceeds as designed.

## Blast radius

Bug 1: MapExplorer.tsx only. No other component uses Leaflet. The pattern fix
(ResizeObserver → invalidateSize) is self-contained to a new child component.

Bug 2: MapExplorer.tsx only — the `handleUseMyLocation` callback and the
`CenterPointControl` JSX where the error is displayed.

## What done looks like

- Opening Map Explorer shows a fully tiled map on first visit, without needing
  to interact with the page.
- Clicking "Use my location" on HTTP shows the HTTPS error immediately, without
  a loading state or silent failure.
- Clicking "Use my location" on localhost or HTTPS resolves coordinates as before.
