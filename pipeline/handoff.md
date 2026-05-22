# Pipeline Handoff — Map Explorer

**Status:** Complete — both sessions finished, feature shipped at v0.0.42

---

## What was built

**Map Explorer** is a new tab in SnowRaven that gives users three ways to explore their birding geography on an interactive Leaflet/OpenStreetMap map.

**My Sightings mode** — plots personal recent observations as green circle markers with an optional heatmap overlay. Filterable by species, breeding status, and date range. Requires the eBird API key configured in Settings; shows the standard SetupRequired screen if absent.

**Hotspots mode** — fetches regional eBird hotspots by lat/lng/radius and classifies them using the stored eBird backup: green teardrop (visited), blue teardrop (unvisited), or orange star (personal location). Sidebar lists results; clicking a sidebar row pans the map to that pin.

**Media Targets mode** — fetches recent regional observations filtered by breeding status and plots label pill pins in purple at each unique location, showing the species common name. Useful for planning ML media collection trips.

All three modes share a 268px sidebar with mode-specific controls, a scrollable results list, and a legend. The MapContainer is always mounted; mode switches add/remove layers without unmounting the map.

---

## Artifacts produced

**Session 1 (planning):**
- `pipeline/map-explorer/strategic-brief.md`
- `pipeline/map-explorer/prd.md`
- `pipeline/map-explorer/schema.md`
- `pipeline/map-explorer/design-spec.md`
- `pipeline/map-explorer/design.html`

**Session 2 (implementation):**
- `frontend/src/components/MapExplorer.tsx` — full tab component with three view modes, DivIcon pins, heatmap, XSS guard
- `backend/routers/map.py` — `GET /map/hotspots` and `GET /map/recent-obs` eBird proxy endpoints (pre-existing, registered to app)
- `frontend/vite.config.ts` — `/map` proxy entry added
- `frontend/src/globals.css` — four map pin tokens (`--sr-map-visited/unvisited/personal/target`) in both themes
- `frontend/src/App.tsx` — `'map-explorer'` tab added to tab bar and tab panel
- `frontend/package.json` — bumped to v0.0.42
- `CHANGELOG.md` — [0.0.42] entry added
- `PRODUCT_CONTEXT.md` — Map Explorer section added; Key Decisions updated
- `DECISIONS.md` — four new decision entries

---

## Key decisions made this session

- Tab panel uses `height: calc(100vh - 178px)` not `flex: 1` because the outer app div is `minHeight: 100vh` (not `height`), which prevents flex fill from producing a bounded height for Leaflet
- DivIcon colors use `style="fill:var(--sr-map-*)"` on the SVG element (not SVG presentation attributes) to support CSS custom properties and dark mode
- `escHtml()` XSS guard applied to any external API string interpolated into DivIcon HTML (established as the required pattern going forward)
- `SightingMarkers` fitBounds runs in `useEffect(fn, [])` so it fires on mount (mode switch) but not on filter-driven re-renders; `HotspotMarkers`/`TargetMarkers` use `key={pins.length}` for data-driven remounts instead

---

## Starting the next feature

Run `/new-feature` to begin a new pipeline session. The Orchestrator will check the roadmap for the next suggested item.
