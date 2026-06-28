# Decisions — Map Explorer Shading Polish

## Stage 1 — The Evaluator

- **Lane = Improve.** All three items refine the shipped v0.5.46 county/atlas shading
  feature; none adds a new capability or user-facing control. #3 (basemap desaturation) is
  borderline but stays Improve because it is automatic, not exposed as its own toggle.
- **imp-1 is a consistency fix.** Verified the sightings sidebar is the lone outlier
  (list-before-controls); hotspots/lifers already bottom-anchor the list. Scope is the
  sightings sidebar (and any other outlier the Engineer finds).
- **imp-2 uses explicit cross-clearing handlers + a pure `nextShadingState` helper**, not a
  `useEffect` mirror (avoids which-wins ambiguity and an extra render). Shading state stays
  session-scoped (not persisted) — matches shipped behavior. Boundary lines stay independent.
- **imp-2 heatmap parity:** with mutual exclusion, county shading + heatmap mode would draw
  the heatmap over the county ramp (only atlas had the under-fill/dim treatment). Default
  decision: extend under-fill + dim to county shading. Confirm visually in the #3 consult.
- **imp-3 mechanism = surgical MapLibre paint** (setPaintProperty on positron land fills +
  raster-saturation on raster bases), NOT a CSS canvas filter (which would grey the user's
  data and not raise contrast). Map-child applies both paths idempotently so it needn't read
  SnowMap's private `base`. Re-apply on `styledata`; never gate on `isStyleLoaded()`.
- **imp-3 design decisions deferred to the user consult:** desaturation scope (land-only vs
  fuller greyscale incl. water), strength (full grey vs partial), and the Trails overlay.
- **All three ship under one 0.5.47 patch.** Release runs from the Mac, not this VM.

## Stage 2 — The Engineer

- **imp-3 design consult (the user's call):** chose **"Muted land, blue water"** — grey
  the four Positron land fills fully (S=0), keep water/roads/labels colored. Not full
  greyscale, not partial. Implemented via `desaturateHsl` + `setPaintProperty`.
- **Trails overlay left colored** (user-agreed default) — it's a user-chosen overlay,
  not the basemap. `RASTER_BASE_LAYER_IDS` = satellite/topo only.
- **Raster bases** (satellite/topo) get `raster-saturation = -0.85` while shading is
  active (strong mute, short of full grey, matching the "muted land" look).
- **Heatmap county parity (user-agreed default):** generalized SightingMarkers'
  `atlasShading` boolean to a `shadingFillId` string, so the heatmap dims + sits under
  the county fill too — not just atlas.
- **CLAUDE.md coexistence note** NOT yet edited — deferred to the Chronicler (Stage 6)
  so all record updates land in one place / one commit ("Chronicler before the push").
- **Implemented:** imp-1 (sightings + hotspots sidebars reordered; targets/lifers already
  correct), imp-2 (`lib/shadingExclusion.ts` + handlers + tooltips/captions), imp-3
  (`mapStyle.ts` exports/helpers + `components/map/BasemapDesaturation.tsx` + SnowMap wiring).
- **CI mirror green:** lint, typecheck, 1153 tests (new: shadingExclusion 7, basemapMute 6),
  production build; entry-chunk guard holds (vendor-maplibre off `dist/index.html`).
