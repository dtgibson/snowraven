# Design Spec — Vector Basemap (MapLibre)

**Lane:** New Feature · **Date:** 2026-06-04 · Builds on schema.md

## Guiding principle
Keep the quiet, clean look Dave preferred (Positron family). The *only* headline
visual change is **legible labels at the right size**. Everything else stays
subtle; the base map is a backdrop for data pins, not a feature itself. Final
values are **tuned live** with Dave (as with the heatmap/textures).

## Base map style
- **Land:** near-white / very light neutral (Positron-like). **Water:** soft
  light blue (≈ the OSM/Positron tone we already match in the void).
- **Tint (light touch only):** optionally nudge parks/reserves toward a very
  desaturated SnowRaven green — low saturation so pins/labels stay dominant.
  Default to almost none; add only if it reads well live.
- **Void/backdrop** (area beyond tiles), per active base — carried from today:
  light neutral for Map/Topo, dark for Satellite.

## Labels (the headline)
- **Size:** start one perceptible step larger than Positron-native (the size
  that read "a touch small"), short of the 2× that read "too big." Concretely:
  bump the base style's `text-size` by ~15–25% as a starting point, then tune
  live to Dave's preference.
- **Weight/halo:** keep a subtle white halo for legibility over land/water;
  normal weight. **Font:** Inter (or the style's default if Inter glyphs aren't
  in the OpenFreeMap font stack — don't block on this).
- Crisp on retina (vector renders sharp by nature).

## Atlas shade textures (redrawn for MapLibre)
Same visual language as the v0.5.2 SVG textures, re-rendered as small sprite
images (`map.addImage`) for `fill-pattern`:
- **Tier 1 (Possible):** sparse dots
- **Tier 2 (Probable):** single diagonal hatch
- **Tier 3 (Confirmed-also):** spaced cross-hatch
- **Tier 4 (Confirmed):** denser cross-hatch
- Colors: `--sr-tier-1..4` purples; **low fill alpha (~0.12)** and generous
  spacing so base-map labels stay readable underneath (the lesson from v0.5.2).
- Flat-shade mode (no textures) uses the tier color at ~0.33 alpha, as today.

## Unchanged visual elements
- The **base-map switcher** control (brand-styled card, segmented Map/Satellite/
  Topo + Trails toggle) — same look as v0.5.7.
- **Pins/legend:** visited (green) / unvisited (blue) / personal (orange);
  target recency tiers; sighting markers — same colors.
- **BirdName** popups, nearest lists, filters — unchanged.

## Reference
`design.html` renders the 4 tier texture tiles (canvas, as they'll appear as
MapLibre sprites) and the tier palette, plus a label-size before/after note.
The base map itself is verified live (a static mockup can't represent a vector
map faithfully).
