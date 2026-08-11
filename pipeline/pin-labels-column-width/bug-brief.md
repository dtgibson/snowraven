# Bug Brief — pin-labels-column-width

## What is broken

Pressing "Pin code labels" on desktop stretches every column of the Breeding Codes matrix to roughly twice its width. The pin CSS is not the cause: `.sr-bc-matrix--pinned` only adds `sticky`/`top`/`z-index`/`box-shadow`, and pinned measures byte-identical to unpinned Unbounded. The widening rides in on the forced view switch (`pinned implies Unbounded`), and the real defect is in Unbounded itself: `.sr-bc-card { width: max-content }` sizes the card from its **widest child**, which is the tier legend (a `flex-wrap: wrap` row whose max-content is every code label on one unwrapped line), not the table. The table's `width: 100%` then resolves against that inflated card and `table-layout: auto` stretches all columns to fill it.

## Steps to reproduce

1. Open the Breeding Codes tab on a desktop viewport (measured at 1728px, 1440px and 1280px; `.sr-panel` caps content at 1280px).
2. Note the Normal view: card 1232px, code columns ~49px, species column 246px, legend wrapped to 3 lines.
3. Press "Pin code labels" (or press "↔ Unbounded" directly, which reproduces it identically without the pin).
4. Card jumps to 2726.81px, code columns to ~109px, species column to 545px, legend collapses to one line and the page gains horizontal scroll.
5. Isolated probe confirms the driver: the table subtree's max-content is 1100px, the legend's is 2724.81px, and the card's used width is 2726.81px (legend plus 2px border).

## Expected behavior

The Unbounded card hugs the table, as CLAUDE.md and DECISIONS v0.5.70 already say it does ("the card hugs its wide auto-layout table"). At the measured 20-code dataset that is a 1100px card with 44px code columns, matching Normal's column density instead of doubling it. The legend keeps wrapping to the card's width rather than dictating it. Pinning then changes exactly one thing the user can see: the code header row stays put while the page scrolls.

## Blast radius

- **The invariant does not need to change.** `pinned implies Unbounded` stays, the v0.5.69 capped-height revert stays reverted, the v0.5.83 code-header-row-only freeze stays, and the shared `lib/pinnedLabels.ts` state machine is untouched. Fixing the card fixes both the reported symptom and the pre-existing Unbounded bug behind it.
- Scope is `.sr-bc-card` and the legend block in `BreedingCodeTable.tsx`. The ≤640 tier overrides the card to `min-content` (v0.5.70, sized to the fixed-layout declared column sum); that phone behavior must not regress, and note the legend also participates in `min-content`.
- The Multimedia twin is unaffected: `LifeListTable` puts its wideMode `width: max-content` on the scroll wrapper, with no legend sibling to inflate it.
- CLAUDE.md's `.sr-bc-card` description is currently false on desktop and needs correcting in the same change. DECISIONS line 504's "desktop Unbounded stays intentionally wide" refers to the phone narrowing not applying to desktop, not to legend-driven column stretch; worth confirming rather than silently overriding.
- Guards to extend: `breedingCodePinnedCss.test.ts` and `BreedingCodeTable.test.tsx`. Both are blind here, so the fix needs a real-render measurement per the house CSS rule.

## What done looks like

On desktop, pressing "Pin code labels" leaves column widths and the card width unchanged from Normal apart from the table hugging its own content, with no page horizontal scroll beyond what the matrix genuinely needs. Verified by measuring the card, the species column and the code columns in both views on a real render, plus a probe asserting the card's width tracks the table subtree's max-content and not the legend's. The ≤640 tier still shows 30px dot columns flush with the card in both views.
