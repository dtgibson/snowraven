# Change Brief — breeding-legend-overflow

## What is changing

The Breeding Codes tier legend leaks out of its card in **Normal view** on a narrow
phone at large text scale. Each code renders as a `white-space: nowrap` chip
("CN Carrying Nesting Material"); at 320px / 200% the widest chip measures 278.17px
inside a 238px legend content box, sitting behind a 24px tier-dot indent, so it runs
64.17px past that content box and 48px past the legend's padding box. **No ancestor
clips it** — every box from the legend up to `body` is `overflow-x: visible` — so the
text hangs outside the card's rounded border, ends 23.17px off the right edge of the
screen, and leaks page horizontal scroll. Fix: constrain the chip column so a label
too wide for a phone reflows instead of overhanging.

## Why now

Seeded from The Spool, found by widening the QA probe grid during the v0.5.83+
card-width work. Confirmed here as a **distinct defect** from v0.5.84, not the same
one with a narrower selector: v0.5.84's `.sr-bc-card > .sr-bc-legend` fixed the legend
*dictating an intrinsic card width*, which cannot happen in Normal (the card is a
stretched flex item at panel width and never carries `.sr-bc-card`). This is the
converse — the card is fixed and an unbreakable chip is simply wider than it. It is
the exact failure v0.5.84's decision entry *anticipated by name* when it rejected
`width: 0` ("a card narrower than the widest chip would push it outside the card's
rounded border and leak horizontal scroll, reachable on a phone at 200%"). Not on ROADMAP.

## User-facing impact

Visible on the Breeding Codes tab at phone width with Text Size at 200%: legend
labels are cut off at the screen edge and the whole page scrolls sideways. The fix
changes how those labels lay out at that tier (they will wrap). Desktop, every width
above 360px, and all three lower text scales are unaffected. **The Unbounded view's
shipped behaviour must not move** — the v0.5.84 rule is load-bearing and recently
earned; it measured clean in all 40 Unbounded configurations here.

## Design pass

**Needed.** Every honest fix chooses how a 28-character label should render in a
238px column: wrap mid-label, break beside the code, drop the tier-dot indent on
phone, or scroll. This legend's readable full-text form is itself a design decision
(v0.5.56, spelling out meanings for touch users), so its phone-width layout is
design-owned rather than incidental.

## Decisions touched

- **v0.5.84 "The Breeding Codes Unbounded card was sized by its legend, not its
  table"** — not reversed. Its `min-content` / `min-width: 100%` rule stays exactly as
  shipped; this adds a Normal-view constraint it deliberately did not cover. Its
  named rejection of `width: 0` is corroborating evidence, so the same trap must not
  be reopened: the fix must not zero the legend's contribution.
- **v0.5.70 / v0.5.69 Breeding Codes mobile decisions** — untouched (`.sr-bc-code-col`
  narrowing, `table-layout: fixed`, natural full-height page-scrolling table).
- **v0.5.56 touch-a11y** (legend meanings as visible text) — the constraint being
  preserved; the labels must stay fully readable, not truncated or hidden.

## What done looks like

At 320px and 360px / 200% in Normal view, no legend descendant extends past the
legend's content box, and no legend content reaches past the viewport. The Unbounded
view measures byte-identical to today at all 40 probed configurations, as do Normal
at 1x/1.25x/1.5x and every width from 390px up. Verified against a real render
(Playwright, backend on `SR_DATA_DIR` demo data), measuring the element against its
container's content box — never page `scrollWidth`.

## Measured probe table

Real render, Chromium, demo dataset (13 codes, includes the table's longest label).
Figures are `.sr-bc-legend` `scrollWidth - clientWidth` / worst descendant past the
legend's **content box**, in px. 80 configurations (10 widths x 4 text scales x 2 views).

| Normal view | 1x | 1.25x | 1.5x | 2x |
|---|---|---|---|---|
| **320px** | 0 / 0 | 0 / 0 | 0 / 3.36 † | **48 / 64.17** |
| **360px** | 0 / 0 | 0 / 0 | 0 / 0 | **8 / 24.17** |
| 390, 430, 480, 560, 640, 768, 1024, 1440px | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |

| Unbounded view | 1x | 1.25x | 1.5x | 2x |
|---|---|---|---|---|
| all 10 widths (320 → 1440) | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |

† 3.36px past the content box but absorbed by the legend's 16px right padding: a
near-miss (21% of the padding consumed), not a visible leak. Recorded as margin.

**Mechanism confirmed by live intervention at 320px / 200% Normal** (baseline 48px):
making the chips breakable → **0**; reverting → **48** again; removing only the 24px
dot indent → 24; shortening just the longest chip → 30. The last reading matters: the
leak is not one outlier label, it survives at 30px without it, and it tracks the data.

**Harness sanity checks** (CLAUDE.md requires validating exclusion logic against a
known-clean configuration before trusting any flagged number): (1) desktop 1440px/1x
Normal reads 0 and negative headroom; (2) the Unbounded legend reads 0 everywhere,
agreeing with the independently-verified v0.5.84 fix; (3) intervene/revert round-trips
to the identical figure; (4) by-design wide boxes are **labelled, not silently
excluded** — the `sr-bc-matrix` table reads 655.52px past the viewport but sits inside
Normal's `overflow-x: auto` wrapper and correctly does not extend page scroll
(`document.scrollWidth` 351, not 655), and the Unbounded card's 360.52px past the
panel is that view's whole purpose.

**Note on `scrollWidth`:** it does not certify this build clean (351 vs 320) but it
under-reports — 31px against the element's real 48px — and at 360px/200% the element
overflows 8px. Measure the element against its container, per the standing rule.

## Out of scope (separate finding)

The **filter pill row** (`.sr-ctl-row` in `BreedingCodeList.tsx`) independently
overflows 55.11px past its parent's content box and reaches 31.11px past the viewport
at 320px / 200%, in **both** views — it, not the legend, is what sets
`document.scrollWidth` there. Same tab, same configuration, different element and
different cause (a wrapping pill row, not a nowrap chip). Left out to keep this one
thing; flagged for the roadmap.
