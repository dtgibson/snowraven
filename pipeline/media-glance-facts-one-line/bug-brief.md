# Bug Brief — media-glance-facts-one-line

## What is broken
On the Statistics tab's Media card, the At a glance facts for busiest day and
longest streak lost their stat tiles in 0.5.24 and were squeezed into the muted
caption line under the grid, joined with dots. Five stats render as tiles; three
read as an afterthought on one line.

## Steps to reproduce
1. Load eBird + ML data, open the Statistics tab.
2. Scroll to the Media card's "At a glance" section.
3. The grid shows five tiles; "Spanning … · Busiest day … (N) · Longest streak
   N days" renders as a single caption line below (`MediaStatsSections.tsx:127`).

## Expected behavior
Busiest day (count, date as sub-line) and Longest streak (days, "days in a row"
as sub-line) return as tiles alongside the other five. Every tile in this grid
reserves the sub-line slot so all seven are equal height at every width — the
misalignment 0.5.24 was chasing cannot return. "Spanning first – last" stays
alone as the caption.

## Blast radius
`StatCell` (statsPrimitives.tsx) is shared with BirdingStats.tsx, which uses it
without sub-lines — the reserved slot must be opt-in (new prop or equivalent),
not a change to the shared default. The Media card's age/gender rework from
0.5.24 is untouched. Component tests for MediaStatsSections cover this section.

## What done looks like
Seven equal-height tiles at any window width (including the auto-fit grid's
narrow breakpoints), span caption below, no regression in BirdingStats tiles,
full frontend suite + typecheck + lint + build green.
