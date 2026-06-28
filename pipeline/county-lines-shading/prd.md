# PRD — County Lines & Shading
**Feature:** county-lines-shading
**Date:** 2026-06-28
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

A Map Explorer overlay that draws US county boundaries over the current map view and,
optionally, shades each county by the user's own recorded count there — a "county life
list" choropleth built entirely from the already-loaded eBird backup. It is the direct
structural parallel to the shipped California Breeding Bird Atlas overlay (`AtlasLayer.tsx`):
a two-level toggle (county lines, then shade-by-metric), viewport-capped GeoJSON recomputed
on `moveend`, theme-aware token fills, a click popup, a data-driven legend, and a
keyboard-accessible "counties in view" disclosure. Geometry is bundled (US Census TIGER/Line,
public domain) and loaded on demand; the per-county count is a pure client-side join over
the user's data. No backend route, no new provider, zero network calls once loaded.

---

## User Stories

> **US-01** — As a county lister, I want US county boundaries drawn over my Map Explorer view, so that I can orient my sightings by county.

> **US-02** — As a birder reviewing my coverage, I want each county shaded by how many species I've recorded there, so that I can see at a glance where my county life lists are deep and where they're thin.

> **US-03** — As a birder, I want to click a county and see its name, state, and my species and checklist counts there, so that I can read the exact numbers behind the shading.

> **US-04** — As a birder, I want counties where I have no records to stay as plain outlines distinct from shaded ones, so that deep-vs-thin coverage is visually unambiguous.

> **US-05** — As a privacy-conscious field user, I want the overlay to work entirely offline with nothing leaving my device, so that it's usable with no connection and consistent with SnowRaven's privacy guarantee.

> **US-06** — As a keyboard or assistive-technology user, I want to reach and read each in-view county's information without a mouse, so that the overlay is operable for me too.

> **US-07** — As a birder comparing effort against diversity, I want to switch the shading between distinct species and total checklists/records per county, so that I can read either dimension on the same map.

> **US-08** — As a dark-mode user, I want boundaries, fills, and the legend to stay legible in my theme, so that the overlay is usable in both light and dark.

---

## Functional Requirements

### A. Overlay controls (two-level toggle, mirrors the atlas)

> **FR-01** — The app shall add a "County lines" toggle to the Map Explorer's shared "Map Overlays" control block, available across every Map Explorer view mode (My Sightings, Hotspots, Nearby Lifers, Media Targets). When on, US county boundaries shall be drawn over the current map area.

> **FR-02** — The "County lines" toggle shall default to OFF. Its on/off state (and the sub-toggles below it) shall be session state shared across the Map Explorer view modes, mirroring the atlas overlay's state handling; it need not persist across an app relaunch.

> **FR-03** — When "County lines" is on, the app shall show a "Shade by species seen" sub-toggle beneath it. The sub-toggle shall default to OFF; when on, it shall add the choropleth fill plus its legend. When "County lines" is off, the sub-toggle, the choropleth, the legend, and any open county popup shall not be shown.

> **FR-04** — The "Shade by species seen" sub-toggle shall be disabled when no eBird backup is loaded (the backup is not in a ready state), with an explanatory note ("Load your eBird backup in Settings to use this"), mirroring the atlas shade toggle's `backupReady` gating. County lines (FR-01) shall remain usable without any backup, since boundaries need only geometry.

### B. County boundaries (lines)

> **FR-05** — The app shall generate the county boundaries for the current viewport only — the set of counties intersecting the current bounds (padded by a margin), recomputed when a pan/zoom gesture settles (`moveend`) — rather than materializing all US county polygons at once, mirroring the atlas viewport cap.

> **FR-06** — The app shall apply a viewport cap and a minimum zoom: a view whose county count would exceed the cap (or a zoom far enough out that the grid is unreadable) shall draw no county geometry and show a non-blocking "Zoom in to see counties" hint, mirroring the atlas "zoom in" chip.

> **FR-07** — Each rendered county shall be identifiable by its name through the county popup (Area D) and the "counties in view" list (Area E). On-map text labels are not required in v1 (see Out of Scope).

> **FR-08** — Boundary lines shall render correctly across the antimeridian and for non-contiguous geographies (Alaska boroughs / the Aleutians, Hawaii) without horizontal smearing or wrap artifacts; the bundled geometry shall be prepared so that such counties draw in their correct location.

### C. Choropleth shading (join, tiers, legend)

> **FR-09** — When shading is on, the app shall tint each county polygon by the user's count for that county, joined client-side from the already-parsed backup data (the per-county aggregation produced by `computeGeo`). No point-in-polygon test shall be used for the count; geometry is used only to draw and locate the county.

> **FR-10** — The join between a county polygon and a user count shall key on **(state/province, normalized county name)** — never county name alone — so that same-named counties across different states (e.g. multiple "Washington"/"Jefferson" counties) are not conflated. The per-county aggregation feeding the join shall accordingly distinguish counties by state, and county-name matching shall be normalized (case/whitespace/diacritic-insensitive) to absorb minor spelling differences between the backup and the bundled geometry.

> **FR-11** — Choropleth tiers shall be data-driven: the app shall compute quantile breaks over the user's own non-zero county counts for the active metric and map them onto the existing `--sr-tier-N` sequential ramp. Tier computation shall handle ties and small datasets gracefully — when there are fewer distinct non-zero values than ramp steps, it shall produce fewer classes rather than empty or duplicate ranges.

> **FR-12** — Counties with zero records for the active metric shall render as a plain outline with no fill (fill-opacity 0), visibly distinct from any shaded (recorded) county.

> **FR-13** — When shading is on, the app shall show a legend mapping each shade to its count range for the active metric, reusing the `--sr-tier-N` ramp. The legend shall update when the metric is switched (FR-19).

> **FR-14** — When shading is on but the user has zero non-zero counties for the active metric (no records, empty data, or no county-tagged checklists), the app shall not draw any fills and shall present an honest empty state for the shading (e.g. a "no recorded counties to shade" note) rather than an error or a misleading uniform tint; county lines, if on, shall still draw.

### D. County popup

> **FR-15** — Clicking a county shall open a single, state-driven popup (one popup per map, mirroring the atlas) showing the county name, the state/province, the user's distinct-species count for that county, and the user's checklist/record count for that county.

> **FR-16** — The popup shall be openable on any county in view, including counties with no records: the choropleth fill of an unshaded county shall remain hit-tested (fill-opacity 0 but clickable), and an unrecorded county's popup shall honestly show zero species / zero records.

> **FR-17** — The popup shall optionally render the county name as a link to its eBird region page (`ebird.org/region/US-{ST}-{FIPS}`) only when a valid eBird county region code can be derived from the county's bundled FIPS/GEOID and a US state/province; the derived region code shall be shape-validated before it becomes an href (same posture as the v0.5.40 hotspot-link / v0.5.34 id-shape guards), and the name shall render as plain text — never a styled link to a 404 — when no valid region code is available (non-US counties, missing or malformed codes).

> **FR-18** — A click that lands on a marker layer painted above the county fill (sighting circle / hotspot teardrop) shall not also open the county popup, mirroring the atlas's marker-layer arbitration so pin clicks behave unchanged.

### E. Keyboard accessibility ("counties in view")

> **FR-19** — The app shall provide a keyboard-accessible "Counties in view" disclosure panel (parallel to the atlas's "Atlas blocks in view") as the keyboard route to a county popup, since the on-map fill is a pointer-only canvas hit-test. The panel shall list the in-view counties (with the active metric's count where shading is on), each row opening that county's popup and centering it; the list shall be capped with an over-cap "zoom in to narrow the list" hint, mirroring the atlas list.

### F. Metric toggle (species ⇄ records)

> **FR-20** — The app shall provide a metric toggle for the choropleth with two options — **distinct species recorded per county** (the default) and **total checklists/records per county** — both sourced from the already-computed per-county data. The shaded metric shall default to distinct species.

> **FR-21** — Switching the metric shall recompute the quantile tiers over the chosen metric's non-zero values (FR-11), redraw the fills, and update the legend (FR-13). The county popup (FR-15) shall continue to show both the species count and the checklist/record count regardless of the active metric.

### G. Geometry, loading, and offline

> **FR-22** — The county boundary geometry shall be bundled with the app (US Census TIGER/Line county boundaries, public domain, simplified) and loaded as an on-demand dynamic-import chunk on first enable of the overlay, mirroring `frontend/src/assets/ca-atlas-blocks.json`. It shall not be part of the app's entry chunk (NFR-08) and shall not be fetched per request from any network provider.

> **FR-23** — Each bundled county shall carry its FIPS/GEOID identifier, used both as the county's stable geographic identity and to derive the optional eBird region link (FR-17).

> **FR-24** — Once the geometry chunk is loaded, the overlay shall make zero network calls — for boundaries, counts, tiers, popup, or legend — and shall function fully offline (consistent with the offline-support Tier A behavior: a map that has loaded its base style once works offline).

> **FR-25** — While the geometry chunk is being fetched on first enable, the app shall show a loading state in the control, mirroring the atlas "Loading atlas blocks…" affordance.

> **FR-26** — A county that exists in the user's data but has no matching bundled geometry (a renamed county, a non-US county, or an unresolved name) shall not break rendering: it is simply not drawn or shaded on the map, with no error. (Its count remains visible in the existing Statistics county tables, which this feature does not change.)

### H. Theme and rendering parity

> **FR-27** — Boundary lines, choropleth fills, and the legend shall render legibly in both light and dark themes. Fill colors shall be read from the `--sr-*` tokens at runtime and re-resolved on a `data-theme` change (via a MutationObserver), mirroring the atlas's theme handling — fills shall not use hardcoded hex/RGB.

---

## Non-Functional Requirements

> **NFR-01 — Performance:** Pan/zoom shall stay responsive on a large life list. The per-county join and quantile-tier computation shall reuse the parse-once `observationsCache` / `computeGeo` results (no re-parse of the backup), be memoized, and not be recomputed during render in violation of the `react-hooks/purity` rule; viewport-capped rendering shall keep the live GeoJSON source small.

> **NFR-02 — Bundle budget (geometry chunk):** The simplified county geometry asset shall be delivered as an on-demand chunk no larger than **400 KB gzipped** (target; raw asset a stretch target of ≤ 1.5 MB). The simplification level shall be chosen to meet this budget while keeping boundaries recognizable at the zoom levels where the overlay is shown.

> **NFR-03 — Entry-chunk exclusion (NFR-16 / v0.5.42 rule):** The county geometry asset and any maplibre-coupled county-layer code shall remain OFF the app's entry chunk. A production build shall show the geometry chunk loaded only on demand (dynamic import), with no county geometry in `dist/index.html`'s modulepreload and no bare import of it in the entry chunk — the same standing check applied to `vendor-maplibre` and `ca-atlas-blocks.json`.

> **NFR-04 — Privacy:** The feature shall add no new network provider, send nothing about the user's data anywhere, and make zero network calls once the bundled geometry is loaded. Because the geometry is bundled (not tile-fetched) and there is no new outbound request, `PRIVACY_POLICY.md` requires no change; the security review for this feature shall confirm this explicitly.

> **NFR-05 — Offline:** The overlay (lines, shading, popup, legend, in-view list) shall be fully functional offline once its geometry chunk has loaded, with no degraded behavior versus online.

> **NFR-06 — Platform parity:** The feature shall work identically on the desktop app (Tauri) and the web/Pi build. As an all-client-side overlay with bundled geometry and a client-side join, it requires no backend route and no dual-transport seam; this shall be preserved (no `/...` backend call introduced).

> **NFR-07 — Accessibility (WCAG 2.1 AA):** The toggles shall be real switches (`role="switch"` + `aria-checked`) with explicit accessible names; the metric toggle shall expose its selected state (`aria-pressed` for a segmented control). The keyboard "counties in view" route (FR-19) shall be operable and announced. Line color, every choropleth fill tier under its on-fill text/legend label, and the popup text shall meet AA contrast (4.5:1 text, 3:1 non-text) in BOTH themes, verified with the project's luminance math before shipping any new token pair.

> **NFR-08 — Security:** The popup shall be built as escaped JSX (mirroring `AtlasLayer.tsx`), never `dangerouslySetInnerHTML`. The derived eBird region code shall be shape-validated against a strict pattern (e.g. `^US-[A-Z]{2}-\d{3}$`) and `encodeURIComponent`-wrapped where interpolated, before becoming an href (FR-17). Bundled FIPS/GEOID values shall be treated as trusted-but-validated.

> **NFR-09 — Responsive layout:** The overlay control, the legend, and the "counties in view" panel shall be usable from ~320px phones up to large desktops, following the responsive conventions (class-based layout, the atlas panel's `min(220px, 60vw)` width clamp, no page horizontal-scroll leak from any off-screen/wide node), and shall hold at 200% in-app text scale.

> **NFR-10 — Testing / maintainability:** The pure join (state+county keying, normalization), the quantile-tier computation (including the ties / small-dataset / zero-non-zero cases), the viewport cap, and the region-code shape guard shall be covered by unit tests; a build-inspection test shall assert the entry-chunk exclusion (NFR-03). Geometry-rendering parallels to the atlas (theme re-resolve, marker-click arbitration) shall reuse the proven patterns rather than re-invent them.

> **NFR-11 — Data source / licensing:** The bundled boundaries shall be US Census TIGER/Line (or the Census cartographic-boundary simplification), which are public domain; any attribution the source requests shall be carried where the project documents bundled data sources.

---

## Out of Scope

- **Non-US counties** (eBird Subnational2 outside the US). TIGER is US-only and non-US county naming/geometry is inconsistent; v1 draws US counties only (parallel to the atlas being California-only). *Open for the user to confirm — see Open Questions.*
- **Surfaces other than Map Explorer.** The Species Detail and Statistics maps (where the atlas can also appear) do not get the county overlay in v1. *Deferrable parallel — see Open Questions.*
- **On-map county text labels.** County names are surfaced via the popup and the "counties in view" list, not drawn as labels on the map (avoids clutter at the zoom levels shown).
- **Per-species county choropleth** (e.g. "shade counties where I've seen Acorn Woodpecker") — a different, larger feature.
- **Additional metrics** beyond distinct species (default) and total checklists/records — no total-individuals-summed metric, no time-windowed ("this year") choropleth.
- **Atlas-style data entry / editing** of county records.
- **Hatch textures** for the county choropleth — the sequential `--sr-tier-N` ramp is used as-is; the atlas hatch mechanism stays available if wanted later.
- **Folding county boundaries into the offline base-map PMTiles** — this overlay ships its own bundled boundary geometry; the two are unrelated.
- **Changes to the existing Statistics county tables** — they remain the source of the same per-county data; this feature only adds a map view of it.

---

## Open Questions

Each is resolved here with a default the build will proceed on unless the user overrides at review.

1. **US-only for v1?** TIGER/Line is US-only, and non-US Subnational2 naming/geometry is inconsistent.
   *Default:* Proceed US-only; non-US counties are out of scope for v1 (non-US counties in the user's data simply render no boundary/shade, per FR-26).

2. **Include the species ⇄ records metric toggle in v1?** Both metrics are already computed by `computeGeo`, so the toggle is low-cost.
   *Default:* Include the toggle in v1, defaulting to distinct species (FR-20). The user may scope it down to species-only if scope tightens; the data and popup are unaffected either way.

3. **Surface area — Map Explorer only?** The atlas also appears on the Species Detail and Statistics maps.
   *Default:* Map Explorer only for v1; extending to the other two maps is a clean later parallel and is out of scope here.

4. **Geometry-chunk size budget.** The simplified county geometry must be on-demand and off the entry chunk; the only open variable is how aggressively to simplify.
   *Default:* Target ≤ 400 KB gzipped for the chunk (NFR-02), with the hard requirement that it never enter the entry chunk (NFR-03). The simplification level is chosen to meet that budget while keeping boundaries recognizable at the shown zooms. The user may set a tighter or looser budget.

5. **Per-county aggregation keying.** `computeGeo` currently keys its county aggregation on county name alone (`countyMap`/`countySpecies` keyed by `c.county`), which conflates same-named counties across states.
   *Default:* The join requires (state, county) keying (FR-10); the build will key the per-county aggregation by state+county for this feature, treating the current name-only keying as a latent collision to correct here. *Flagging because it touches shared `computeGeo` data the Statistics county tables also read — the change must preserve those tables' behavior.*

6. **Quantile class count.** The `--sr-tier-N` ramp currently has 4 steps (tiers 1–4).
   *Default:* Use up to 4 data-driven quantile classes mapped onto tiers 1–4, collapsing to fewer when the user has fewer distinct non-zero values (FR-11). The user may request a different class count if the ramp is extended.

---

## Success Metrics

QA checks for Stage 6. Every functional requirement maps to at least one check.

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | County lines toggle present & functional (FR-01) | With a map loaded, the "Map Overlays" block shows a "County lines" toggle in every Map Explorer view mode; turning it on draws US county boundaries over the current view. |
| QA-02 | Default off, shared session state (FR-02) | County lines is OFF on a fresh Map Explorer mount; switching view modes preserves its on/off state; the state is not required to survive an app relaunch. |
| QA-03 | Shade sub-toggle gated on county lines (FR-03) | The "Shade by species seen" sub-toggle appears only while County lines is on; enabling it adds fills + legend; turning County lines off hides the sub-toggle, fills, legend, and any open popup. |
| QA-04 | Shade disabled without a backup; lines still work (FR-04) | With no eBird backup loaded, the shade sub-toggle is disabled with the "Load your eBird backup…" note, while County lines still draws boundaries. |
| QA-05 | Viewport-capped, recomputed on moveend (FR-05) | Panning/zooming updates the drawn counties to those intersecting the new view after the gesture settles; the live source holds only in-view counties, not all US counties. |
| QA-06 | Over-cap / far-zoom hint (FR-06) | At a zoom far enough out (or a count over the cap) no county geometry is drawn and a "Zoom in to see counties" hint is shown; zooming in draws counties again. |
| QA-07 | County identifiable by name (FR-07) | Each in-view county's name is readable via its popup and via the "counties in view" list. |
| QA-08 | Antimeridian / non-contiguous geographies (FR-08) | Alaska boroughs, the Aleutians, and Hawaii draw in their correct locations with no horizontal smear or wrap artifact when in view. |
| QA-09 | Client-side join, no point-in-polygon (FR-09) | With shading on, a county's tint reflects the user's own count from the loaded backup; counts match the Statistics county tables for the same county; no per-point geometry test is performed for the count. |
| QA-10 | (State, county) join key (FR-10) | Two same-named counties in different states (e.g. two "Washington" counties) are shaded by their own per-state counts, not a merged total; a minor spelling/case/diacritic difference still matches. |
| QA-11 | Data-driven quantile tiers (FR-11) | Tier breaks reflect quantiles of the user's non-zero county counts (they differ between two users with different distributions); ties and small datasets yield no empty/duplicate ranges. |
| QA-12 | Unrecorded counties plain (FR-12) | Counties with zero records for the active metric show a plain outline with no fill, visibly distinct from shaded counties. |
| QA-13 | Legend present & metric-accurate (FR-13) | With shading on, a legend maps each shade to a count range for the active metric and is correct against the rendered fills. |
| QA-14 | Zero-non-zero-counties empty state (FR-14) | With shading on and no non-zero counties, no fills are drawn and an honest "nothing to shade" state is shown (no error, no uniform tint); county lines still draw if on. |
| QA-15 | Popup contents (FR-15) | Clicking a county opens one popup showing county name, state, the user's species count, and the user's checklist/record count for that county. |
| QA-16 | Popup works on unrecorded counties (FR-16) | Clicking an unshaded (zero-record) county opens a popup showing zero species / zero records; the transparent fill is hit-tested. |
| QA-17 | eBird region link gated & safe (FR-17, NFR-08) | The county name links to `ebird.org/region/US-{ST}-{FIPS}` only when a valid region code is derivable; a non-US county or a malformed/missing code renders the name as plain text (no 404 link); the URL is shape-validated and encoded. |
| QA-18 | Marker-click arbitration (FR-18) | Clicking a sighting/hotspot pin that sits above a county opens the pin's popup only, not the county popup. |
| QA-19 | Keyboard "counties in view" route (FR-19, NFR-07) | A keyboard user can open the "Counties in view" panel, tab to a county row, activate it to open and center that county's popup; the list is capped with an over-cap hint. |
| QA-20 | Metric toggle present & defaulted (FR-20) | A species ⇄ records metric toggle is present; distinct species is the default shaded metric; both options shade from already-computed data. |
| QA-21 | Metric switch re-tiers & relabels (FR-21) | Switching the metric recomputes tiers, redraws fills, and updates the legend; the popup keeps showing both species and checklist/record counts regardless of metric. |
| QA-22 | Geometry bundled & lazy (FR-22) | County geometry is a bundled asset loaded via dynamic import on first enable, not fetched from any network provider. |
| QA-23 | FIPS/GEOID carried (FR-23) | Each bundled county carries a FIPS/GEOID used for identity and the region link. |
| QA-24 | Zero network calls / offline (FR-24, NFR-04, NFR-05) | With the geometry loaded and the network disabled, lines, shading, popup, legend, and the in-view list all work; a network trace shows no requests attributable to the overlay after the chunk loads. |
| QA-25 | Loading state on first enable (FR-25) | On first enable, a loading affordance is shown in the control while the geometry chunk fetches, then clears when ready. |
| QA-26 | Data-without-geometry handled (FR-26) | A county present in the data but absent from the bundled geometry (or non-US) causes no error — it is simply not drawn/shaded; its count still appears in the Statistics county tables. |
| QA-27 | Theme parity (FR-27, NFR-07) | Lines, fills, and legend are legible and AA-contrast in both light and dark; toggling the theme re-resolves the fill colors at runtime (no stale palette, no hardcoded hex). |
| QA-28 | Performance on a large list (NFR-01) | With a ~20k-row backup, enabling shading and panning/zooming stays responsive; the join/tiers reuse the parse-once cache and are not recomputed during render (no `react-hooks/purity` violation). |
| QA-29 | Geometry chunk within budget (NFR-02) | The built county geometry chunk is ≤ 400 KB gzipped. |
| QA-30 | Entry-chunk exclusion (NFR-03) | A fresh `npm run build` shows the county geometry chunk loaded only on demand: absent from `dist/index.html` modulepreload and not imported by the entry chunk; a build-inspection test enforces this. |
| QA-31 | Platform parity / no backend route (NFR-06) | The overlay behaves identically on desktop and web/Pi; no new backend route or transport seam is introduced. |
| QA-32 | Responsive (NFR-09) | The control, legend, and "counties in view" panel are usable and free of page horizontal-scroll from ~320px to large desktop, holding at 200% text scale. |
| QA-33 | Unit & build-inspection tests (NFR-10) | Unit tests cover the (state,county) join + normalization, quantile tiers (ties / small / zero-non-zero), the viewport cap, and the region-code guard; the NFR-03 build-inspection test is present and passing. |
| QA-34 | Public-domain source / attribution (NFR-11) | The bundled boundaries are TIGER/Line (or Census cartographic-boundary) public-domain data, with any requested attribution recorded where the project documents bundled data sources. |

---

*One source of truth: where this PRD and the strategic brief differ in detail, this PRD governs. No conflicts with the brief were found while writing it — the brief's open flags are resolved above as decisions with stated defaults.*
