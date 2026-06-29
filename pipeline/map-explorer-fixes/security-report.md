# Security Review — Map Explorer Fixes

**Date:** 2026-06-29
**Feature:** map-explorer-fixes
**Stack:** react-vite-tailwind frontend (these changes are frontend-only)
**Outcome:** PASSED

## Summary
Five frontend visual/clarity changes plus a regenerated bundled data asset. No new
network calls, no new providers, no new user input handling, no new trust boundary.
The county popup remains escaped JSX. No findings.

## Findings
No security issues found.

## Checks Performed

| Check | Result |
|---|---|
| New attack surface / trust-boundary change | Pass — CSS/label/disclosure changes + a data-asset regen; no new I/O |
| Injection in the county popup (long names, counts) | Pass — popup stays escaped JSX (NFR-08); names/counts render as React children; the eBird region URL is `encodeURIComponent`-wrapped, gated on a shape-validated region code |
| Regenerated `us-counties.json` provenance | Pass — public-domain US Census Cartographic Boundary 500k via the pinned build script (`build-county-boundaries.mjs`), same source as before, only denser; no executable content (pure GeoJSON) |
| New network calls / providers | Pass — none; the geometry is bundled, the regen is a release-time dev tool (not in `npm run build`) |
| Secrets / keys introduced | Pass — none in the diff |
| New tokens / colors | Pass — `--sr-county-5..10` are static CSS values, basemap-anchored |
| Dependency changes | Pass — none |

## Notes
The privacy posture is unchanged: no analytics, no telemetry, no new third-party
requests. `PRIVACY_POLICY.md` needs no update. Deployment is not blocked.
