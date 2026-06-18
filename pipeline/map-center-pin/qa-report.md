# QA Report — map-center-pin (0.5.43)

**Date:** 2026-06-17
**Test Runner:** vitest
**Result:** PASSED

## Test Suite Results
978 tests passing, 0 failing (80 files), including 8 `CenterPinDropper` tests for the
gesture logic. Lint (`eslint .`) and typecheck (`tsc --noEmit`) clean. Production build
(`tsc -b && vite build`) succeeds with no chunk-size warning.

## Acceptance Criteria Verification (change-brief "What done looks like")

| Criterion | Result | Notes |
|---|---|---|
| Right-click (desktop) / long-hold (touch) drops a center pin and re-runs the active view | ✓ Pass | `contextmenu` + a long-press timer; unit-tested |
| Pin drags to fine-tune; re-runs on release | ✓ Pass | draggable DOM `<Marker>`, `onDragEnd` → `applyCenter` |
| Left-click pin/popup selection still works (no collision) | ✓ Pass | gestures are `contextmenu`/long-press, distinct from left-click |
| Panning never hijacked by the long-press | ✓ Pass | timer cancelled on move/pan/zoom/2nd-touch/touchend; no `preventDefault` before fire |
| Session-only — saved default untouched | ✓ Pass | `applyCenter` never writes `map-defaults` |
| Works in fullscreen; keyboard-accessible; hint present | ✓ Pass | DOM marker inside `<SnowMap>` (fullscreen-safe); lat/lng inputs are the keyboard path; hint under the inputs + HELP |
| Full CI mirror green | ✓ Pass | lint + typecheck + 978 tests + build |

## Regression Review (independent, adversarial)
PASS, no regressions. Verified gesture correctness and every cancel path, no collision
with the existing map click handlers (sighting/hotspot/atlas GL clicks, target/lifer DOM
markers), genuine session-only behavior, the `centerPinShown` / blue-dot guard, and that
maplibre stays off first paint (entry chunk unchanged at ~218 KB — the 0.5.42 load
optimization holds). It surfaced two minor findings, both fixed:
- Website Map Explorer copy now mentions the pin-drop gesture (CLAUDE.md convention).
- Added a dedup guard so a touch long-press can't double-fire via a platform-synthesized
  `contextmenu` after the hold (plus a regression test).

## Edge Cases Tested
- Long-press cancel paths: map pan/move/zoom, touchmove past the slop threshold,
  second-finger pinch, a quick tap, and unmount (listeners removed).
- Synthesized-`contextmenu`-after-long-press dedup.
- Empty / partial coordinates → no pin (`parseFloat` NaN guard).
- The blue "Use my location" dot is preserved in My Sightings (not a center view).

## Known Limitations
- Long-press is touch-only and was verified via the unit-tested timer/cancel logic rather
  than on a physical device. The mobile OS long-press callout is a possible future
  refinement.
