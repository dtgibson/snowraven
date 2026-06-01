# Schema — Map Atlas Blocks & Nearest Hotspots

## Path
Frontend Only — no database, no migrations. The data substance is a new bundled block-boundary asset plus its conversion pipeline and runtime spatial query, documented here.

## Existing pieces reused (no change to their behavior)
- `frontend/src/components/MapExplorer.tsx`: `distanceMiles()` (~134), `nearest10` useMemo (~910), `panTarget`/`setPanTarget` + `MapPanner` (~185, ~641), the Media Targets nearest-10 sidebar rows (~1453), hotspot pins with `kind: 'visited' | 'unvisited' | 'personal'`, the `useMap()` null-render child pattern (`MapPanner`, `DefaultCenterSetter` ~584), Hotspots sidebar + legend (~1213, ~1247).
- react-leaflet v5 / leaflet 1.9 — use `<GeoJSON>` and `useMapEvents` (both already available from react-leaflet, no new dep required for rendering).

---

## A. Atlas block data asset (the "data layer")

> **Design note (refined after review):** the blocks are a regular grid (USGS 7.5' quads, each split 6 ways on a uniform sub-grid), so the *geometry is generatable* and bundling full polygons for all 16,527 blocks is largely redundant. The only irreducible data is what can't be computed from coordinates: the **quad names** and **which quads exist** (incl. any clipped edge blocks). So the bundled artifact is a compact **quad gazetteer**, and block rectangles + names are **generated at runtime**.

### Source → compact gazetteer (one-time, offline)
- **Source:** Dave provides the official California atlas data (statewide KML or shapefile). 16,527 blocks = ~2,750 USGS quads × 6, each block a ~rectangle with an atlas name (quad name + position).
- **Conversion (one-time, committed result):** a one-off Node script under `scripts/` (using `@tmcw/togeojson` for KML or `mapshaper`/`shapefile` for shp) reduces the official data to a compact JSON:
  - **Primary form — quad gazetteer:** for each quad, `{ sw: [lat, lng], name: "<quad name>" }` (~2,750 entries; the SW corner lands on the 0.125° grid). Estimated ~20–70 KB raw (gzip far less). Round corner coords to 4 decimals.
  - The script must also **extract the exact subdivision scheme** from the source (2×3 vs 3×2; the position codes and their geometry) and assert that every block is a uniform quad/6 rectangle. **Any block that is NOT a clean rectangle (clipped coastline/border blocks) is stored explicitly** in a small `irregular` list as `{ name, geometry }`, so correctness is never sacrificed for compactness.
  - Commit BOTH the conversion script (reproducible) and the resulting `ca-atlas-blocks.json` (gazetteer + scheme + irregular list).
- **Runtime generation:** a pure helper `generateBlocks(quad, scheme)` produces the 6 block rectangles for a quad (each a Polygon + name = `${quad.name} ${positionCode}`), computed from the SW corner and the fixed sub-grid steps. Irregular blocks come straight from the explicit list. This helper is unit-testable in isolation (no DOM/map needed) — good QA leverage.
- **Placement & loading:** store as a JSON module. Because the gazetteer is tiny, it MAY be imported normally; but keep the **dynamic `import()` on first overlay-enable** anyway (cheap, and future-proofs if other atlases are added). Vite bundles it into every target → offline-capable, no runtime Google Drive / third-party call (FR-03 / NFR-02). Initial-bundle impact is negligible either way (FR-04 / NFR-04 comfortably satisfied).

### Fallback
- If the real file turns out **less regular than expected** (many blocks not clean quad/6 rectangles), fall back to bundling the official polygons as minified GeoJSON (coords at 4 decimals; ~1–2 MB, lazy-loaded; TopoJSON via `topojson-client` if even that is too big). The runtime rendering (Section B) is identical either way — it consumes a list of `{ name, polygon }`, whether generated or read.

### Precomputed bboxes for fast viewport query
- For each block (generated or explicit), compute its bbox `[minLng, minLat, maxLng, maxLat]` once. For generated blocks this is trivial (it's a rectangle). Used for O(n) viewport filtering. With generation, the in-view set can be computed even more cheaply by first selecting quads whose bbox intersects the view, then generating only those quads' blocks.

---

## B. Runtime rendering architecture

### New child component: `AtlasBlockLayer` (inside `<MapContainer>`)
Follows the `MapPanner`/`DefaultCenterSetter` null-render-child pattern.
- Props: `enabled: boolean`, plus access to the loaded `features` + their bboxes (via closure/state in MapExplorer).
- Uses `useMapEvents({ moveend, zoomend })` to read `map.getBounds()` into local state (debounced ~150 ms).
- Computes the **in-view subset**: features whose bbox intersects the current map bounds.
- **Cap / hint (FR-06):** if the in-view count exceeds a cap (default **~400**, tune in build) OR zoom is below a min level, render **no** polygons and surface a one-line "Zoom in to see atlas blocks" hint (state lifted to the sidebar, or a small map-corner note). Outside California → subset is empty → nothing drawn, no error.
- Renders the subset as `<GeoJSON data={subsetFC} key={subsetSignature} pathOptions={...} onEachFeature={bindNamePopup} />`. `subsetSignature` (e.g. count + rounded bounds) changes only when the subset changes, forcing a clean re-render without thrashing.
- **Style (FR-07):** outline only — `color: var(--sr-...)`, `weight: 1`, `fill: false` (or very low `fillOpacity`), so blocks read as a grid over the tiles without hiding pins/heatmap. Add a new `--sr-map-atlas` token (light + dark) in `globals.css`.
- **Popup (FR-05):** `onEachFeature` binds a click popup showing `feature.properties.name`.

### Toggle + lazy load (in MapExplorer)
- New state: `atlasEnabled: boolean` (default false), `atlasData: { features, bboxes } | null`, `atlasLoading: boolean`.
- Toggle control (Designer places it; default: a labeled switch in the map sidebar/controls, `role="switch"` + `aria-checked` + `tabIndex={0}` per NFR-05). On first enable → set loading, dynamic-import the asset, store in `atlasData`. Subsequent toggles just flip `atlasEnabled` (data stays in memory).
- `<AtlasBlockLayer enabled={atlasEnabled && !!atlasData} ... />` rendered inside `<MapContainer>` alongside `MapPanner`/`DefaultCenterSetter`.

---

## C. Nearest-10 unvisited hotspots (in MapExplorer)
- New `nearestUnvisited` useMemo: from `hotspotPins`, filter `kind === 'unvisited'`, sort by `distanceMiles(center, pin)`, slice 10, map to `{ pin, dist }` — mirrors the existing `nearest10`.
- Render in the **Hotspots** sidebar, below the legend/filter buttons (~after line 1247), reusing the Media Targets nearest-10 row markup/styling: each row = name + distance (1 decimal, " mi"), `onClick={() => setPanTarget({ lat, lng })}` (FR-10), `tabIndex={0}`. Section omitted entirely when the list is empty (FR-11). Recomputes automatically via the memo deps (hotspotPins, lat, lng).

---

## What The Engineer builds (summary)
1. `scripts/convert-atlas-blocks.*` (one-off) + `frontend/src/assets/ca-atlas-blocks.json` (compact quad gazetteer + scheme + irregular list; needs Dave's source file). Plus a pure `generateBlocks()` helper (unit-tested) that expands a quad into its 6 named block rectangles.
2. `AtlasBlockLayer` child component (select in-view quads → generate their blocks → cap/hint + GeoJSON render + name popup).
3. MapExplorer: `atlasEnabled`/`atlasData` state, lazy dynamic import, toggle control, layer wired into MapContainer.
4. `nearestUnvisited` memo + sidebar list rows in Hotspots mode.
5. `--sr-map-atlas` token (light + dark) in `globals.css`.
6. Docs at Stage 9: HELP/README Map Explorer section, attribution for the CA atlas data.

## Build dependency
- Needs Dave's source KML/shapefile to produce the asset. Conversion may add a dev-only dep (`@tmcw/togeojson` or `mapshaper`); no new **runtime** dependency unless the TopoJSON fallback is needed (`topojson-client`).

## No database work
No migrations or persistent storage changes. The block asset is static and read-only.
