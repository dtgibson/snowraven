# QA Report — county-overlay-precision (v0.5.49)

Full CI mirror, green:

- **Lint** (`eslint .`) — clean.
- **Typecheck** (`tsc --noEmit`) — clean (the new `source-layer` Layer
  prop + `FilterSpecification` typing compile).
- **Tests** (`vitest run`) — **1168 / 1168 passed**, 99 files (was 1163;
  +5 from the new/extended specs).
- **Build** (`tsc -b && vite build`) — ✓. The `us-counties` on-demand
  chunk is **unchanged at 751.84 kB gz** (approach A adds zero bundle);
  `vendor-maplibre` stays its own off-entry chunk (`entryChunk.test.ts`
  green).

New / extended coverage:

- `CountyLayer.test.tsx` (new) — the accurate `sr-county-line-hi` layer
  is added on the `openmaptiles` `boundary` source-layer with an
  `admin_level==6` filter at minzoom 9; the bundled `sr-county-line` is
  maxzoom-capped at 9; and the accurate line is omitted when the vector
  source is absent (offline), leaving the bundled line as fallback.
- `HotspotLink.test.tsx` — a truncating hotspot LINK now carries
  `maxWidth:100%` (so a long name ellipsizes instead of overflowing);
  a non-truncating link does not force it (parity with the plain branch).
- `mapStyle.test.ts` — `boundary_3` is narrowed to `admin_level ≤ 4`.

Manual spot check to perform on the running app before release sign-off
(documented as a follow-up, not blocking): at z10–12 over a US area,
confirm the accurate solid county line renders and hands off from the
bundled line at ~z9 with no visible pop or double-draw.
