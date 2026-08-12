# breeding-legend-overflow

### What this does

The Breeding Codes tier legend leaked its longest labels out of the card and off
the screen in **Normal view** on a narrow phone at large text scale. Each code
renders as an unbreakable `white-space: nowrap` chip, no ancestor from the legend
up to `<body>` clips it, so at 320px / 200% text scale with a complete breeding
list the widest label (`B Wren/Woodpecker Nest Bldg`) ran **81.08px** past the
legend's content box, out through the card's rounded border and off the right edge
of the viewport, leaking page horizontal scroll.

The fix lets a chip too wide for a phone line wrap, scoped to the phone tier and to
Normal view. Three class names are added and one inline declaration is lifted into
the stylesheet; three CSS declarations do the work.

```css
/* top level — byte-identical to the inline value it replaces */
.sr-bc-legend-chip { white-space: nowrap; }

@media (max-width: 640px) {
  .sr-bc-legend--normal .sr-bc-legend-tier { min-width: 0; }
  .sr-bc-legend--normal .sr-bc-legend-chip {
    white-space: normal;
    min-width: 0;
    overflow-wrap: break-word;
  }
}
```

This is the converse of v0.5.84's `.sr-bc-card > .sr-bc-legend`, not a narrower
version of it. That rule stopped the legend *dictating an intrinsic card width*,
which can only happen in Unbounded. Here the card is fixed at the panel's width and
an unbreakable chip is simply wider than it — the exact failure v0.5.84's decision
entry anticipated by name when it rejected a zero contribution. v0.5.84's rule is
untouched, and its rejection is not reopened.

### How to test

`pipeline/breeding-legend-overflow/how-to-see.md` has the step-by-step. In short:
Breeding Codes tab, Text Size at 200%, window narrowed to a phone width, Normal
view. Before: the longest legend labels run off the right edge and the page scrolls
sideways. After: they wrap onto a second line, fully spelled out.

### Verification

**Real-render A/B, measuring text ink.** `legend-ink-probe.mjs` (Playwright /
Chromium) measures 320 configurations: 10 widths x 4 text scales x 2 views x 2
datasets (all 23 breeding codes, and a 13-code subset), across **two genuine
builds** — the built `dist/assets/index-*.css` from each revision, and the card
`outerHTML` the real component renders at that revision, dumped through jsdom so
nothing is retyped into a fixture. Simulating "before" by toggling a class was
rejected: it exercises only the DOM half of the change.

It measures **text ink through `Range` client rects**, not element boxes, because
two of the design's five mutations leave a box measurement reading a clean zero
while text hangs 22px and 81px outside it. Both figures are reported side by side.

| | before | after |
|---|---|---|
| Leaking configurations (ink past the legend's content box) | 7 | **0** |
| Unbounded configurations whose rendering moved | — | **0 of 80** |
| Previously-clean Normal configurations that moved | — | **0** |
| Wrapped chip sharing a flex line with another chip | — | **0** |

Leaks fixed, all in Normal view: 23 codes at 320px/1.5x (16.20), 320px/2x
(**81.08**), 360px/2x (41.08), 390px/2x (11.08); 13 codes at 320px/1.5x (3.36),
320px/2x (64.16), 360px/2x (24.16).

**Harness sanity, before any flagged number was trusted.** The reproduction
independently reproduces four prior measurements it was not fitted to: the brief's
13-code baselines (64.16 vs 64.17, 24.16 vs 24.17, and 3.36 exactly), the design's
23-code re-measurement (81.08, 41.08, 11.08, 16.20 — all exact), the legend's
238px content box at 320px, and the design's "11 of 23 labels take a second line at
320px/2x". A known-clean desktop 1440px/1x reads 0 in both builds.

**A third way page `scrollWidth` certifies a broken build.** On the 23-code set it
merely under-reported (360 where the element leaked 81.08). On the 13-code set it
reads **351 in both builds** — bit-identical across a change that takes the leak
from 64.17px to zero — because the out-of-scope filter pill row sits further past
the edge and masks the fixed element entirely. This joins the two mechanisms
CLAUDE.md already records (an `overflow: hidden` ancestor swallowing the signal, and
a left overflow never extending scroll width): **a co-located larger overflower
hides the element you are measuring.** Measure the element against its container's
content box.

The flex-line check was **found vacuous and repaired before its result was used**:
a chip is a flex item, so it is blockified and `getClientRects()` on the element
returns one border-box rect however many lines its text takes. The first cut
reported a confident zero shared lines while structurally unable to see any wrap at
all. It now counts line boxes through a `Range`, and carries a per-partition
non-vacuity assertion (chips must be enumerated, and some configuration must
actually wrap).

**Mutation testing, 24 mutations, 24 correct.** Declarations (drop either
`min-width: 0`, drop `overflow-wrap`, `break-word` to `anywhere`, base `nowrap` to
`normal`, add a hanging indent, add `word-break: break-all`), **selectors** (unscope
either tier rule so it reaches Unbounded, rename the class so the rule selects
nothing, narrow the scope to a class nothing carries), **both media bounds**
(consolidate into a lower-bounded tier, lower the upper bound, move the base rule
into the tier), the component (make `--normal` unconditional, invert it, restore the
inline `white-space`, drop the tier class), and v0.5.84's rule weakened to a zero
contribution — all correctly red. Three equivalent rewrites that change nothing
correctly stayed green.

That last group earned its place: one guard was written keyed on the literal
selector spelling `.sr-bc-card > .sr-bc-legend`, so rewriting it as a descendant
combinator — which selects the same element — turned it red. The guard was wrong,
not the mutation, and only running the must-stay-green cases surfaced it.

**Cascade-competitor scan, re-run after implementation.** The change lowers the
chip's `white-space` from inline (1,0,0) to a class (0,1,0) and gives two
previously-unclassed elements their first class; both make them newly reachable.
Scanning the **rightmost compound** of every selector across **both** stylesheets
the bundle emits (`globals.css` and the `maplibre-gl.css` chunk that stays in the
document once any map tab has mounted): 227 rules can match one of the four element
states, and exactly **one** sets a property that matters — `.sr-bc-card >
.sr-bc-legend`, which targets the legend rather than either newly classed element
and is byte-identical. The other 14 flagged hits are `> *` direct-child rules
(`.sr-field-row > *`, `.sr-action-row-stack > *`) whose ancestor the legend is a
*sibling* of, verified structurally in `BreedingCodeList.tsx` rather than by eye.
**No rule anywhere in the bundle sets `white-space`, `overflow-wrap`, `word-break`,
`line-break` or `min-width` on the chip or the tier group**, so the lift introduced
no competitor for the property it moved. The new rules are unlayered user CSS;
preflight sits in `@layer base`, and unlayered beats layered regardless of
specificity.

**Declaration-block multiset diff against HEAD** (comment-stripped, whitespace
normalized, at any nesting depth): **257 blocks before, 260 after, 0 removed or
weakened**, exactly the three intended additions. `globals.css` carries safe-area
gates, contrast tokens and accessibility guards, which is when CLAUDE.md says to
reach for this.

**Built-CSS diff.** A clean `dist/` from each revision differs by exactly the three
rules and nothing else — no Tailwind utility emitted from the new vocabulary in the
comments and test files (v4 auto source detection scans them).

`npx vitest run` 2228 passed / 163 files, `npm run build` clean, `npm run lint`
clean, `pytest` 193 passed. `weft-design-lint check src/` reports **zero `warn`**
and nothing on either touched file. Motion Spec is "no motion": no `transition`,
`transform` or keyframes are added, so `prefers-reduced-motion` is not implicated.

### Notes for reviewer

**An existing guard had to be repaired to land this, and the repair is the
interesting part of the diff.** `breedingCodePinnedCss.test.ts` asserted that no
`@media` tier redeclares the legend, by scanning the raw stylesheet for the
substring `.sr-bc-legend`. That string is a **prefix of all three new class names**,
so the guard went red the moment the phone-tier chip rules landed, reporting them
as "the legend declared inside an at-rule" when they declare nothing on the legend
at all. It now enumerates rules at any nesting depth and asks about each rule's
**subject** (its rightmost compound), matching `.sr-bc-legend` and its `--normal`
modifier exactly while ignoring descendants. Mutation-checked in the direction it
was written for: a tier redeclaring a width on the legend box, by either class
name, is correctly caught. This is the third `String.includes` selector matcher in
this file family to be converted; build 3 of this same bundle did the other two.

**What must not be flattened,** each proven load-bearing by measurement and locked
by a mutation test:

- **`break-word` plus the two `min-width: 0` must not become `overflow-wrap:
  anywhere`.** It renders identically here, and it collapses min-content to a single
  character — the zero-contribution shape v0.5.84 named and rejected, and
  min-content is exactly the value that rule reads. `break-word` never affects
  intrinsic sizing. These three are not a complete-list edge case: the shipped demo
  dataset **includes** code `C` (28 rows), the one label whose unbreakable run is
  wider than a phone line, so `break-word` and both floors are load-bearing for it
  too. Only `B`, the widest label, is absent there.
- **The `.sr-bc-legend--normal` scope.** It is what makes "Unbounded cannot change"
  a property of the stylesheet rather than an argument: the component adds it
  exactly when it omits `.sr-bc-card`, so the two can never co-occur. A component
  test asserts that mutual exclusion in both directions, because it is a property
  of the component and every CSS guard would stay green without it.
- **`overflow-wrap: break-word`**, which a box-based test reports as unnecessary.
  It is not; measure ink.
- **No hanging indent.** It was designed and rejected: `padding-left` changes the
  chip's box at every width in the tier, including configurations that must stay
  put. Flex collects items onto a line only while they fit, so a chip wide enough to
  wrap is always alone on its line (0 shared lines across all probed
  configurations), and every line opens with a bold code or continues the one above.

**Deliberately out of scope,** both flagged for the roadmap:

- **Rewording code C.** `Courtship/Display/Copul.` is the only label with an
  unbreakable run wider than a phone line, so it is the only one the fix breaks
  mid-word (`Courtship/Display/Co` / `pul.` — bounded and legible). eBird's own name
  for it, "Courtship, Display, or Copulation", has comma break opportunities and
  renders one line shorter with no mid-word break. It is a compile-time constant
  that also feeds the column `title` and the sort button's accessible name
  (`Sort by Courtship/Display/Copul. (C)`), so rewording it changes desktop
  rendering and an accessible name. **The CSS is deliberately not made to depend on
  it** and holds for any label.
- **The filter pill row** (`.sr-ctl-row` in `BreedingCodeList.tsx`) independently
  overflows 55.11px past its parent and reaches 31.11px past the viewport at
  320px / 200%, in **both** views. Same tab, same configuration, different element
  and different cause. It, not the legend, is what sets `document.scrollWidth`
  there.

**A scope claim I am not making, and a correction to it.** The probe's second
dataset is a 13-code subset built to match how the brief and design *described* the
synthetic demo dataset. That description was wrong, and my subset inherited the
error: the shipped demo data (`website/tools/demo-data/ebird-backup.csv`, verified
by extraction) is NY, N, S7, NB, FY, C, T, P, CF, S, FL, ON, CN — it omits `B`
only, and **includes** `C`. My subset omitted `C` and carried four codes the real
set does not.

No measurement moves, because `CN` is the widest chip in both sets, which is why
the subset reproduced the brief's figures to 0.01px. But the correction strengthens
the case rather than weakening it, so it is worth being precise about: with `C`
present in the shipped demo data, the residual that `overflow-wrap: break-word` and
the two `min-width: 0` exist to close is reachable there too. The 23-code set is
still the one the "what done looks like" claim rests on, and it agrees with the
design's independent measurement exactly.
