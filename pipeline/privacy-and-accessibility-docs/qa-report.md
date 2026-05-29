# QA Report — privacy-and-accessibility-docs

**Date:** 2026-05-29
**Test Runner:** vitest
**Result:** PASSED

## Test Suite Results
246 tests passing, 0 failing (13 files). Frontend build clean. These root docs are not bundled into the app, so there is no build/runtime surface beyond the existing suite.

## Verification Against Change Brief

| Item | Result | Notes |
|---|---|---|
| PRIVACY_POLICY.md exists at root | ✓ Pass | Local-first/no-collection; honest third-party section. |
| ACCESSIBILITY.md exists at root | ✓ Pass | v0.3.28 features; no reduced-motion claim. |
| Both linked from README | ✓ Pass | Documentation section; links resolve to existing files. |
| Privacy claim accuracy ("no collection") | ✓ Pass | Re-verified: no analytics/telemetry/tracking refs in frontend or backend. |
| Third-party services accurate | ✓ Pass | eBird, OpenWeather, Nominatim — match the services called in code. |
| Accessibility claims accurate | ✓ Pass | Drawn from the verified v0.3.28 PRODUCT_CONTEXT entry; reduced-motion correctly omitted (not implemented). |
| No app code/behavior change | ✓ Pass | Only PRIVACY_POLICY.md, ACCESSIBILITY.md (new), README.md. |

## Regression Checks
- Full suite green (246). No source changes → no functional regression surface.
- README internal links verified to point at existing files.

## Known Limitations
- External links (eBird API terms, OpenWeather privacy, OSM privacy) are canonical URLs; not machine-verified for live reachability. The OpenWeather corporate-privacy URL was flagged to the user for a manual glance.

## Convention Flags
- None.
