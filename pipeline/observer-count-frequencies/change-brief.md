# Change Brief — Observer Count Frequencies

## What is changing
The Statistics tab's "Lists by observer count" section stops collapsing
checklists with 5 or more observers into a single "5+" bucket. The model
(`frontend/src/lib/birdingStats.ts:418`, `const key = c.numObservers >= 5 ? 5
: c.numObservers`) drops the clamp so `observerRows` carries one row per
distinct observer count present in the data. The component
(`frontend/src/components/BirdingStats.tsx`) drops its three "5+" label
special-cases: the XAxis `tickFormatter` (~1217), the tooltip
`labelFormatter` (~1225), and the legend label (~1253). The chart, donut,
and legend machinery are otherwise untouched — they already render whatever
rows the model provides (donut colors cycle via `i % obsPieColors.length`).

## Why now
User's saved idea (Spool queue): show the frequency of every observer count
available, not a 5+ rollup. The original 2026-05-23 user direction was
"the total number of lists with 1, 2, 3, etc. for as many observers as there
are in the file" — the 5+ clamp was an implementation cap on that intent.
This build removes the cap.

## User-facing impact
A birder with checklists of 6, 8, or 30 observers sees each count as its own
bar, legend row, and donut slice instead of one "5+" aggregate. Sparse high
counts are fine: the XAxis is categorical (`dataKey="n"`), so only counts
present in the data render — a lone 30-observer checklist sits adjacent to
the others, no empty gap-filling. Legend/donut colors repeat past 5 rows
(existing modulo cycling); the legend column grows with distinct counts —
verify in live preview against real data. The avg-observers caption, solo/
group split, and largest-group stat read raw `numObservers` and are
unchanged. No published doc states the 5+ rollup (HELP.md/README/website
greped) — no doc edits needed.

## Design pass
Not needed — no visual change. The section's layout, chart pattern, tokens,
and legend structure are untouched; only the bucketing rule and three label
special-cases change. Data-content change within the existing chart.

## Decisions touched
"Birding Stats: map, Big Year, and average-observers removed at user
direction — 2026-05-23" (DECISIONS.md ~1865): the observer distribution
chart replaced FR-43. Touched, not reversed — this change fulfills that
entry's recorded user direction ("for as many observers as there are in the
file") more faithfully. The Chronicler should log it as extended.

## What done looks like
A fixture with 6- and 8-observer checklists yields distinct `{n:6}`/`{n:8}`
rows — a new `birdingStats.test.ts` assertion that FAILS under the old
`>= 5` clamp (the existing observer test locks only avg/solo/largest, so a
regression test must be added, not just moved). No "5+" string remains in
the section (axis, tooltip, legend). `BirdingStats.test.tsx` fixtures
(observers 1–3) unaffected; jsdom chart conventions already in place.
Full suite + `npm run build` green. Version bump + CHANGELOG happen once at
the Spool bundle level, not in this build.
