# stylesheet-guard-exact-selectors

Build 3 of the v0.5.85 Spool bundle. Test-only.

### What this does

Converts selector *selection* in the last two substring-matching stylesheet guards —
`frontend/src/lib/filterControlSizeCss.test.ts` and
`frontend/src/lib/breedingCodePinnedCss.test.ts` — to exact comparison, per the CLAUDE.md
sub-rule and the `mapFabCascade.test.ts` / `helpContentWidthCss.test.ts` house pattern.

The seed idea assumed both guards were merely fragile. They were not. Three defects were
live in the tree, each mutation-verified against the real `globals.css` rather than reasoned
about:

1. **One assertion could not fail.** `filterControlSizeCss`'s "reaches buttons, selects and
   inputs" tested `expect(sel).toContain('input')` against the joined selector string, which
   the *class name* `.sr-input-16` satisfies on its own. Narrowing the shipped rule to
   `:is(button, select)` left it **GREEN**, while the identical `button` mutation correctly
   went red. This is the per-partition non-vacuity defect CLAUDE.md records for
   `mapFabCascade`'s glyph half, live in a second file.
2. **Two prefix collisions held off only by source order.** `ruleBody`/`ruleOffset` used
   `css.indexOf(selector + ' {')`, and `.sr-bc-matrix--pinned thead th` also occurs inside
   `.sr-ios-app .sr-bc-matrix--pinned thead th` (as `.sr-pinnote--enter` does inside
   `@media (prefers-reduced-motion)`). Deleting the base pinned rule outright left the
   source-order guard **GREEN**, silently asserting against the iOS rule. That is property #1
   in `cssTopLevelRules.ts`'s own docblock, in a file that already imported it.
3. **Both helpers searched the raw stylesheet with comments intact**, inconsistent with the
   same file's `declarations`. A doc comment quoting a rule hijacked the lookup: a comment
   reading `/* .sr-pinstatus { display: block; } */` above a real rule that had gained
   `padding` kept the chromeless-wrapper assertion **GREEN**.

### How it was verified

20 mutations, each applied inside its own rule's block after asserting the needle is unique
in the file, so no mutation can land in an unrelated rule that shares a common declaration.
Mutations cover **selectors**, not only declarations, and reach into each scan's exclusive
territory (the `.sr-input-16` subject and the `.sr-ctl-row` subject separately; `ruleBody`
and `ruleOffset` separately). `HEAD` is the pre-change guard restored from HEAD and run
against the identical mutated CSS.

**The two `HEAD` columns are separate on purpose.** A single "before: GREEN" reads as
file-level, and for B1 and B7 that would overstate the finding: the HEAD *file* was already
red there for an unrelated reason, and what was green is the specific assertion the mutation
targets. Stating only the coarse figure is the exact failure this bundle has already been
bitten by twice.

| # | mutation | HEAD: targeted assertion | HEAD: whole file | now |
|---|---|---|---|---|
| F1 | drop `input` from the `:is()` list — **the finding-1 defect** | GREEN | GREEN | RED |
| F2 | drop `button` from the `:is()` list (control) | not run | not run | RED |
| F3 | drop `select` from the `:is()` list | not run | not run | RED |
| F4 | SELECTOR: rename `.sr-input-16` → `.sr-input-16-lg` | GREEN | GREEN | RED |
| F5 | SELECTOR: rename `.sr-ctl-row` → `.sr-ctl-row-x` | RED | RED | RED |
| F6 | size the CONTAINER itself (`.sr-ctl-row`, no descendant) | not run | not run | RED |
| F7 | SELECTOR: scope the stacking rule to an ancestor that does not exist | GREEN | GREEN | RED |
| F8 | SELECTOR: width on the ROW instead of the stacked FIELDS | GREEN | GREEN | RED |
| F9 | *equivalent*: reflow the selector group onto one line | not run | not run | GREEN |
| F10 | *equivalent*: child combinator instead of descendant | not run | not run | GREEN |
| B1 | PREFIX COLLISION: delete the base pinned rule | **GREEN** | RED¹ | RED |
| B2 | *equivalent*: `.sr-ios-app` rule moved above the base it cannot lose to | not run | RED | GREEN |
| B3 | COMMENT HIJACK: doc comment quoting the rule, real rule gains padding | GREEN | GREEN | RED |
| B4 | DRY-CONSOLIDATION: entry animation moved into the phone tier | GREEN | GREEN | RED |
| B5 | drop one of the four focus selectors (`tbody th *`) | not run | not run | RED |
| B6 | drop one of the four iOS focus selectors (`tbody td *`) | not run | not run | RED |
| B7 | SELECTOR: the `\b`-against-a-hyphen trap, `.sr-bc-card` → `.sr-bc-card-x` | **GREEN** | RED² | RED |
| B8 | *equivalent*: descendant combinator instead of child | not run | not run | GREEN |
| B9 | *equivalent*: reorder the four focus selectors within the group | not run | not run | GREEN |
| B11 | PREFIX COLLISION: an earlier duplicate `.sr-pinnote--enter` masks the rule that governs | GREEN | GREEN | RED |

¹ The HEAD file was already red on two *other* assertions (`ruleBody` resolved to the
`.sr-ios-app` rule and failed the `position: sticky` and hairline checks). The source-order
assertion itself passed, confirming the ordering of a rule that no longer existed.
² The HEAD file was already red on `legendRuleBody()`'s anchored regex, which is correct and
untouched. The scope assertion itself passed on `.sr-bc-card-x`.

**Nine mutations the old guards accepted now go red** — seven of them at file level (F1, F4,
F7, F8, B3, B4, B11) and two at assertion level inside an already-red file (B1, B7). **Four
rewrites a guard must not reject stay green** — F9 (reflow onto one line) and B9 (reorder the
selectors in a group), which are strictly cascade-neutral, plus F10 and B8 (child vs
descendant combinator), which are not neutral in general but are equally correct here because
the element is a direct child either way. B2 is the case that goes the other way: the old
guard went *red* on a reorder that changes nothing (the `.sr-ios-app` rule wins on specificity
at (0,2,2) vs (0,1,2), so its position is irrelevant), because it had resolved to the wrong rule.
F5 was already caught incidentally by the old container-hook regex; recorded as-is rather than
claimed as new.

**Label collision, disambiguated.** The Tester's report also has a "B10", and it is a
DIFFERENT mutation of the same `.sr-pinnote--enter` collision class. Both are accurate and
neither party measured wrong; the row above has been relabelled **B11** so a later reader is
not misled. The Tester's count of eight false-positive removals is over this build's original
19; the nine above is over 20, the extra one being B11. B11 was prompted by the Tester's
finding but measured independently here.

B11 is the sharpest of the collision set, because the two duplicate rules resolve in *opposite*
directions: `css.indexOf` returns the FIRST occurrence while the cascade applies the LAST, so
planting an earlier duplicate carrying the healthy value hides a real `animation: none` on the
rule that actually governs. `parseTopLevelRules` resolves a duplicate key last-wins, which is
what the cascade does, so the new guard reads the rule in force.

The Tester ran 35 mutations in total: all 19 of this build's reproduced exactly, and 16 further
mutations put all 40 assertions across both files on record as live, with no other inert
assertion found.

`globals.css` was restored from a pristine copy after every mutation and verified
byte-identical to HEAD (`git diff` = 0 lines).

### The three things the sweep established

- **"Exact" means the RIGHTMOST COMPOUND, not string equality.** `.sr-ctl-row :is(button,
  select, input)` and `.sr-map-sidebar-overlay .sr-field-row > *` are deliberately descendant
  selectors; equality with the ancestor would invert what they assert. For a CONTAINER hook
  the LEADING compound is matched instead, and the bare `.sr-ctl-row { font-size }` form is
  **deliberately still admitted** — excluding it would drop the offending rule out of the set
  and leave the assertion that exists to reject it passing vacuously on the very bug it names.
- **A class name can stand in for the element it is named after**, which is exactly how F1
  went inert. The element list is now read off the rule's own type selectors, `:is()`
  arguments included, never off the selector text.
- **`\b` sits happily between a word character and a hyphen**, so `/^\.sr-bc-card\b/` admits
  `.sr-bc-card-x`. Same trap as the `/\b100%\b/` one CLAUDE.md records.

### Scope boundaries held

- `breedingCodePinnedCss`'s **`ruleBody` moved onto the shared `parseTopLevelRules`** (every
  selector it looks up is top-level reachable); its **`ruleOffset` did not**, because source
  order is the one question a selector-to-body map throws away. The carve-out
  `DECISIONS.md:129` records per *file* is now per *question*.
- **`filterControlSizeCss` keeps its local parser entirely.** Both its subjects are ≤640-tier
  rules, and `parseTopLevelRules` skips at-rule blocks whole, so neither is even present in
  its map.
- `legendRuleBody()` was already correctly anchored and is untouched. The negative/absence
  assertions (conservative by over-inclusion) are untouched.
- The four-selector focus rules are now asserted **one selector at a time** rather than as one
  literal list string, so the invariant survives a reflow (B9) while dropping any of the four
  goes red (B5, B6).
- `parseTopLevelRules`' consumer count was **re-derived, not incremented**: still five. This
  build widened `breedingCodePinnedCss`'s use of it without adding a consumer.

### Notes for reviewer

- **No `globals.css` edit, no component edit, no shipped-bundle change — and that last claim is
  MEASURED, not assumed.** It was briefly false. Tailwind v4's auto source detection scans test
  files and extracts bare words from comments as class candidates, so one word in a comment this
  build added emitted a real rule into the production stylesheet (+219 bytes, different content
  hash). No element carried the class, so nothing rendered differently, but "test-only" was not
  true. The comment was reworded rather than the claim weakened, and the first repair
  reproduced the defect by naming the word inside its own warning. Controlled A/B, same
  directory and toolchain, both arms built from this working tree:

  | arm | file | bytes | sha256 (first 16) |
  |---|---|---|---|
  | HEAD (both test files reverted) | `index-CrwYPorM.css` | 45,506 | `6a099c257c102b17` |
  | HEAD again (determinism control) | `index-CrwYPorM.css` | 45,506 | `6a099c257c102b17` |
  | build 3 | `index-CrwYPorM.css` | 45,506 | `6a099c257c102b17` |
  | build 3 again (reproducibility control) | `index-CrwYPorM.css` | 45,506 | `6a099c257c102b17` |

  **Byte-identical to HEAD at the same content hash**, with both controls passing. The 219-byte
  delta reproduced exactly before the fix. Written up as a standing convention in `CLAUDE.md`,
  because it is not specific to this build: any comment in any test file in this repo can
  silently add a rule to the shipped stylesheet, and the cost falls on words NEW to the whole
  corpus (16 of the 18 commonest single-word utilities are already emitted at HEAD), which makes
  it invisible to review and detectable only by measuring.
- `cssTopLevelRules.ts` is test-only and nothing in the app imports it (re-verified: the only two
  non-test files naming it do so in a comment).
- **A pre-existing blind spot, out of scope, noted accurately because it is easy to record as
  narrower than it is.** The "no ungated `env(safe-area-*)`" check is defeated by an at-rule tier
  in **five guards, by two distinct mechanisms**: a line anchor in `breedingCodePinnedCss`, and
  `parseTopLevelRules` skipping at-rule blocks whole in `lifeListPinnedCss`, `iosChrome` (twice)
  and `mapIosFullscreen`. All five catch an ungated `env(safe-area-*)` at column 0 and all five
  miss it indented inside an at-rule tier. Pre-existing, untouched by this build, captured for
  the roadmap; it is a five-guard pattern, not a single-file issue.
- **No version bump** — build 2 already set 0.5.85; the changelog entry lands under the
  existing heading.
- **Deliberately out of scope, flagged for the roadmap:** the declaration matcher
  `/width\s*:/` also matches `min-width:`/`max-width:`. That is declaration-matching
  looseness, not selector looseness, and this build was about selectors.
- **Also deliberately left alone:** the `@media (prefers-reduced-motion)` probe in
  `breedingCodePinnedCss` is a third raw-`css` search. It is an at-rule *containment* question
  rather than selector selection, and it fails red on absence, so it is sound if brittle. Not
  in this build's scope.
- The selector-analysis helpers (`splitList` / `compounds` / `simpleParts`) are now a third
  copy of `mapFabCascade.test.ts`'s. That is the threshold at which `cssTopLevelRules.ts` was
  extracted, and it is on the roadmap — held back here because extracting means editing
  `mapFabCascade.test.ts`, whose `specificity()` is built on its copies and would need its own
  mutation pass.

### Verification

| gate | result |
|---|---|
| `npx vitest run` | 163 files, **2211 passed** (the two suites still 40, unchanged) |
| `npm run build` | clean |
| `npm run lint` | clean |
| `backend/.venv/bin/python -m pytest backend/tests/ -q` | **193 passed** |
