# QA Report — idle-flake-and-doc-rot

**Date:** 2026-06-11
**Test Runner:** vitest (frontend) · pytest (backend)
**Result:** PASSED
**QA loop:** zero fixes needed, zero retries — the change passed on the first pass.

## Verdict

The change does exactly what the brief says and nothing else. Both test-determinism
fixes are in place and independently proven (15/15 stressed runs green post-fix; the
pre-fix code failed under the same recipe with the exact documented failure class).
The record narrowing matches the brief's wording character-for-character, the
PRODUCT_CONTEXT rewrites are factually accurate against the current code, and the
binding boundaries (no production code, no version files, no website, zero new Mini
content) all hold.

## Criterion 1 — Diff confinement and content review

| Check | Result | Evidence |
|---|---|---|
| Diff confined to allowed files | ✓ Pass | Modified: `CHANGELOG.md`, `DECISIONS.md`, `PRODUCT_CONTEXT.md`, `ROADMAP.md`, the two test files, plus pipeline bookkeeping (`pipeline/handoff.md`, `pipeline/session-state.json`, untracked `pipeline/` dirs). Nothing in `frontend/` outside the two test files (pathspec-excluded diff = 0 lines); nothing in `src-tauri/`, `backend/`, `website/`; no version files. |
| A1 fix: rafQueue precondition | ✓ Pass | `BirdingStats.test.tsx` `renderAndLoad()` adds `await waitFor(() => expect(rafQueue.length).toBeGreaterThan(0))` after the existing waitFor, with the commit-vs-effect race comment. Observable stub-queue precondition, no wall-clock. |
| A1 diagnostic: idleQueue | ✓ Pass | `expect(idleQueue.length).toBeGreaterThan(0)` before `flushIdle()` in the idle-callback test, marked non-load-bearing. |
| A2 fix: 120 ms afterAll wait-outs | ✓ Pass | `afterAll(() => new Promise((r) => setTimeout(r, 120)))` with the toolkit-fallback-timer comment in BOTH `BirdingStats.test.tsx` and `MediaStatsSections.test.tsx`. |
| Rejected approaches stayed rejected | ✓ Pass | `test-setup.ts` untouched; no `vi.resetModules()`, no rIC shims. |
| Zero new Mini content | ✓ Pass | Added-line grep over the diff: Mini appears only in (a) the DECISIONS.md:62 header, where the brief's exact replacement wording carries the pre-existing phrase byte-identically, (b) the edited ROADMAP.md line, whose Mini sentence is byte-identical to HEAD, (c) `pipeline/handoff.md` bookkeeping describing the boundary rule itself. Per-file "Mini" counts identical HEAD vs working tree (DECISIONS 5/5, ROADMAP 2/2, CHANGELOG 2/2, PRODUCT_CONTEXT 2/2; `snowraven-mini` 2/2). The DECISIONS historical Mini block is byte-identical, just shifted 4 lines by the inserted paragraph. |
| B wording matches the brief verbatim | ✓ Pass | All four edits (DECISIONS header, DECISIONS What-paragraph + appended sentence, CHANGELOG 0.5.29 lead-in + appended sentence with body unchanged, ROADMAP lead-in + parenthetical) match the brief's exact wording. |

## Criterion 2 — Stress acceptance (independent 15-run confirmation)

Recipe: `npx vitest run src/components --maxWorkers=1 --sequence.shuffle.files=true`
under 3 concurrent nohup CPU busy-loops (killed after), 4-core VM. Per-run grep:
`Unhandled|cancelAnimationFrame` — required 0 hits.

| Run | Result | Tests | Unhandled/cAF hits |
|---|---|---|---|
| 1–15 | GREEN (exit 0), every run | 82 passed (82), 12 files, every run | 0, every run |

**15/15 green.** Combined with the Engineer's 30/30, that is 45/45 post-fix stressed
runs against a pre-fix failure rate of 3/30.

## Criterion 3 — Negative control (pre-fix code, proves the precondition matters)

Throwaway detached `git worktree` at HEAD (`2a7a3a8`, pre-fix), shared
`node_modules` via symlink, identical stress recipe, early stop on first failure.
Worktree removed after.

- Runs 1–11: green.
- **Run 12: FAILED (exit 1)** — vitest caught 2 unhandled errors:
  `ReferenceError: cancelAnimationFrame is not defined` at
  `@reduxjs/toolkit/dist/redux-toolkit.modern.mjs:481` (Timeout callback),
  originated in `BirdingStats.test.tsx`, **with all 82 tests passing** — the run
  failed with all tests green. This is the A2 (run-28 / inter-environment timer
  leak) class verbatim.

The A1 frozen-shell assertion class did not surface before the early stop
(historical rate 2/30; one known-class failure satisfies the control). The same
recipe that goes 15/15 green on the fixed code fails on the pre-fix code with a
documented failure class — the fix bites.

## Criterion 4 — Normal runs

| Check | Result |
|---|---|
| Full vitest run 1 | ✓ exit 0 — **774 passed (774)** |
| Full vitest run 2 | ✓ exit 0 — **774 passed (774)** |
| `backend/.venv/bin/python -m pytest tests/ -v` | ✓ exit 0 — **110 passed** |
| `npx tsc --noEmit` | ✓ exit 0, zero output |
| `npm run lint` | ✓ exit 0 |

## Criterion 5 — Docs fact-check

Six rewritten PRODUCT_CONTEXT.md passages selected at random (shuf) from the
twelve in the brief, each verified against the actual code:

| Passage | Rewritten claim | Verified against | Result |
|---|---|---|---|
| Species Detail key files (~:561) | `Phase` union `loading-saved \| setup-required \| error \| ready`; `ui.tsx`/`ToggleSwitch.tsx`/`MapBoundsFitter.tsx` locations; `SightingMarker` from `lib/sightingMarkers.ts`; shared `SightingsMap` | `SpeciesDetail.tsx:42-46` (exact union), all three files exist at the stated paths, `sightingMarkers.ts:6` exports the type, `SpeciesDetail.tsx:31-32, 343, 1233` consume it | ✓ |
| BirdingStats key files (~:591) | ~1,940 lines; `SnowMap` + DOM `<Marker>` pins with `RankIcon` circle/square; one state-driven `<Popup>`; `fitToPins` on load | `wc -l` = 1,939; `BirdingStats.tsx:856-879` (SnowMap, `RankIcon shape="circle"/"square"`, `geoPopup`-driven Popup, `onLoad={e => fitToPins(...)}`) | ✓ |
| Heatmap toggle (~:642) | `HeatmapLayer` at `components/speciesDetail/HeatmapLayer.tsx`, GeoJSON `Source`, weights fold count × intensity via `heatWeight`, paint via `heatRadiusPx`/`heatIntensityFactor` | `HeatmapLayer.tsx:2-28`; `SpeciesDetail.tsx:352-353` (`heatWeight(m.sightings.length, heatIntensity)`); `lib/heat.ts:12,18,29,35` exports all four | ✓ |
| Nearest-10 pan (~:786) | Clicking sets `panTarget`; `MapEffects` child inside `SnowMap` (`components/map/MapControls.tsx`) calls `map.flyTo()` | `MapExplorer.tsx:165, 1484-1489`; `MapControls.tsx:13, 22` | ✓ |
| SetupRequired gating (~:819-820, the brief's flagged re-verify) | `SetupRequired` panel replaces the map area itself in My Sightings; Hotspots/Media Targets still render the map with personal markers gated off; missing key shows in-sidebar `KeyNotice` | `MapExplorer.tsx:1471-1472` (`isSetupRequired && viewMode === 'sightings' ? <SetupRequired/> : <SnowMap/>` ternary), `:1500` marker gate, `:982/:1137` KeyNotice. The old "MapContainer always rendered" claim was indeed false. | ✓ |
| TabNav z-index (~:1221) | Menu at `z-index: 1200`, above the MapLibre map and its controls | `TabNav.tsx:283` | ✓ |

**Supersession notes (5):** all five point at the new anchor entry "Maps — MapLibre
Vector Migration (complete — June 2026, v0.5.9)", which exists (~:983-987). Per-note
facts verified: `AtlasBlockLayer.tsx` gone / `AtlasLayer.tsx` present;
`blocksInBounds` + `padBounds` exported by `lib/atlasBlocks.ts` (:127, :102);
`AtlasTierPatterns.tsx` gone / `lib/atlasTextures.ts` present; `map.addImage` +
`fill-pattern` in `AtlasLayer.tsx`; `pointToBlockCode` unchanged in
`atlasBreeding.ts`; `lib/basemaps.ts` / `MapBaseLayers.tsx` gone;
`fetchTunedBaseStyle` + `VOID_COLOR` in `lib/mapStyle.ts`; `lib/clipboard.ts`
present (the still-current clipboard half); the cited DECISIONS.md anchor "Vector
basemap: Leaflet → MapLibre GL + OpenFreeMap — 2026-06-04 (v0.5.9)" exists
(DECISIONS.md:409).

**Key Decisions (2):** both marked "*(Historical — superseded by the v0.5.9 MapLibre
migration)*" with accurate current-truth notes — Leaflet is genuinely gone (zero
`leaflet` in `frontend/package.json`, zero `from 'leaflet'` imports, zero
`_getIconUrl` anywhere), and MapLibre popups are JSX in the React tree.

**`grep -in "leaflet" PRODUCT_CONTEXT.md`:** 14 hits, every one inside a historical
entry body that now carries a supersession note, the v0.5.9 anchor entry itself, or
the two annotated Key Decisions. Zero remaining current-tense Leaflet claims.

**CHANGELOG:** `## [Unreleased]` sits above `## [0.5.30]` with the file's standard
`### Fixed` / `### Changed` subsections; the 0.5.29 narrowing matches the brief's
exact wording; the [Unreleased] entries accurately describe the change and state
"Test infrastructure only — no production code changed."

## Edge Cases Tested

- File-order shuffle: every stressed run used a fresh random seed (vitest
  `--sequence.shuffle.files=true`), so the fixes held across 27 distinct orderings.
- Negative-control infra was validated as a true control: the failure observed was a
  known product failure class (toolkit timer leak), not a worktree/symlink artifact —
  all 82 tests passed in the failing run; only the unhandled error failed it.

## Known Limitations

- The negative control reproduced only the A2 class before its early stop (run 12 of
  up to 15). The A1 frozen-shell class (historical 2/30) did not surface in 11 green
  control runs — expected at that rate; the Engineer's pre/post evidence plus the A2
  repro carry the control.
- Pre-existing, out of scope (binding no-production-code boundary — report only):
  `frontend/src/components/TabNav.tsx:281-282` carries a stale code comment ("Above
  Leaflet's panes and controls") above the `zIndex: 1200` it explains. Behaviorally
  correct, wording stale since v0.5.9. A one-line comment touch-up for a future lane.
- The stress recipe on this 4-core VM completes a run in ~12-19 s; the busy-loops
  were verified running for both stressed phases.
