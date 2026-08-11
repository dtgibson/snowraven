# Change Brief — stylesheet-guard-exact-selectors

## What is changing

Convert selector *selection* in the two remaining substring-matching stylesheet guards to exact
comparison, per the CLAUDE.md sub-rule and the `mapFabCascade` / `helpContentWidthCss` house pattern.
Two of the three defects found are live in the current tree, not theoretical:

1. **`filterControlSizeCss.test.ts:146` is INERT in one third.** `expect(sel).toContain('input')` is
   satisfied by the class name `.sr-input-16`, never by the `input` element it names. Mutation-verified:
   narrowing the rule to `:is(button, select)` leaves the assertion PASSING; the `button` mutation
   correctly fails. This is the per-partition non-vacuity defect CLAUDE.md records for `mapFabCascade`'s
   glyph half, in a second file.
2. **`breedingCodePinnedCss.test.ts` `ruleBody`/`ruleOffset` collide on a prefix.**
   `'.sr-bc-matrix--pinned thead th'` has **two** occurrences (line 1031, and inside
   `.sr-ios-app .sr-bc-matrix--pinned thead th` at 1079); `'.sr-pinnote--enter'` has two (1194 top-level,
   1196 inside `@media (prefers-reduced-motion)`). Both resolve correctly *only* by source order.
   Mutation-verified: a pure reorder makes the base-rule guard silently assert against the iOS rule.
3. **Same two helpers search the RAW `css`**, comments included, inconsistent with the same file's
   `declarations`. Mutation-verified: a comment containing `selector + ' {'` hijacks the lookup.

## Why now

`ROADMAP.md` "On the Horizon" names exactly these two files; `helpContentWidthCss.test.ts` was converted
during the v0.5.84 spool and `mapFabCascade.test.ts` is the reference. The seed idea assumed both guards
were merely fragile. They are not: one assertion cannot fail today, and two lookups are one source-order
edit away from testing the wrong rule.

## User-facing impact

None. Test-only hardening. No `globals.css` edit, no component edit, no shipped-bundle change
(`cssTopLevelRules.ts` is test-only and nothing in the app imports it). No version bump (build 2 already
set 0.5.85).

## Design pass

Not needed — no visual change.

## Decisions touched

`DECISIONS.md:129` — "The skip link takes the safe-area inset on focus only; and the stylesheet-guard
parser is extracted at its third consumer" (v0.5.82). Its carve-out reads *per file*: "Deliberately not
migrated: `filterControlSizeCss.test.ts` and `breedingCodePinnedCss.test.ts` ask offset questions a
selector→body map cannot answer." This build refines it to **per question**, matching what CLAUDE.md
already records at v0.5.84 ("`breedingCodePinnedCss.test.ts` now does BOTH"). Verified against the real
stylesheet: every selector `breedingCodePinnedCss` looks up by body IS top-level reachable through
`parseTopLevelRules`; its *offset* questions are not, and `filterControlSizeCss`'s two subjects
(`.sr-input-16`, `.sr-ctl-row :is(...)`) are not top-level at all, being ≤640-tier rules. That entry's
standing rule also governs verification here: a green suite after a guard refactor is not evidence.

## Scope: what changes, what must not

**Changes (comparison only).** `filterControlSizeCss`: `sizingRules`, the `.sr-ctl-row` descendant
filter, `stackingRules`, the `.sr-map-sidebar-overlay` scope test, `widthRule`, and the inert tag check
(which must assert against the rule's element list, not the joined selector string). Split selector lists
on `,`, not `'\n'`. `breedingCodePinnedCss`: `ruleBody` moves onto `parseTopLevelRules` (exact keys,
comments stripped); `ruleOffset` keeps a local helper but gains exact selector matching; the
`.sr-bc-legend` scope filter at :319 tightens (`/^\.sr-bc-card\b/` today admits `.sr-bc-card-x`).

**Must NOT change.** Both files keep their own local parsers for the *offset* questions: which tier a
rule sits in, whether a tier is bounded, source order between two rules, and at-rule containment. The
`.sr-ctl-row` and `.sr-map-sidebar-overlay .sr-field-row > *` subjects are deliberately DESCENDANT
selectors, so exact-match must mean "rightmost compound is the descendant", not equality with the
ancestor. `legendRuleBody()` (:271) is already correctly anchored and stays. Negative/absence assertions
(:112, :131, :181, :307) are conservative by over-inclusion and stay.

**Never-vacuous companions.** Both files already have anchors and no new ones are needed:
`filterControlSizeCss` fails on rule deletion via :74/:87 and :168/:202; `breedingCodePinnedCss` throws
from `ruleBody`/`ruleOffset` and asserts explicitly at :272, :306, :320, :340. The gap is per-assertion,
not per-file, and is what item 1 above fixes.

## What done looks like

Both suites green (40 tests today) with no `globals.css` edit. Each converted assertion mutation-checked
in the form its defect returns in: the dropped-`input` mutation now goes RED, the source-order reorder
now goes RED, the comment-decoy now goes RED, and the rules that must stay green (the shipped stylesheet,
and `.sr-bc-card > .sr-bc-legend` vs `.sr-bc-card .sr-bc-legend`) stay green. `ROADMAP.md` entry removed;
CLAUDE.md's "still remains in `filterControlSizeCss` and `breedingCodePinnedCss`" sentence updated, and
its `parseTopLevelRules` consumer count re-derived rather than incremented.
