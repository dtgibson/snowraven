# QA Report — Map Explorer Shading Polish

**Date:** 2026-06-28
**Test Runner:** vitest (+ eslint, tsc, vite build)
**Result:** PASSED

## Test Suite Results
1158 tests passing across 98 files, 0 failing. Lint clean, typecheck clean,
production build succeeds. New tests this run:
- `lib/shadingExclusion.test.ts` — 7 (imp-2 mutual-exclusion rule)
- `lib/basemapMute.test.ts` — 6 (imp-3 grey derivation + mute config)
- `components/map/BasemapDesaturation.test.tsx` — 5 (imp-3 map-child contract)
- `components/map/SightingMarkers.test.tsx` — updated for the `shadingFillId` prop;
  still green (source-id remount contract intact).

## Acceptance Criteria Verification

| Criterion | Result | Notes |
|---|---|---|
| imp-1: in-view list is the last section in every sidebar | ✓ Pass | Sightings + Hotspots reordered; Targets/Lifers already last (verified by reading all four sidebars). |
| imp-1: no regression to focus order / keyboard path | ✓ Pass | DOM order = tab order; mobile focus trap re-queries each Tab. In-view rows still open the popup + pan. |
| imp-2: turning one shading on turns the other off | ✓ Pass | `nextShadingState` unit-tested incl. the "never both on" invariant; handlers wired to both toggles. |
| imp-2: boundary lines still coexist; shade stays session-scoped | ✓ Pass | `atlasEnabled`/`countyLinesEnabled` untouched; shade state is plain useState (not persisted). |
| imp-2: the silent switch is discoverable | ✓ Pass | Hover tooltip on each shade toggle + contextual caption when the other shading is on. |
| imp-3: basemap land greys when shading is on, restores when off | ✓ Pass | `BasemapDesaturation` test asserts grey on the 4 land fills when active, original tints when inactive. |
| imp-3: water / roads / labels keep color; only land + raster bases mute | ✓ Pass | Only `TINTED_LAND_LAYERS` + `RASTER_BASE_LAYER_IDS` are touched; water/road/label layers are not. |
| imp-3: Trails overlay left colored | ✓ Pass | `RASTER_BASE_LAYER_IDS` excludes `sr-trails` (asserted in `basemapMute.test.ts`). |
| imp-3: survives a style reload; no crash on a missing layer | ✓ Pass | Re-applies on `styledata` while active; `getLayer` guard skips absent layers (tested). |
| imp-3: heatmap dims under the county ramp too (parity) | ✓ Pass | `shadingFillId` drives the heatmap `beforeId`/opacity + pin dim for county as well as atlas. |
| Entry chunk: maplibre stays off first paint | ✓ Pass | `entryChunk.test.ts` green; fresh build shows `vendor-maplibre`/`BasemapDesaturation` absent from `dist/index.html`. |

## Edge Cases Tested
- Mutual exclusion from every starting state (both-off, atlas-on, county-on) never
  yields both-on.
- `desaturateHsl` guards malformed input (returns it unchanged).
- BasemapDesaturation no-ops safely when the map ref is null and when layers are absent.

## Known Limitations
- The *subjective* visual check (does the muted basemap make the ramp pop enough; AA
  contrast of labels/overlay over grey land in both themes) is best confirmed in the
  running app with real data — recommended at the deploy verification step. The
  mechanism and exact paint values are verified here; the aesthetic is the human call
  the design consult already framed.
- imp-1 mirrors only sidebars that host an in-view list; no sidebar was found needing a
  change beyond Sightings + Hotspots.

## Convention Flags
- New off-entry-chunk component (`BasemapDesaturation`) imports maplibre via the lazy
  MapExplorer chunk — consider adding it to `entryChunk.test.ts`'s explicit assertions
  if that guard is ever tightened. (Chronicler to weigh.)
