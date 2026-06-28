# Strategic Brief — County Lines & Shading

## What We're Building
A Map Explorer overlay that draws US county boundaries over the current view and,
optionally, shades each county by how many species the user has recorded there —
a choropleth "county life list" map built entirely from the user's own loaded
eBird data. It is the direct parallel to the shipped California Breeding Bird
Atlas overlay and its "Shade by My Highest Breeding Code" toggle.

## Why Now
SnowRaven's whole reason to exist is letting a birder see their *own* records in
ways eBird doesn't — and "how does my coverage break down by county?" is a
question birders ask constantly (county listing is a deeply established part of
the hobby) that the official tools answer only as a flat table. The Statistics
tab already computes per-county species and checklist totals; this feature finally
puts that data on the map. It also lands on a freshly hardened map stack: the
atlas overlay (v0.5.0–v0.5.2) is a proven, reusable pattern for exactly this kind
of viewport-capped, theme-aware, client-side-joined choropleth, so the build rides
existing rails rather than breaking new ground.

## The User Problem
A birder accumulates years of checklists across many counties but has no spatial,
at-a-glance read of where their coverage is deep and where it's thin — the eBird
county tables are a list, not a map, and they don't render over the user's own
sightings. SnowRaven's user wants to *see* their county footprint shaded on the
same map they already explore, and to orient themselves with county lines when
scanning their sightings, completely offline and with nothing leaving their device.

## Success Criteria
- Toggling **County lines** on draws US county boundaries over the current map
  area, recomputed as the user pans/zooms, with each county identifiable by name.
- A **Shade by species seen** sub-toggle tints each county by the number of
  species the user has recorded there, drawn from the already-loaded eBird backup,
  with a legend mapping shades to count ranges.
- Clicking a county opens a popup showing the county name, state, and the user's
  count for that county (species recorded, and checklist/record count).
- Counties with no records render as plain outlines (no fill), clearly distinct
  from shaded counties.
- The overlay makes **zero network calls** once its bundled geometry is loaded;
  nothing about the user's data is transmitted, and it works fully offline.
- Boundaries, fills, and the legend render legibly in both light and dark themes,
  and the choropleth is reachable/announced for keyboard and assistive-tech users
  (parallel to the atlas's "blocks in view" panel).

## Scope
- A two-level overlay control on the **Map Explorer**, mirroring the atlas exactly:
  a "County lines" toggle (boundaries + county names) and, beneath it, a "Shade by
  species seen" sub-toggle (the choropleth fill + legend).
- **Bundled US county boundary geometry** (US Census TIGER/Line, public domain),
  simplified, loaded as an on-demand chunk — no per-request boundary fetch.
- A **client-side join** of each county polygon to the user's per-county species
  count, computed from the already-parsed backup (the data `computeGeo` already
  produces), keyed on **(state, county name)**.
- **Data-driven choropleth tiers** (quantile breaks over the user's own non-zero
  county counts) with a legend, reusing the existing `--sr-tier-N` token ramp.
- A **county popup** (name + state + species count + checklist/record count),
  following the atlas-popup pattern, optionally linking the county name to its
  eBird region page when a valid region code is available.
- Light/dark theme parity (tokens read at runtime, re-resolved on theme change)
  and a keyboard-accessible "counties in view" route.

## Out of Scope
- **Non-US counties** (eBird Subnational2 outside the US) — TIGER is US-only and
  non-US county naming/geometry is inconsistent; v1 draws US counties only
  (parallel to the atlas being California-only). *Open for the user to confirm.*
- **Per-species county choropleth** (e.g. "shade counties where I've seen Acorn
  Woodpecker") — a different, larger feature.
- Any atlas-style **data entry / editing** of county records.
- Additional metrics beyond the chosen default and the optional species⇄records
  toggle — no total-individuals metric, no time-windowed ("this year") choropleth.
- Folding county boundaries into the **offline base-map PMTiles** — this overlay
  ships its own bundled boundary geometry; the two are unrelated.
- **Hatch textures** for the choropleth (the sequential ramp is already reasonably
  colorblind-readable; the atlas hatch mechanism stays available if wanted later).

## Key Decisions
- **Build it — strategy-aligned and low-risk.** User-requested, a natural parallel
  to the shipped atlas overlay, and privacy-clean (client-side join over the
  already-loaded backup, zero new providers or network calls). It reuses a
  hardened, well-understood map-overlay pattern rather than inventing one.
- **Default shaded metric = distinct species recorded per county** (a per-county
  "life list" / county tick count). This is the birder-meaningful reading of
  "number of birds seen" — it measures diversity, the thing birders actually
  compare county-to-county — and it is already computed (`countySpecies` in
  `computeGeo`, `frontend/src/lib/birdingStats.ts`). Alternatives considered and
  rejected as the default: total records/checklists (rewards repeat visits to one
  spot over diversity) and total individuals summed (noisy — a single large flock
  dominates). **A metric toggle (species ⇄ records) is low-cost** because both are
  already computed; recommend including it, but it is a clean defer if scope tightens.
- **The COUNT needs no geometry and no point-in-polygon.** The eBird backup CSV
  carries `County` and `State/Province` columns (parsed in
  `parseEbirdObservations.ts`), and `computeGeo` already aggregates per-county
  species/checklist counts. Geometry is needed **only to draw boundaries**. The
  join key must be **(stateProvince, county name)**, not county-name-alone — county
  names collide across states (many "Washington"/"Jefferson" counties); normalize
  the name and scope by state for the join.
- **Geometry = bundled US Census TIGER/Line county boundaries (public domain),
  simplified**, shipped as an **on-demand dynamic-import chunk** (mirrors
  `frontend/src/assets/ca-atlas-blocks.json`). It must stay **off the entry chunk**
  (NFR-16 and the v0.5.42 "maplibre off first paint" rule). No new provider, no
  per-request boundary fetch — privacy-first and offline-capable. Carry each
  county's **FIPS/GEOID** so the popup can optionally link to the eBird county
  region page (`ebird.org/region/US-{ST}-{FIPS}`), gated by a region-code shape
  guard (same posture as the v0.5.40 hotspot-link id guard).
- **Mirror `AtlasLayer.tsx` exactly:** a viewport-capped GeoJSON source recomputed
  on `moveend` (US has ~3,143 counties — far fewer than the atlas's ~17k blocks,
  so the cap is rarely hit); a **line layer** for boundaries plus a **fill layer**
  for the choropleth where unshaded counties keep `fill-opacity 0` but stay
  hit-tested for the popup; theme-aware fills read from `--sr-*` tokens at runtime
  with a `data-theme` MutationObserver re-resolve; a single state-driven `<Popup>`;
  and a keyboard "counties in view" disclosure panel for WCAG-AA parity with the
  atlas's "Atlas blocks in view".
- **Choropleth tiers are data-driven (quantile breaks over the user's own non-zero
  county counts), not fixed thresholds** — county totals vary enormously per user,
  unlike the atlas's fixed ordinal breeding tiers — with a legend showing the count
  range per shade, reusing the existing `--sr-tier-N` sequential ramp.
- **Two-level toggle structure** matching the atlas ("show blocks" + "shade by
  breeding"): "County lines" draws boundaries + names; "Shade by species seen"
  adds the choropleth + legend. Surfaced in the Map Explorer's shared overlay-controls
  block (available across its view modes). Extending the shading to the Species
  Detail / Statistics maps (where the atlas also appears) is a deferrable parallel,
  not part of v1.
