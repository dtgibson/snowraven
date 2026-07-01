# Change Brief — Sighting Point Visibility

## What is changing
The Map Explorer's My Sightings map gets a new session-only **Point Size**
control (a `SegControl`: **Normal / Small / Off**) that lets the user shrink
or hide the sighting POINTS so they don't obscure a shaded breeding-block or
county choropleth. Today the only display choice is the Pins ⇄ Heatmap
`SegControl` under "Map View" (`MapExplorer.tsx:1341`); when a shade ramp is
active the pins already auto-dim to `ATLAS_DIM_FACTOR` (0.25) and the heatmap
re-orders under the fill + dims (`SightingMarkers.tsx:164-172`, `:146-157`).
This extends that automatic fade into an explicit, user-driven option: the
control governs the `sr-sight-circle` GL layer's radius/opacity (via
`lib/mapPins.ts` `pinFillRadiusExpr`/`pinOpacityExpr`) in **Pins** mode. It
applies to POINTS only; the Heatmap keeps its existing auto-dim behavior.

## Why now
The user reports that in Pins (and Heatmap) mode the sighting markers "interfere
or make it hard to see" when examining shaded breeding-code blocks or shaded
counties. The existing auto-dim (v0.5.47, `shadingFillId`) helps but is not
user-controllable and can't fully hide points — the user asked specifically for
an *option* to make points "very small or hide them altogether."

## User-facing impact
There IS user-facing impact: a **new "Point Size" `SegControl`** in the My
Sightings sidebar (Normal / Small / Off), rendered next to the existing
"Map View" Pins/Heatmap control. Default **Normal** ⇒ zero change for existing
users unless they opt in. **Off** hides the `sr-sight-circle` layer entirely
(and its popup/click target); **Small** shrinks the circle radius. No new copy
voice or design judgment beyond matching the shipped sidebar patterns
(`SegControl`, `SidebarLabel`, `aria-pressed`). No new data, schema, page, or
network call. `docs/HELP.md` (line 233), `README.md`, and `website/` must be
updated to describe the new control (per CLAUDE.md docs rules).

## Decisions touched
- **v0.5.47 (single-active-shading + auto-muted basemap):** this builds directly
  on the `SightingMarkers` `shadingFillId` string and the pins-fade /
  heatmap-under-fill behavior. Point Size composes with (does not replace) the
  auto-dim — e.g. "Small" + active shade still multiplies opacity by the dim
  factor. Chronicler should log this as an *extension*, not a reversal.
- Calibration note (not touched, but relevant): v0.5.47 records that a
  "Desaturate basemap" *user toggle* was deliberately NOT exposed to stay in the
  Improve lane. This control is safely on the Improve side of that line — it is a
  visibility refinement of an existing surface (points already fade), not a new
  capability or a new brand/design call.

## What done looks like
- A **Point Size** control (Normal / Small / Off) appears in the My Sightings
  sidebar; **Off** removes the sighting points + their popup; **Small** shrinks
  them; **Normal** is unchanged from today. It composes with the shade auto-dim.
- Session-only (plain `useState`, no `storage` seam), matching displayMode /
  shade state; resets on relaunch. Version bumped + CHANGELOG/HELP/README/website
  updated; `npm run build` + vitest green.
