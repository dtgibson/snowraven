# QA Report — county-fill-sharpen

**Date:** 2026-06-29
**Test runner:** vitest (frontend) + production build
**Outcome:** PASSED

## What was verified
Regenerating the bundled county geometry at the higher simplification fidelity (15%)
must not break any existing behavior, and the larger asset must stay off the entry
chunk.

## Results (full CI mirror, CI order)
- **Lint** (`eslint .`): clean.
- **Typecheck** (`tsc --noEmit`): clean.
- **Tests** (`vitest run`): 1168 passed / 99 files. Covers the county guards —
  `entryChunk.test.ts` (geometry stays off the entry chunk), `CountyLayer.test.tsx`,
  `countyBoundaries.test.ts`, `countyContrast.test.ts`, `mapStyle.test.ts`.
- **Build** (`tsc -b && vite build`): succeeded. County chunk `us-counties-*.js` =
  3.79 MB raw / 1.04 MB gz, emitted as a separate on-demand chunk (not in the entry
  modulepreload). The >1100 KB chunk-size warning is pre-existing for this on-demand
  asset (and ebird-taxonomy) and is not an error.

## Regressions
None detected. No runtime code changed — only the bundled data asset, the release-time
build script, version, changelog, and site version pill.
