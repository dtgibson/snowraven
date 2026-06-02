## Atlas blocks — shade by my highest breeding code

### What this does
Adds a second Map Explorer toggle (shown when atlas blocks are on) that tints each atlas block by the user's highest personally-entered breeding code in it — encoded as both a tier purple AND a distinct texture so it's colorblind-accessible.

### What was built
- `frontend/src/lib/atlasBlocks.ts` — `buildQuadIndex` + `pointToBlockCode(lat,lng)` (quad-grid point→block, no polygon test). Unit-tested (+4 cases).
- `frontend/src/lib/atlasBreeding.ts` — `buildBreedingByBlock(data, observations)` → `Map<blockCode, {code,label,tier,count}>` in one pass; keeps the strongest code (by `BREEDING_CODES` rank) + count per block; only blocks with ≥1 personal record. New test file (5 cases).
- `frontend/src/components/AtlasTierPatterns.tsx` — SVG `<defs>` with 4 patterns (`sr-atlas-tier-1..4`), each baking a translucent tier-color rect + a hatch that densifies with tier (sparse dots → dense cross-hatch); colors via `--sr-tier-N-rgb` (theme-reactive).
- `globals.css` — `.sr-atlas-tier-N { fill: url(#sr-atlas-tier-N) }`.
- `AtlasBlockLayer.tsx` — `shade` + `breedingByBlock` props; per-feature `style` function (shaded blocks get `sr-atlas-tier-N` + opaque fill so the pattern shows; unshaded keep the transparent clickable fill); popup adds "Highest: {label} ({code}) · N records"; `key` includes a shade signature so re-styles on toggle.
- `MapExplorer.tsx` — `shadeByBreeding` state (reset when atlas turned off), `breedingByBlock` memo (from `phase.observations` + gazetteer), the gated toggle (disabled + "load your eBird backup" note when no backup) with the personal-data caption, a 4-row legend (texture + label), `<AtlasTierPatterns/>` rendered once, props threaded to the layer.

### How to test
- `cd frontend && npm run dev` → Map Explorer → Hotspots → turn on **Atlas blocks** → turn on **Shade by My Highest Breeding Code**. Over California where you have breeding records, blocks tint by tier with textures; legend appears; click a shaded block for the highest code + count. Blocks with no record stay outline-only. Toggle off (shade or atlas) removes it.
- Colorblind check: desaturate a screenshot — tiers should remain distinguishable by texture density.
- Readability: confirm OSM street/place labels stay legible under the textures at several zooms (alpha/spacing tunable in `AtlasTierPatterns`).
- With no backup loaded, the shade toggle is disabled with a note.

### Status / verification dependency
- tsc + eslint clean; **266 tests pass** (+9). Pure join logic fully unit-tested.
- Live shading needs **California** breeding-coded records in the backup (atlas is CA-only) — Dave to verify on real data, including base-label readability and the cross-SVG `fill: url(#id)` pattern resolution (fallback documented in schema.md if it misbehaves).

### Refinements after review
- **Readability tuning:** initial fills/hatch were too heavy over the base map. Final: faint fill (alpha 0.12) + spaced hatch; cross-hatch tiers (3,4) lightened further (line opacity 0.6, wider spacing — tier 3 = 22px, tier 4 = 16px) so OSM labels read through.
- **"Use Textures" toggle (off by default):** third toggle under the shade toggle. Off → flat translucent tier color (max map visibility); on → the hatch patterns (color-independent). Flat fills via `.sr-atlas-fill-N` (alpha 0.33); legend swatches follow the active mode.
- **Popup wording:** "Highest breeding code: {label} ({code})" + "{N} of your breeding records (any level) in this block."
- **All three sidebars:** overlay controls extracted to a shared `atlasOverlayControls` block — My Sightings (bottom, below Map View), Hotspots (between legend & nearest list), Media Targets (above Nearest Targets). Map layer already drew in every mode; state shared.
- **Higher zoom reach:** viewport block cap raised 400 → 5000 so blocks appear at a regional zoom while staying smooth and legible.

## Convention Flags
- Texture-pattern fills for Leaflet vector layers via injected `<defs>` + `fill: url(#id)` CSS class — reusable pattern for any future map encoding needing a non-color channel.
