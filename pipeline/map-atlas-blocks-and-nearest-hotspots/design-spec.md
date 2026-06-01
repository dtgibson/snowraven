# Design Spec — Map Atlas Blocks & Nearest Hotspots

## Visual Direction
Extends the existing Map Explorer with no new visual language. Two additions: an "Atlas blocks" toggle + a "nearest unvisited hotspots" list in the sidebar, and a neutral reference-grid overlay on the map. The grid is deliberately a non-data color so it never competes with the existing pins.

## Screens / Views

### Hotspots sidebar
- **Atlas blocks toggle** — reuses the existing `ToggleSwitch` (`role="switch"`, `aria-checked`, `tabIndex={0}`), under a "Map overlays" label, with a one-line caption ("California Breeding Bird Atlas blocks. Shown for the current map area."). Default off. While the data lazy-loads on first enable, show a brief loading state on the switch/caption.
- **Nearest unvisited hotspots** — a new section below the legend. Up to 10 rows, each ranked by distance from the center point. Each row:
  - is an **anchor link to `https://ebird.org/hotspot/{locId}`**, `target="_blank" rel="noreferrer"` (consistent with the existing unvisited-pin popup link), with a small external-link icon after the name.
  - shows an unvisited-blue dot + hotspot name (truncated) on the left, distance (1 decimal, " mi", tabular) on the right.
  - hover tints the name to `--sr-accent`; `tabIndex={0}`.
  - Section is omitted entirely when there are no unvisited hotspots.

### Map overlay
- **Atlas grid** — block boundaries drawn as outlines only: `--sr-map-atlas` (new token: slate `#475569` light / `#94A3B8` dark), ~1px stroke at ~0.85 opacity, no fill. Reads as a reference grid over the tiles; does not obscure pins or heatmap.
- **Block name popup (click)** — clicking a block opens a Leaflet popup: bold block name (e.g. "Mount Diablo NE") + a muted subline "California Breeding Bird Atlas block".
- **Zoomed-out state** — when too many blocks would be in view, draw none and show a pill hint near the bottom center: a zoom/search icon + "Zoom in to see atlas blocks".
- **Outside California** — nothing drawn, no error.

## Component Usage
- Reuse `ToggleSwitch`, the existing sidebar section/legend styling, the Media Targets nearest-10 row layout (adapted to anchors), Leaflet `<GeoJSON>` + `<Popup>`.
- New token `--sr-map-atlas` (+ `--sr-map-atlas-rgb` for the stroke alpha) in `globals.css`, light + dark.

## Design Tokens Applied
- Grid: `--sr-map-atlas` / `--sr-map-atlas-rgb`. Pins unchanged (`--sr-map-visited/unvisited/personal`). Text/surface/border standard `--sr-*`. Accent on row hover.

## Interaction Notes
- Toggle on → lazy-load (first time) → draw in-view blocks; pan/zoom updates them. Toggle off → remove layer (data stays in memory).
- Nearest rows open the eBird hotspot page in a new tab. The hotspot's on-map pin already provides the visual locate; the row's job is the eBird jump (no map-pan on these rows, to keep the link behavior unambiguous).
- Keyboard: toggle and each row operable via keyboard; rows are real anchors so Enter activates them.

## Content Notes
Caption and popup copy name the source as the "California Breeding Bird Atlas." Warm, plain, no jargon.
