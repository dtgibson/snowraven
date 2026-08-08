# group-size-exact-counts

## What this does

Makes the exact checklist count of every observer group size readable at a
glance in Statistics → Effort → "Lists by observer count". Each legend row
beside the decorative donut now reads count-first ("1 obs · 1,234 lists
(99%)" instead of "1 obs 99%"), and a rare group size whose share rounds to
zero shows "<1%" instead of a bare "0%" — on a 99%-solo dataset the rare
sizes were previously invisible slivers labeled "0%", with the exact count
reachable only through the bar chart's click tooltip.

## How to test

1. Start the app (backend on 1620 + `npm run dev` in `frontend/`, or the
   desktop dev app) with an eBird backup loaded.
2. Open the Statistics tab and jump to the Effort section.
3. Find "Lists by observer count". Each legend row now shows the observer
   count, the exact number of lists (locale-grouped), and the percentage.
4. With a solo-dominated dataset, confirm rare group sizes show their real
   count and "<1%" — never "0%".
5. The bar chart, click tooltip, caption (% solo / avg observers / largest
   group), and donut are unchanged.
6. Automated: `npx vitest run src/lib/statsFormat.test.ts
   src/components/BirdingStats.test.tsx src/lib/birdingStats.test.ts` and
   `npm run typecheck` in `frontend/`.

## Notes for reviewer

- Display-only change. `computeEffort` / `observerRows` are untouched — the
  compute layer already carried exact counts. No binning introduced; the
  v0.5.78 no-rollup regression test stays green (run in verification).
- The zero-collapse fix is a new pure helper `fmtSharePct(count, total)` in
  `lib/statsFormat.ts` (unit-tested): nonzero-but-rounds-to-zero → "<1%";
  a genuinely zero count or empty total stays an honest "0%".
- "lists" pluralizes ("1 list" / "2 lists"), matching the tooltip's
  observer pluralization idiom.
- The optional count-labels-on-bars idea from the brief was deliberately
  skipped: with many distinct observer counts the labels would collide over
  thin bars, and the legend now carries the exact numbers.
- The legend was already outside the donut's `aria-hidden` + `inert`
  wrapper, so the exact counts are exposed to AT too; the bar chart's
  `role="img"` aria-label ("Bar chart of checklists grouped by number of
  observers") remains truthful and unchanged.
- Longer legend rows wrap within the existing 140–160px aside on desktop
  and get full width on phones (`.sr-grid-chart-aside` stacks at ≤640), so
  nothing overflows at 320px or 200% text scale.
- `docs/HELP.md` (Effort section description) got the matching one-phrase
  update. README/website do not describe this chart at that granularity
  (verified in the brief), so no touch there.
- Version bump / CHANGELOG are handled by the bundled Spool release prep,
  not this change.
