# PRD — Atlas Shade by Breeding Code
**Feature:** atlas-shade-by-breeding-code
**Date:** 2026-06-01
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview
A second Map Explorer toggle, "Shade by My Highest Breeding Code," shown only when the atlas blocks overlay is on. When enabled, each atlas block the user has personally recorded a breeding code in is filled with that block's highest breeding-code tier, shown both as the tier's translucent purple AND as a distinct per-tier texture pattern so the level is readable without relying on color (colorblind-accessible). It visualizes the user's personal breeding-evidence coverage by block.

## User Stories

> **US-01** — As a California atlaser, I want my atlas blocks tinted by the highest breeding code I've recorded in each, so I can see my breeding-evidence coverage at a glance.

> **US-02** — As a user, I want it to be clear this reflects only my own entered breeding codes, not all observers', so I don't misread it as official atlas data.

> **US-03** — As a user, I want to click a shaded block and see its highest code and how many of my breeding records are there.

> **US-04** — As a user with no eBird backup loaded, I want the toggle to tell me it needs my data rather than silently doing nothing.

## Functional Requirements

**Toggle & gating**
> **FR-01** — A "Shade by My Highest Breeding Code" toggle shall appear in the Map Explorer only while the atlas blocks overlay is enabled; it shall default to off, and reset/hide when the atlas overlay is turned off.
> **FR-02** — The toggle shall carry a caption stating it is based only on the user's personally entered breeding codes (e.g. "Based only on breeding codes you've personally entered").
> **FR-03** — When no eBird backup is loaded (no breeding data available), the toggle shall be disabled with a brief note to load the backup in Settings, rather than enabling with no effect.

**Data: highest breeding tier per block**
> **FR-04** — From the user's eBird observations that have a breeding code and coordinates, the app shall determine, for each atlas block, the highest breeding-code **tier** (4 > 3 > 2 > 1 per `BREEDING_CODES`) among the user's records falling within that block.
> **FR-05** — Each breeding observation shall be assigned to the atlas block whose rectangle contains its coordinates (blocks are a regular quad-derived grid; a point maps to at most one block). Observations outside California atlas coverage contribute to no block.
> **FR-06** — Only blocks with at least one of the user's breeding records shall be shaded; all other blocks remain outline-only.

**Rendering**
> **FR-07** — When the shade toggle is on, each recorded block shall be filled with a translucent tint of its highest tier's color, using the existing tier tokens (`rgba(var(--sr-tier-N-rgb), α)`), so block outlines, map tiles, and pins remain readable.
> **FR-08** — Block interiors shall remain clickable when shaded (preserving the v0.5.0 click-to-open behavior).
> **FR-09** — Clicking a shaded block's popup shall additionally show the block's highest breeding code (its label) and the count of the user's breeding records within the block, alongside the existing block name + eBird link.
> **FR-10** — Turning off either the shade toggle or the atlas overlay shall remove the tint; with shade off, atlas blocks render exactly as in v0.5.0.

**Colorblind accessibility**
> **FR-11** — Each tier shall be distinguishable **without color alone**. Each of the four tiers shall carry a distinct texture/hatch pattern (e.g. progressively denser hatching from tier 1 → tier 4, or distinct pattern styles per tier) applied to the block fill, so the breeding level is legible in grayscale / for colorblind users. The tier color remains as a redundant cue, and the exact code is always available in the block popup (FR-09).
> **FR-12** — If a legend is shown (see Designer), it shall present both the color and the texture for each tier so the texture↔tier mapping is learnable.

## Non-Functional Requirements

> **NFR-01 — Performance:** The per-block highest-tier mapping shall be computed efficiently (a single pass over the user's breeding observations, not a per-block scan) and only viewport blocks are rendered. No noticeable lag toggling or panning.
> **NFR-02 — Reuse & consistency:** Reuse `BREEDING_CODES` tiers and `--sr-tier-*` colors so shading matches the breeding-code colors elsewhere in the app. No new color system.
> **NFR-03 — Theming & accessibility:** The toggle uses the existing switch pattern (`role="switch"`, `aria-checked`, `tabIndex={0}`); tints work in light and dark via the tier RGB tokens. Breeding level must not be conveyed by color alone (see FR-11) — the texture pattern is the primary non-color channel and must remain distinguishable in both themes.
> **NFR-04 — No regression:** Atlas overlay behavior with shade off, the breeding-codes tab, pins, and other map modes are unchanged.

## Out of Scope
- Atlas-wide / all-observer breeding data (unavailable).
- Atlases other than California.
- Changing breeding-code tier definitions or the Breeding Codes tab.
- A legend/scale UI for the tiers (may be a later refinement; not required for v1).

## Open Questions
- **Point-to-block mapping precision.** Blocks are axis-aligned quad/6 rectangles, so a point maps to a block by quad-grid math + the gazetteer. *Default if unresolved by Stage 5:* The Architect specifies the `pointToBlockCode(lat,lng)` derivation using the existing scheme/gazetteer; observations whose computed quad isn't in the gazetteer contribute to no block.
- **Tint alpha.** *Default:* ~0.35–0.5, tuned by the Designer so all four tiers are distinguishable yet translucent.
- **Texture mechanism & pattern set.** SVG hatch/texture patterns per tier on Leaflet vector fills (via `<pattern>` defs referenced by the path fill, or the `leaflet.pattern` approach). *Default if unresolved by Stage 5:* The Architect picks the implementation and the Designer defines the four patterns (must be distinct in grayscale and at small block sizes); patterns should degrade gracefully (still color-tinted) if a pattern can't render.

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Toggle gated on atlas (FR-01) | Shade toggle appears only when atlas blocks on; default off; removed when atlas off |
| QA-02 | Personal-data copy (FR-02) | Label + caption make clear it's the user's own entered codes |
| QA-03 | No-backup handling (FR-03) | With no backup loaded, the toggle is disabled with a load-backup note |
| QA-04 | Highest tier per block (FR-04, FR-05) | A block with multiple personal codes shades to the highest tier present; point lands in the correct block |
| QA-05 | Only recorded blocks shaded (FR-06) | Blocks with no personal breeding record stay outline-only |
| QA-06 | Tier-colored translucent fill (FR-07, NFR-02) | Shaded blocks use the matching `--sr-tier-N` purple, translucent; outlines/pins still readable; light + dark correct |
| QA-07 | Interiors still clickable (FR-08) | Clicking inside a shaded block opens its popup |
| QA-08 | Popup detail (FR-09) | Shaded block popup shows highest code label + count of the user's records, plus name + eBird link |
| QA-09 | Toggle off removes tint (FR-10) | Turning shade off (or atlas off) returns to v0.5.0 outline rendering |
| QA-10 | Performance (NFR-01) | Toggling/panning with shading on stays responsive on a real backup |
| QA-11 | No regression (NFR-04) | Atlas-off rendering, pins, other modes, breeding-codes tab unchanged; suite green |
| QA-12 | Colorblind / non-color encoding (FR-11) | Each tier has a distinct texture pattern; tiers are distinguishable in grayscale (verify e.g. desaturated screenshot) and in light + dark |

**Verification note:** Live checks (QA-04–08) need an eBird backup containing California breeding-coded observations (the atlas is California-only). The mapping logic (`pointToBlockCode`, highest-tier reduce) is unit-testable independent of the map.
