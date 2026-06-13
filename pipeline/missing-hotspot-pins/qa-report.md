# QA Report — missing-hotspot-pins (0.5.30)

**Date:** 2026-06-11
**Test Runner:** vitest (frontend) + pytest (backend)
**Result:** PASSED — FINAL for the lane (hotspot pins + heatmap toggle; 2 QA-loop passes, see pass 2 below)

## Test Suite Results

| Suite | Result |
|---|---|
| vitest | 773 passing, 0 failing (54 files) — run twice, both green; the known BirdingStats idle-callback flake did not trip |
| pytest | 110 passing, 0 failing |
| tsc --noEmit | clean |
| eslint | clean (after QA-loop fix, below) |
| New tests in isolation (`HotspotMarkers.test.tsx`, `AtlasLayer.test.tsx`) | 4 passing (2 files) |

## QA Loop

**Attempt 1 — lint failure (genuine, from this fix).** The two new exports
(`hotspotKindForImage`, `hatchTierForImage`) tripped
`react-refresh/only-export-components` in both component files (2 errors; the
rule had zero pre-existing violations in the codebase). Minimal fix:
`eslint-disable-next-line` on each export, keeping the lookups beside the
handlers they serve and the diff inside the allowed file set. All suites
re-run green. No further attempts needed.

## Bug-Brief Verification (acceptance criteria)

| Criterion | Result | Notes |
|---|---|---|
| Deterministic repro now passes: delayed satellite tiles (~20s) + base switch + hotspot search mid-churn → teardrops render | ✓ Pass | Run twice (fresh browser context each). Both runs: **180 teardrops rendered while tiles were still delayed**, all three sprites (`sr-pin-visited/unvisited/personal`) registered, kinds after tiles landed: unvisited 55, personal 84, visited 41. Screenshots: `/tmp/qa-hotspot-fixed.png`, `/tmp/qa-hotspot-fixed-run2.png`, mid-churn state `/tmp/qa-hotspot-fixed-during.png`. |
| Zero `Image "sr-pin-*" could not be loaded` warnings | ✓ Pass | 0 in both runs (console captured end to end). |
| `styleimagemissing` safety net actually fires | ✓ Pass | Live test in run 2: `map.removeImage('sr-pin-visited')` + repaint → handler re-baked it (`removed: true, restored: true`). Ownership contract (own ids → kind/tier, foreign ids → null) locked by the 2 new unit tests, which exercise real `HOTSPOT_IMAGE_ID`/`HATCH_IMAGE_ID` values and foreign/empty ids. |
| Atlas hatches appear (same fix in AtlasLayer) | ✓ Pass | Textures on with shading: all 4 `sr-atlas-hatch-*` images registered, 48 shaded blocks rendered (`/tmp/qa-walk-atlas-textures.png`). |
| Full suites green, tsc clean | ✓ Pass | Counts above. |
| No diff outside allowed set | ✓ Pass | Working tree: `HotspotMarkers.tsx`, `AtlasLayer.tsx`, 2 new test files, `package.json` + `tauri.conf.json` (both 0.5.30), `CHANGELOG.md`, `website/index.html` (version pill + footer), pipeline files. `BirdingStats.test.tsx`, `commentBlocks.ts`, formatters untouched. `package-lock.json` untouched. |

## Map Regression Walk (healthy network, dev app at :5173)

| Step | Result | Evidence |
|---|---|---|
| Sighting pins (`sr-sight-circle`) render + clickable | ✓ Pass | 509 rendered; click → popup opened |
| Hotspot teardrops render + clickable | ✓ Pass | 180 rendered; click → popup opened (`/tmp/qa-walk-hotspot-popup.png`) |
| Legend hide/show a kind | ✓ Pass | Unvisited hidden → {personal 84, visited 41}; restored → all 180 |
| Base switches positron → satellite → topo → back | ✓ Pass | 180 teardrops survive every switch |
| Atlas blocks + breeding shading + textures on/off | ✓ Pass | 48 fill + 48 line blocks; shading on; 4/4 hatch images; clean teardown (layer removed, teardrops intact) |
| Heatmap toggle (Pins → Heatmap) | ✗ FAIL — **pre-existing, not from this fix** | App-wide crash, see below. **FIXED in this lane — QA loop pass 2 (section below) verifies it.** |
| Theme dark/light flip — sprites re-bake, nothing vanishes | ✓ Pass | 180 teardrops + 48 blocks + 3 pin images + 4 hatch images present in light → dark → light; visual color change confirmed (`/tmp/qa-theme-light.png`, `/tmp/qa-theme-dark.png`) |

## Pre-Existing Issues (diagnosed, not fixed here)

1. **CRITICAL — Map Explorer heatmap toggle crashes the whole app.**
   *(User approved fixing this in the same lane; fixed and verified in
   QA loop pass 2 — see the section at the end of this report.)*
   Clicking Pins → Heatmap throws react-map-gl's `Error: source id changed`
   and trips the app error boundary ("Something went wrong" / Reload).
   Reproduced deterministically in dev AND against the production build
   served on :1620 — **the shipped 0.5.29 crashes too.** Root cause:
   `SightingMarkers.tsx` returns `<Source id="sr-heat">` (heatmap branch) or
   `<Source id="sr-sight">` (pins branch) at the same React tree position
   with no `key`, so React reuses the instance and react-map-gl asserts on
   the in-place id change. Not from this fix: the file is untouched (last
   changed 0.5.18), `package-lock.json` unchanged since 0.5.17, and neither
   fixed component is mounted on the crash path. Species Detail's heatmap
   uses the safe pattern (conditionally mounted separate `HeatmapLayer`)
   and is unaffected. Trivial fix shape: `key={displayMode}` (or keyed
   branches) so the Source unmounts/remounts. **Recommend an immediate
   follow-up fix lane.**
2. MapLibre warning `Expected value to be of type number, but found null`
   on hotspot popup interaction — known, listed out-of-scope in the bug brief.
3. Web dev-mode settings noise: `404` on `/settings/<key>` reads and `405` on
   `/settings/map-base-layer` writes (backend settings router doesn't serve
   per-key get/set; the web storage seam falls back to localStorage). Harmless,
   pre-existing, untouched by this fix.

## Edge Cases Tested

- Sprite removal at runtime (safety-net fire) — restored on demand.
- Hidden-kind filter + restore while sprites are GL-registered.
- Both sprite families (teardrops + hatches) across a double theme flip.
- Mid-churn search with 20s tile delay, twice, fresh contexts.

## Known Limitations

- The repro and walk drive the dev server (web mode); Tauri desktop runtime
  not exercised (no map-path code differs by runtime).
- Verification scripts kept at `/tmp/qa-repro.mjs`, `/tmp/qa-walk.mjs`,
  `/tmp/qa-theme.mjs`, `/tmp/qa-crash.mjs` (reusable for the heatmap fix).

## Convention Flags

- A react-map-gl `<Source>` whose `id` differs between render branches must
  be keyed (or conditionally mounted as separate components) so it remounts
  instead of mutating `id` in place — an in-place id change is an app-crashing
  assert. Make this a standing map-component check (the Map Explorer heatmap
  crash shipped unnoticed since at least 0.5.18). *(Now also enforced
  mechanically by `SightingMarkers.test.tsx` for this component.)*

---

# QA Loop Pass 2 — Heatmap Toggle Fix (attempt 2 of 3)

**Date:** 2026-06-11
**Scope:** Re-verify the Engineer's fix for the Pins → Heatmap crash
(the CRITICAL issue found in pass 1; user approved fixing it in this lane).
**Result:** PASSED — independent re-verification, all checks green.

## Diff Review

`SightingMarkers.tsx` diff is exactly the prescribed fix and nothing else:
`key="sr-heat"` / `key="sr-sight"` on the two branch `<Source>`s plus
explanatory comments. Plus one new test file
(`frontend/src/components/map/SightingMarkers.test.tsx`) and one
CHANGELOG paragraph under 0.5.30. No other files changed since pass 1.

## Does the New Test Genuinely Pin the Contract?

Yes — proven, not just reasoned. The test stubs `Source` with an
empty-deps mount/unmount log, so a reused instance whose `id` prop
mutates logs nothing. Verified empirically against the PRE-FIX code:
a detached git worktree at HEAD (which predates the fix), with the new
test copied in, **fails** with
`expected [ 'mount:sr-sight' ] to deeply equal [ 'mount:sr-sight', 'unmount:sr-sight', 'mount:sr-heat' ]`
— exactly the silent instance-reuse the bug rode on. The working tree
was never touched; the worktree was removed after.

## Fresh Suite Runs (independent of the Engineer's)

| Suite | Result |
|---|---|
| vitest | **774 passing, 0 failing** (55 files) — 773 prior + the 1 new test |
| tsc --noEmit | clean |
| eslint | clean |
| pytest (backend) | 110 passing |

## Live Toggle Walk (Playwright, dev app at :5173, GL state inspected per step)

| Step | Result | Evidence |
|---|---|---|
| Pins → Heatmap → Pins, **3 full cycles** | ✓ Pass | Error boundary never tripped; each heatmap entry mounts `sr-heat` source+layer with `sr-sight` fully gone; each return remounts `sr-sight` with all 509 pins rendered; zero page errors all 6 transitions |
| Intensity slider in heatmap mode | ✓ Pass | 5 → 9: radius 42→66 px, intensity 0.30→0.54 — paint-only update, no rebuild, no errors |
| Atlas shading + heatmap together | ✓ Pass | `sr-heat` ordered UNDER `sr-atlas-fill` (layer idx 59 < 60), heatmap dimmed to exactly 0.45; shading off restores 0.85; atlas off leaves heatmap intact (`/tmp/qa2-heatmap-atlas.png`) |
| Final return to pins | ✓ Pass | 509 pins, clean |
| Species Detail heatmap toggle (one cycle) | ✓ Pass | No crash either direction, heatmap renders (`/tmp/qa2-sd-heatmap.png`) — confirms the safe pattern there was not disturbed |

Main screenshot: `/tmp/qa2-heatmap.png` (Map Explorer heatmap mode,
heat blobs rendered, no error screen). Walk script kept at
`/tmp/qa2-heatmap.mjs`.

## FINAL VERDICT — Whole Fix Lane

**PASSED.** Both deliverables verified end to end:

1. **Hotspot pins fix** (pass 1): deterministic repro passes twice,
   safety net fires, atlas hatches restored, full regression walk green.
2. **Heatmap toggle fix** (pass 2): crash gone across 3 live toggle
   cycles, slider/atlas-ordering/dim behavior exactly as designed,
   Species Detail unaffected, contract locked by a regression test
   proven to fail on the pre-fix code.

All suites green (vitest 774, pytest 110, tsc, eslint). No diff outside
the allowed set. Ready for The Auditor.
