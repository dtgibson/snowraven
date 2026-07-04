## Calendar refinements batch (v0.5.60)

### What this does
Three polish/extension refinements to the already-shipped Calendar tab, built entirely on existing patterns:

1. **New "Total count" metric.** The Calendar's *Show* toggle gains a third option alongside Species and Checklists. **Total count** shades and numbers each day by the sum of individual birds recorded that day (the eBird `Count` column, `ObservationEntry.count`, summed). Presence-only records ("X" / blank / non-numeric → parsed `count: null`) contribute **0** individuals, matching the Statistics tab's `individualCount` rule exactly, so the two tallies can never silently disagree. It threads through the untouched `metricCount → computeCountyTiers → legend/popup` pipeline; it honors the "Count spuh, slash & hybrids" toggle (with-forms vs countable-only fields, mirroring Species); and paired with the per-species filter it answers "how many of this bird did I record across the year." The day popup now always shows all three stat tiles (species, checklists, individuals) whichever metric is active.

2. **View toggle relabel: Months | Year → Large | Compact.** Both views always showed the whole year — only the cell size differs — so the old labels were misleading. The internal `ViewDensity` enum was renamed `'months' | 'year'` → `'large' | 'compact'` (session-only `useState`, no persistence, so the rename is migration-free). Pure relabel; no behavior/layout/data change.

3. **Day numbers in the Compact (mini-month) cells.** The 3×4 thumbnail grid previously rendered shading only; each populated mini-cell now carries its active-metric count (`--sr-cal-fg` white, tabular-nums, `~0.5rem`), with a muted "0" on present-but-zero cells (parity with the Large view) and the tier-color pill backing the number in textures mode so it reads over the hatch. A ~16px legibility floor (a CSS **container query** on the mini-month card, the sanctioned px exception) hides the number and degrades to shading-only where a cell is too small — never distorting the 3×4 grid or the `aspectRatio 1/1` cells. The exact value always lives in the Large view + popup.

### Files changed
**Change 1 (data + UI):**
- `frontend/src/lib/calendar.ts` — `CalendarMetric` extended to `'total'`; `individualsOf(count) = count ?? 0` (named export); `DayCell.totalCount` / `totalCountWithForms`; per-bucket running sums in `buildDayCells`' single pass; the `'total'` branch in `metricCount`.
- `frontend/src/components/Calendar.tsx` — third SegControl metric option; `legendUnit` / `metricPhrase` / `formsSuffix` total branches; zero-kind aria-label says "individuals" under total; the popup's third stat tile (flex row now wraps for three tiles).

**Change 2 (relabel):**
- `frontend/src/components/Calendar.tsx` — `ViewDensity` type, the density state init, `expandMonth`'s `setDensity`, the render branch, and the View SegControl option values/labels/titles.

**Change 3 (compact numbers):**
- `frontend/src/components/Calendar.tsx` — `MiniDayCell` renders the centered decorative number (`pointerEvents: none`, `overflow: hidden` clamp); `MiniMonth` inner grid gains `.sr-cal-minigrid`.
- `frontend/src/globals.css` — `.sr-cal-minimonth` is a size container; `.sr-cal-mininum > span` hidden below a `@container (min-width: 152px)` floor.

**Tests:**
- `frontend/src/lib/calendar.test.ts` — `individualsOf` ("X"/null/0), `totalCount`/`totalCountWithForms`, the `'total'` `metricCount` branch, same-day multi-checklist SUM, combined-view summing, species-filter + total. (Also fixed the test `obs()` factory to honor an explicit `count: null`.)
- `frontend/src/components/Calendar.test.tsx` — Total-count metric renders + relabels legend/sub-line; Total count is NOT dimmed (honors forms); relabeled Large/Compact toggle; a compact mini-cell shows its number; the popup asserts all three tiles. Updated every test that referenced the old `'Months'`/`'Year'` labels.

**Close-out:** version bumped `0.5.59 → 0.5.60` in `frontend/package.json` + `src-tauri/tauri.conf.json`; `CHANGELOG.md`, `docs/HELP.md`, `README.md`, and `website/` (Calendar copy + version pill/footer) updated. `PRIVACY_POLICY.md` unchanged (no network/analytics/service added).

### How to test
1. Open the Calendar tab (needs a stored eBird backup).
2. In **Show**, pick **Total count** — every day repaints to individual totals, the legend reads "Individuals / day", and the sub-line reads "Individuals recorded each day".
3. Verify "Count spuh, slash & hybrids" is NOT dimmed under Total count and re-shades when toggled; it IS dimmed under Checklists (unchanged).
4. Click a day — the popup shows three tiles (species, checklists, individuals). An all-"X" day reads 0 individuals but still opens (present-but-zero cell).
5. Pick a species in the **Species** dropdown + Total count — that one bird's individuals per day.
6. Switch **View** to **Compact** — the label reads Large | Compact, and each populated mini-cell shows its number (muted "0" on zero days). "Open →" from a mini-month still expands to Large and scrolls to it.
7. Narrow the window so the 3-up Compact cells get tiny — numbers degrade to shading-only without distorting the grid.

### Notes for reviewer
- **"X" → 0 individuals** is the one new logged decision — chosen for consistency with Statistics `individualCount` (`if (o.count !== null) sum += o.count`), not X-as-1, to avoid silently inflating totals. It's a one-line change in `individualsOf` if ever reversed.
- The mini-cell number is decorative-inside-a-button: `pointerEvents: none`, and the cell's existing `title` + the mini-month's `aria-label` carry the accessible info — no new tab stops.
- The ~16px floor is a **container query** (not a viewport breakpoint) because the mini-month width is driven by the `.sr-cal-year` 3/2/1-up grid, not the window — the correct tool for "respond to my own width."
- No new tokens/network/persistence. `--sr-cal-fg` AA on every tier is already guarded by `calendarContrast.test.ts`.

### Gate results
- `npm run typecheck` — clean (`tsc -b`).
- `npm run lint` — clean.
- `npm run test -- src/lib/calendar.test.ts src/lib/calendarContrast.test.ts src/components/Calendar.test.tsx` — 3 files, 80 tests passed.
- `npm run build` — succeeded (only the pre-existing >1100 KB maplibre/taxonomy/counties chunk-size advisory).
- Full suite (`npm run test`) — 112 files, 1387 tests passed.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
