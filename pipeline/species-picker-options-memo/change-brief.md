# Change Brief — species-picker-options-memo

## What is changing

`SpeciesCombobox` has four call sites, and **three** of them hand it a
brand-new `options` array on every parent render, so its `filtered` and `rows`
memos miss every time and rebuild the whole list. Two are the inline `.map(...)`
the roadmap names. The third is one level up and is a new finding:
`BirdingStats.tsx:426` declares `sciFor` as a plain body function, so it gets a
fresh identity per render and defeats `WeatherStatsSection.tsx:245`'s own
`speciesOptions` memo before the combobox ever sees it.

| Site | Shape | Fix |
|---|---|---|
| `Calendar.tsx:1008` | `options={speciesOptions.map(name => ({ name }))}` | one `useMemo` |
| `SpeciesDetail.tsx:742` | `options={displaySpeciesList.map(...)}` | one `useMemo` |
| `BirdingStats.tsx:426` → `WeatherStatsSection.tsx:245` | `sciFor` unstable, in the memo's deps | one `useCallback` on `[sciByNorm]` |
| `MapExplorer.tsx:2052` | already memoized on stable deps | none — roster row, not a fix |

Upstream inputs at all three sites are already memos, so each fix is one hook.

## Why now

The roadmap item, re-verified at HEAD rather than quoted. Its two line numbers
are still exact — the three bundle builds touched `PlanChart.tsx` and
`WeatherTideSection.tsx` only — but its **count is wrong**, and correcting it is
part of this build. The defeat is structural, not probabilistic: `useMemo`
compares with `Object.is` and `.map()` returns a new array every call, so the
miss is certain on every parent render. Cost per render is exactly `2N`
allocations (N option objects at the call site, N row objects in `rows`), plus
N `matchesSpeciesQuery` calls whenever a query is typed. **The picker does not
have to be open** — `rows` recomputes during render regardless, so a closed
picker pays in full. Measured on the reference export: N is 283 (Calendar,
normalized) and 293 (Species Detail). Harmless there, as the idea says. It
shows up because the parents re-render often and for unrelated reasons: Species
Detail's comment filter (`:1560`) and heatmap slider (`:1436`) re-render on
every keystroke and every drag tick, and Statistics re-renders on 22 pieces of
state. The upper bound is a world list, ~17,891 names.

## User-facing impact

None. No DOM, no CSS, no copy, no ARIA, no keyboard path, no persisted value
changes; the rendered output is identical at every site. The only observable
difference is less work per keystroke on a long list, which is the point.

## Design pass

**Not needed.** This is pure referential identity — three hooks that change
*when* a value is rebuilt, never what it contains or how it renders. Nothing
visual is in the diff: no stylesheet change, no token, no layout, no element,
no size register, and `SpeciesCombobox` itself is not edited at all. There is
no existing surface whose look or feel is being refined, which is the test the
design-pass check applies. Deciding it on the merits rather than on the
expectation: had the fix required touching the listbox's rendering or its
scroll behaviour it would route through The Designer, and it does not.

## Decisions touched

- **The `.sr-combobox-list` WebKit scroll-anchoring decision** (DECISIONS.md,
  ROADMAP.md, 2026-09-15 `b472ae8`) — **checked, and this work does not touch
  it.** Its reversal condition is a change that parks focus or
  `aria-activedescendant` inside the list across a rebuild of `rows`. This
  change adds no focus or `aria-activedescendant` behaviour, edits no CSS, and
  strictly *reduces* `rows` rebuilds, so it moves away from that condition
  rather than toward it. The measurement stands unchanged and stays deliberately
  unfixed.
- **The `SightingsMap` / `MapBoundsFitter` fresh-array finding** (DECISIONS.md,
  v1.0.29) — same defect class, one `useMemo`, extended not reversed. Its guard
  is the shape to copy.
- **The `SpeciesCombobox` extraction** (DECISIONS.md, v0.5.61) — Species Detail
  remains the reference implementation and must stay regression-free. Constraint
  honoured, nothing reversed.

Ride-along doc rot found by the sweep: `entryChunk.test.ts:450` says
SpeciesCombobox has "only three importers." There are four —
`WeatherStatsSection` is the fourth. The assertion is still correct (all four
are lazy); only its comment is stale.

## What done looks like

Three hooks land, the three sites stop rebuilding, and `MapExplorer` is
untouched. The guard **counts work done, never elapsed time** — no milliseconds,
no ratio with a constant numerator, and it does not extend
`speciesUtilsMemoBound`'s timing shape, which is only judgeable on a quiet
machine. Two legs per site: the `options` array reaching the combobox is the
*same reference* across an unrelated parent re-render (structural, cannot
flake), and with a query typed, an unrelated re-render adds *zero*
`matchesSpeciesQuery` calls where it currently adds N. Written as **one roster
of all four call sites**, each carrying its own re-trigger, so a fifth site
arrives as a missing row rather than as nothing. A guard-the-guard leg proves
the options identity *does* change and the predicate *does* re-run when the
species list genuinely changes — memoizing into staleness must go red. The
roadmap entry is corrected from two sites to three and retired; the stale
importer comment is fixed. Full suite, typecheck and `npm run build` green.
