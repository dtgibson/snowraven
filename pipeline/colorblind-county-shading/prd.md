# PRD — Colorblind-Accessible County Shading

**Feature:** colorblind-county-shading
**Date:** 2026-06-29
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

An optional "Use Textures" mode for the Map Explorer's county shading that
encodes each county's count tier as a pattern density (sparse hatch → tight
crosshatch) instead of relying on the single-hue green ramp alone. It is the
color-independent read for the county choropleth, bringing it to parity with the
atlas overlay's existing "Use Textures" toggle.

---

## User Stories

> **US-01** — As a birder with red-green color vision deficiency, I want county
> tiers shown as pattern density, so that I can rank counties by how much I've
> recorded there without relying on hue or brightness.

> **US-02** — As a Map Explorer user, I want a "Use Textures" toggle on the county
> shading that works the same way as the atlas overlay's, so that I don't have to
> learn a new control.

> **US-03** — As a user who reads the plain color ramp fine, I want textures off
> by default, so that my normal view is unchanged unless I opt in.

> **US-04** — As a keyboard or screen-reader user, I want the density-to-count
> mapping available in the legend and the "counties in view" disclosure, so that I
> can understand the encoding without seeing the map fills.

> **US-05** — As a dark-mode user, I want the textures to stay legible after I
> switch themes, so that the pattern doesn't wash out or disappear.

> **US-06** — As a user comparing coverage, I want textures to keep working when I
> switch the county metric between species and records, so that the density always
> reflects what I'm currently measuring.

---

## Functional Requirements

### Area A — Toggle and availability

> **FR-01** — The app shall provide a "Use Textures" toggle on the Map Explorer
> county shading controls, using the same label and placement pattern as the atlas
> overlay's existing "Use Textures" toggle.

> **FR-02** — The toggle shall be meaningful only while county shading is active.
> When county shading is off, the app shall not render any county texture fill, and
> the toggle shall be hidden or disabled so it cannot produce a textured view with
> no underlying shading.

> **FR-03** — The toggle shall default to off on every fresh load. The plain color
> quantile ramp shall remain the default county-shading view.

> **FR-04** — Enabling the toggle shall render county fills as density patterns;
> disabling it shall return to the plain color quantile ramp with no other change
> to map state (zoom, pan, metric, popup, boundary lines).

### Area B — Density encoding

> **FR-05** — The app shall map each of the 10 county quantile tiers
> (`--sr-county-1..10`) to a distinct pattern density, increasing monotonically
> from sparse (tier 1) to tight crosshatch (tier 10).

> **FR-06** — No two adjacent tiers shall be visually ambiguous by density: each
> tier's pattern shall be distinguishable from the tier immediately above and below
> it.

> **FR-07** — Tier rank shall be readable from density alone, without depending on
> hue or luminance (i.e., the encoding survives when color discrimination is
> removed, such as a grayscale rendering).

> **FR-08** — Counties with no records (tier 0) shall remain plain outlines and
> shall never receive a texture fill, matching their no-fill treatment in the plain
> color ramp.

### Area C — Metric coverage

> **FR-09** — Textures shall apply to both county metrics the overlay already
> supports: species count and records/checklists. The density shall key to the
> tiers of whichever metric is active.

> **FR-10** — Switching the metric (species ↔ records) while textures are on shall
> re-tier the counties and re-render the density for the new metric without turning
> textures off.

### Area D — Theme behavior

> **FR-11** — Textures shall render legibly in both light and dark themes, with the
> pattern color following the active theme's county tokens.

> **FR-12** — Switching the theme while textures are on shall refresh the textured
> render so it stays legible, with no stale, invisible, or wrong-theme pattern
> persisting.

### Area E — Legend

> **FR-13** — While textures are on, the legend shall communicate the density →
> count-tier mapping (a density ramp), in place of or alongside the color swatches,
> so a user can read which density means "more recorded here."

> **FR-14** — The legend shall reflect the currently active metric label (species
> or records) while textures are on.

### Area F — Accessibility

> **FR-15** — The textured county encoding shall be reachable via keyboard and
> assistive technology through the existing county "counties in view" disclosure
> (or an equivalent), conveying each county's tier without relying on color.

> **FR-16** — The "Use Textures" toggle shall be a labeled control with an
> accessible name and a pressed/selected state reflecting whether textures are on.

### Area G — Interaction with existing overlay behavior

> **FR-17** — Mutual exclusivity of the two shading ramps shall be preserved.
> Enabling atlas breeding shading while county textures are on shall clear county
> shading (and therefore its textures), and enabling county shading shall clear
> atlas breeding shading — per the existing `nextShadingState` rule.

> **FR-18** — While county textures are on, the existing "a ramp is active"
> behaviors shall remain in effect: the basemap land mutes to grey and the heatmap
> re-orders beneath the active county fill and dims.

> **FR-19** — In the over-cap / zoomed-out state (the "Zoom in to see counties"
> condition), the app shall draw no county fills (textured or color) and shall show
> the same hint chip; the texture toggle state shall be retained so the textured
> view returns when the user zooms back in.

> **FR-20** — Texture mode shall not change county boundary lines, the county
> popup, the (state, county) join, or the viewport windowing — only the fill
> rendering of shaded counties changes.

---

## Non-Functional Requirements

> **NFR-01 — Accessibility:** The feature shall uphold the published WCAG 2.1 AA
> posture. Adjacent tiers shall be density-distinguishable in both light and dark
> themes, and this shall be locked by a pattern-legibility guard test in the spirit
> of `countyContrast.test.ts` so a future tweak fails the suite rather than the
> user's eyes.

> **NFR-02 — Privacy and network:** The feature shall be a pure client-side render
> option. It shall add no network calls, no new tile/data providers, no bundled
> data, no telemetry, and no new privacy surface. `PRIVACY_POLICY.md` shall require
> no change.

> **NFR-03 — Consistency:** The texture mechanism shall mirror the atlas overlay's
> approach — canvas `ImageData` sprites registered via `map.addImage` and
> referenced from a MapLibre `fill-pattern` layer (not SVG `<pattern>`), with
> sprite colors read from the `--sr-county-*` tokens at generation time and
> regenerated/re-added on a `data-theme` change via a `MutationObserver`, the same
> contract as the atlas hatches and the county fill's runtime token re-resolve.

> **NFR-04 — Performance:** Texture rendering shall stay within the existing county
> viewport cap and shall not introduce a per-county DOM marker. Sprite generation
> shall happen on mount and on a theme change, not per frame or per `moveend`.

> **NFR-05 — Compatibility:** The feature shall work identically on the desktop
> (Tauri) and web/Pi builds, in both themes, and at the app's responsive
> breakpoints, including 200% in-app text scale.

> **NFR-06 — Scope and persistence:** The toggle shall be session-scoped React
> state, off by default, with no persistence in v1 (matching the atlas textures
> control).

---

## Out of Scope

- Extending county shading or its textures to the Species Detail or Statistics
  maps (a separate roadmap item).
- Changing the atlas overlay's existing hatch textures or its toggle.
- New, recolored, or additional county color classes / ramps.
- Non-US county boundaries.
- Per-species county choropleths or any new county shading metric.
- Persisting the texture toggle across relaunch/reload (deferred to a later
  version).
- A standalone "textures everywhere" or global accessibility preference; this is
  the county overlay's own toggle only.

---

## Open Questions

**OQ-01 — Legend treatment: replace the color swatches with density swatches, or
show both?**
Default assumption: while textures are on, the legend shows density swatches in
place of the color swatches (mirroring how the atlas legend swaps to a hatch
preview), keeping the tier ordering and the active metric label. If both are
wanted, the color swatch stays as a secondary cue but density leads.

**OQ-02 — Does the textured fill keep a faint tier color tint under the pattern,
or sit on a neutral/transparent base?**
Default assumption: keep a faint tier tint beneath the pattern (matching the atlas
hatch-over-translucent-color treatment), but density is the load-bearing
encoding — the tier must be fully readable with the tint ignored.

**OQ-03 — How sparse is tier 1 (the lowest non-zero tier)?**
Default assumption: tier 1 is sparse but clearly present, so it reads as distinct
from a tier-0 plain-outline county and from no fill at all, while leaving room for
nine denser steps above it.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Toggle present and mirrors atlas (FR-01) | A "Use Textures" toggle appears on the county shading controls, matching the atlas toggle's label, placement, and control style. |
| QA-02 | Toggle meaningful only when shading on (FR-02) | With county shading off, no county texture fill renders and the toggle is hidden or disabled; a textured fill is impossible without active county shading. |
| QA-03 | Off by default (FR-03) | On a fresh load, textures are off and the plain color quantile ramp is the county-shading view. |
| QA-04 | Enable/disable round-trips cleanly (FR-04) | Toggling on renders density patterns; toggling off restores the exact plain color ramp with zoom, pan, metric, popup, and boundary lines unchanged. |
| QA-05 | Monotonic density across 10 tiers (FR-05) | Tiers 1–10 render at strictly increasing pattern density from sparse to tight crosshatch, one density per tier. |
| QA-06 | Adjacent tiers unambiguous (FR-06) | Each tier's density is visually distinct from its neighbors above and below; the guard test asserts adjacency distinguishability in both themes. |
| QA-07 | Color-independent read (FR-07) | Rendered (or test-sampled) in grayscale, every tier's rank is still readable from density alone. |
| QA-08 | Tier-0 stays plain (FR-08) | Counties with no records render as plain outlines with no texture fill, the same as in the color ramp. |
| QA-09 | Both metrics textured (FR-09) | With textures on, both the species metric and the records/checklists metric render density keyed to that metric's tiers. |
| QA-10 | Metric switch keeps textures (FR-10) | Switching species ↔ records with textures on re-tiers and re-renders density without turning textures off. |
| QA-11 | Legible in both themes (FR-11) | Textures render legibly in light and dark themes, with pattern color following the theme's county tokens. |
| QA-12 | Theme switch refreshes texture (FR-12) | Switching theme with textures on refreshes the render; no stale, invisible, or wrong-theme pattern remains. |
| QA-13 | Legend shows density mapping (FR-13) | With textures on, the legend shows a density ramp communicating density → count tier. |
| QA-14 | Legend reflects metric (FR-14) | The legend's metric label matches the active metric (species or records) while textures are on. |
| QA-15 | Keyboard/AT parity (FR-15) | The textured encoding is reachable via the "counties in view" disclosure (or equivalent), conveying tier without color, by keyboard and screen reader. |
| QA-16 | Accessible toggle (FR-16) | The toggle has an accessible name and a pressed/selected state reflecting on/off. |
| QA-17 | Mutual exclusivity preserved (FR-17) | Enabling atlas breeding shading while county textures are on clears county shading and its textures; enabling county shading clears atlas shading — per `nextShadingState`. |
| QA-18 | Ramp-active behaviors hold (FR-18) | With county textures on, the basemap land is greyed and the heatmap is re-ordered beneath the county fill and dimmed. |
| QA-19 | Over-cap state correct (FR-19) | In the "Zoom in to see counties" state, no county fills draw and the hint chip shows; the texture toggle state is retained for when the user zooms back in. |
| QA-20 | Non-fill behavior untouched (FR-20) | Boundary lines, county popup, the (state, county) join, and viewport windowing are unchanged when textures are on. |
| QA-21 | No new network/privacy surface (NFR-02) | A build/inspection shows no new network call, provider, bundled data, or telemetry from the feature; `PRIVACY_POLICY.md` is unchanged. |
| QA-22 | Legibility guard test exists (NFR-01, NFR-03) | A pattern-legibility guard test (spirit of `countyContrast.test.ts`) asserts monotonic, adjacency-distinguishable density across tiers 1–10 in both themes and fails on a regression. |
| QA-23 | Performance constraints (NFR-04) | No per-county DOM marker is added; sprites generate on mount and theme change only, not per frame or per `moveend`; render stays within the county viewport cap. |
| QA-24 | Session-scoped, no persistence (NFR-06) | The toggle resets to off after a reload/relaunch; nothing about texture state is persisted in v1. |
