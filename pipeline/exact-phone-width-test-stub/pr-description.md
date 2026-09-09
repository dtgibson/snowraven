## Exact phone-width test stubs

### What this does

Introduces one shared jsdom `matchMedia` helper that routes values by the complete media-query string. A test that enables SnowRaven's `'(max-width:640px)'` phone query now leaves both 1024px tablet spellings, reduced motion, color scheme, and every other unlisted query false unless that exact query is configured separately.

Five component suites now use the helper:

- `MapExplorerLocateFab.test.tsx` and `MapExplorerSearchThisArea.test.tsx`, replacing their identical static `stubPhoneWidth` copies.
- `MapExplorerSidebarTrap.test.tsx`, preserving mounted phone-to-desktop transitions through query-scoped `change` listeners.
- `ChartViewTip.test.tsx`, preserving independent phone-width and reduced-motion values.
- `Calendar.test.tsx`, replacing its partial `max-width:640px` substring check.

The helper's focused suite is the regression lock. It proves phone `true` does not imply either `'(max-width: 1024px)'` or `'(max-width:1024px)'`, proves reduced motion can change without changing phone width, and proves a phone change notifies only the exact phone-query listener.

### How to test

Run the exact command in `pipeline/exact-phone-width-test-stub/how-to-see.md`. Verified in this build:

- 6 targeted files passed, 162 tests.
- `npm run typecheck` passed.
- `npm run build` passed; only the existing expected large-chunk warning was emitted.
- ESLint passed for the seven changed TypeScript files.

### Notes for reviewer

This is test infrastructure only. No production source, UI behavior, responsive query, version stamp, changelog, published documentation, or release artifact changed.

The helper deliberately does not import or export through production `useIsPhone.ts`. Its test-only `PHONE_MEDIA_QUERY` constant is an exact contract: if production changes the query spelling, these phone-path tests stop receiving the convenient `true` answer and expose the drift instead of silently following it.

The reactive helper keeps live `MediaQueryList` snapshots and sends change events only when the exact configured query changes. Static suites use the same implementation without maintaining listeners of their own. A source sweep finds no remaining component-test phone stub that classifies a query with `includes('max-width')` or `includes('max-width:640px')`.

### Convention flags

- Improve lane; no design pass.
- Test-only and bundle-identical; no version, changelog, docs, or deploy work.
- Unknown queries fail closed to `false`.
- Reduced motion stays independently configurable.
- No browser or manual verification is applicable.
