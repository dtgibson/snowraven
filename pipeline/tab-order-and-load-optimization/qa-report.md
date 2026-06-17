# QA Report — tab-order-and-load-optimization (0.5.42)

**Date:** 2026-06-17
**Test Runner:** vitest
**Result:** PASSED

## Test Suite Results
970 tests passing, 0 failing (79 files). Re-run confirmed green. Lint (`eslint .`)
and typecheck (`tsc --noEmit`) clean. Production build (`tsc -b && vite build`)
succeeds with no chunk-size warning.

## Acceptance Criteria Verification (change-brief "What done looks like")

| Criterion | Result | Notes |
|---|---|---|
| First-run tab order: Checklists between Breeding Codes and List Comparer | ✓ Pass | `DEFAULT_TAB_ORDER` + `tabLayout.test.ts` literal; saved custom layouts preserved via `parseLayout` |
| maplibre off first paint, no chunk-size warning | ✓ Pass | `vendor-maplibre` absent from `dist/index.html` modulepreload; entry chunk 331→218 KB (84.5→54 KB gz); build clean |
| CI mirror green (lint + typecheck + vitest + build) | ✓ Pass | all four green |
| `npm audit` clean at both scopes | ✓ Pass | full and `--omit=dev` both report 0 vulnerabilities |

## Regression Review (independent, adversarial)
PASS, no regressions. Verified: the tab order is single-sourced (no other file
hardcodes the old order; the Settings "is default" check is positional/dynamic);
the new `<Suspense>` boundaries sit inside the `mountedTabs` gating; the per-row
map's Suspense boundary preserves the single-WebGL-context accordion (FR-21/FR-23);
App's idle warmer pre-warms the same `SightingsMap` chunk the lazy component loads;
and the two updated `NamedBirdsTable.test.tsx` assertions genuinely await the lazy
map (not vacuous).

## Edge Cases Tested
- `parseLayout` append-missing-tabs normalization with the new order (append-order
  test green; `slice(-3)` still `['checklists','comparer','named-birds']`).
- Lazy List Comparer / Checklists render through Suspense with no a11y regression
  (reuses the `TabLoading` live-region announcer pattern, F068).
- Per-row map mounts on row-expand only; single-open accordion teardown verified.

## Known Limitations
- The initial-load improvement is a web / self-hosted benefit; on the Tauri desktop
  build, modulepreload is served from local disk, so the saving there is marginal.
  Not a defect.

## Notes
- The regression review caught one cosmetic nit — `npm audit fix` left the
  lockfile's top-level `version` at 0.5.41 (npm does not gate `ci`/`install` on it).
  Synced to 0.5.42; `npm ci --dry-run` passes "up to date."
