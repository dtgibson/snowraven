# PR — Colorblind-Accessible Hotspot Pins (v1.0.2)

## What this does

Adds an opt-in **"Use Tier Rings"** switch to the Map Explorer's "Color pins
by" block. With a color mode active and the switch on, every ramp pin gains a
thin white ring just inside its rim, split into five fixed segments; a pin's
tier fills that many segments clockwise from the top, the remainder staying as
a faint 0.28-alpha track. Tiers then read by extent at map scale and by count
up close, with no reliance on hue or luminance discrimination. The legend's
mini pins gain the same ring and the popup's 10px square swatch becomes an
18px round tier badge, all three surfaces drawing from ONE exported geometry
spec (`HOTSPOT_TIER_ARC` in `lib/mapPins.ts`) so they cannot drift (NFR-10).
The switch is off by default and persisted through the storage seam (key
`hotspotTierRings`) — the user-approved deviation from the session-only
Use-Textures precedent, because a vision-linked reading aid should not need
re-enabling every launch.

## What deliberately does NOT change

- Rings off = the shipped sprites bit for bit (guarded op-for-op), and the
  default visited/unvisited/personal mode stays byte-identical (FR-03 guard).
- Non-value states (hollow zero/quiet, dashed unanswered, pale nodata) and
  personal pins never carry a ring, in either toggle state.
- In-view list dots (`HotspotModeDot`) unchanged in both states (9px is below
  the cue's resolution; each dot sits beside its value in words).
- No new CSS tokens; ring white `#fff` + track alpha are sprite-baked
  literals in the `HOTSPOT_GLYPH_*` family (the basemap-anchored GL
  exception). No text on pin fills, so `hotspotContrast.test.ts`'s dormant
  4.5:1 on-fill clause stays dormant.
- A toggle flip is a cosmetic in-place sprite re-bake (`updateImage`, same
  dimensions) — no fetch, no remount, no map re-fit, no popup dismissal
  (the v0.5.59 rule). No network change, so `PRIVACY_POLICY.md` is untouched.

## Files

**Implementation**
- `frontend/src/lib/mapPins.ts` — `HOTSPOT_TIER_ARC` / `HOTSPOT_TIER_BADGE` /
  `HOTSPOT_TIER_RING_COLOR` spec constants, `tierArcSegments` /
  `tierArcSegmentPath` / `rampTierOf` helpers, ring drawing in
  `modeTeardropImageData` (new optional `tierRings` param, default false).
- `frontend/src/components/map/HotspotMarkers.tsx` — `tierRings` prop threaded
  into every mode-sprite bake; flip re-bakes in place.
- `frontend/src/components/map/HotspotModeControl.tsx` — the "Use Tier Rings"
  switch row (shipped Use-Textures switch idiom), revealed only while a
  non-default mode is active via the grid-rows collapse + `inert` idiom; the
  `role="status"` live region stays outside every inert boundary.
- `frontend/src/components/map/MapSidebarUI.tsx` — `HotspotModeMiniPin`
  `rings` prop (ramp minis only) + new `HotspotTierBadge` popup badge, both
  drawing spec-derived paths.
- `frontend/src/components/MapExplorer.tsx` — persisted state + hydration
  through the storage seam, the toggle handler, and the one boolean flowing to
  control, marker layer, legend minis, and popup badge.

**Tests**
- `frontend/src/lib/hotspotTierRings.test.ts` (NEW) — the
  `countyTextures.test.ts` analogue: spec literals pinned, filled-segment
  count = tier and strictly monotonic, annulus clearances (glyph ~r8 /
  rim inner edge 13.25), rings-off byte-identity via a recording 2D context
  (flag omitted = flag false = shipped, op for op; red-first verified against
  two mutations), non-value invariance under rings-on, surgical ring-block
  insertion between teardrop stroke and glyph, and legend-mini/popup-badge
  paths string-equal to the spec-derived geometry.
- `frontend/src/components/map/HotspotMarkers.test.tsx` — additive: the flag
  reaches every bake (default false), a flip re-bakes via updateImage with no
  re-fit. FR-03 pinned literals untouched.
- `frontend/src/components/map/HotspotModeControl.test.tsx` — additive: switch
  revealed per non-default mode, collapsed + inert in default, status region
  outside every inert boundary, label/explainer/aria contract, both toggle
  directions dispatched.

**Docs (same change, per CLAUDE.md)**
- `docs/HELP.md` — "Use Tier Rings (colorblind aid)" paragraph in the Color
  pins by section.
- `README.md` — Map Explorer bullet names the opt-in switch.
- `website/index.html` — feature prose + version pill/footer to v1.0.2.
- `ACCESSIBILITY.md` — the map paragraph now claims the structural tier
  reading (true as shipped); the Use-Textures paragraph names the pin-scale
  sibling and why it is segments, not texture.

**Version**
- `frontend/package.json` AND `src-tauri/tauri.conf.json`: 1.0.1 → 1.0.2
  (patch). `CHANGELOG.md` entry added. Nothing committed or pushed — the
  deploy stage owns git.

## How to test

1. `cd backend && uvicorn main:app --reload --port 1620`, and in another
   terminal `cd frontend && npm run dev`; open http://localhost:5173.
2. Map Explorer → Hotspots view → Find Hotspots.
3. In "Color pins by", pick **My species** (or My checklists / Recent
   activity). A "Use Tier Rings" switch appears below the mode pills (and
   below the Time window row in Recent activity), above the status line.
4. Switch it on: ramp pins gain the segmented ring (count the segments
   against the legend row values); legend minis gain the same ring; click a
   ramp pin — the popup swatch is now a round segmented badge. Hollow,
   dashed, pale, and personal pins are unchanged.
5. Switch back to **Visited status**: the row collapses; pins are the shipped
   default.
6. Reload the app with the switch left on, re-run a search, activate a mode:
   the rings come back on without touching the switch (persistence).
7. Verify no reframe: with a popup open, flip the switch — the map must not
   move and the popup must stay open.

## Notes for reviewer

- The rings-off byte-identity guard uses a recording 2D context (jsdom has no
  canvas): identical op streams on the same context are identical pixels, and
  the recorder localizes any drift to the exact operation. It was proven red
  against an unconditional-ring mutation and an off-by-one fill mutation.
- The sprites are baked with the ring whenever the persisted flag is on, even
  in default mode — harmless because ramp sprites are only referenced while a
  mode is active, and it keeps the bake independent of mode state.
- `weft-design-lint check src/`: 0 warns; all notes pre-existing (the
  `#000000` in mapPins.ts is v0.5.92's fail-loud token-missing sentinel; the
  motion notes are the tool not seeing the global reduced-motion CSS block,
  which does cover the new switch and reveal transitions).

---

## Seeing Tier Rings locally

1. Open a terminal in your project folder.

2. Start the desktop app in dev mode:
   `cd frontend && npm run desktop:dev`
   (or for the web version: start the backend with
   `cd backend && uvicorn main:app --reload --port 1620`, then in a second
   terminal `cd frontend && npm run dev` and open http://localhost:5173)

3. Go to the **Map Explorer** tab and pick the **Hotspots** view in the
   sidebar.

4. Press **Find Hotspots** (use your saved center, or type a place name).

5. In the **Color pins by** block, click **My species**. The pins recolor
   onto the blue ramp, and a new **Use Tier Rings** switch appears just
   below the mode buttons.

6. Turn the switch on. What to look for:
   - Every blue ramp pin gains a thin white ring split into five segments;
     darker pins carry more filled segments (a tier-5 pin closes the ring).
   - The legend's little pins show the same rings beside their number
     ranges.
   - Click a blue pin: the popup's small color square is now a round badge
     with the same segments.
   - Hollow pins, dashed gray pins, pale pins, and orange personal stars
     look exactly as before.

7. Turn the switch off: everything returns to the exact shipped look.

8. Quit and relaunch the app, run a search, and pick a color mode again:
   the switch remembers your last choice, so if you left it on, the rings
   are already there.
