# QA Report — Colorblind-Accessible County Shading ("Use Textures")

**Date:** 2026-06-29
**Lane:** Feature (Stage 6 — The Tester)
**Feature:** colorblind-county-shading
**Test Runner:** vitest (frontend) + tsc + eslint + vite build (full CI mirror)
**Version under test:** 0.5.51 (package.json + tauri.conf.json — matched)
**Result:** PASSED (pass-with-manual-notes)

---

## Verdict

**PASS — all 24 success metrics satisfied.** 7 verify statically from the shipped
unit test / build / code; 14 hold by construction (the wiring guarantees them);
3 are runtime-visual properties that warrant a human spot-check before the Deploy
gate but are de-risked by the Designer's `design.html` proof and the
theme-independent density guard. No failing tests, no regressions, do-not-touch
list respected, no new privacy/network surface.

---

## Test Suite Results

Full CI mirror (run independently by the orchestrator, re-confirmed from the diff):

- `npm run lint` (eslint .) — clean, exit 0
- `npm run typecheck` (tsc --noEmit) — clean, exit 0
- `npm run test` (vitest run) — **1173 passed / 1173 total, 100 files**, exit 0
  - includes the NEW `frontend/src/lib/countyTextures.test.ts` (5 tests)
  - the UNTOUCHED `countyContrast.test.ts` and `entryChunk.test.ts` (6) stay green
  - `CountyLayer.test.tsx` (admin_level-6 line / bundled maxzoom cap / offline-omit)
    still green after being hardened for the new sprite effect
- `npm run build` (tsc -b && vite build) — success, exit 0, 2479 modules.
  `vendor-maplibre` (1,027 KB) and `us-counties` (3,786 KB) remain SEPARATE
  on-demand chunks, NOT in `dist/index.html` modulepreload (entry-chunk guard green).

0 failing. No regression in the existing suite.

---

## Acceptance Criteria Verification (QA-01..24)

Status key: **PASS (static)** = proven now by test/build/code · **PASS (construction)**
= guaranteed by the wiring (mechanism cited) · **MANUAL** = runtime-visual, recommend
human spot-check.

| ID | Criterion | Status | Evidence |
|---|---|---|---|
| QA-01 | Toggle present, mirrors atlas (FR-01) | ✓ PASS (construction) | County "Use Textures" toggle at `MapExplorer.tsx:1181-1205` is byte-for-byte the same control pattern as the atlas toggle (`:1055-1089`): same label, `role="switch"`, `aria-checked`, 44×24 pill, placed inside the county shading controls. |
| QA-02 | Meaningful only when shading on (FR-02) | ✓ PASS (construction) | The toggle row only renders inside `{shadeByCounty && backupReady && (…)}` (`:1170`), so it is hidden when shading is off. The fill never textures unless `useHatch = useTextures && shadeOn` (`CountyLayer.tsx:250`); `shadeOn = shade && !!aggregates`. A textured fill with no active shading is structurally impossible. |
| QA-03 | Off by default (FR-03) | ✓ PASS (static) | `const [useCountyTextures, setUseCountyTextures] = useState(false)` (`MapExplorer.tsx:230`). Default fill branch is the color quantile ramp (`CountyLayer.tsx:260-266`). |
| QA-04 | Enable/disable round-trips cleanly (FR-04) | ✓ PASS (construction) + MANUAL visual | Only `fillPaint` switches branch on `useHatch` (`CountyLayer.tsx:251-266`); the `Source` data, both line layers, the `<Popup>` state, metric, zoom/pan are untouched, so disabling restores the identical color ramp. Recommend a quick visual confirm of the exact restore. |
| QA-05 | Monotonic density across 10 tiers (FR-05) | ✓ PASS (static) | `countyTextures.test.ts` "strictly monotonic increasing" asserts `countyHatchDensity(n) > countyHatchDensity(n-1)` for n=2..10 over the shipped `HATCH` curve. |
| QA-06 | Adjacent tiers unambiguous (FR-06) | ✓ PASS (static) + MANUAL visual | `countyTextures.test.ts` asserts adjacency ratio ≥ 1.12 (actual min ~1.195 at 7→8). Density is geometry, so the guard covers both themes. On-map tier-1-vs-tier-10 separation worth a glance (de-risked by `design.html`). |
| QA-07 | Color-independent read (FR-07) | ✓ PASS (static) | Encoding metric `countyHatchDensity(tier) = lineWidth/gap` is hue- and luminance-independent; the monotonic + adjacency tests prove rank survives color removal. `design.html` includes a grayscale proof. |
| QA-08 | Tier-0 stays plain (FR-08) | ✓ PASS (construction) | Texture branch `fill-opacity: ['case', ['>', ['get','tier'], 0], 1, 0]` (`CountyLayer.tsx:258`) hides tier 0 entirely; the `match` default arm maps tier 0 to a valid image but opacity 0 makes it a plain outline — same as the color branch. |
| QA-09 | Both metrics textured (FR-09) | ✓ PASS (construction) | The fill-pattern keys on `tier`, which is computed from `countyMetricValue(agg, metric)` (`CountyLayer.tsx:151`) for whichever metric is active; the texture path is metric-agnostic. |
| QA-10 | Metric switch keeps textures (FR-10) | ✓ PASS (construction) | `countyMetric` and `useCountyTextures` are independent state. Switching metric re-memos `countyTiers` (`MapExplorer.tsx:771-774`) and `tierForCounty`/`fc` (deps include `metric`), re-rendering density; `useCountyTextures` is never reset. |
| QA-11 | Legible in both themes (FR-11) | MANUAL (visual) | Sprite tint/stroke read `--sr-county-N-rgb` at generation (`countyTextures.ts:69-73`); ramp is identical in both themes by design. On-map legibility in dark mode is a visual property — spot-check, de-risked by the theme-independent density. |
| QA-12 | Theme switch refreshes texture (FR-12) | ✓ PASS (construction) + MANUAL | `MutationObserver` on `data-theme` calls `addAll()` (regenerate + `updateImage` the sprites) and bumps `themeRev` to re-render (`CountyLayer.tsx:229-231`), mirroring the atlas/NFR-03 contract. No stale/wrong-theme pattern by construction; a visual no-flash confirm is cheap. |
| QA-13 | Legend shows density mapping (FR-13) | ✓ PASS (construction) | With textures on, each legend row swaps the color swatch for `<CountyDensitySwatch tier={row.tier} />` (`MapExplorer.tsx:1222-1224`), which reads the SAME `HATCH` curve as the on-map sprite (`MapSidebarUI.tsx:214-234`), so the legend can't drift from the map. |
| QA-14 | Legend reflects metric (FR-14) | ✓ PASS (construction) | Legend heading + unit are `COUNTY_METRIC_META[countyMetric].title/.unit` (`MapExplorer.tsx:1215, 1226`), driven by the active metric. |
| QA-15 | Keyboard/AT parity (FR-15) | ✓ PASS (construction) | The "Counties in view" disclosure (`CountyLayer.tsx:353-435`) is the keyboard route; with textures on each focusable row shows `<CountyDensitySwatch>` (`:404-405`) and the tier's metric **value** as text (`:417-420`), conveying rank without color. `role="list"/"listitem"`, `aria-label`, `aria-pressed`, `aria-expanded` present. |
| QA-16 | Accessible toggle (FR-16) | ✓ PASS (static) | `<button role="switch" aria-checked={useCountyTextures} aria-label="Use textures on shaded counties" tabIndex={0}>` (`MapExplorer.tsx:1184-1190`). |
| QA-17 | Mutual exclusivity preserved (FR-17) | ✓ PASS (construction) | `handleShadeCounty`/`handleShadeBreeding` route through `nextShadingState` (`MapExplorer.tsx:746-756`, do-not-touch lib unchanged). Enabling breeding clears `shadeByCounty` → `shadeOn` false → `useHatch` false → no county texture, and the toggle row unmounts. |
| QA-18 | Ramp-active behaviors hold (FR-18) | ✓ PASS (construction) | `BasemapDesaturation active={shadeByCounty \|\| shadeByBreeding}` (`:2077`) and the heatmap `shadingFillId={… shadeByCounty ? 'sr-county-fill' : undefined}` (`:2108`) both key on `shadeByCounty`, not on textures; the fill layer id stays `sr-county-fill` in BOTH paint branches, so z-order/desaturation are untouched by texture mode. |
| QA-19 | Over-cap state correct (FR-19) | ✓ PASS (construction) | Over cap, the `fc` memo returns `EMPTY_FC` and `tooMany` true (`CountyLayer.tsx:155-158`) → no fills (textured or color) draw and the "Zoom in to see counties" chip shows (`:337-349`). `useCountyTextures` is separate React state, never cleared, so the textured view returns on zoom-in. |
| QA-20 | Non-fill behavior untouched (FR-20) | ✓ PASS (construction) | Only `fillPaint` differs between branches. The boundary lines (`sr-county-line` + `sr-county-line-hi`), the `<Popup>`, the `countyKey(stusps,name)` join, and `countiesInBounds` viewport windowing are identical regardless of `useTextures`. |
| QA-21 | No new network/privacy surface (NFR-02) | ✓ PASS (static) | No `fetch`/transport/provider/navigator primitive in `countyTextures.ts` or `MapSidebarUI.tsx` (grep clean); `countyTextures.ts` is pure canvas `ImageData`. Build shows no new bundled asset (maplibre/us-counties chunks unchanged). `PRIVACY_POLICY.md` is NOT in the diff — unchanged. |
| QA-22 | Legibility guard test exists (NFR-01, NFR-03) | ✓ PASS (static) | `frontend/src/lib/countyTextures.test.ts` (5 tests) asserts tiers 1..10, strict monotonic density, adjacency ≥ 1.12, 10 distinct sprite ids, reverse-lookup round-trip + null-for-foreign — the spirit of `countyContrast.test.ts`, theme-independent. |
| QA-23 | Performance constraints (NFR-04) | ✓ PASS (construction) | Texture is a GL `fill-pattern` layer — no per-county DOM marker. Sprites bake in the `useEffect` on mount + on a `data-theme` change only (`CountyLayer.tsx:207-233`), not per frame/`moveend`; `styleimagemissing` is a bounded on-demand safety net for OUR ids. Render stays within `COUNTY_CAP = 800`. |
| QA-24 | Session-scoped, no persistence (NFR-06) | ✓ PASS (static) | `useState(false)`, no `storage` seam read/write for the toggle — resets to off on reload/relaunch. |

**Tally:** 24/24 satisfied — 7 PASS (static), 14 PASS (construction), 3 with a
recommended visual spot-check (QA-04 restore, QA-11 dark-mode legibility, QA-12
theme-switch refresh; QA-06/07 on-map separation also visual but covered by the
guard test + `design.html`).

---

## Edge Cases Verified (from code)

- **Shading off → toggle hidden AND fill impossible** (QA-02 double gate: render
  condition + `useHatch` requires `shadeOn`).
- **Tier 0 with a valid match-default image** is hidden by `fill-opacity 0` — no
  stray hatch on unrecorded counties.
- **Atlas + county textures both wired** through the same `useTextures`/`useCountyTextures`
  pair without collision: separate state, separate sprite id namespaces
  (`sr-atlas-hatch-*` vs `sr-county-hatch-*`), and `countyHatchTierForImage`
  returns null for the atlas ids (round-trip test) so the `styleimagemissing`
  safety net never cross-bakes.
- **jsdom canvas** has no 2D context; `CountyLayer.test.tsx` now stubs
  `getContext` + the `hasImage/addImage/updateImage` map API so the real sprite
  registration path runs under test without a GL map (the existing line/cap/offline
  assertions still hold).

---

## Do-Not-Touch List — Respected

`git diff HEAD` touches only feature files + version + docs. NONE of the protected
files changed:

- `frontend/src/lib/shadingExclusion.ts` — untouched
- `frontend/src/components/map/BasemapDesaturation.tsx` — untouched
- `frontend/src/lib/countyShading.ts` — untouched
- `frontend/src/globals.css` — untouched (no new `--sr-county-*` token; sprites
  reuse the existing 10-class ramp)
- `frontend/src/lib/countyContrast.test.ts` — untouched
- `SightingMarkers` `shadingFillId` contract — unchanged (`'sr-county-fill'`)

Diff scope: `MapExplorer.tsx`, `CountyLayer.tsx`, `CountyLayer.test.tsx`,
`MapSidebarUI.tsx`, new `countyTextures.ts` + `countyTextures.test.ts`,
`package.json` + `tauri.conf.json` (both → 0.5.51), `CHANGELOG.md`, `README.md`,
`docs/HELP.md`, `website/index.html`, pipeline files.

---

## Manual QA Checklist for the User

A short live-map pass before the Deploy gate (each is a visual/runtime property
that code can't fully prove; all are de-risked by the Designer's `design.html`
density+grayscale proof and the theme-independent density guard test):

1. **Dark-mode legibility (QA-11):** turn County shading + Use Textures on, switch
   to dark theme — confirm tier-1 (open lattice) through tier-10 (tight crosshatch)
   all read clearly on the greyed basemap.
2. **Theme-switch refresh (QA-12):** with textures on, flip light↔dark — the hatch
   should re-tint instantly with no stale, blank, or wrong-theme pattern.
3. **Enable/disable exact restore (QA-04):** toggle Use Textures off — the view
   should return to the identical color ramp with zoom/pan/popup unchanged.
4. **Density rank by eye (QA-06/07):** glance across a well-birded region — the
   denser the crosshatch, the higher the count, readable without relying on the
   green hue.
5. **Desktop (Tauri) + web parity, 200% text scale (NFR-05):** confirm the toggle,
   legend density swatches, and on-map hatch render identically on the desktop app
   and web build, and that the sidebar legend stays usable at 200% in-app text scale.

---

## Test Coverage Note

The new `frontend/src/lib/countyTextures.test.ts` locks the load-bearing encoding:
the `HATCH` density curve is **strictly monotonic** tier 1→10 and every adjacent
pair is **≥ 1.12×** apart (shipped min ~1.195), measured by the pure, theme-independent
`countyHatchDensity = lineWidth/gap` proxy — so any future flattening tweak fails
the suite, not the user's eyes (the colorblind analogue of `countyContrast.test.ts`).
It also locks the 10 distinct sprite ids and the reverse-lookup round-trip
(`countyHatchTierForImage`), which guards the `styleimagemissing` safety net against
cross-baking foreign ids. The `CountyLayer.test.tsx` hardening keeps the existing
line/cap/offline assertions valid now that the sprite effect runs on mount.

## Convention Flags

None. The feature reuses the established atlas-hatch / token-re-resolve / guard-test
conventions already documented in `CLAUDE.md`; nothing new worth a standing rule
emerged.
