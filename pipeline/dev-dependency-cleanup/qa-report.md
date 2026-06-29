# QA Report — Dev Dependency Cleanup

**Date:** 2026-06-29
**Test Runner:** vitest
**Result:** PASSED

## Test Suite Results
1158 tests passing (98 files), 0 failing. Duration ~25s.

## CI Mirror (the project's full pre-push gate)

| Step | Command | Result |
|---|---|---|
| Lint | `npm run lint` (eslint) | ✓ pass (clean) |
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | ✓ pass (clean) |
| Test | `npm run test` (`vitest run`) | ✓ 1158 / 1158 |
| Build | `npm run build` (`tsc -b && vite build`) | ✓ built |

## Change-brief verification

| Criterion | Result | Notes |
|---|---|---|
| `npm audit` (dev incl) → 0 high/critical | ✓ Pass | undici now 7.28.0 |
| `npm audit --omit=dev` → 0 | ✓ Pass | unchanged (was clean) |
| Full CI mirror green | ✓ Pass | lint / typecheck / test / build |
| App source unchanged (lock-file-only) | ✓ Pass | + lockfile metadata sync |

## Edge Cases / Regression Focus
- The bumped dependency (`undici`) is transitive under `jsdom`, the vitest jsdom
  test environment. The full suite — including the jsdom-mounted component tests
  and the entry-chunk guard (`entryChunk.test.ts`) — passed, so the test runtime
  is unaffected by the bump.

## Known Limitations
- The build emits the known chunk-size warning for `vendor-maplibre` and the data
  chunks (over 1100 kB). Expected per project convention: these are off the entry
  chunk and `chunkSizeWarningLimit` is 1100. `vendor-maplibre` remains a separate
  chunk (absent from the entry), confirming the off-entry-chunk guard holds.
