# help-overlay-641-leak

### What this does

Fixes a horizontal leak in the Help overlay at 200% text scale in a narrow band of
viewport widths just above the 640 phone tier. v0.5.83's `help-docs-phone-width`
wrote **both halves** of its fix inside `@media (max-width: 640px)`, so 641px and up
never received the wrap allowance. Above the tier the content column is exactly
`viewport − 288` (a fixed 200px TOC, 40px gap, 2 x 24px row padding), and the longest
unbreakable run in the help text renders 399.77px at 200% — the link
`github.com/dtgibson/snowraven-mini` breaks at its hyphen, leaving
`github.com/dtgibson/snowraven-` as one unbreakable fragment. At 641px that fragment
sat 46.77px past a 353px column and dragged the whole help body 23px sideways.

The fix is one rule: the **wrap allowance only**, scoped to the Help subtree in a
`@media (min-width: 641px)` block in `globals.css`.

Two things are deliberately *not* done:

- **The constraint half (`align-self: stretch` / `width: 100%`) stays ≤640-only.** It
  exists because the phone tier flips the row to `flex-direction: column`, which hands
  the parent's inline `alignItems: 'flex-start'` control of *width*. Above 640 the row
  is a real row, `flex-start` governs the vertical axis (load-bearing for the sticky
  TOC), and the column's inline `flex: 1; minWidth: 0` already fills correctly —
  measured `viewport − 288` at every width. Those two declarations would fight `flex: 1`.
- **No upper bound on the media query.** The 687px edge is a function of the longest
  link's rendered width in `docs/HELP.md`, so pinning the band (`and (max-width: 687px)`)
  would silently stop covering a longer future URL. The guard test rejects that form.

`.sr-wrap-anywhere` was not used: the helper is unconditional and cannot be scoped to a
tier, and the two tiers want different halves of the fix. This follows the adjacent
v0.5.83 precedent of inlining the same two declarations.

`HelpDocs.tsx` needs no change — the `.sr-help-content` hook already exists.

### How to test

See `how-to-see.md` for the click-path. The short version: open Help, set Text Size to
200%, and narrow the window to ~641px wide. Before this change the help text could be
dragged sideways and the `snowraven-mini` link ran past the right edge of the column;
now it wraps and the body does not move.

### Verification

**Real render, measured with Playwright against two production builds** (pre-fix and
post-fix `dist`, same DOM, served locally), 19 widths x 4 text scales = 76
configurations per build.

Per CLAUDE.md, **page `scrollWidth` is not admissible here and would have certified the
broken build**: `.sr-help-panel` is `overflow: hidden`, and `document.documentElement.scrollWidth`
read *exactly the viewport width in all 76 pre-fix rows*, every broken one included. The
measurement is the element's client rects against `.sr-help-content`'s **content box**
(border and padding removed), plus the row's parent scrollport for user-visible drag.
Descendants nested in their own scroll container (the coordinates `<pre>`,
`overflow-x: auto` by design) are excluded.

Defect band, before → after:

| scale | width | element overflow | drag |
|---|---|---|---|
| 2 | 641 | 46.77 → **0** | 23 → **0** |
| 2 | 645 | 42.77 → **0** | 19 → **0** |
| 2 | 650 | 37.77 → **0** | 14 → **0** |
| 2 | 655 | 32.77 → **0** | 9 → **0** |
| 2 | 660 | 27.77 → **0** | 4 → **0** |
| 2 | 663 | 24.77 → **0** | 1 → **0** |
| 2 | 664 | 23.77 → **0** | 0 → 0 |
| 2 | 670 | 17.77 → **0** | 0 → 0 |
| 2 | 680 | 7.77 → **0** | 0 → 0 |
| 2 | 687 | 0.77 → **0** | 0 → 0 |

Both nested bands reproduce exactly as the brief measured them: element overflow spans
641–687px (gone at 688 = 288 + 399.77), user-visible drag spans 641–663px (gone at 664,
where the row's 24px right padding absorbs the remainder — which is why drag alone
under-reports the defect by 24px of width).

**Inertness.** Across all 76 configurations, the only geometry that changed is the 10
broken ones above. Every other measured field is byte-identical between the two builds:
column content box, column client width, page scroll width, row `flex-direction` and
`align-items`, TOC width / `position` / `max-height`, content `align-self` and computed
`width`, drag, and offender count. Specifically:

- **≤640 tier byte-identical** at 320/390/430/640 x all four scales — every field, not
  just drag (still 0 drag, 0 overflow, `flex-direction: column`).
- **Inert at 100% / 125% / 150%** at every width, and at 200% from 688px up. The rule
  applies there (computed `overflow-wrap` becomes `anywhere` at all 60 configs above
  640) but nothing needs to wrap, so no geometry moves.
- **Two-column layout intact**: `flex-direction: row`, `align-items: flex-start`, TOC
  `width: 200px`, `position: sticky` at 641/768/1024/1440 in all four scales.
- **Sticky TOC byte-identical** at all 16 checked configurations (offset at `scrollTop`
  0 and 100). Note for the record: at 1.5x and 2x the nav reaches its `max-height:
  calc(100vh - 52px)` cap, which equals the 848px scrollport height, so a sticky element
  exactly as tall as its scrollport has no pinning room and translates with the scroll.
  That is pre-existing, governed by the `.sr-help-toc` cap from an earlier fix, and
  identical before and after — flagged as an observation, not touched here.

**Cascade-competitor scan** over every stylesheet the bundle emits (`index-*.css` and
the lazy `vendor-maplibre-*.css`): no rule in either sets `overflow-wrap` or `word-break`
on `.sr-help-content` or any descendant selector matching inside it, so the plain
(0,1,0) class rule wins with no `!important` — confirmed empirically by the computed
style reading `anywhere` / `break-word` in the real render.

**Guard test mutation-checked** (10 mutations, each sliced to the rule's own block so a
first-textual-match replacement cannot land on an unrelated rule):

| mutation | expected | result |
|---|---|---|
| M1 delete the `min-width: 641px` block (the shipped defect) | red | red |
| M2 pin the upper bound `and (max-width: 687px)` | red | red |
| M3 re-scope into the 1024 tier | red | red |
| M4 keep the rule, drop the wrap declarations | red | red |
| M5 consolidate to a top-level rule (measured-equivalent) | **green** | green |
| M6 `overflow-wrap: break-word` alone above the tier (other accepted spelling) | **green** | green |
| M7 constraint escapes the tier into the 641 block | red | red |
| M8 constraint escapes to top level | red | red |
| M9 phone tier loses its wrap allowance | red | red |
| M10 phone tier loses its constraint (the measured half-fix) | red | red |

Both correct-but-different forms stay green and every defect form goes red, in each
scan's exclusive territory (upper band and phone tier mutated separately).

Gates: `npm run test` 155 files / 2093 tests passing, `npm run lint` clean,
`npm run build` clean.

### Notes for reviewer

- **`helpContentWidthCss.test.ts` test 3 was amended, not bypassed.** It asserted that
  *every* `.sr-help-content` rule lives inside the ≤640 tier, which this fix
  deliberately violates. It is now split along exactly the line the fix draws: the
  **constraint** half is still pinned to ≤640 (M7/M8 prove it), the **wrap allowance**
  is required in *both* bands (M9 and M1 prove each side), and the upper band must stay
  unbounded above (M2/M3). The previous single test could not have caught either half
  drifting into the other's tier; the split pair can.
- **Two prose claims were corrected rather than deleted**, since both were true at 100%
  text scale only: the `globals.css` comment above the ≤640 `.sr-help-content` rule
  ("641px through 1440px measured clean and stay untouched") and the guard test's file
  header. Both now state what was actually measured and what was not — the widths above
  640 were never measured at 200%, which is how the gap survived.
- The test file keeps its own local CSS parser rather than moving to
  `lib/cssTopLevelRules.ts`. Every question it asks is an offset/nesting question (which
  tier a rule sits in, whether that tier is bounded above) that a selector→body map which
  skips at-rule blocks whole cannot answer — the same carve-out CLAUDE.md records for
  `filterControlSizeCss` and `breedingCodePinnedCss`. The new `enclosingAtRules` helper
  carries the "a top-level `;` terminates a prelude" property, since `globals.css` opens
  with `@import "tailwindcss";`.
- Two 0.02px sub-pixel readings on a `<strong>` (1.25x@700, 2x@768) are pre-existing
  inline text rounding, present and **identical** in both builds. Not related to this
  defect and not touched.
- No version bump, changelog entry, or commit — one build in a bundled Spool release.
- `ROADMAP.md:164` records this leak as an open item and should be cleared at bundle
  closeout (The Chronicler's edit, not this change).
