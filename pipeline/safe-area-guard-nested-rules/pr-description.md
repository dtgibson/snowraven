# PR Description — safe-area-guard-nested-rules

## Summary

Repairs the stylesheet safety net that keeps native safe-area declarations behind the
native-app scope. The existing checks covered top-level rules but missed equivalent declarations
inside block at-rules or native nested rules. The shipped stylesheet was already correct; this
change strengthens its enforcement without changing rendered CSS or runtime behavior.

## What changed

- Added a fail-closed `css-tree` AST walk beside `parseTopLevelRules`. The established top-level
  parser remains byte-for-byte unchanged and still excludes at-rule bodies for positive
  “applies at every width” assertions. `css-tree` and its TypeScript declarations are explicit
  frontend dev dependencies.
- Extended the parser for valid implicit CSS nesting and the `||` column combinator. The walker
  resolves explicit and implicit nesting, `@scope`/`:scope`, and every `:is()`/`:where()`
  alternative structurally. Malformed CSS or residual parser recovery nodes throw instead of
  being treated as safe.
- Represents selector alternatives as directed constraint graphs. Functional branches converge
  on their rightmost subject, preserving the compound that contains `:is()`/`:where()` while
  keeping earlier branch compounds as independent ancestry constraints. This closes the audit
  bypass where `.sr-ios-app:is(.web > .sr-help-panel)` was incorrectly flattened into an
  apparent native-app ancestor.
- Applies one deterministic 4,096-path expansion budget before functional, selector-list,
  native-nesting, and scope Cartesian products. Over-budget stylesheets fail closed with a stable
  diagnostic instead of risking unbounded allocation or a stack overflow.
- Handles arbitrary block at-rules, escaped identifiers, exact and token-list class attributes,
  duplicate selector occurrences, and quoted/commented false positives. Only a proven
  `.sr-ios-app` ancestor connected by a descendant or child relationship gates a surface;
  same-compound classes, later descendants, adjacent/sibling/column relations, and incidental
  functional mentions do not.
- Added shared queries for every safe-area rule on a named surface, the subset lacking a real
  native-app ancestor, and AST-confirmed declaration metadata. Safe-area evidence comes only
  from a parsed `env()` call whose first identifier decodes to `safe-area-*`.
- Rewired the five historically recorded guards: Breeding Codes pinned band, Multimedia pinned
  band, Help panel, skip link, and fullscreen map panel.
- The root-cause sweep found two more current negative guards with the same gap: the Help TOC
  and map FAB cluster. They now use the same all-depth check.
- The fullscreen sidebar's double-inset check was also top-level-only. It is stricter than the
  gate checks: no `padding-left` declaration containing a safe-area `env()` belongs on that
  surface, even with the native scope. It now filters decoded declaration properties returned by
  `findSafeAreaDeclarations`, so escaped spellings and nested values cannot bypass the invariant,
  while an unrelated safe-area property plus `padding-left: 0` is not misclassified.

## Reverification after the failed audit

- Focused CSS guard run: **6 files, 180 tests passed** (seven new regressions beyond the earlier
  173-test round).
- Shared helper suite: **70/70 passed**.
- Independent directed-selector probe: **36/36 passed**, including the original audit bypasses,
  nested and mixed-branch variants, and true-gated controls.
- Repository mutation matrix: **64/64 expected outcomes** across 16 selector forms and seven
  protected surfaces.
- Independent expansion-boundary probe: **8/8 passed** across chained functional selectors,
  selector lists, nested-parent products, and scope/rule products. Exact 4,096-path inputs were
  accepted; 4,097-, 4,160-, and 8,192-path inputs failed closed. The combined probe completed in
  0.19s with 132,907,008-byte maximum RSS and no OOM.
- Clean full frontend rerun: **164 files, 2,301 tests passed** with two workers. An earlier
  unrestricted-worker attempt encountered host worker-pool contention; it produced no Build-2
  CSS assertion failure and was not used as passing evidence.
- TypeScript project check and touched-file ESLint passed.
- Full backend suite passed **193/193** with one existing Starlette warning. Rust library, binary,
  and documentation harnesses passed; the crate currently defines zero tests.
- `npm audit` reported **0 vulnerabilities** across 386 dependencies.
- `git diff --check` and the production build passed; the build emitted only the existing
  large-chunk warning.
- Fresh current and isolated `df42ec2` builds emitted byte-identical application and vendor CSS:
  the same filenames, byte counts, SHA-256 hashes, and clean `cmp` results.

## Scope

Changes are limited to the CSS inspection helper, its consumer tests, and the explicit `css-tree`
dev dependency metadata. There is no change to `globals.css`, components, runtime modules,
version, or changelog, and no visual or production behavior change.

This Tester round is a PASS. The existing failed security report remains authoritative until a
fresh Auditor round reviews the structural repair and issues a new verdict.
