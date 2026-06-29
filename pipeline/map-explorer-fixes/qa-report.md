# QA Report — Map Explorer Fixes

**Date:** 2026-06-29
**Test Runner:** vitest
**Result:** PASSED

## Test Suite Results
1163 tests passing (98 files), 0 failing (+4 new collapse-disclosure tests).

## CI Mirror (full pre-push gate)

| Step | Result |
|---|---|
| `npm run lint` (eslint) | ✓ clean |
| `npm run typecheck` (`tsc --noEmit`) | ✓ clean |
| `npm run test` (vitest) | ✓ 1163 / 1163 |
| `npm run build` (`tsc -b && vite build`) | ✓ built |

## Per-item verification

| Item | Result | Notes |
|---|---|---|
| 1 — popup name overflow | ✓ | `sr-wrap-anywhere` + `min-width:0` on both link/plain branches; inner div maxWidth 220 |
| 2 — sharper county lines | ✓ | Geometry regenerated at 10% keep — 3,144 counties, 2.85 MB raw / **751 KB gz** (build chunk), under the raised budget; off the entry chunk |
| 3 — count label clarity | ✓ | Caption "by your checklist count", per-row + headline tooltips, "Records"→"Checklists" toggle; aggregation unchanged (countyShading parity tests green) |
| 4 — 10-step shading | ✓ | `computeCountyTiers` default 10; `--sr-county-1..10` contrast-guarded (every adjacency ≥1.212:1); legend auto-renders N rows; new 10-class test |
| 5 — collapse in-view list | ✓ | Chevron disclosure on all 4 lists (3 via shared `InViewMarkerList`, Targets inline); aria-expanded + inert body; 4 new tests |

## Regression focus
- County shading aggregation/semantics unchanged → `countyShading.test.ts` (records=checklists,
  species=distinct, computeGeo parity) green.
- Off-entry-chunk guard (`entryChunk.test.ts`) green despite the larger county chunk (it checks
  load location, not size); `vendor-maplibre` still isolated off first paint.

## Known Limitations
- 10 single-hue green steps sit close together by design (adjacencies ~1.21–1.23:1, just above
  the legibility floor) — the finest gradations are intentionally subtle; the contrast test is the guard.
- The county on-demand chunk download grows (~310 KB → ~751 KB gz) — off first paint, fetched only
  when the county overlay is first opened, then cached.
