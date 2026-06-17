# Strategic Brief — public-hotspot-links

## Why this feature
A location name should behave by what it *is*: a public eBird hotspot has a real
eBird page worth linking to; a personal location does not (and a link there 404s).
Today most location names are plain text, and the two places that *do* link them
(Species Detail Top Locations, Map Explorer popups) link by id-format alone — so they
already point personal locations at dead hotspot pages. This feature establishes one
convention app-wide — **public hotspot names link to `ebird.org/hotspot/{locId}`;
personal locations stay plain text** — which also fixes that latent bug.

## The determination (efficient — the core ask)
Classify a locId by membership in a region-scoped public-hotspot Set, not per-location lookups:
- The eBird export carries the subnational1 region code per row (`stateProvince`, e.g.
  `US-CA`). Dedupe the distinct regions (usually 1–3).
- Fetch each region's public hotspots once via eBird `ref/hotspot/{regionCode}`; union
  the locIds into one `Set<string>`. **O(regions) API calls — a handful, not one per location.**
- `isPublicHotspot(locId) = set.has(locId)`, gated on a valid `^L\d+$` id. O(1) everywhere.
- Cached at the existing transport seam; identical in web (FastAPI) and desktop (Tauri).
  No key / failed fetch → empty Set → plain text everywhere (never a speculative link).
- Reuses the Map Explorer's existing hotspot-Set membership pattern, promoted from
  "current map radius" to "the user's region(s)."

## Scope (Phase 1 + Phase 2 — approved "all in one go")
Apply the convention to every location-name surface that can resolve a locId:
- **Already carry the locId:** Species Detail Top Locations + Comments; Map Explorer
  popups + My Sightings; Statistics geographic / effort / highlights lists.
- **Need the locId threaded through their shared structures (Phase 2):** Checklists tab
  (all-checklists rows + comment results), Named Birds (+ Species Detail Named
  Individuals), Frivolous Lists Rainbow first-seen location.
- **Excluded:** Multimedia / Media stats (their locations may not map to an eBird locId) —
  leave plain text.

## What it touches
- New backend route `GET /map/hotspot-region` (+ its Tauri-service twin in `lib/tauri/mapService.ts`)
  — fetch a region's hotspots; transport-cached; confirm `/map` is in the vite dev proxy.
- New `lib/hotspotSet.ts` — build the Set from the user's distinct regions; `isPublicHotspot` helper.
- New shared `components/HotspotLink.tsx` — wraps `OutboundLink`; id-validated (`LOCATION_ID_RE`)
  AND Set-gated; accessible name "Open {name} on eBird (opens in a new tab)" (parallels
  ChecklistLink, WCAG 3.2.4); folds in the 3 existing inline hotspot links; `compact` mode for popups.
- Thread `locId` onto the Phase-2 shared structures (`ChecklistRowData`/comment entries,
  `NamedSighting`, `RainbowEntry`, the geo top-locations rows) and their builders.

## What done looks like
- Public hotspot names link to their eBird hotspot page across all in-scope surfaces;
  personal locations render plain text (latent bug fixed); junk/absent id → plain.
- Determination is O(regions) calls, cached, graceful without a key, identical web + desktop.
- One shared `HotspotLink` (3 prior inline implementations folded in) + a `HotspotLink` test;
  unit coverage for `hotspotSet` (region union + `isPublicHotspot`).
- Lint, typecheck, tests, production build green. No DB/schema, no new provider; PRIVACY_POLICY
  already covers the eBird API + outbound links (verify, no change expected).

## Notes / risks
- Frontend-heavy + one thin backend route; no schema.
- Staleness: a personal location created after the last backup, or a hotspot newly
  promoted/demoted, can misclassify — acceptable (the user's own locations are the minority);
  note in DECISIONS.
- International / blank `stateProvince` codes: validate the region code, degrade to plain text
  on a 4xx rather than erroring.
- This brief + the investigation already cover the architecture and the (established) link
  design, so the planning/design work is largely done.
