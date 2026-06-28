## County Lines & Shading

### What this does
Adds a Map Explorer overlay that draws US county boundaries over the current view and,
optionally, shades each county by how many species (or how many checklists) the user has
recorded there — a "county life list" choropleth built entirely from the already-loaded
eBird backup. It is the structural twin of the shipped California Breeding Bird Atlas
overlay: a two-level toggle (County lines → Shade by species seen), a Species/Records
metric switch, a data-driven quantile legend, a click popup with the county's counts and a
contextual top-3 (top species or top locations), and a keyboard "Counties in view" panel.
The boundary geometry is a bundled US Census (public-domain) asset loaded on demand; the
join is 100% client-side, so the overlay adds **zero network calls** and works offline.

### How to test
1. Start the backend (`cd backend && uvicorn main:app --reload --port 1620`) and the
   frontend (`cd frontend && npm run dev`), then open `http://localhost:5173`.
2. Open the **Map Explorer** tab. In the sidebar's **Map Overlays** group, turn on
   **County lines** — US county boundaries draw over the current area. Zoom way out: a
   "Zoom in to see counties" chip appears and nothing is drawn; zoom back in to redraw.
3. With a backup loaded in Settings, turn on **Shade by species seen** — counties tint on
   the green ramp; a legend shows the quantile ranges. Counties with no records stay as
   plain outlines. Flip **Species ⇄ Records**: the fills re-tier, the legend relabels, and
   the popup's bottom list swaps from top species to top locations.
4. Click a county → a popup shows its name, state, your species + checklist counts, an
   eBird county-region link (US counties only), and the contextual top-3. Click an
   unrecorded county → the popup opens honestly at 0 / 0.
5. Open the **Counties in view** panel (bottom-left), tab to a row, and activate it — it
   opens and centers that county's popup (keyboard route).
6. Without a backup loaded, **County lines** still draws; the **Shade** toggle is disabled
   with a "Load your eBird backup in Settings to use this" note.
7. Toggle light/dark — boundaries, fills, and legend stay legible; the green ramp is
   intentionally distinct from the purple atlas ramp (both overlays can be on at once).

### Notes for reviewer
- **One shared-code change:** `computeGeo` (`lib/birdingStats.ts`) was re-keyed from
  county-name-alone to a (state, county) composite, fixing a latent collision that merged
  same-named counties across states (e.g. the two "Washington" counties). The output row
  shape `{ name, count, stateProvince, species }` is preserved; the only observable change
  is that such counties now emit two rows instead of one merged row (a correctness fix —
  visible to users who birded same-named counties in multiple states). The Statistics
  county-table React keys were re-keyed to `${stateProvince}-${name}`; a two-Washingtons
  regression test was added.
- **No backend route, no new provider, no transport seam.** The geometry is a bundled
  frontend-only asset (`frontend/src/assets/us-counties.json`, 318 KB gzipped — under the
  400 KB budget); the per-county join is pure client-side over the parse-once cache. So
  `PRIVACY_POLICY.md` needs no change (confirmed: no new outbound request).
- **Off the entry chunk (NFR-03):** `CountyLayer` is reached only through the lazy
  MapExplorer; `us-counties.json` is a dynamic import on first enable. A new build-
  inspection test (`lib/entryChunk.test.ts`) walks App.tsx's static import graph and
  asserts both are absent (and that maplibre stays off first paint).
- **One logged design extension (decisions.md D-01):** a new `--sr-county-1..4` green ramp
  (identical in both themes, basemap-anchored), guarded by an AA/monotonicity test
  (`lib/countyContrast.test.ts`).
- **Popup favicons:** the top-species favicons render only when a taxon code is already
  resolved (from the existing target-species code map) — the popup makes no taxonomy fetch,
  to honor the zero-network-calls guarantee. Names still render through `<BirdName>` and
  link to Species Detail.
- The county geometry asset was regenerated from source by `scripts/build-county-boundaries.mjs`
  (US Census `cb_2023_us_county_500k`, simplified with mapshaper, dateline-cut, 4-dp
  rounded); re-run it at release time to refresh the Census vintage.
