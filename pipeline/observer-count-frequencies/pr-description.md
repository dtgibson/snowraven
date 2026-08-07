# Observer Count Frequencies

## What this does

Removes the "5+" observer-count rollup from the Statistics tab's "Lists by
observer count" section. The effort model now keys `observerRows` by the
actual observer count, so every distinct count in the data gets its own bar,
legend row, and donut slice (a lone 30-observer checklist shows as "30", not
folded into "5+"). Rows stay sorted ascending by count.

## How to test

1. `cd frontend && npm run dev`, open http://localhost:5173
2. Load an eBird backup that has checklists with 5 or more observers
3. Statistics tab, Effort section, "Lists by observer count": each distinct
   observer count has its own bar and legend entry; no "5+" label anywhere
   (axis ticks, click-tooltip, legend)
4. Confirm the caption stats (percent solo, avg observers, largest group)
   are unchanged: they always read raw `numObservers`

## Notes for reviewer

- Model: `frontend/src/lib/birdingStats.ts` (~line 417) drops the
  `numObservers >= 5 ? 5 : numObservers` clamp; the map now keys on the raw
  count. Sorting and row shape (`{ n, count }`) unchanged.
- Component: `frontend/src/components/BirdingStats.tsx` drops the three
  "5+" special-cases: XAxis `tickFormatter` (now plain `String(n)`), tooltip
  `labelFormatter`, and the legend row label. The categorical XAxis
  (`dataKey="n"`) renders only counts present in the data, so sparse high
  counts do not gap-fill, and two-digit ticks render as ordinary category
  labels.
- Donut/legend colors already cycle via `i % obsPieColors.length`, so more
  than 5 rows repeat colors by existing design; the donut is decorative
  (`inert`, `aria-hidden`) so no accessibility impact.
- Regression test added in `frontend/src/lib/birdingStats.test.ts`
  ("keys observerRows by the actual count"): 6/8/8/2-observer checklists
  must yield distinct rows keyed 2, 6, 8 and no row keyed 5. Verified to
  FAIL against the old clamp (temporarily restored the old line: 1 failed)
  and pass with the fix.
- No version bump or CHANGELOG entry here: this is a bundled Spool build;
  both happen once at the bundle level.
