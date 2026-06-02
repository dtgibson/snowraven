# Design Spec — Atlas Shade by Breeding Code

## Visual Direction
Atlas blocks shaded by the user's highest breeding tier, encoded redundantly as **translucent purple + a distinct texture** so the level reads with or without color. Reuses the existing 4-tier breeding palette; adds four hatch textures that progress sparse → dense with evidence strength.

## The four tier textures (sparse → dense)
Each tier is a single SVG `<pattern>` that bakes both channels: a translucent tier-color rect + a hatch stroke in the stronger tier color.
- **Tier 1 — Possible:** sparse dots.
- **Tier 2 — Probable:** single diagonal lines.
- **Tier 3 — Confirmed (nest building):** cross-hatch (medium).
- **Tier 4 — Confirmed (nest/young):** dense cross-hatch.
Verified in the mockup's grayscale row: the four are distinguishable by texture density alone (colorblind-safe), in light and dark.

## Readability requirement (load-bearing)
- The base map underneath (OpenStreetMap street/place labels) MUST remain readable through the shading. Keep fill alpha translucent (~0.35–0.45) and texture strokes thin/spaced.
- **Tune on the real map:** exact alpha and texture spacing are finalized by the Engineer against live tiles and at multiple zooms — increase spacing / lower alpha if labels are obscured, especially for the dense tier-4 pattern at small block sizes. This is an explicit acceptance check, not a fixed value.

## Controls
- **Shade toggle:** sibling under the "Atlas blocks" toggle, shown only when atlas is on. Label "Shade by My Highest Breeding Code"; caption "Based only on breeding codes you've personally entered." Existing switch styling (`role="switch"`, `aria-checked`, `tabIndex={0}`). Default off. Disabled with a "Load your eBird backup in Settings to use this" note when no backup is loaded.
- **Legend:** a 4-row legend (keep for v1) pairing each texture swatch with its evidence label (Confirmed nest/young, Confirmed nest building, Probable, Possible), so the texture↔tier mapping is learnable. Shown when the shade toggle is on.

## Interaction
- Shading appears only for blocks with ≥1 of the user's breeding records; others stay outline-only. Interiors remain clickable (transparent-fill technique for unshaded; pattern fill is still a click target for shaded).
- Clicking a shaded block: popup shows the highest code label + code + the user's record count, under the block name + eBird link.
- Turning off shade (or atlas) removes the tint.

## Tokens
- `--sr-tier-1..4` + `--sr-tier-N-rgb` for the pattern rect/stroke (theme-reactive). Outline keeps `--sr-map-atlas`. No new color tokens.

## Content
Warm, precise. Legend labels use the eBird evidence categories. Caption makes the personal-data scope unmistakable.
