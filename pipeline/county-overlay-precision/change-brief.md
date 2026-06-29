# Change Brief — county-overlay-precision

Improve lane. Two issues on the Map Explorer county overlay, both
user-facing, no new behaviour a user couldn't already reach.

## Problem

1. **Popup overflow (shaded map).** On the shaded county map, long
   *place* names in the popup's contextual top-3 ("Top locations" /
   Checklists metric) still run off the right edge. The v0.5.48 fix
   wrapped the county *name* — that holds. This is a *different*,
   latent bug: the shared `HotspotLink` public-hotspot link branch is
   `display:inline-flex` with `minWidth:0` but **no `maxWidth:100%`**,
   so it shrink-to-fits to its own max-content and overflows the
   popup. It only shows on the shaded map because the place-name top-3
   appears only in the records/"Checklists" metric, and the
   Species/Checklists switch only renders when `shadeByCounty`.

2. **County lines imprecise up close.** The bundled 10%-keep county
   geometry is blocky at high zoom; the basemap already draws the true
   county line underneath and the overlay line visibly diverges from
   it. The user wants accurate lines at every zoom and asked whether
   public data exists to adapt.

## Decision (data source) — confirmed with the user

**Approach A (A-minimal):** draw the overlay's county *lines* from the
basemap's OWN vector tiles, which we already fetch — no new download,
no new provider, no privacy-policy change. Verified live:

- OpenFreeMap Positron's `openmaptiles` source (TileJSON
  `https://tiles.openfreemap.org/planet`) exposes a `boundary`
  source-layer with an `admin_level` (Number) field, zoom 0–14.
- The app's tuned `boundary_3` already filters `admin_level 3..6` at
  minzoom 4 — i.e. the app is **already rendering** admin_level-6
  county lines; that IS the accurate "line underneath" the user sees.

The bundled `us-counties.json` is **retained** for what the tiles
cannot provide: the shade fill, the popup, the (stusps,name) join, and
the below-z9 / offline line fallback. (Measured today: 2.78 MB raw /
~0.71 MB gz, 3,145 features — note the doc drift vs CLAUDE.md's
"~751 KB-gz" and the build script's "~0.95 MB gz" estimate; correct in
the records at chronicle time.)

Approaches **B** (new hosted tile/data provider — new network request +
PRIVACY_POLICY change → New-Feature territory) and **C** (bundled/desktop
PMTiles via srpm:// — new artifact + desktop/web parity split) are
**out of scope**. Approach **D** (one much sharper bundled file) is the
documented fallback if the residual sliver is ever judged unacceptable
(it is a +2–3 MB gz on-demand chunk and busts the size guard — not
chosen).

## Scope / approach

- **Popup:** `HotspotLink.tsx` link branch gains
  `...(truncate ? { maxWidth: '100%' } : null)`, mirroring the plain
  branch. Reuses `.sr-truncate`; fixes every truncating hotspot-link
  site (e.g. Species Detail named-birds), not just this popup.
- **Lines:** `CountyLayer.tsx` adds a dedicated accurate county-line
  `line` layer on source `openmaptiles`, source-layer `boundary`,
  filter `admin_level == 6` (excluding maritime/disputed, matching
  boundary_3), `minzoom 9` (where the data appears), `beforeId` below
  markers — gated on the `openmaptiles` source being present
  (`vectorReady`, refreshed on `styledata`). The existing bundled
  `sr-county-line` is **maxzoom-capped at 9** so it only draws z4–9
  (far out, where blockiness is invisible, and the offline/below-z9
  fallback). The fill (`sr-county-fill`), the join, the popup, and the
  viewport windowing are **untouched**.
- **Basemap de-dup:** `mapStyle.ts` narrows `boundary_3` to
  `admin_level 3..4` (states/provinces only) so counties are
  overlay-only and the basemap's always-on dashed line no longer
  double-draws under the dedicated county line. Affects all three maps
  (they have no county feature; this only removes an always-on faint
  county dash — neutral-to-better).

## Files

- `frontend/src/components/HotspotLink.tsx` — popup fix.
- `frontend/src/components/map/CountyLayer.tsx` — accurate line layer;
  cap bundled line; `vectorReady` guard.
- `frontend/src/lib/mapStyle.ts` — narrow `boundary_3` to states.
- `frontend/src/components/HotspotLink.test.tsx` — truncate link carries
  `maxWidth:100%`.
- `frontend/src/components/map/CountyLayer.test.tsx` — NEW: accurate
  line layer (source/source-layer/filter/minzoom) + bundled line
  maxzoom cap.
- `frontend/src/lib/mapStyle.test.ts` — boundary_3 narrowed to ≤4.
- Version: `frontend/package.json` + `src-tauri/tauri.conf.json`
  → 0.5.49. `CHANGELOG.md`, `docs/HELP.md`, `README.md`, `website/`.

## Tests / verification

- HotspotLink truncate test; CountyLayer layer test; mapStyle narrow
  test. `entryChunk.test.ts` stays green (no new bundled asset / static
  import — A adds zero bundle). `countyContrast`/`countyShading`
  unchanged (fill geometry untouched).
- Full CI mirror before push: lint + typecheck + vitest + **build**.
- In-app spot check: at z10–12 over a US area, the accurate solid
  county line renders and the bundled line hands off at ~z9 with no
  visible pop or double-draw.

## Out of scope

- Approaches B/C; replacing the bundled geometry wholesale; sharpening
  the shade FILL edges (the A-plus / D path); changing the shading
  join / countyKey / aggregation.

## Risks

- **Cross-source sliver:** with shading ON at high zoom, the crisp tile
  line over the still-blocky bundled fill edge can show a hair-thin
  colour sliver. Accepted (user chose A-minimal).
- **Offline-Tier-A at high zoom:** no basemap tiles → no accurate line,
  and the bundled line is capped at z9, so county lines are absent at
  z10+ when fully offline with no region downloaded. Accepted (rare
  corner; Evaluator-recommended).
- **z9 handoff seam:** bundled (z4–9) → tile (z9+); both TIGER/OSM
  lineage so they should agree far out — verify no pop in-app.
- **Shared-component blast radius:** the `HotspotLink` change touches
  every truncating link site — verify no truncation regression.
