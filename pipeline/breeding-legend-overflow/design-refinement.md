# Design Refinement — breeding-legend-overflow

The Breeding Codes tier legend in **Normal view** leaks its longest labels out of
the card and off the screen on a narrow phone at large text scale. The labels must
stay fully readable (v0.5.56), so they wrap. This is the design of that wrap, and
of the scope that keeps everything else still.

## Visual Direction

Quiet utility, unchanged. Nothing about the legend's look moves: same surface, same
tier dots, same type, same 16px group gap, same bold-code-then-meaning chip. The
only thing that changes is that a label too wide for a phone line stops being
unbreakable. Above the phone tier, and in the Unbounded view at every width, the
legend renders byte-identically to what ships today.

## The decision

Of the four directions the Evaluator named, this takes **wrap mid-label** —
constrained to the phone tier and to Normal view — and rejects the other three on
measurement. But the naive form of "wrap mid-label" does not work, and finding out
why is most of this design.

### What is actually broken

Re-measured on a real render (Chromium, the shipped legend DOM and CSS reproduced;
the reproduction agrees with the brief's independently measured baseline to 0.01px —
64.16 against 64.17, widest chip 278.16 against 278.17 — and reads clean at a
known-good 1440px/1x).

**The defect is wider than the brief recorded.** The brief measured the 13-code
demo dataset. With all 23 breeding codes present — an ordinary complete breeding
list — the worst text ink past the legend's content box is:

| Normal view | brief (13 codes) | re-measured (23 codes) |
|---|---|---|
| 320px / 2x | 64.17 | **81.08** |
| 360px / 2x | 24.17 | **41.08** |
| 390px / 2x | 0 *(recorded clean)* | **11.08** |
| 320px / 1.5x | 3.36 *(near-miss)* | **16.20** |
| 430px+, all scales | 0 | 0 |

So the band reaches **390px** and **1.5x**, not 360px and 2x only. The worst label
is `B Wren/Woodpecker Nest Bldg` (max-content 295.08px), not `CN Carrying Nesting
Material` (278.16px). This matters for QA's grid and for the "what done looks like"
claim, which was written against the narrower band.

### Why relaxing `white-space` alone is not enough

Measured: it leaves **22.19px** still leaking.

One label, `C Courtship/Display/Copul.`, contains a 24-character run with no break
opportunity — Chromium does not offer a break after `/` here — whose min-content is
**236.19px** against a **214px** line (238px content box less the 24px tier-dot
indent). The tier group `<div>` and the chip `<span>` are both flex items with
`min-width: auto`, whose automatic minimum size is their min-content width, so both
were being floored at 236.19px regardless of the available space. Releasing both
floors lets the box reach the line; `overflow-wrap: break-word` then breaks that one
run inside it.

Per-chip min-content at 200% scale confirms this is a single outlier: the next
largest unbreakable run is 177.47px (`Wren/Woodpecker`), comfortably inside the line.

### The rule

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

Every declaration is load-bearing. Removed one at a time, 23 codes at 320px/2x:

| mutation | box past | ink past |
|---|---|---|
| all three present | 0 | **0** |
| drop `min-width: 0` on the tier group | 22.19 | 22.20 |
| drop `min-width: 0` on the chip | 22.19 | 22.20 |
| drop `overflow-wrap: break-word` | **0** | **22.20** |
| revert `white-space` to `nowrap` | **0** | **81.08** |
| shipped baseline | 81.08 | 81.08 |

**The last two rows are the most important line in this document.** Two mutations
leave an element-box measurement reading a clean zero while text hangs 22px and 81px
outside it. Once a box may shrink to the line, an unbreakable run simply
ink-overflows it, and `getBoundingClientRect()` on the element cannot see that. The
brief's harness measures element boxes against the container's content box — correct
for the baseline, where nowrap text fills its box exactly, but it **will certify a
half-fixed build as clean**. This is the same family as the standing
`document.scrollWidth` rule: the proxy does not merely under-report, it reports the
bug as absent.

### Why wrapping stays readable

The obvious objection to wrapping a row of chips is that a continuation line strands
a word beside the start of the next chip — `Material  DD Distraction` reading as one
run. That cannot happen, and it is a property of flex line collection rather than
luck: items are collected onto a line only *while they fit*, so an item wide enough
to wrap is always **alone on its flex line**. Verified on the render at every probed
configuration — zero shared lines, in both datasets, at all five widths and four
scales. Every line in the legend therefore begins with a bold code, or continues the
line above it.

This is why no extra structure is needed. It is also why forcing
`flex-direction: column` at the tier was rejected: it would buy nothing that flex
already guarantees, while restructuring the legend at 640px/1x, where it works.

## Screens / Views

### Breeding Codes tab — tier legend, Normal view, ≤640px

Unchanged in structure: four tier groups in a wrapping flex row (`gap: 16px`), each
a colored 18px dot plus a text column holding the tier name and its codes. The 24px
dot indent **stays** — it is what groups a tier's codes under its heading at exactly
the moment the legend is tallest, and dropping it was measured insufficient anyway
(24px recovered against 81px needed).

What changes: a label wider than the line wraps onto a second line instead of
overhanging. At 320px/2x with all 23 codes, 11 of the 23 labels take a second line.

### Breeding Codes tab — Unbounded view, and every width above 640px

No change, by construction. See Scope.

### Everything else

Untouched.

## Component Usage

No components added or removed. `BreedingCodeTable.tsx` only: three class names
added, one inline declaration lifted.

## Design Tokens Applied

None added, none changed. This refinement declares no color, type, spacing, or
radius value.

## Interaction Notes

Two new class names and one view modifier. The Engineer must add all three; each
does a distinct job.

- **`.sr-bc-legend--normal`** on the legend, present exactly when `wideMode` is
  false — mirroring line 180's `className={wideMode ? 'sr-bc-card' : undefined}`.
  This is the scope, and it is load-bearing (see below), not decoration.
- **`.sr-bc-legend-tier`** on each tier group `<div>` (currently unclassed). Its
  inline `display`/`alignItems`/`gap` stay inline — only the class is added.
- **`.sr-bc-legend-chip`** on the chip `<span>`, with the inline
  `style={{ whiteSpace: 'nowrap' }}` **removed** — an inline style is specificity
  (1,0,0) and unreachable from a media query, the same trap `.sr-bc-card`,
  `.sr-bc-matrix`, and `.sr-bc-code-col` were each lifted out of.

Keyboard, focus, screen-reader output, `aria` and hit targets are all unaffected —
this changes where text breaks, nothing else.

## Motion Spec

**No motion.** Nothing animates, and nothing should.

- The change is a reflow that happens at a breakpoint or on a text-scale change, not
  a state transition a user triggers. There is no "before" state for motion to
  explain, and animating a text reflow is a jank source with no informational payload.
- No `transition`, no `transform`, no keyframes are added. `white-space` and
  `min-width` are not usefully animatable here in any case.
- `prefers-reduced-motion` is therefore not implicated: there is no motion to
  provide a calm fallback for. No existing reduced-motion handling is touched.
- The mockup is also deliberately static: a toggle that crossfaded between Before and
  After would make the reviewer hold one state in memory to compare it with the
  other. A geometric comparison wants both on screen at once.

## Content Notes

No copy changes in this refinement. The labels stay exactly as they are, fully
spelled out, never truncated or abbreviated — that is the v0.5.56 constraint and it
is preserved literally.

**One follow-up, deliberately out of scope.** `Courtship/Display/Copul.` is the only
label with an unbreakable run wider than a phone line, so it is the only one the fix
has to break mid-word. It renders:

```
C
 Courtship/Display/Co
pul.
```

Bounded and legible, and the correct behaviour for CSS that must hold for any label.
The real repair is the string: eBird's own name for code C is **Courtship, Display,
or Copulation**, whose commas are break opportunities. Measured with the label
reworded, the same configuration gives `C Courtship, Display, / Copulation` — no
orphaned code, no mid-word break, one line shorter. It is left out because the label
is a compile-time constant that also feeds the column `title` and the sort button's
`aria-label` (`Sort by Courtship/Display/Copul. (C)`), so rewording it changes
desktop rendering and an accessible name — a copy decision with reach well past this
tier and past a brief scoped to constraining the chip column. It goes to the roadmap
with the measurement attached. **The CSS must not be made to depend on it.**

## Scope — what must not move, and why it cannot

1. **Unbounded cannot change, as a property of the stylesheet.** The block is scoped
   to `.sr-bc-legend--normal`, which the component adds exactly when it omits
   `.sr-bc-card`. The two can never co-occur, so the block cannot match in Unbounded.
   This is doing real work: `min-width: 0` on the tier group lowers the legend's
   min-content, which is precisely the value `.sr-bc-card > .sr-bc-legend` reads.
   Without the scope this change would reach into v0.5.84's input. **Do not flatten
   the modifier into an unconditional class.**

2. **v0.5.84's rule is untouched and its rejection is not reopened.**
   `.sr-bc-card > .sr-bc-legend { width: min-content; min-width: 100%; }` stays
   byte-identical. `overflow-wrap: anywhere` was measured against the chosen rule and
   **renders identically** — same line breaks, same block height, same zero leak — so
   it buys nothing, while collapsing min-content to a single character, the shape
   that decision named and rejected. `break-word` never affects intrinsic sizing.
   **Do not "simplify" `break-word` + the two `min-width: 0` into `anywhere`.**

3. **Nothing above 640px moves.** The base rule reproduces the inline `nowrap` value
   exactly.

4. **Nothing that measures clean today moves.** Verified by fingerprinting every
   chip's x/y/width/height to 1/100px across 40 configurations (2 datasets x 5 widths
   x 4 text scales) in both builds: the only configurations whose rendering differs
   are the 7 that were already leaking. Both declarations are inert by construction —
   a box that fits renders identically whether or not it is allowed to shrink, and a
   `white-space: normal` box that fits renders identically to a `nowrap` one.

5. **The cascade was scanned after the specificity lift.** Moving `white-space` from
   inline (1,0,0) to a class (0,1,0), and giving two previously unclassed elements
   their first class, makes them reachable by rules that could not touch them before.
   Across `globals.css` **and** the bundled `maplibre-gl.css`, testing the *rightmost
   compound* of every selector setting `white-space`, `min-width`, `overflow-wrap`,
   `word-break` or `line-break`: one hit, `.sr-bc-card > .sr-bc-legend`, which targets
   the legend rather than either newly classed element and is unaffected. Re-run this
   after implementation.

## What The Engineer must not flatten

- The `.sr-bc-legend--normal` scope (see Scope 1).
- `break-word` into `anywhere` (Scope 2).
- Either `min-width: 0` — both are load-bearing and the mutation table proves it.
- The `overflow-wrap: break-word` declaration, which a box-based test will report as
  unnecessary. It is not; measure ink.

## Notes for QA

- **Measure text ink, not element boxes.** Client rects over a `Range` per text node,
  against the legend's *content box*. A box measurement passes two of the five
  mutations above.
- **Probe with all 23 codes present**, not only the 13-code demo dataset. The demo
  set omits `B`, the widest label, so it understates the leak. It does **include**
  `C` (28 rows), the one label with an unbreakable run wider than a phone line —
  extracted from `website/tools/demo-data/ebird-backup.csv`, which lists NY, N, S7,
  NB, FY, C, T, P, CF, S, FL, ON, CN. *(Corrected after implementation: this said
  the demo set omitted both. It omits `B` only. No measurement moves — `CN` is the
  widest chip in that set either way — but it matters for the argument, because
  `C` present means `overflow-wrap: break-word` and the two `min-width: 0` are
  load-bearing for the shipped demo dataset too, not only for a complete list.)*
- **Cover 390px and 1.5x**, which the brief's grid recorded as clean and which are
  not.
- Assert the guarantee, not just the absence of a leak: no flex line holds a wrapped
  chip alongside another chip.
- Stylesheet guard: `breedingCodePinnedCss.test.ts` already parses this file both
  ways. These rules sit inside a media block, so `parseTopLevelRules` will skip them —
  use that file's local offset helpers for the tier rule, and `parseTopLevelRules`
  for the top-level base rule. Compare selectors **exactly**; `.sr-bc-legend` is a
  prefix of `.sr-bc-legend-chip`, `.sr-bc-legend-tier`, and `.sr-bc-legend--normal`,
  so a `String.includes` guard here is guaranteed to lie.

## Deviations from the design system

One, deliberate: `design.html` declares the app's `'Inter', system-ui, ...` stack on
the reproduced legend, which `weft-design-lint` flags as `banned-font`. It is
declared once, on the product surface only; the document's own display face is a
distinctive serif. The entire subject of this refinement is *where text breaks*,
which is a function of exact font metrics — rendering the reproduction in any other
face would move every wrap point and every number in the document. Justified, not
overlooked.
