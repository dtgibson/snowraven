# QA Report — Tab and Map Default Order

**Date:** 2026-06-17
**Test Runner:** vitest
**Result:** PASSED

## Test Suite Results

970 tests passing, 0 failing.

- `npm run test`: 79 test files passed, 970 tests passed.
- `npm run build`: passed (`tsc -b && vite build`).
- `npm run lint`: passed.
- Browser smoke against the production build preview: passed.

## Acceptance Criteria Verification

| Criterion | Result | Notes |
|---|---|---|
| New/default tab order is Weather, Statistics, Species Detail, Map Explorer, Checklists, Multimedia, Breeding Codes, List Comparer, Named Birds, Settings | Pass | Browser smoke confirmed the rendered tab order after clearing saved layout. `DEFAULT_TAB_ORDER` is locked by `tabLayout.test.ts`. |
| Existing saved custom tab layouts keep working | Pass | Existing parse/serialize/load tests still pass. Missing tabs are appended through the existing normalization path rather than overriding saved order. |
| List Comparer opens on checklist comparison by default | Pass | Browser smoke confirmed Checklists is selected by default. `ListComparer.test.tsx` locks the pressed state. |
| Checklists is on the left side of the List Comparer selector | Pass | Browser smoke and `ListComparer.test.tsx` both confirm the visible order is Checklists, then Life Lists. |
| Map Explorer shows Nearby Lifers before Media Targets | Pass | Browser smoke confirmed the rendered mode order. `mapViewModes.test.ts` locks the order as My Sightings, Hotspots, Nearby Lifers, Media Targets. |
| Focused frontend test run passes | Pass | Focused run passed earlier: 3 files, 26 tests. Full Vitest run also passed. |

## Edge Cases Tested

- Cleared saved tab layout before smoke testing to verify first-run/reset defaults.
- Confirmed saved-layout normalization still preserves known stored tab order and appends missing tabs.
- Confirmed List Comparer’s Life List controls still render after switching from the new Checklists default.
- Confirmed production build output loads far enough to verify all three visible ordering changes.

## Known Limitations

No QA blockers or product limitations found. During frontend-only preview, settings API calls logged connection errors because the backend was not running; those calls are outside this ordering change and did not affect the verified UI paths.
