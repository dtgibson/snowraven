# QA Report — efficiency-and-docs-audit (v0.5.52)

**Date:** 2026-06-30
**Test runners:** vitest (frontend), pytest + ruff (backend)
**Result:** PASSED

## Test Suite Results

- **Frontend:** 1173 passed (100 files), 0 failing. Lint clean (eslint),
  typecheck clean (`tsc -b` — now meaningful), production build succeeds with the
  entry-chunk guard intact (no maplibre/county on first paint).
- **Backend:** 157 passed, 0 failing. ruff clean. The 15 tide tests
  (`test_tide_router.py` + `test_tide_at.py`) — which exercise the three-product
  NOAA fetch — pass, confirming the new `asyncio.gather` returns identical
  readings (observed, predicted-fallback, and hilo-interpolation paths).

## Acceptance Criteria Verification (from change-brief.md)

| Criterion | Result | Notes |
|---|---|---|
| Tide fetch parallelized, output-identical | ✓ Pass | 15 tide tests green; `_get` swallows exceptions so `gather` can't raise; tuple order preserved. |
| SpeciesDetail baseCount memoized, identical denominator | ✓ Pass | Output-identical (memoized form of the same pure computation, phase-guarded); typecheck/build green. See Known Limitations. |
| computeTotals min/max without sort, identical first/last date | ✓ Pass | `birdingStats.test.ts` asserts `firstDate`/`lastDate` (lines 124–125) — green. Lexicographic `<` on `YYYY-MM-DD` == calendar order. |
| Checklists eBird+ML parallel load, identical behavior | ✓ Pass | `Checklists.test.tsx` green; `.catch(()=>null)` preserves graceful ML-missing degradation; error path unchanged. |
| Backend writes off the event loop, identical on-disk result | ✓ Pass | `run_in_threadpool` wraps `write_bytes`/`_write_meta`/`write_text`; settings/settingskv tests green; `encoding="utf-8"` preserved. |
| `typecheck` now type-checks (`tsc -b`) | ✓ Pass | Previously a no-op (checked zero files); now compiles the referenced projects. |
| Dead deps removed (clsx/tailwind-merge/cva), build byte-identical | ✓ Pass | Removed from package.json + lockfile; suite + build green. |
| Dead assets removed (utils.ts, react/vite.svg, hero.png) | ✓ Pass | Confirmed referenced nowhere (repo-wide grep) before deletion; build green. |
| CI: pipeline concurrency-cancel + windows npm cache | ✓ Pass | YAML valid; scoped per-ref; lockfile paths correct. |
| Docs current (README/HELP/ACCESSIBILITY/CLAUDE/vite/networkCache/Settings) | ✓ Pass | County overlay added to offline lists + a11y keyboard route; stale comments corrected. |
| Version → 0.5.52 in both manifests + CHANGELOG + website pill | ✓ Pass | `package.json` + `tauri.conf.json` lockstep; changelog entry + pill/footer updated. |
| No new network/provider/telemetry → no PRIVACY_POLICY change | ✓ Pass | Confirmed — nothing touched the network surface. |

## Edge cases reasoned/verified

- **`gather` error path:** if any NOAA product errors, `_get` returns `None`
  (unchanged); `gather` therefore can't raise. Tested by `test_predicted_fallback`
  (observed missing → falls back to predictions).
- **Checklists when eBird fails:** ML now loads concurrently but is discarded on
  the eBird-failure branch (error shown). User-visible result identical; the only
  difference is the shared ML cache may warm — harmless and not user-facing.
- **computeTotals empty input:** `firstDate`/`lastDate` stay `null` (matches the
  old `?? null`).

## Known Limitations

- **SpeciesDetail `baseCount`** has no dedicated unit test (it renders the
  "X of N checklists" strip text). Verified output-identical by construction: a
  memoized form of the exact same pure filter, keyed on the inputs it depends on.
- **`clsx` remains in the lockfile** as a transitive dependency of another
  package (npm removed only `cva` + `tailwind-merge` as direct-only). Expected —
  our change removed the three *direct* deps; the bundle is unaffected.

## Regression assessment

No regressions. Every changed code path is covered by a green test or is
provably output-identical; the full suite (1173 + 157) is green at the
verification stage. This is a conservative PASS.
