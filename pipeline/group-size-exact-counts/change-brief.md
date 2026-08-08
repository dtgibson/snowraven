# Change Brief — group-size-exact-counts

## What is changing
The Statistics "Lists by observer count" section (Effort area of
`BirdingStats.tsx`, ~lines 1223–1299) gains visible exact counts per
group size. Today the exact count exists only in a click-triggered
tooltip, and the legend beside the decorative donut shows
`{n} obs {pct}%` with `Math.round` — on a 99%-solo dataset every rare
group size renders "0%" and its bar is an invisible sliver. The fix
surfaces the exact list count for every observer-count row at a glance
(legend rows lead with the count, e.g. "1 obs · 1,234 lists (99%)";
rare sizes never show a bare rounded "0%" — use "<1%" or count-first),
optionally plus count labels on/above the bars.

## Why now
Saved Spool idea (verbatim): "In statistics, for birding group sizes,
show the exact count of each group size. It is currently hard to see
the rarer group sizes since 99% of my birding is by myself." Direct
follow-on to v0.5.78's observer-count-frequencies change (every
distinct count now gets its own bar); proportional scaling still hides
the rare sizes, so the exact numbers must be readable, not inferred.

## User-facing impact
Yes, deliberately: each group size's exact checklist count becomes
readable directly in the section (no click/hover needed), and rare
sizes stop displaying as "0%". The bar chart, click tooltip, caption
(% solo / avg observers / largest group), and donut remain. The
`role="img"` aria-label / a11y story should stay truthful to what is
shown. `docs/HELP.md` line ~187 (the section description) gets a
matching one-phrase update; README/website do not describe this chart
at that granularity, so no touch there.

## Design pass
Not needed — data-display refinement using existing Statistics count
idioms. Counts-beside-labels is the established vocabulary (BarRow's
`value` + `pctOf` throughout the tab; tokens `--sr-text-muted`, rem
sizes, existing legend layout). No new surface, layout, hierarchy, or
visual language; the Engineer extends the legend/labels in place.

## Decisions touched
Touches, none reversed:
- v0.5.78 "Two prior stats decisions touched" item (2): every distinct
  observer count keeps its own bar (no 5+ rollup) — this builds on it;
  the regression test locking it must stay green.
- v0.5.78 bounded-histogram entry: it names this chart as the
  distinct-values-bounded shape — display-only change, no binning
  introduced, entry unaffected; do not generalize from it.
- 2026-05-23 "average-observers removed": the distribution chart is
  the sanctioned replacement for the average — keep the distribution
  primary; do not regress toward an average-only display.

## What done looks like
On a solo-dominated dataset, the exact count of every group size is
readable in the section without clicking; no row shows a bare "0%".
Constraints intact: no-rollup regression test green; donut stays
decorative (`aria-hidden` + `inert`); render-purity (no `Date.now()`
in render); `--sr-*` tokens only; holds at 320px and 200% text scale;
`BirdingStats.test.tsx` recharts `afterAll` timer rule respected if
tests are added; `npm run build` + full suites green.
