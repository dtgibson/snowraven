# Help overlay: stop the documentation body scrolling sideways on a phone

### What this does

On a phone, the Help overlay's body scrolled horizontally: every line of prose ran off
the right edge mid-word and had to be dragged left and right to read. At 320px the help
body was 186px wider than the screen, and at 200% in-app text scale it was 372px.

The cause is layout, not content. The ≤640 tier flips `.sr-help-row` to
`flex-direction: column`, which hands the row's inline `alignItems: 'flex-start'`
control of the **cross** axis, and on a column that axis is width. So the content column
stopped stretching and shrink-to-fit to its widest child's min-content instead. That
child is the coordinates `<pre>`, which is `white-space: pre`, so its min-content is its
longest line: 494px at 100% text scale, 955px at 200%. The column's inline `minWidth: 0`
was powerless, because it relaxes the *main* axis.

The fix is two parts, and it needs both:

1. The content column gets a class (`sr-help-content`) and a ≤640 rule in `globals.css`
   that makes it fill the stacked row (`align-self: stretch` + `width: 100%`, both
   `!important` because the element carries an inline style block at specificity 1,0,0).
2. A wrap allowance on the same rule, for three strings that have no wrap opportunity at
   200% text scale: the links `github.com/dtgibson/snowraven-mini` (399.77px) and
   `ebird.org/downloadMyData` (326.89px), and the single H1 word "Documentation"
   (356.42px), all against a 296px column.

Part 1 alone still leaves 92px of drag at 320px/200% — measured, not assumed. See the
three-phase table below.

`docs/HELP.md` is unchanged: this is a layout defect. The coordinates `<pre>` is not the
bug either. Once the column is constrained it scrolls inside its own `overflow-x: auto`
box exactly as intended (296px box, 492px of content at 320px).

### How to test

See `how-to-see.md` in this directory for the click-by-click version. In short: build the
frontend, open the app at a 320px viewport, click **Help** in the footer, and scroll into
the prose. Before the fix the text runs off the right edge and the body drags sideways;
after it, every line wraps inside the screen. Repeat with Text Size at 200% in Settings.

### Measurements

Chromium, `deviceScaleFactor: 2`, the built bundle. The measured quantity is the **content
column against `.sr-help-row`'s content box** and the body scrollport's
`scrollWidth - clientWidth` (what the user can drag).

Page `scrollWidth` is deliberately **not** the assertion: it read a clean 320/390 in every
broken configuration, because the panel is `overflow: hidden`. Anything asserting on the
page would report this bug absent.

Before / after, plus the constraint-only half-fix to show the wrap allowance is
load-bearing rather than decorative:

| viewport | scale | phase | column | row content box | overflow | body drag | leaks |
|---|---|---|---|---|---|---|---|
| 320px | 100% | before | 494.28px | 296px | +198.28px | **186px** | 0 |
| 320px | 100% | constraint only | 296px | 296px | 0 | **0px** | 0 |
| 320px | 100% | **after** | 296px | 296px | 0 | **0px** | 0 |
| 390px | 100% | before | 494.28px | 366px | +128.28px | **116px** | 0 |
| 390px | 100% | **after** | 366px | 366px | 0 | **0px** | 0 |
| 430px | 100% | before | 494.28px | 406px | +88.28px | 76px | 0 |
| 430px | 100% | **after** | 406px | 406px | 0 | **0px** | 0 |
| 320px | 200% | before | 680px | 296px | +384px | **372px** | 0 |
| 320px | 200% | constraint only | 296px | 296px | 0 | **92px** | 3 |
| 320px | 200% | **after** | 296px | 296px | 0 | **0px** | 0 |
| 390px | 200% | before | 680px | 366px | +314px | **302px** | 0 |
| 390px | 200% | constraint only | 366px | 366px | 0 | **22px** | 1 |
| 390px | 200% | **after** | 366px | 366px | 0 | **0px** | 0 |
| 640px | 200% | before | 680px | 608px | +72px | 56px | 0 |
| 640px | 200% | **after** | 608px | 608px | 0 | **0px** | 0 |

"leaks" counts elements whose right edge passes the column's own content box. In the
constraint-only phase at 320px/200% the three are exactly the strings named above; the
biggest is the `snowraven-mini` link at +103.77px.

The before column reproduces the Evaluator's independently measured table to the
hundredth of a pixel (494.28 / 296 / 186 / 372 / 116 / 76 / 56), which is what
establishes that the harness is measuring the shipped behavior.

No regression above the tier. Every number is byte-identical before and after, and the
computed `align-self` stays `auto` and `overflow-wrap` stays `normal`, confirming the
rule does not reach past 640px:

| viewport | scale | before | after |
|---|---|---|---|
| 640px | 100% | 0px | 0px (unchanged) |
| 641px | 100% | 0px | 0px (unchanged) |
| 641px | 200% | 23px | 23px (unchanged) |
| 768px | 100% | 0px | 0px (unchanged) |
| 1024px | 100% | 0px | 0px (unchanged) |
| 1024px | 200% | 0px | 0px (unchanged) |
| 1440px | 100% | 0px | 0px (unchanged) |

### Notes for reviewer

- **The 641px/200% row is pre-existing and deliberately untouched.** That configuration
  has 23px of drag from the same `snowraven-mini` link in the two-column layout's 353px
  content column, and it measures identically before and after this change. It sits above
  the 640 tier, where `align-items: flex-start` is load-bearing for the sticky TOC, and
  the brief scopes this fix to ≤640. Flagging it rather than fixing it here.
- **Why the wrap allowance is spelled out in the rule instead of adding the existing
  `.sr-wrap-anywhere` class in the markup.** That helper is unconditional, and this
  defect and all of its evidence are phone-tier only; attaching the class would also
  change wrapping at 641px and up, which the brief excludes. The rule carries the same
  two declarations the helper does (`overflow-wrap: anywhere; word-break: break-word`),
  so behavior matches it exactly where it applies. No new shared utility was minted.
- **Both wrap declarations are inherited, and both are no-ops inside the `<pre>`**, where
  `white-space: pre` forbids wrapping. Verified: the `<pre>` still reports
  `overflow-x: auto`, `white-space: pre`, a 296px box and 492px of scrollable content.
- **Verification posture.** Per CLAUDE.md a CSS-only fix is proven against a real render,
  so the numbers above come from a browser, not a parsed stylesheet. Before and after are
  measured on the **same DOM nodes** in the same page: the element carried no class
  before this change, so removing the class restores the pre-fix state exactly, and the
  column is resolved by structural path (`.sr-help-row > *:nth-child(2)`) from the build
  that has the class, with the resolved node guarded on tag, sibling position, and child
  count.
- **The two unit tests are tripwires, not the proof**, and both are written as invariants.
  The stylesheet guard accepts any measured-equivalent constraint (`align-self: stretch`,
  `width: 100%`, or `min-width: 100%`) and either spelling of the wrap allowance, while
  rejecting: no rule, no `!important`, the constraint-only half-fix, and a rule hoisted
  out of the ≤640 tier. The jsdom guard asserts the class is on the row's second child
  **and** that nothing inline (`width`, `align-self`, `overflow-wrap`, `word-break`) could
  out-specify it, which is the v0.5.82 lesson that a class can ship inert. All six wrong
  implementations and three right ones were run through the suite by mutating the source;
  that exercise found a real dead branch in the guard's own helper (`/\b100%\b/` can never
  match, because `%` is not a word character), which is now fixed and commented.
- **Cascade competitor scan** over both emitted stylesheets (`index-*.css` and the lazy
  `vendor-maplibre-*.css`), testing the rightmost compound of every selector that sets any
  of the four properties: the only rule that can reach a bare `div.sr-help-content` is
  this one. The three `width: 100%` near-matches all require a `.sr-field-row` /
  `.sr-action-row-stack` ancestor. Confirmed mechanically in the **shipped** CSS that the
  rule sits at brace depth 1 inside `@media (width<=640px)` and unlayered.
- No version bump, changelog, or `docs/HELP.md` change: this is one build of a bundled
  Spool release, versioned once at the end.

### Files

- `frontend/src/components/HelpDocs.tsx` — the content column gets `className="sr-help-content"`
- `frontend/src/globals.css` — one new rule in the ≤640 tier, beside the existing
  `.sr-help-row` / `.sr-help-toc` overrides
- `frontend/src/lib/helpContentWidthCss.test.ts` — new stylesheet guard
- `frontend/src/components/HelpDocs.test.tsx` — one added DOM guard

Gates: `npx vitest run` 1944 passed / 146 files, `npm run build` (`tsc -b && vite build`)
clean, `npx eslint src --max-warnings=0` clean.
