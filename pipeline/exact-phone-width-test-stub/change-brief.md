# Change Brief — Exact Phone Width Test Stub

## What is changing

Replace the phone-width `matchMedia` doubles that classify queries with substring checks with one shared, test-only helper keyed by exact media-query strings. Repository inspection found four broad predicates, not only the two identical `stubPhoneWidth` copies: `MapExplorerLocateFab.test.tsx`, `MapExplorerSearchThisArea.test.tsx`, `MapExplorerSidebarTrap.test.tsx`, and `ChartViewTip.test.tsx` all answer the phone value for any query containing `max-width`. `Calendar.test.tsx` narrows that to `max-width:640px` but still uses substring matching and should join the same helper rather than remain a fifth local phone-query implementation.

The helper should return `true` for the app's exact `'(max-width:640px)'` query only when the test enables phone width, return `false` for every unlisted query, and allow exact independent values for queries such as `'(prefers-reduced-motion: reduce)'`. It must also support the listener notification used by the sidebar rotation tests. Production `useIsPhone`, its query, and responsive behavior do not change. This remains an Improve-lane test-infrastructure hardening.

## Why now

The proposed extraction threshold has been crossed: the same unsafe classification exists in four suites, including one reactive viewport harness and one component that already reads two different media queries. The current tests happen to stay honest only because no rendered production tree asks these stubs a second `max-width` question today. The stylesheet already has a distinct 1024px tablet tier; if a future render branch reads that tier, every broad stub would report phone and tablet as matching together and could keep a wrong branch green.

## User-facing impact

None. This changes test infrastructure only: no UI, behavior, data, network request, accessibility output, or shipped bundle changes. It therefore needs no version bump, changelog entry, documentation update, release, or deployment.

## Design pass

Not needed. There is no visual or interaction change to evaluate; the work only makes viewport test doubles model their owned queries precisely.

## Decisions touched

- The v1.0.20 focus-trap decision says the modal flag cannot disagree with CSS because `useIsPhone` reads the same `'(max-width:640px)'` boundary. This work strengthens the tests around that invariant; it does not alter it.
- The Calendar Tuneup decision established `useIsPhone` as the sanctioned render-safe `matchMedia` store with change listeners and an old-Safari listener fallback. The shared double must preserve that observable contract. No part of the production decision is reversed.
- The testing methodology's non-vacuity and honest-double rules are applied: a stub answers only the query it owns, unknown queries fail closed, and the reactive case proves notification rather than merely returning a convenient snapshot.

## What done looks like

- One shared test helper covers static and listener-driven media-query cases, with exact query/value routing and `false` as the default for unknown queries.
- The four broad `max-width` predicates are gone; Calendar's partial substring predicate is migrated too, leaving no component-test phone stub that classifies by substring.
- A regression row proves phone can be `true` while `'(max-width: 1024px)'` and `'(max-width:1024px)'` are both `false`; reduced motion remains independently controllable, and a phone-width transition notifies the subscribed `useIsPhone` path.
- The five affected suites pass unchanged in their product assertions, followed by frontend typecheck/build verification. No production or documentation file changes.
