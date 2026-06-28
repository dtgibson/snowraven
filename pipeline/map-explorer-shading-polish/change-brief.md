# Change Brief — Map Explorer Shading Polish

**Lane:** Improve (maintain) · **Target version:** 0.5.47 (patch) · **Stage 1 — The Evaluator**

## Lane verdict: Improve (confirmed)

All three items refine the v0.5.46 county/atlas shading feature already shipped in
the Map Explorer. None adds a new data source, a new map mode, or a new user action:

- **#1** is a pure JSX reorder of an existing list.
- **#2** *removes* a state combination (mutual exclusion) rather than adding one.
- **#3** is the most feature-flavored — it introduces a new *visible* behavior (the
  basemap changing appearance) — but it is automatic and tied to the existing shade
  toggles. There is no new control, setting, or affordance, so it reads as appearance
  polish on the existing feature. It would only cross into New-Feature territory if it
  were exposed as its own user toggle ("Desaturate basemap"). It is not.

This run reverses one documented design contract (CLAUDE.md: the two overlays were
"designed to coexist"), so the convention doc must be updated in the same change.
Reversing a documented choice is still refinement, not new capability. Verdict: **Improve.**

A useful dependency: once #2 lands, at most one shading ramp is ever active — which is
exactly the precondition that makes #3's "single ramp pops against grey" rationale
coherent. Sequence accordingly.

---

## The three improvements

### imp-1 — Move the "in view" list to the panel bottom

**What:** The "(sightings) in view" list is long and pushes the controls down. Move it
to the bottom of the sidebar, below the overlay controls, in every view.

**Reality (verified):** `atlasOverlayControls` renders in all four sidebars
(MapExplorer.tsx:1329 sightings, :1421 hotspots, :1655 targets, :1792 lifers). The
**sightings** sidebar is the lone outlier: it renders `InViewMarkerList` (:1312) *before*
`atlasOverlayControls` (:1329). Hotspots (:1421→:1426) and lifers (:1792→:1794) already
render controls-then-list. So this is a **consistency fix**, not a one-off.

**Approach:** In the sightings sidebar, swap the two sibling blocks so
`{atlasOverlayControls}` renders first and the `InViewMarkerList` wrapper is the last
block inside the scrollable container (1193–1331), still above the pinned stats bar
(:1333, flexShrink:0). Pure JSX reorder — no logic/state/class change. Engineer must
confirm the targets sidebar (:1655) and any list it hosts are likewise bottom-anchored,
and bring any remaining outlier into line. Do not touch `InViewMarkerList` itself.

**Files:** `frontend/src/components/MapExplorer.tsx`

**Risk:** Low. Focus order follows DOM order; the mobile focus trap re-queries focusables
every Tab (MapExplorer.tsx:284-294), so a child reorder adapts automatically. The
keyboard "Counties/Atlas in view" disclosures live in CountyLayer/AtlasLayer (map
children), a different subtree — unaffected.

**Tests:** No unit change required. Keep entryChunk.test.ts green. Optional: assert in a
jsdom test that the in-view list renders after the overlay controls.

### imp-2 — County and atlas SHADING are mutually exclusive

**What:** Turning one shading on turns the other off. Boundary *lines* may still coexist;
only the shade *fills* are exclusive.

**Reality (verified):** `shadeByBreeding` (:209) and `shadeByCounty` (:217) are plain,
session-scoped `useState(false)` — not persisted (intended; keep it so). The two shade
toggles are bare setters: `setShadeByBreeding(v=>!v)` (:1005) and
`setShadeByCounty(v=>!v)` (:1119). Cross-clear precedent already exists:
`handleToggleAtlas` (:687/690) and `handleToggleCounty` (:713/716) zero the shade when
their overlay is switched off. `atlasOverlayControls` is one shared JSX const (:961) used
by all sidebars, so editing the two onClicks fixes every view at once.

**Approach:** Add explicit cross-clearing handlers (not a `useEffect` mirror — effects
watching both flags are ambiguous about which wins and add a render). Extract the pure
rule into a tiny lib helper (e.g. `lib/shadingExclusion.ts` → `nextShadingState(which, prev)`
returning `{shadeByBreeding, shadeByCounty}`) so it is unit-testable in isolation, the way
`mapPins.ts`/`heat.ts` factor pure map logic out of components. Wire the two onClicks to
the handlers. Leave `atlasEnabled`/`countyLinesEnabled` (presence) independent. Keep the
"shade off when overlay off" behavior. Add discoverability copy (tooltip/caption) so the
"only one shading at a time" rule is visible (keep-tooltips convention).

**Heatmap z-order parity (sub-task, tied to #3's goal):** `SightingMarkers` gets
`atlasShading={atlasEnabled && shadeByBreeding}` (:2021); the heatmap-under-fill re-order
+ heatmap dim + pin dim fire **only** for atlas shading. With mutual exclusion, county
shading + heatmap mode would render the heatmap at full opacity *on top of* the county
choropleth — obscuring the very ramp #3 is trying to make pop. Default decision: extend
the under-fill/dim treatment to county shading too (parity). Confirmed visually in the #3
design consult. (In pins mode this is moot.)

**Files:** `frontend/src/components/MapExplorer.tsx`, new
`frontend/src/lib/shadingExclusion.ts` (+ test), `frontend/src/components/map/SightingMarkers.tsx`
(heatmap parity), `CLAUDE.md` (reverse the coexistence note).

**Tests:** Unit-test `nextShadingState` (atlas-on clears county, county-on clears atlas,
either-off leaves the other). Keep countyShading/mapPins/birdingStats/entryChunk green.

### imp-3 — Desaturate the basemap while any shading is active (DESIGN DECISION)

**What:** When a shading ramp is on, mute the basemap so the green county ramp (and the
purple atlas ramp) stand out; restore default colors when shading is off.

**Reality (verified):** Basemap land tints are module-private HSL consts in mapStyle.ts:
`TINT_PARK hsl(142,34%,79%)`, `TINT_WOOD hsl(146,30%,68%)`, `TINT_GRASS hsl(138,38%,89%)`,
`TINT_DEVELOPED hsl(40,14%,88%)` (:29-32), applied in `fetchTunedBaseStyle` to
`park`/`landcover_wood`/`landcover_grass`/`landuse_residential`. `base`
(positron|satellite|topo) is private `useState` in SnowMap (:53); raster layers are
`sr-satellite`/`sr-topo` (bases) and `sr-trails` (overlay), toggled by visibility.

**Mechanism (decided — engineer level):** Surgical MapLibre paint, **not** a CSS filter.
A `filter: grayscale()` on the canvas greys *everything* (pins, county/atlas fills,
heatmap, labels) and, being a uniform multiplier, does **not** raise basemap-vs-overlay
contrast — it just dims the user's data. Instead:
- Positron: `setPaintProperty(layerId,'fill-color', grey)` on the four land fills (grey =
  same lightness, S=0, derived from the exported `TINT_*` so there is one source of truth),
  each guarded by `getLayer()`; restore `TINT_*` when shading is off.
- Raster bases: `raster-saturation` = 0 on `sr-satellite`/`sr-topo`; restore to 1.
- Implement as a small map-child (e.g. `BasemapDesaturation`) rendered inside `<SnowMap>`
  alongside AtlasLayer/CountyLayer, driven by `active = shadeByCounty || shadeByBreeding`
  via `useMap().current`. Apply BOTH paths idempotently so the child needn't read the
  private `base` (positron fills are occluded under a raster base; `raster-saturation` is
  inert while a raster layer is hidden — both harmless). Re-apply on `styledata` (an
  offline/online style reload recreates layers with original colors); do NOT gate on
  `isStyleLoaded()` (sprite-registration post-mortem). Greys are theme-independent (S=0),
  so no data-theme observer is needed. Export `TINT_*` from mapStyle.ts for restore.

**Open DESIGN decisions (the user consult — see below):**
1. **Scope:** mute only the green-ish *land* fills (water stays blue, roads/labels stay) —
   surgical, keeps the map readable — vs a *fuller* greyscale that also desaturates water
   and pushes the whole base toward grey (closer to a literal "monochrome map").
2. **Strength:** full grey (S=0, max overlay pop, parks/woods become indistinguishable)
   vs a partial reduction (keeps some basemap legibility, less pop).
3. **Trails overlay:** when Trails is on, desaturate it too, or leave it colored (it is a
   user-chosen overlay)?
4. **Heatmap parity (from imp-2):** confirm the heatmap should drop under + dim for county
   shading like it does for atlas (default: yes).

**Files:** `frontend/src/lib/mapStyle.ts` (export TINT_* + grey derivation), new
`frontend/src/components/map/BasemapDesaturation.tsx`, `frontend/src/components/MapExplorer.tsx`
(render the child), `frontend/src/components/map/SightingMarkers.tsx` (heatmap parity).

**Risks:** Layer absence → guard every paint call with `getLayer()`. Style reload loses the
effect → re-apply on `styledata`. Accessibility → a muted base behind a colored overlay
must keep label legibility and overlay contrast ≥ WCAG AA (≥3:1 graphical, ≥4.5:1 text) in
both themes at 200% scale. entryChunk.test.ts must stay green (the new child + mapStyle
export must not pull maplibre/SnowMap onto the entry chunk).

**Tests:** Unit-test the grey-derivation (TINT `hsl(H,S%,L%)` → `hsl(0,0%,L%)`) incl.
malformed-input guard. jsdom/integration: active=false → original tints; active=true → grey
+ raster-saturation 0; toggle restores. Stable across base switch and theme flip.

---

## Cross-cutting (the closeout, once after all three)

- **Version:** 0.5.46 → **0.5.47** (patch). Bump BOTH `frontend/package.json` AND
  `src-tauri/tauri.conf.json` to the same version.
- **CHANGELOG.md:** one entry per item.
- **CLAUDE.md:** rewrite the overlay "designed to coexist — green vs purple ramp" note to
  describe single-active-shading + the desaturated basemap; reconcile the heatmap-re-order
  note with the new county parity; confirm the desaturation greys are the documented
  `TINT_*` hardcoded-HSL exception (not a token violation).
- **docs/HELP.md:** bottom-anchored in-view list, "only one shading at a time," auto-muted
  basemap. **README.md / website/:** refresh Map Explorer copy + version pill; any new
  screenshot must come from SYNTHETIC demo data.
- **PRIVACY_POLICY.md / ACCESSIBILITY.md:** no new tile provider or third-party request
  (desaturation reuses existing tiles) → privacy unaffected; re-confirm accessibility
  statement after the contrast check.
- **CI mirror before push (eslint FIRST):** `npm run lint` → `npm run typecheck` →
  `npm run test` → `npm run build`. The production build is the real gate; entryChunk.test.ts
  is a hard guard (vendor-maplibre must stay off the modulepreload).
- **Release hygiene:** this run does NOT run `release.sh` (Mac-only). The VM commits +
  pushes main and the `v0.5.47` tag as the final deploy step; the Mac runs `release.sh`.
  Do not leave the bump uncommitted as "release-ready."

## Suggested sequence

1. **imp-1** — lowest risk, pure JSX reorder; land and verify focus order.
2. **imp-2** — pure state logic; establishes the single-active-shading invariant for #3.
   Update CLAUDE.md's coexistence note here; add the heatmap county parity.
3. **imp-3** — resolve the design decisions (consult), then build on the single-ramp invariant.
4. **Closeout** — version bump 0.5.47, CHANGELOG/HELP/README/website, full CI mirror.

All three ship under one 0.5.47 patch to avoid three separate Mac releases.

## Out of scope / follow-ups (flag, don't silently expand)

- Mirroring imp-1 to a sidebar that turns out not to host an in-view list.
- Exposing desaturation as its own user toggle (would be New-Feature territory).
- County overlay on Species Detail / Statistics maps (already a deferred backlog item).
