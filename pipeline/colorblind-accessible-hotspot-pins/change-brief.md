# Change Brief — Colorblind-Accessible Hotspot Pins

## What is changing
The v0.5.92 "Color pins by" hotspot modes encode the five ramp tiers
(t1–t5) by fill hue/luminance alone at pin scale. The non-value states
already carry structure (hollow disc, dashed ring, pale fill), and every
value is stated in words in the popup and the "Hotspots in view" list —
but tier-vs-tier reading on the map itself requires color/brightness
discrimination a colorblind user cannot rely on at 28px. This change adds
a simple non-color channel for the ramp tiers, in the spirit of the
existing "Use Textures" convention (atlas v0.5.2, county v0.5.51,
Calendar), with the pin-scale mechanism chosen by The Designer — v0.5.92
recorded that a county-style crosshatch does not resolve on a teardrop
bulb, so the channel will be structural (e.g. tick/notch/segment marks
baked into the mode sprites in `mapPins.ts`), mirrored in the legend.

## Why now
Direct user feedback immediately after v0.5.92 shipped: the pins look
great but are not colorblind accessible. Every sibling shaded surface
(breeding atlas, county shading, Calendar) already offers a
color-independent reading; the hotspot ramp is the one gap, and
ACCESSIBILITY.md's map paragraph leans on "luminance + words" alone
for it. The user's explicit constraint: simple and non-overwhelming.

## User-facing impact
With a color mode active, ramp pins (and their legend swatches, and the
popup swatch) gain a structural cue readable without hue perception —
possibly behind a small opt-in toggle mirroring the existing
"Use Textures" pattern, per the Designer's call. The default
visited/unvisited/personal coloring is untouched (byte-identical,
regression-guarded), non-value states keep their shipped structure,
and ACCESSIBILITY.md/HELP/README/website update in the same change.

## Design pass
Needed. Surfaces being refined: the mode teardrop sprites
(`modeTeardropImageData` in `frontend/src/lib/mapPins.ts`), the mode
legend block in `MapExplorer.tsx` (+ `HotspotModeMiniPin`/`HotspotModeDot`
in `map/MapSidebarUI.tsx`), the popup mode-line swatch, and — only if a
toggle is added — the "Color pins by" block in `HotspotModeControl.tsx`.
What should feel better: a tier is readable at a glance without hue or
fine luminance discrimination, while normal-vision users see the same
calm ramp they already have. Lean on existing app patterns; do not
invent a new visual system.

## Decisions touched
- v0.5.92 "Three design decisions worth their record": "the colorblind
  path at pin scale is luminance + structure + words, not texture" — this
  change EXTENDS that decision (tiers gain structure; texture-as-crosshatch
  stays rejected). The Chronicler must log the amendment.
- FR-03 byte-identical default coloring guard (`HotspotMarkers.test.tsx`)
  — must stay green; default mode is out of scope.
- `hotspotContrast.test.ts` clauses: nodata replacement clauses, ≥1.2:1
  adjacency, ≥3:1-vs-land — and its DORMANT clause: any text/number
  painted ON a pin fill requires adding the 4.5:1 on-fill clauses.
- Use-Textures precedents (v0.5.2 / v0.5.51 / v0.5.58 Calendar rule:
  DOM surfaces reuse only the pure density model; pins ARE sprites, so
  the sprite bake path is the right home here).
- ACCESSIBILITY.md map paragraph (published claim) must be updated to
  stay true. Zero/quiet shared token and personal-pins-excluded-from-ramps
  decisions are unchanged and must not drift.

## What done looks like
A colorblind user (or a grayscale/no-hue check) can distinguish ramp
tiers on the map itself, legend and pins reading from one shared
geometry source so they cannot drift, with a new structural-monotonicity
guard test alongside the untouched contrast guards. The FR-03
byte-identical default guard and `entryChunk.test.ts` stay green; docs
(HELP/README/website/ACCESSIBILITY) move in the same change.
