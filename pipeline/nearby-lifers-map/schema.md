# Technical Design — Nearby Lifers Map
**Feature:** nearby-lifers-map
**Stage:** 3 — The Architect
**Path:** Frontend Only (no data layer)
**Source:** prd.md (approved)

## No Data Layer
SnowRaven has no database, ORM, schema, or migrations. This feature persists nothing new: it reads the existing `map-defaults` setting (default location + radius) and writes nothing. No tables, no columns, no migrations. What follows is the integration design the Engineer builds from.

## The data path (the crux)
The user's life list lives only on the client (parsed from the eBird backup CSV), so the backend cannot filter to lifers. The server returns recent nearby species observations *with coordinates*; the client subtracts the life list and groups by location.

**Decision: reuse `GET /map/recent-obs` by making its `codes` filter optional.** It already returns coordinate-bearing records (speciesCode, comName, locId, locName, lat, lng, recentDate, subId, checklistCount) grouped by (speciesCode, locId), but today it requires a comma-separated `codes` param and returns `[]` when empty. Relax it: empty/omitted `codes` ⇒ return every species in the radius (skip the code filter). Media Targets always passes `codes`, so its behavior is unchanged. This reuses the existing, tested route and grouping in both transports with a one-guard change, instead of duplicating the same eBird call in a new route.

*Alternative considered:* a dedicated `/map/nearby-obs` route. Rejected — identical data and shape, more surface to maintain across two transports.

**eBird semantics note:** `/data/obs/geo/recent` returns the *most recent* observation of each species in the area, so each lifer appears once, at its single most-recent location and checklist. Showing every location a species was seen would require a heavier per-species query and is out of scope. One pin per species' most-recent spot is the model.

## Backend / service design (both transports, in lockstep)
- **`backend/routers/map.py` — `/map/recent-obs`:** make `codes` optional; when empty, skip the species-code filter and return all species in the radius. Response shape unchanged; keep the lat/lng/dist validation; `back=30` unchanged. The recency filter (day / week / 30 days) is applied client-side over this 30-day window — the route exposes no `back` param.
- **`frontend/src/lib/tauri/mapService.ts` — `getRecentObs`:** mirror the same change (empty codes ⇒ all species). Guard each record's `lat`/`lng` presence (the nemesis path never touched these fields).
- **`frontend/src/lib/transport.ts`:** `/map/recent-obs` already routed and cached; `/map` already in the vite proxy. No change beyond confirming the no-codes case is carried.

## Frontend types (`lib/mapExplorerTypes.ts`)
- Reuse the existing coordinate-bearing recent-obs record shape (per-species, with location).
- Add `NearbyLiferLocation`: `{ locId, locName, lat, lng, lifers: { comName, speciesCode, recentDate, subId }[], count, mostRecentDate, tier }`.
- Add `'lifers'` to the `ViewMode` union.

## Client logic — new pure module `lib/nearbyLifers.ts` (tested)
- Input: recent-obs records + the normalized recorded-species set (`computeLifeList`).
- Subtract recorded species (normalized, case-insensitive) → nearby lifers.
- Skip records with null/invalid coordinates.
- Apply the recency window (last day / week / 30 days, default 30 days) by keeping records whose most-recent report date is within the window — client-side over the already-fetched 30-day data, so switching windows needs no refetch.
- Group by `locId` → one `NearbyLiferLocation` per location; species sorted most-recent first; `count` = distinct lifer species; `mostRecentDate` + recency `tier` from the newest report.
- Provide a nearest-first sort by distance from the center (reusing `distanceMiles`).
- Mirrors the pure-and-tested pattern of `lib/sightingMarkers.ts`.

## Rendering & MapExplorer wiring
- **New `components/map/NearbyLiferMarkers.tsx`** — clone of `TargetMarkers.tsx`: DOM `<Marker>` per location (bounded scale), a count-badge chip, recency-tier color, `neutralizeMarkerWrapper` + a real `<button>` with aria-label, one lifted state-driven `<Popup>` listing each lifer (BirdName plain + favicons, recency, date, validated `ChecklistLink`).
- **`MapExplorer.tsx`** — the standard six touch points for a new mode: ViewMode member; per-mode state (`liferPins`, loading, error, `selectedLiferLocId`); mode-bar button (aria-pressed); `lifersSidebar` reusing `CenterPointControl` + `RadiusControl` + `AddressSearch` + a new shared **Time-range SegControl** (day / week / 30 days, labeled "Time range") + `atlasOverlayControls` + `InViewMarkerList`; a `recencyWindow` state that re-filters the built locations client-side (no refetch); the gated `<NearbyLiferMarkers>`; a `lifersInView` memo + `openLiferFromList`. `handleFindLifers` calls `transport.get('/map/recent-obs', { lat, lng, dist })` (no codes), then `POST /taxonomy/codes` for favicons, then `buildNearbyLifers(...)`.
- **Media Targets consistency (scope addition):** the same time-range SegControl is also added to the existing `targetsSidebar`, with its own window state, and the identical client-side date-window filter is applied to the Media Targets pins/list (Media Targets already uses the same `/map/recent-obs` data + recency tiers), so the two panels read identically. Factor the SegControl + the date-window predicate as a small shared helper so both sections use one implementation. No other Media Targets behavior changes.
- **Units:** apply radius in miles → km (`Math.round(radius * 1.60934)`) like the rest of the Map Explorer — correct from the start (the old Statistics card passed miles as km).
- **hasEntry = false** for lifers (not in the backbone) → plain name + favicons, no Species Detail link.
- Reused wholesale: SegControl, SidebarLabel, KeyNotice, InViewMarkerList, AddressSearch, CenterPointControl, RadiusControl, MapEffects, BoundsTracker, markersInView, distanceMiles/recencyTier/tierColors, BirdName, ChecklistLink, the single-popup lifted-selection pattern, the mobile focus/overlay stack. The section also inherits the map-level chrome shared by every mode — the base-layer switcher (Map / Satellite / Topo / Trails) via the single persistent `<SnowMap>`, the California Breeding Bird Atlas overlay (`AtlasLayer`, rendered mode-agnostically; its toggle lives in `atlasOverlayControls` in the sidebar), and the fullscreen / Filters FAB — and provides its own viewport-scoped in-view keyboard list. The Sightings-only heatmap toggle does not apply to location-grouped pins.

## Statistics removal (FR-20)
- Remove the Nearby Lifers block from `BirdingStats.tsx` (state, fetch effect, `nemesisFiltered`, JSX, the `NemesisSpecies` type). Keep the shared `map-defaults` read if other stats use it.
- Retire the now-dead `/stats/nemesis`: the `backend/routers/stats.py` handler, `getNemesis` + interface in `statsService.ts`, the `transport.ts` mapping, and related tests — after confirming nothing else references `nemesis`.

## Accessibility & conventions (NFR-01)
Inherit the Map Explorer's existing focus/overlay stack and follow the standing conventions: explicit aria-labels on the search box + radius/select controls; aria-pressed on the mode toggle; the keyboard in-view list as the pin path; colors only via `--sr-*` (tier-fg/-text families, never a fill token as text); `ChecklistLink` with `SUBMISSION_ID_RE`, locId via `LOCATION_ID_RE`; one focus-restoring close path; gate the map on results so no empty WebGL context mounts.

## Tests
- `lib/nearbyLifers.test.ts` — filter/group/sort/skip-null-coords/tier logic.
- `NearbyLiferMarkers.test.tsx` — jsdom docblock + react-map-gl/SnowMap stubs; markers are real buttons, count badge, popup content + close.
- Backend: `/map/recent-obs` empty-codes ⇒ all-species case; Tauri `getRecentObs` parity.
- Remove obsolete nemesis tests.

## Files touched (map)
- **Backend:** `routers/map.py` (relax codes), `routers/stats.py` (remove nemesis), `tests/test_*`.
- **Desktop services:** `lib/tauri/mapService.ts` (relax codes), `lib/tauri/statsService.ts` (remove getNemesis), `lib/transport.ts` (drop /stats/nemesis mapping).
- **Frontend:** `components/MapExplorer.tsx` (new Nearby Lifers mode + the shared Time-range control on both the Nearby Lifers and Media Targets sidebars), `components/map/NearbyLiferMarkers.tsx` (new), `lib/mapExplorerTypes.ts`, `lib/nearbyLifers.ts` (new) + test (incl. the shared date-window predicate), `components/BirdingStats.tsx` (remove block).
- **Docs/version:** handled at Stage 9 (Chronicler) — CHANGELOG, HELP, README, website, version bump in both `package.json` and `tauri.conf.json`.
