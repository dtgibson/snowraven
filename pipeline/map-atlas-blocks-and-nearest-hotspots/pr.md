## Map Explorer — Atlas blocks overlay + nearest unvisited hotspots

### What this does
Two additions to the Map Explorer: a toggle that overlays California Breeding Bird Atlas block boundaries (viewport-rendered, name on click), and an automatic "10 closest unvisited hotspots" list (eBird links) in the Hotspots sidebar.

### What was built
- `frontend/src/lib/atlasBlocks.ts` — pure, dependency-free helpers: `generateBlocks(quad, scheme)` (expands a quad's SW corner into its 6 named block rectangles) and `blocksInBounds(data, bounds, cap)` (viewport filter with a too-many cap). 10 unit tests in `atlasBlocks.test.ts`.
- `frontend/src/components/AtlasBlockLayer.tsx` — react-leaflet null-render child: tracks map bounds on `moveend`, generates only in-view blocks, draws them as a GeoJSON outline (`.sr-atlas-block` CSS class so the `var(--sr-map-atlas)` stroke resolves and is theme-reactive), binds a name popup, and reports `tooMany` up.
- `MapExplorer.tsx` — `atlasEnabled/atlasData/atlasLoading/atlasTooMany` state; an "Atlas blocks" toggle (`role="switch"`) in the Hotspots sidebar; **lazy** dynamic `import()` of the data on first enable; the layer wired into `<MapContainer>`; a "Zoom in to see atlas blocks" pill over the map when too many are in view; and the **Nearest Unvisited Hotspots** list (eBird hotspot links, name + distance + external-link icon) below the legend.
- `frontend/src/globals.css` — `--sr-map-atlas` (+ `-rgb`) token light/dark; `.sr-atlas-block` stroke; nearest-row hover.
- `scripts/convert-atlas-blocks.mjs` — one-off, dependency-free converter: official CA atlas KML → the compact gazetteer asset.
- `frontend/src/assets/ca-atlas-blocks.json` — **REAL statewide data**, generated from `ca_bba_blocks_v3.kml`: 2,878 quads (232 partial edge quads), 0 irregular, 123 KB raw / 26 KB gzip. All 16,527 official blocks verified as clean rectangles; generation reproduces a known block's geometry exactly.

### Status
- Complete and green: tsc + eslint clean, **256 tests pass** (+10), production build clean. The atlas asset code-splits into its own lazy chunk (`ca-atlas-blocks-*.js`, 123 KB / 26 KB gz) — initial load unaffected.
- Data confirmed: scheme is 2 cols × 3 rows (SW/SE, CW/CE, NW/NE), matching the official KML. No data dependency remains.

### How to test
- `cd frontend && npm run dev` → Map Explorer → Hotspots. Run a hotspot search where you have visited/unvisited classification → the "Nearest Unvisited Hotspots" list appears below the legend; rows link to eBird.
- Flip the "Atlas blocks" toggle; over the Bay Area (placeholder coverage) zoomed in, sample block outlines draw with name popups; zoomed out → the "zoom in" pill; toggle off removes them.
- Real statewide verification waits on the converted data asset.

### Notes for reviewer
- Geometry is GENERATED at runtime from a tiny gazetteer, not bundled as 16,527 polygons (Dave's design refinement). `generateBlocks` is unit-tested in isolation.
- The CSS-class stroke (vs Leaflet's `color` option) is deliberate — Leaflet writes `color` to the SVG stroke attribute, where `var()` doesn't resolve.

### Refinements after review
- "Map Overlays" toggle moved to the **bottom** of the Hotspots panel.
- Block stroke thickened to 2px.
- **Interior clickable:** blocks use a transparent fill (`fillOpacity: 0`) so Leaflet's `pointer-events: auto` hit-tests the interior — clicking inside a block selects that block (fixes the shared-edge ambiguity where clicking a line hit a neighbor). `pointer-events: all` via the CSS class did NOT work — Leaflet's own `path.leaflet-interactive` rule outranks it on specificity; the transparent-fill approach is the robust fix.
- **Block name → eBird link:** the popup name links to `https://ebird.org/atlascalifornia/block/<code>`, where `<code>` = USGS quad id + position, captured from each block's `<description>` in the KML. Asset now carries `id` per quad (160 KB / 34 KB gz).

## Convention Flags
- Atlas/grid overlays use the `.sr-atlas-block` CSS-class pattern for stroke (so `var(--sr-*)` resolves on Leaflet paths) — worth noting for any future Leaflet vector overlay.
- To make an outline-only Leaflet polygon's interior clickable, use a transparent fill (`fillOpacity: 0`), not `pointer-events` overrides (Leaflet's interactive-path rule wins on specificity).
