# Design Refinement — Colorblind-Accessible Hotspot Pins

Approved design direction (user-approved, including persisted toggle:
"That sounds good to me, including remembering the toggle. Please build
it."). Refines the v0.5.92 "Color pins by" hotspot modes on the Map
Explorer. The rendered mockup is `design.html` in this directory; its
inline `ARC` spec and pin-drawing JS are the geometry reference.

## Visual Direction

An opt-in **tier ring**: a thin white ring just inside each ramp pin's
rim, split into five fixed segments; a pin's tier fills that many
segments clockwise from the top, the remainder staying as a faint
track. The calm shipped cyan-blue ramp is untouched by default — the
ring appears only when the user switches it on, adds no new color
(same white as the baked kind glyph), and reads by extent at map scale
(like a clock face) and by count up close. Quiet utility: structure
added, nothing louder.

## Screens / Views

### Map Explorer — hotspot pins (mode sprites)

- **Rings OFF (default):** byte-identical to shipped. The FR-03
  byte-identical default guard and every shipped mode sprite stay
  exactly as they are.
- **Rings ON, ramp pins (t1–t5 × visited/unvisited):** the sprite bake
  (`modeTeardropImageData` in `frontend/src/lib/mapPins.ts`) adds the
  segmented ring after the fill/stroke and before the glyph.
  - **Ring geometry (the shared spec constant):** cx 14, cy 14,
    r 11.1, strokeWidth 2.4, 5 segments, 16° gaps, start −90°
    (12 o'clock), clockwise, butt caps. Filled segments `#fff`;
    unfilled track `#fff` at 0.28 alpha. Export ONE spec object from
    `mapPins.ts` (alongside `HOTSPOT_HOLLOW_DISC` /
    `HOTSPOT_DASH_PATTERN`, e.g. `HOTSPOT_TIER_ARC`) and derive canvas
    arcs, legend SVG minis, and the popup badge from it — the
    CountyDensitySwatch same-source rule (NFR-10). Never duplicate the
    numbers.
  - **Tier encoding:** filled-segment count = tier index of the fixed
    5 (matches the fixed 16-sprite table; with fewer rendered classes,
    tiers 1..k still encode correctly). Structurally monotonic —
    filled segments strictly increase with tier.
  - The ring sits in the free annulus between the glyph extents (~r 8)
    and the outline's inner edge (r 13.25); it never touches either.
- **Rings ON, everything else:** non-value states (hollow zero/quiet,
  dashed unanswered, pale nodata), personal pins, and the default
  visited/unvisited/personal mode are all byte-identical to shipped.
  Rings render on ramp sprites only.

### Sidebar — "Color pins by" block (`HotspotModeControl.tsx`)

- New **"Use Tier Rings"** switch row, in the shipped Use-Textures
  switch idiom (label span 0.8125rem/500 + `role="switch"` 44×24
  track, `--sr-accent` when on / `--sr-border-medium` when off, 20px
  `--sr-switch-thumb` knob), with muted explainer line (0.6875rem):
  "Adds a segmented ring per tier so pins are readable without color."
- **Placement:** below the mode pills and the activity Time-window
  reveal, above the status live region. **Revealed only while a
  non-default mode is active**, via the component's existing
  grid-rows collapse + `inert` idiom — and the `role="status"` live
  region stays OUTSIDE any inert boundary (the v0.5.92 rule already
  honored in this component).

### Sidebar — mode legend (`MapExplorer.tsx` + `HotspotModeMiniPin`)

- Rings ON: `HotspotModeMiniPin` variant `ramp` draws the same ring
  segments in its 28×40 viewBox from the shared spec (viewBox
  coordinates are the sprite coordinates, so it is literally the same
  numbers). Rings OFF: shipped minis unchanged. State/personal minis
  unchanged in both.

### Hotspot popup — mode line swatch (`MapExplorer.tsx` ~line 1150)

- Rings ON: the ramp reading's 10px square swatch becomes an ~18px
  round tier badge — bulb circle (r 12.4, fill = tier token, stroke
  `--sr-map-pin-stroke` 1.5) + the same ring segments (badge radius
  9.4, stroke width 3), from the shared spec. Rings OFF: shipped 10px
  square. Non-ramp swatch states (pale/nodata/unanswered) unchanged in
  both.

### In-view list (`HotspotModeDot`)

- **Unchanged in both states.** 9px is below the cue's resolution and
  each dot sits beside its exact value in words.

## Component Usage

- `mapPins.ts`: shared spec constant + ring drawing in
  `modeTeardropImageData` (canvas arcs via `ctx.arc` per segment).
- `MapSidebarUI.tsx` `HotspotModeMiniPin`: SVG ring paths from the
  same spec, gated on the rings boolean prop.
- Popup badge: small SVG (or shared sub-component) in the popup mode
  line, same spec, same boolean.
- `HotspotModeControl.tsx`: the switch row (shipped switch idiom, not
  the boxed `ToggleSwitch` — match the Use Textures markup at
  `MapExplorer.tsx` ~1590).
- One boolean flows to all three surfaces from `MapExplorer.tsx`; a
  re-bake of the mode sprites on toggle follows the existing theme
  `MutationObserver` re-bake path (regenerate + `updateImage`; sprite
  dimensions unchanged, as required).

## Design Tokens Applied

- **No new CSS tokens.** Ramp fills stay `--sr-hotspot-1..5`; states
  stay `--sr-hotspot-unanswered/zero/nodata/pale`; stroke stays
  `--sr-map-pin-stroke`; switch uses `--sr-accent` /
  `--sr-border-medium` / `--sr-switch-thumb`.
- Ring white `#fff` and track alpha 0.28 are **sprite-baked literals
  in the `HOTSPOT_GLYPH_*` family** (basemap-anchored GL exception;
  name them as exported constants beside `HOTSPOT_GLYPH_ON_PALE`).
  White on t1 `#2C89AA` ≈ 4.0:1, above the 3:1 non-text bar; no text
  is painted on any fill, so the dormant 4.5:1 on-fill clause stays
  dormant.

## Interaction Notes

- **Toggle:** label "Use Tier Rings"; `aria-label` "Use tier rings on
  hotspot color modes"; `role="switch"` + `aria-checked`;
  `tabIndex={0}`; explainer copy as above.
- **Persistence: PERSISTED through the storage seam** —
  `storage.getSetting`/`setSetting`, key `hotspotTierRings`, default
  off. This is the approved, logged deviation from the session-only
  county/atlas Use-Textures precedent (see `decisions.md`): a
  vision-linked accessibility preference must not be re-enabled every
  launch. Never `localStorage` directly (desktop relaunch rule).
- The toggle changes pin/legend/badge RENDERING only — it never
  triggers fetches, never touches mode state, tiers, or the activity
  pass, and never remounts the marker layer in a way that re-fits the
  map (the v0.5.59 cosmetic-toggle rule: prop-driven re-render, not a
  layer `key`).
- Kind hide/show chips, mode pills, window pills: all unchanged.

## Motion Spec

Honest restraint — this is a map-pin refinement; no new animation on
pins. One line each:

- Use Tier Rings reveal (with the mode-active block): existing
  `.sr-hotspot-reveal` grid-rows collapse, ease-out, 180ms, top-origin,
  reduced-motion → near-instant, CSS (shipped rule).
- Switch thumb/track: ease-out, 150ms, thumb slides in-place,
  reduced-motion → near-instant, CSS (matches shipped Use Textures
  switch).
- Pins/sprites on toggle: NO transition — sprites swap on re-bake,
  instant in both motion settings (GL sprites; the v0.5.91 GL-motion
  rule makes "no animation" the correct spec here).

## Content Notes

- Switch label: "Use Tier Rings" (the "Use …" prefix marks the map's
  colorblind-aid family; the noun names the actual mechanism — it is
  not a texture).
- Explainer: "Adds a segmented ring per tier so pins are readable
  without color." (mirrors the atlas explainer's sentence shape).
- No other copy changes on this surface. Docs obligations ride the
  change per the brief: ACCESSIBILITY.md's map paragraph updates to
  name the opt-in tier ring (luminance + structure + words + opt-in
  ring), plus HELP/README/website in the same change.

## Guard obligations (for The Engineer / Tester)

- FR-03 byte-identical default guard (`HotspotMarkers.test.tsx`):
  stays green — default mode and rings-off sprites untouched.
- `hotspotContrast.test.ts`: all clauses untouched (adjacency ≥1.2:1,
  ≥3:1-vs-land, nodata replacement clauses); the 4.5:1 on-fill clause
  stays dormant (geometry, not glyphs).
- NEW structural-monotonicity guard: filled-segment count strictly
  increases t1→t5, asserted against the ONE shared spec (the
  countyTextures density-test analogue); plus rings-off = shipped
  bytes.
- `entryChunk.test.ts`: stays green (`mapPins.ts` is already on the
  lazy map graph; add nothing statically reachable from `App.tsx`).
- v0.5.92 decision amendment for the Chronicler: "luminance +
  structure + words" EXTENDS to "…+ opt-in tier-ring structure for
  the ramp tiers"; texture-as-crosshatch stays rejected.
