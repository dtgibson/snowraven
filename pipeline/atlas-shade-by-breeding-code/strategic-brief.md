# Strategic Brief — Atlas Shade by Breeding Code

## What We're Building
A second toggle in the Map Explorer — **"Shade by My Highest Breeding Code"** — that appears only when the atlas blocks overlay is on. When enabled, each atlas block the user has personally recorded a breeding code in is tinted with the purple shade of that block's *highest* breeding-code tier, using SnowRaven's existing 4-tier breeding palette. The control's label and a caption make explicit that this reflects the user's own entered breeding codes, not atlas-wide data.

## Why Now
The California atlas overlay (v0.5.0) shows block boundaries; this makes them *informative* — turning the map into a personal atlasing-coverage view where a birder sees, by color, which blocks they've confirmed breeding in and at what evidence level. It's the natural completion of the atlas feature for the California atlaser it serves.

## The User Problem
An atlaser can see block outlines but has no spatial sense of their own breeding-evidence coverage — which blocks they've confirmed in, which only have possible/probable codes, and which are blank. They'd otherwise cross-reference the Breeding Codes tab against a separate atlas map by hand.

## Success Criteria
- With atlas blocks on, a "Shade by My Highest Breeding Code" toggle appears; off by default.
- Enabling it tints each block containing ≥1 of the user's breeding-coded observations with the purple of that block's highest breeding tier (4 = darkest/Confirmed … 1 = lightest), matching the breeding-code colors used elsewhere in the app.
- The control clearly communicates it is based only on the user's personally entered breeding codes (label + caption), so it can't be mistaken for all-observer atlas data.
- Blocks with no personal breeding record stay outline-only.
- The tint is translucent so the map and block outlines remain readable.
- Clicking a shaded block shows its highest breeding code (and the count of the user's breeding records there) alongside the block name.
- Turning the shade toggle (or the atlas toggle) off removes the tint.

## Scope
- The shade toggle (gated on atlas-on) with personal-data copy, the spatial join of the user's breeding observations to atlas blocks, the highest-tier-per-block computation, the tier-colored translucent fill, and the popup addition.
- Reuses the existing breeding-code tier definitions/colors and the atlas block geometry.

## Out of Scope
- Any non-personal/atlas-wide breeding data (not available to the app).
- Atlases other than California.
- Changing breeding-code tier definitions or the Breeding Codes tab.

## Key Decisions
- **Source is the user's own eBird backup** (`breedingCode` + lat/lng per observation) — the only available breeding data; effectively visualizes personal atlasing coverage. The UI copy states this explicitly.
- **"Highest" = highest tier** (4 > 3 > 2 > 1) among the user's records in a block, using `--sr-tier-1..4`.
- **No backup loaded → no breeding data:** the shade toggle is disabled with a brief "load your eBird backup" note rather than silently doing nothing.
- **Translucent fill** (not solid) so outlines/tiles/pins stay legible; reconciles with the transparent-fill click behavior from v0.5.0.
