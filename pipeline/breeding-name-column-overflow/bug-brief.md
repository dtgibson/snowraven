# Bug Brief — breeding-name-column-overflow

## What is broken

At 320px the Breeding Codes row-name cell is clamped, but its one-line `BirdName` row still lays out the common name beside an indivisible two-link favicon group with visible overflow. Real-render QA measured 36 overflowing descendants at 1x (worst 27.44px) and 9 on the current demo data at 200% (worst 33.52px); the far favicon/link group, not the name text or scientific-name line, sets the worst edge.

## Steps to reproduce

1. Serve the demo dataset, open Breeding Codes at 320px, and measure every row-name descendant against its clamped `<th>` box at 100% and 200% Text Size.
2. Repeat in light/dark and Normal, Unbounded, and Unbounded+pinned; prior Chromium results show the 27.44–33.52px escape while the name-cell clamp itself resolves as designed.
3. Compare the current row cell, `BirdName`, and `SpeciesLinks` with the pre-v0.5.83 revision: the relevant code is byte-identical, confirming this predates pinning.

## Expected behavior

Every name-cell descendant remains inside the clamped cell at 320px without clipping the common/scientific names or reducing external links below their 24px targets. Normal retains its sticky name column; Unbounded and pinned retain their intentionally non-sticky name column. Wider tiers and shared `BirdName`/`SpeciesLinks` rendering outside this matrix do not move.

## Blast radius

The defect is frontend-only in `BreedingCodeTable`'s row-name presentation; data, sorting, codes, legend, header pin, and backend are unaffected. Pinning does not change width—it implies Unbounded and merely makes the existing escape easier to notice before horizontal scrolling. Scope any repair under the Breeding Codes name-cell/phone tier; do not narrow `NAME_COL_WIDTH` or globally change the shared favicon system. Hiding only the `<img>` is insufficient because `.sr-favicon-slot` deliberately reserves 14px even on image failure.

## What done looks like

A real-render probe reports ≤0px worst descendant escape at 320px, both text scales, themes, and all three states; it measures visible ink and hit targets against the clamped cell box, not page `scrollWidth`. Normal/Unbounded/pinned column widths and sticky predicates remain unchanged, ≥641px fingerprints match baseline, names remain readable, and retained external links keep accessible names and 24px targets. A scoped CSS/component guard rejects an ungated shared-component fix.
