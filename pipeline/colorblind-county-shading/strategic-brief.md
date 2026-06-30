# Strategic Brief — Colorblind-Accessible County Shading

## What We're Building
An optional crosshatch/texture fill for the Map Explorer's county
shading, where pattern density increases with the recorded count
(tier 1 = sparse hatch … tier 10 = tight crosshatch), so the
choropleth reads without relying on hue or luminance.

## Why Now
County shading just landed (v0.5.46–v0.5.50) on a single-hue green
ramp whose top steps are deliberately subtle — legible by design
only at ~1.2:1 adjacency, which is exactly where color-alone
encoding fails colorblind and low-vision birders. SnowRaven already
ships this remedy for its other Map Explorer choropleth — the
atlas overlay's "Use Textures" toggle (v0.5.2) — so the county ramp
is the one shading surface still missing a color-independent read.
Closing that gap brings the two mutually-exclusive ramps to parity
and keeps the published WCAG 2.1 AA posture true to the shipped app.

## The User Problem
A birder with red-green color vision deficiency (or anyone on a
glary screen) looking at the county overlay can see *that* counties
differ but can't reliably rank them — the 10-step green ramp
compresses to a few indistinguishable shades, and the high-count
counties at the subtle end are the hardest to tell apart even for
sighted users. The data is there; the encoding is the barrier.

## Success Criteria
- A county's count tier is readable WITHOUT relying on color —
  density alone communicates "more recorded here."
- Pattern density tracks the recorded count monotonically across
  all 10 tiers (sparse → dense), with no two adjacent tiers
  visually ambiguous.
- The affordance is consistent with the atlas overlay's existing
  "Use Textures" toggle — same mental model, same vocabulary.
- Off by default; the plain color ramp stays the default view.
- Works correctly in both light and dark themes.
- The legend communicates the density→count mapping, and the
  encoding is reachable via keyboard/AT (parity with the existing
  county "counties in view" disclosure).

## Scope
- A texture/pattern fill option on the Map Explorer **county**
  shading, covering BOTH metrics it already supports (species count
  AND records/checklists).
- Pattern density keyed to the existing 10 data-driven county
  quantile tiers (`--sr-county-1..10`) — density encodes tier.
- A legend treatment showing the density ramp alongside (or in
  place of) the color swatches when textures are on.
- An off-by-default toggle, mirroring the atlas "Use Textures"
  control.
- Keyboard and assistive-technology parity for the textured view.

## Out of Scope
- Extending county shading to the Species Detail or Statistics maps
  (a separate "On the Horizon" roadmap item — keep distinct).
- Changing the atlas overlay's existing hatch textures or its
  toggle.
- New or recolored county ramps / additional color classes.
- Non-US county boundaries.
- Per-species county choropleths or any new shading metric.

## Key Decisions
- Mirror the atlas implementation: canvas `ImageData` sprites added
  via `map.addImage(...)` and referenced from a `fill-pattern`
  layer (the `lib/atlasTextures.ts` + `AtlasLayer` approach), NOT
  an SVG `<pattern>` — MapLibre fills can't use SVG fragments.
- Density (line spacing / crosshatch tightness), not just hue,
  carries the tier — so the read survives with hue and luminance
  discrimination removed.
- Regenerate + re-add sprites on a `data-theme` change via a
  `MutationObserver`, same contract as the atlas hatches and the
  county fill's runtime token re-resolve.
- Preserve the two existing county-overlay behaviors intact: the
  mutual exclusivity with atlas breeding shading
  (`nextShadingState`) and the basemap desaturation that activates
  while any ramp is on.
- Toggle is session-scoped `useState`, off by default — same as
  the atlas textures (no persistence required for v1).
- Add a WCAG-AA / pattern-legibility guard in the spirit of
  `countyContrast.test.ts`: prove adjacent tiers are
  density-distinguishable in both themes so a future tweak fails
  the suite, not the user's eyes.
