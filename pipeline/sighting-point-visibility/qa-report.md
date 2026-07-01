# QA Report — Sighting Point Visibility (Point Size control)

**Date:** 2026-07-01
**Lane:** Improve (maintain) — primary concern: no regression
**Test Runner:** vitest (frontend) + eslint + tsc + vite build
**Result:** PASSED

## Test Suite Results

Full frontend suites run under Node 24 (`zsh -lc`), from `frontend/`:

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` (eslint) | Clean — 0 errors, 0 warnings |
| Typecheck | `npm run typecheck` (`tsc -b`) | Clean — 0 errors |
| Full vitest suite | `npm run test` (`vitest run`) | **100 test files passed, 1183 tests passed, 0 failing** |
| Production build | `npm run build` (`tsc -b && vite build`) | Built in 592ms; `vendor-maplibre` remains its own chunk (1,027 kB / 273 kB gz), off the entry `index` chunk — entryChunk guard held |

Backend: `git diff --name-only` shows **zero** `backend/` files changed, so the
Python suite was not required (untouched by this change).

The full vitest suite is the regression gate (the Engineer ran only the touched
files). All 1183 tests pass, including the new coverage in `mapPins.test.ts` and
`SightingMarkers.test.tsx` and every pre-existing regression guard
(entryChunk, mapStyle, countyContrast/Texture, milestoneContrast, etc.).

## Acceptance Criteria Verification

| # | Criterion | Result | Notes |
|---|---|---|---|
| 1 | "Point Size" control (Normal / Small / Off) renders in My Sightings "Map View" block, **only in Pins mode** | ✓ Pass | `MapExplorer.tsx:1353` gates the `SegControl` on `displayMode === 'pins'`; the Heatmap branch (`:1368`) shows Intensity instead. Sits under the Pins/Heatmap `SegControl` in the same "Map View" sidebar block. |
| 2 | **Off** removes the `sr-sight-circle` layer AND its click/hover/popup target | ✓ Pass | `SightingMarkers.tsx:175` `if (pointSize === 'off') return null` — no `<Source>`/`<Layer>`, no `sightPopup`. Click/hover effect is gated on `pointsShown = displayMode === 'pins' && pointSize !== 'off'` (`:97`, `:103`). Test "renders NO points Source in Off (no layer, so no click/popup target)" asserts `sourceLog === []`. |
| 3 | **Small** shrinks the point radius via the `mapPins.ts` factor (single source; `mapPins.test.ts` parity holds) | ✓ Pass | `POINT_SIZE_RADIUS_FACTOR.small = 0.5`, applied through `pinFillRadiusExpr(factor)` — the single sizing source. `mapPins.test.ts` locks function↔expression parity and "Small produces a strictly smaller footprint than Normal at every count." |
| 4 | **Normal** is byte-identical to pre-change rendering (factor-1 short-circuit; equality test passes) | ✓ Pass | `scaleRadius` short-circuits `factor === 1` (`mapPins.ts:93`); test "default radius expressions are byte-identical to the unscaled table (factor 1 = Normal)" asserts `pinRadiusExpr(factor.normal).toEqual(pinRadiusExpr())` and same for `pinFillRadiusExpr`. |
| 5 | Point Size **composes** with the shade auto-dim (opacity still × `dim = shadingFillId ? ATLAS_DIM_FACTOR : 1`) | ✓ Pass | `SightingMarkers.tsx:180-187`: radius uses `POINT_SIZE_RADIUS_FACTOR[pointSize]`, opacity (fill + stroke) uses `pinOpacityExpr(dim)` with `dim` unchanged. Small + active shade applies both. |
| 6 | **Heatmap untouched**; layer id `sr-sight-circle` preserved | ✓ Pass | Heatmap branch (`:146-170`) never reads `pointSize`; auto-dim/beforeId behavior unchanged. Circle layer id is still `sr-sight-circle` (`:194`). |
| 7 | **Session-only** (plain `useState`, resets on relaunch — no `storage` seam) | ✓ Pass | `MapExplorer.tsx:182` `const [pointSize, setPointSize] = useState<PointSize>('normal')` — no `storage.getSetting`/`setSetting`, matching `displayMode`/shade state. |
| 8 | Version bumped to **0.5.53** in both `frontend/package.json` and `src-tauri/tauri.conf.json` (identical); CHANGELOG/HELP/README/website updated | ✓ Pass | Both files read `"version": "0.5.53"`. `CHANGELOG.md` has a `[0.5.53] - 2026-07-01` Added entry; `docs/HELP.md:235`, `README.md:14`, and `website/index.html:259` describe the control; website version pill = 0.5.53. |
| 9 | Accessibility: control carries `aria-pressed` (SegControl) and a proper label | ✓ Pass | `SegControl` (`MapSidebarUI.tsx:23`) sets `aria-pressed={value === opt.value}` per option; Point Size passes `ariaLabel="Point size"` (→ `role="group"` + `aria-label`) plus a visible `<SidebarLabel>Point Size</SidebarLabel>`. |

## Edge Cases Tested

- **Normal → Off → Small transitions** — `SightingMarkers.test.tsx` asserts the
  Source unmounts on Normal→Off and remounts on Off→Small (`sourceLog` sequence),
  so a hidden point leaves no stray GL source/click target and returning to a
  visible size cleanly re-mounts it.
- **Pins → Heatmap → Pins toggle** — pre-existing "source id changed" crash guard
  still passes (distinct `sr-sight`/`sr-heat` keys); the new prop didn't disturb it.
- **Small footprint monotonicity** — every count stop yields a strictly smaller
  fill radius under Small than Normal (`pinFillRadiusExpr` test), and the scaled
  expression stays equal to its `pinRadiusScaled` function twin (parity lock).
- **Off in the click/hover effect** — the `map.on('click' | 'mouseenter' |
  'mouseleave')` wiring is disabled while `pointSize === 'off'`, so no cursor/hit
  handling survives on a hidden layer.

## Known Limitations

- **Live browser click-through was NOT performed** (hands-off run, no browser
  wired). The component tests cover the load-bearing behaviors structurally:
  Off ⇒ no Source (hence no click/popup), and Small ⇒ strictly smaller radius via
  the single `mapPins` factor. Visual confirmation on the running app (the
  Normal/Small/Off SegControl actually shrinking/hiding pins over a shaded county
  choropleth) is deferred to the user at deploy sign-off.
- **`vitest` is not a substitute for a real desktop bundle** — but `npm run build`
  (the same `tsc -b && vite build` that Windows CI and `release.sh` run) passed,
  so the release-gate build is green.
