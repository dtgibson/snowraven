## Map Explorer shading polish (0.5.47)

### What this does
Three refinements to the v0.5.46 county/atlas shading on the Map Explorer:
1. **In-view list to the panel bottom** — the long "… in view" list is now the last
   section in every sidebar (fixed the Sightings and Hotspots outliers; Targets/Lifers
   already were).
2. **Shadings are mutually exclusive** — turning county shading on switches atlas
   shading off and vice-versa (their ramps fought). Boundary *lines* still coexist.
3. **Basemap mutes while shading is active** — the basemap's green land fills grey out
   (water/roads/labels keep color; raster bases desaturate) so the active ramp pops,
   and restore when shading is off.

### How to test
`cd frontend && npm run dev`, open Map Explorer with a backup loaded. See
`pipeline/map-explorer-shading-polish/how-to-see.md` for the step-by-step.

### Notes for reviewer
- imp-2's rule is a pure, unit-tested helper (`lib/shadingExclusion.ts`,
  `nextShadingState`); the two toggle onClicks call it, so React batches the paired
  setters (no double-render). State stays session-scoped (not persisted), as before.
- imp-3 uses MapLibre `setPaintProperty` on the four Positron land-cover fills +
  `raster-saturation` on raster bases — NOT a CSS canvas filter (which would grey the
  user's pins/data and wouldn't raise contrast). New map-child `BasemapDesaturation`
  applies both paths idempotently (so it needn't read SnowMap's private base) and
  re-applies on `styledata` (style reload). `TINT_*` are now exported from `mapStyle.ts`
  for the restore path; greys are theme-independent (S=0).
- The heatmap's old `atlasShading` prop is generalized to `shadingFillId`, so the
  heatmap dims + sits under the county fill too (county/heatmap parity).
- Entry-chunk guard holds: `vendor-maplibre` stays off `dist/index.html`
  (`entryChunk.test.ts` green; verified in a fresh build).
- CLAUDE.md's "designed to coexist" overlay note is reversed by imp-2 — updated at the
  Chronicler step.

### Tests
- New: `lib/shadingExclusion.test.ts` (7), `lib/basemapMute.test.ts` (6).
- Updated: `components/map/SightingMarkers.test.tsx` (prop rename).
- Full suite green: 1153 tests; lint + typecheck + build clean.
