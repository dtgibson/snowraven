# Schema — Atlas Shade by Breeding Code

## Path
Frontend Only — no database/migrations. Reads already-loaded data (parsed eBird backup + bundled atlas gazetteer) and renders. The substance is the spatial-join logic and the SVG texture rendering, documented here.

## Existing pieces reused
- `frontend/src/lib/breedingCodes.ts` — `BREEDING_CODES[]` with `{ code, label, tier: 1|2|3|4 }`, ordered strongest-first (tier 4 first). Source of tier + label + a natural rank (array index).
- `frontend/src/lib/atlasBlocks.ts` — gazetteer (`AtlasData`: scheme, quads `{sw,name,id,pos?}`), `generateBlocks`, `blocksInBounds`. Blocks are axis-aligned quad/6 rectangles; `block.code` = quad `id` + position (e.g. `32117F2CE`).
- `frontend/src/components/AtlasBlockLayer.tsx` — renders in-view blocks as GeoJSON (currently transparent fill for click hit-testing) + name/eBird popup.
- `MapExplorer.tsx` — `phase.observations: ObservationEntry[]` (lat/lng/breedingCode), `atlasEnabled`/`atlasData` state, atlas toggle in the Hotspots sidebar.
- Tokens: `--sr-tier-1..4` + `--sr-tier-N-rgb` triplets (light + dark) for `rgba(var(--sr-tier-N-rgb), α)`.

---

## A. Spatial join (pure, in `atlasBlocks.ts` — unit-tested)

### Quad index + point→block
- Add `buildQuadIndex(data): Map<string, Quad>` keyed by `"${swLat},${swLng}"` (4-dp), built once.
- Add `pointToBlockCode(data, index, lat, lng): string | null`:
  1. Snap the point down to the 0.125° quad grid → quad SW; look up in `index`. Not found → `null` (outside CA coverage).
  2. Within the quad, compute column from `(lng - swLng) / (quadLng/cols)` and row from `(lat - swLat) / (quadLat/rows)`, clamp to grid → position code via `scheme.positions[row][col]`.
  3. If the quad's `pos` list exists and lacks that code (edge quad missing that block) → `null`.
  4. Return `quad.id + positionCode` (the block code).

### Highest tier per block
- Add `buildBreedingByBlock(data, observations): Map<string, BlockBreeding>` where `BlockBreeding = { code: string; label: string; tier: 1|2|3|4; count: number }`.
  - Precompute `rank`/`tier`/`label` lookups from `BREEDING_CODES` (rank = array index; lower = higher).
  - One pass over observations: skip those without `breedingCode`/coords or whose code isn't a known breeding code; `pointToBlockCode(...)`; skip if null; increment that block's `count`; if the obs code's rank is better (lower) than the stored one, update `code/label/tier`.
  - Result: only blocks with ≥1 personal breeding record appear in the map. O(observations).

## B. MapExplorer wiring
- New state `shadeByBreeding: boolean` (default false). Reset to false whenever `atlasEnabled` goes false.
- `breedingByBlock = useMemo(() => (atlasData && phase.tag==='ready') ? buildBreedingByBlock(atlasData, phase.observations) : null, [atlasData, phase])`.
- Shade toggle (sibling under the atlas toggle, rendered only when `atlasEnabled`):
  - Label "Shade by My Highest Breeding Code"; caption "Based only on breeding codes you've personally entered."
  - Disabled with a "Load your eBird backup in Settings to use this" note when `phase.tag !== 'ready'` (no breeding data).
  - `role="switch"`, `aria-checked`, `tabIndex={0}`.
- Pass to `AtlasBlockLayer`: `shade={shadeByBreeding && !!breedingByBlock}` and `breedingByBlock`.

## C. Rendering — color + texture (AtlasBlockLayer)

### Per-tier SVG patterns (baked color + hatch) — the colorblind channel
- Render a one-time hidden `<svg>` `<defs>` (a small React component, e.g. `AtlasTierPatterns`) containing **4 `<pattern>` elements** `id="sr-atlas-tier-1..4"`. Each pattern tile:
  - a `<rect>` filled with the tier's translucent color — `fill: rgba(var(--sr-tier-N-rgb), ~0.4)` via inline `style` so it's **theme-reactive** (the rgb token differs light/dark);
  - hatch geometry distinct per tier (the Designer defines the exact set; e.g. tier 1 sparse dots → tier 2 single diagonal → tier 3 cross-hatch → tier 4 dense cross-hatch), stroked with `rgba(var(--sr-tier-N-rgb), ~0.9)`.
  - Patterns must be distinct in **grayscale** and legible at small block sizes (FR-11).
- Block fill references the pattern: shaded blocks get a per-tier CSS class `sr-atlas-tier-N` with `.sr-atlas-tier-N { fill: url(#sr-atlas-tier-N); }` (CSS `fill` property resolves the fragment ref and beats Leaflet's fill attribute, same technique as the `.sr-atlas-block` stroke).
- **defs reachability:** `fill: url(#id)` resolves by document fragment id; render the `<defs>` SVG in the MapExplorer DOM (same document as the Leaflet overlay SVG). The Engineer verifies cross-SVG `url(#id)` resolves in the target browsers (Chromium/WebKit/WebView2 do); **fallback** if not: inject the `<defs>` into Leaflet's overlay-pane `<svg>` directly, or fall back to solid tier color + a per-tier `dashArray` block border so tier is still non-color-encoded.

### Style function
- `AtlasBlockLayer` `style` becomes a function of feature: 
  - shaded (shade on AND `breedingByBlock.has(code)`): `{ className: 'sr-atlas-block sr-atlas-tier-${tier}', fill: true, fillOpacity: 1 }` (opacity 1 because translucency is baked into the pattern's rgba colors).
  - unshaded: current `{ className: 'sr-atlas-block', fill: true, fillOpacity: 0 }` (outline only, still clickable).
- The GeoJSON `key` must also vary with `shade` + a signature of `breedingByBlock` so the layer re-styles when the toggle flips.

### Popup (FR-09)
- In `onEachFeature`, if `shade` and `breedingByBlock.get(code)` exists, append: "Highest: {label} ({code}) · {count} record{s}" under the existing name/eBird link. Import `BREEDING_CODES` (or pass the label via the map entry — already stored).

## D. Legend (FR-12, optional v1)
- If the Designer includes a legend, it lists the 4 tiers each with its swatch **and** texture sample + label. Otherwise rely on popup + the patterns being self-evidently ordered (sparse→dense). Designer's call.

---

## What The Engineer builds
1. `atlasBlocks.ts`: `buildQuadIndex`, `pointToBlockCode`, `buildBreedingByBlock` (+ types) — unit-tested.
2. `AtlasTierPatterns` defs component + `.sr-atlas-tier-N` CSS (globals.css).
3. `AtlasBlockLayer`: `shade`/`breedingByBlock` props, per-feature style function, popup detail, key includes shade signature.
4. `MapExplorer`: `shadeByBreeding` state (+ reset on atlas-off), `breedingByBlock` memo, the gated/disabled toggle with copy.
5. Stage-9 docs: HELP/README note.

## No database work
No migrations or persistence changes.
