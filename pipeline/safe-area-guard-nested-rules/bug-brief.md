# Bug Brief — safe-area-guard-nested-rules

## What is broken

Five stylesheet absence guards promise that an `env(safe-area-*)` declaration cannot reach web without the `.sr-ios-app` gate, but all five inspect only top-level/column-0 rules. The same ungated selector indented inside any block at-rule is invisible and the suite stays green. This is a test-enforcement defect, not a live CSS defect: `globals.css` is correctly gated today.

The exact affected checks are:

| suite | guarded ungated selector(s) | blind mechanism |
|---|---|---|
| `breedingCodePinnedCss.test.ts` — “gates EVERY safe-area rule…” | `.sr-bc-matrix--pinned…` | `^` with `/m` requires the selector at column 0 |
| `lifeListPinnedCss.test.ts` — same title | `.sr-ll-table--pinned thead th` plus its four focus selectors | looks only in `parseTopLevelRules(css)` |
| `iosChrome.test.ts` — Help panel | `.sr-help-panel` | looks only in `parseTopLevelRules(css)` |
| `iosChrome.test.ts` — skip link | `.sr-skip-link` and `.sr-skip-link:focus` | looks only in `parseTopLevelRules(css)` |
| `mapIosFullscreen.test.ts` — fullscreen panel | `.sr-map-fullscreen-panel` | looks only in `parseTopLevelRules(css)` |

Controlled mutations are decisive: an ungated rule at column 0 makes every named check red; put the identical rule inside, for example, `@media (max-width: 900px) { … }` and every check remains green. Baseline is 79/79 passing across the four suites.

## Root cause

There are two mechanisms with one underlying category error.

1. The Breeding Codes raw-CSS regex anchors at line start without allowing indentation: `^\.sr-bc-matrix--pinned…/m`.
2. The other four checks ask `parseTopLevelRules` for an exact base-selector body. That helper deliberately skips every at-rule block whole. This is correct for a positive any-width claim (“this rule must be top-level”), but incomplete for a whole-stylesheet absence claim (“this selector must never reach `env()` ungated”). Absence has two territories: top-level and nested.

A DRY consolidation into a media/supports/container/layer tier is precisely the realistic edit that moves a rule into the missed territory.

## Impact and blast radius

`index.html` ships `viewport-fit=cover` to browsers, so safe-area environment values are non-zero in ordinary iOS Safari. If a future edit adds one of these ungated nested rules, shipped web rendering on notched phones changes: pinned headers/focus offsets, Help panel geometry, the skip link, or the fullscreen map can be inset as though they were inside the native app. The affected assertions would falsely certify the gate.

Scope is test-only: the four suites above and, if useful, the shared test-only stylesheet helper. Do not change `globals.css`, components, runtime code, or the intended positive behavior of `parseTopLevelRules`; its at-rule exclusion remains load-bearing for any-width checks. Preserve exact selector discrimination so gated descendants cannot satisfy an ungated-base lookup. Cover arbitrary block at-rules and nesting, not only one literal media query or indentation width.

## What done looks like

- Each of the five named absence guards scans both top-level and at-rule-nested territory while excluding selectors gated by `.sr-ios-app`.
- The current stylesheet stays green.
- For every guard, a controlled ungated `env(safe-area-*)` mutation fails both at column 0 and when indented inside an at-rule; the corresponding gated rule stays green.
- Existing positive top-level/any-width assertions keep their present semantics.
- No production source or rendered CSS changes. Because Tailwind v4 scans test-file text for class candidates, verify the built CSS is byte-identical to an equivalent baseline rather than assuming a test-only edit cannot affect the bundle.

## Recorded decision

This closes the v0.5.85 finding in `DECISIONS.md` and `ROADMAP.md`: absence assertions over stylesheets must be mutation-checked in both top-level and tier-nested territory. A design pass is not needed; there is no visual change.
