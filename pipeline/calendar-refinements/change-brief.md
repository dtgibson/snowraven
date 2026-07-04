# Change Brief — calendar-refinements batch (v0.5.60)

**Lane: Improve (confirmed).** Three small refinements to the *already-shipped* Calendar
tab (v0.5.58), built entirely on *existing* patterns — a third `SegControl` metric that
reuses the same `metricCount` → `computeCountyTiers` → legend/popup pipeline, two `SegControl`
label strings, and rendering a number in the mini-cells that already carry a count. No new
user-visible flow or surface (the Calendar tab, its metric toggle, its view-density toggle,
and its mini-months all already exist), no new data model (the eBird `count` column is
already parsed into `ObservationEntry.count`), no new network call/provider/persisted setting,
and no open brand/design space (each approach is specified concretely below). This is a lane
**redirect** from the user's New-Feature pick — noted and confirmed as maintenance: these are
polish/extension refinements to a shipped feature, not new capability. There is **no blocking
flag**. The one genuinely new decision worth logging at closeout is the **"Total count" metric
semantics — specifically the "X"/present-not-counted handling** (stated in change 1).

The batch ships as one patch release **v0.5.60** with the usual close-out: bump BOTH
`frontend/package.json` and `src-tauri/tauri.conf.json` (both currently `0.5.59`) to `0.5.60`,
update `CHANGELOG.md`, `docs/HELP.md` (the Calendar section, lines ~217–242), `README.md`, and
`website/` (feature copy + version pill/footer) in the same change; then push → tag `v0.5.60`
→ wait for Windows CI → `./release.sh` per CLAUDE.md.

**User-facing impact (this batch DOES change visible controls/labels):**
1. A new **"Total count"** option in the Calendar's *Show* metric toggle — each day shaded/
   numbered by the total individual birds recorded that day (the eBird `Count` column summed).
2. The **View** toggle relabels **Months → Large** and **Year → Compact** (same two views,
   clearer names; both show the whole year, only cell size differs).
3. The **Compact** (formerly "Year") mini-months now show a **day number in each cell**
   (currently shading only).

**Decisions touched (`DECISIONS.md`):** No prior decision is **reversed**. The
**"Tab Improvements Batch — 2026-07-04 (v0.5.59)"** and **"Calendar Tab … (v0.5.58)"** entries
describe the metric pipeline (`CalendarMetric = 'species' | 'checklists'`, `metricCount`,
the 5-tier `--sr-cal` ramp, `legendUnit`, the Year-Overview mini-cells that *omit* numbers) —
change 1 **extends** the metric union to a third value and change 3 **adjusts** the mini-cell
rendering the v0.5.58 entry described as number-less. Both are additive extensions, not
reversals. **New decisions to LOG at closeout:** (a) the **"Total count" metric + its "X"/
present-not-counted rule** (change 1) and (b) the mini-cell now carries a number (change 3);
note the label rename (change 2) in the same entry.

---

### 1 New "Total count" metric

**What is changing.** The Calendar's *Show* toggle currently offers **Species** and
**Checklists**. Add a third option, **Total count** — each day is shaded and numbered by the
**sum of individual birds** recorded that day (the eBird `Count` column, `ObservationEntry.count`,
summed across every qualifying row that lands on that day). Paired with the existing per-species
filter it answers the user's stated use case: *"how many of a bird did I record across the year."*

**Files / symbols.**
- `frontend/src/lib/calendar.ts`
  - `CalendarMetric` (line 12): extend to `'species' | 'checklists' | 'total'`.
  - `DayCell` (lines 21–39): add `totalCount: number` (Σ individuals, countable rows only)
    and `totalCountWithForms: number` (Σ individuals including spuh/slash/hybrid), mirroring
    the existing `speciesCount` / `speciesCountWithForms` split so the include-forms toggle
    generalizes with no new branch.
  - `buildDayCells` (lines 112–162): in the single accumulation loop, add per-bucket running
    sums. For each row, `const n = individualsOf(o.count)` (helper below); always add to the
    with-forms sum; add to the countable sum only when `!isNonCountableSpecies(o.commonName)` —
    the SAME gate already used for `speciesCount`. Emit both fields in the output map.
  - New tiny pure helper `individualsOf(count: number | null): number` — returns
    `count ?? 0` (see the "X" decision below). Kept as a named export so the unit test and the
    closeout decision reference one function.
  - `metricCount` (lines 203–206): add the `'total'` branch —
    `if (metric === 'total') return includeNonCountable ? cell.totalCountWithForms : cell.totalCount`.
    `nonZeroMetricCounts` (lines 213–224) needs **no change** — it reads `metricCount`.
- `frontend/src/components/Calendar.tsx`
  - `SegControl` *Day metric* options (lines 768–773): add
    `{ value: 'total', label: 'Total count' }` as the third option (the control already wraps
    via `.sr-wrap-flex`, so three fit at 320px).
  - `legendUnit` (lines 336–341): add the `'total'` unit strings —
    `combined ? 'Individuals across all years' : 'Individuals / day'`.
  - `metricPhrase` (lines 737–739): add the `'total'` sub-line phrase —
    `combined ? 'Individuals recorded on each calendar day' : 'Individuals recorded each day'`.
  - The `formsDisabled` guard (line 746) stays `metric === 'checklists' || speciesFilterActive`
    — **Total count DOES honor the include-forms toggle** (it has a with-forms field), so it is
    NOT added to that disable condition. `effectiveForms` already forces with-forms under a
    species filter, which is correct for Total count too.
  - The `DayPopup` (lines 397–508) currently shows a Species stat tile + a Checklists stat tile.
    Add a **third stat tile** for the day's total individuals (`cell.totalCount` /
    `cell.totalCountWithForms` per `includeForms`), so the popup always shows all three numbers
    regardless of the active metric — matching the county-popup "always show both counts"
    precedent. Keep the stat row responsive (it is a `flex` row; three tiles wrap on a phone).
  - The `zero`-kind aria-label (line 170) references "checklists"/"countable species"; extend
    its wording to name "individuals" when `metric === 'total'`.
- Tests: `frontend/src/lib/calendar.test.ts` — new cases for `totalCount` /
  `totalCountWithForms`, the `'total'` `metricCount` branch, `individualsOf('X'→null)`, the
  sum-across-checklists behavior, and combined-view summing.

**Proposed approach (concrete).** Total count is a **SUM** metric (no de-dup, unlike Species'
Set-based union). In a single year, a day's value = Σ `count` over every qualifying row bucketed
on that date — so a species recorded on two checklists the same day contributes its individuals
from **each** checklist (two rows → two adds), which is the intended "total birds seen that day."
In the **combined all-years** view the same accumulation naturally SUMS across years (like the
Checklists metric, NOT the Species union) because every qualifying row across every year lands
in the one `MM-DD` bucket and adds to the running sum. The metric threads through the untouched
`computeCountyTiers` (5-class) → `--sr-cal` ramp → legend → popup pipeline exactly as Species and
Checklists do; the only additions are the two `DayCell` fields, the `metricCount` branch, the
`SegControl` option, the two label strings, and the popup's third tile. Under the **per-species
filter** (v0.5.59), Total count + a selected species = that species' individuals per day across
the view — the user's headline use case — with zero extra code, because the filter already
narrows the row set before `buildDayCells` sums.

**Decisions / semantics (the NEW decisions to log).**
- **"X" / presence-only / blank / non-numeric → 0 individuals.** The eBird `Count` column is
  parsed to `ObservationEntry.count: number | null`, where **null** is exactly the "X"
  (present-but-uncounted) / blank / non-numeric case (`parseEbirdObservations.ts` lines 113–115:
  `parseInt` → `NaN` → `null`). `individualsOf(count)` returns `count ?? 0`, so an "X" row
  contributes **0** to the day's total. **Rationale — chosen for app-wide consistency and
  honesty over inflation:** the app already has exactly one individual-tally — the Statistics
  tab's `individualCount` (`birdingStats.ts` lines 80 & 125: `if (o.count !== null) sum += o.count`,
  documented in `types.ts` line 101 as *"Σ Count across the checklist's species (X/blank = 0)"*,
  and locked by `birdingStats.test.ts` line 49 asserting X/null → 0). Making the Calendar's total
  match means a birder who reads "312 individuals" on a Calendar day and compares it to a
  Statistics "most individuals" figure gets **matching arithmetic** — the two individual tallies
  can't silently disagree. Counting "X" as 1 would be defensible ("a present bird is ≥1"), but it
  would (a) diverge from the one shipped precedent, (b) silently inflate every total by the number
  of X-marked rows (common for hard-to-count flocks), and (c) mix a *presence* signal into a
  *count* metric. The honest, consistent default is **0**; this is the decision to record. (If the
  user later prefers X-as-1, it is a one-line change in `individualsOf` plus the two test
  assertions and the doc note — flagged as a cheap reversal, not a redesign.)
- **SUM, no de-dup.** Total count sums raw `count` across all qualifying rows on a day; a species
  on two same-day checklists adds twice. Combined view sums across years (Checklists-style, not
  Species-union-style).
- **Include-forms behavior mirrors Species.** By default, individuals of spuh/slash/hybrid rows
  are **excluded** (`totalCount`), and the existing "Count spuh, slash & hybrids" toggle admits
  them (`totalCountWithForms`) — so the three metrics stay mutually consistent (a spuh flock's
  individuals appear in Total count only when its species also would count under Species). Under a
  concrete species filter `effectiveForms` forces with-forms (a no-op for a normal species; makes
  a selected spuh render its own individuals) — same rule as Species.

**Edge cases.** A day of all-"X" rows → total `0` → renders as the present-but-zero cell (the
existing `zero` kind), NOT a blank no-data cell, because a checklist still landed there. Large
flock counts (e.g. 50,000 Snow Geese) are shown verbatim (`toLocaleString` in the popup); the
5-class quantile tiering absorbs outliers gracefully (a single huge day just sits in the top tier).
Negative/absurd counts can't occur (`parseInt` of a non-negative CSV field; negatives would parse
but eBird never exports them). Species filter + Total count + combined = that one species'
individuals across all years. Empty/blank-count-only year → tiers computed over an all-zero set →
empty legend (existing empty-input path). The include-forms toggle is live for Total count (unlike
Checklists), and disabled only under a concrete species filter (existing `formsDisabled` logic).

**What done looks like.** A **Total count** option appears in the *Show* toggle; selecting it
repaints every day cell/number/tier, the legend ("Individuals / day" · combined "Individuals
across all years"), and the sub-line to individual totals; an "X"-only day reads 0; a species on
two same-day checklists sums both; the "Count spuh, slash & hybrids" toggle re-tiers Total count
(it is NOT disabled for this metric); the day popup shows all three stat tiles; `calendar.test.ts`
covers the new fields, the `'total'` branch, `individualsOf('X')→0`, same-day multi-checklist
summing, and combined-view summing; `npm run build` + vitest + `calendarContrast.test.ts` green.

---

### 2 Rename the view-density toggle: Months|Year → Large|Compact

**What is changing.** The *View* `SegControl` currently reads **Months** (big month grids with
day numbers) and **Year** (the 3×4 all-months thumbnail grid). Both views actually show the
**whole year** — only the cell size differs — so the month/year framing is misleading. Relabel
to **Large** (big cells) and **Compact** (small all-year grid). This is a **label + copy change**;
the underlying behavior is unchanged.

**Files / symbols.**
- `frontend/src/components/Calendar.tsx`
  - The `ViewDensity` type (line 39) is `'months' | 'year'`. **Rename the internal enum to
    `'large' | 'compact'`** for clarity (it is session-only `useState`, no `storage` seam, so a
    rename is safe and has no persistence/migration impact) — OR keep the internal values and
    change only the display labels. **Recommended: rename to `'large' | 'compact'`** so code and
    UI agree; this touches the `density` state init (line 558, `'months'` → `'large'`), the
    `expandMonth` handler (line 656, `setDensity('months')` → `setDensity('large')`), and the
    render branch (line 873, `density === 'months'` → `density === 'large'`).
  - The *View* `SegControl` options (lines 830–838): update `label` "Months" → "Large" and
    "Year" → "Compact"; update the `title` tooltips ("Large month grids with day numbers" →
    e.g. "Large day cells across the whole year"; "All twelve months as small heatmap thumbnails"
    → "Compact day cells across the whole year"); the `value`s become `'large'`/`'compact'`; the
    `LayoutGrid`/`Grid2x2` icons stay.
  - `ariaLabel="View density"` (line 831) stays accurate; no change needed (optionally
    "Cell size").
- `docs/HELP.md` — the Calendar section (lines ~217–242) references the Months/Year toggle;
  update the wording to Large/Compact. Check `README.md` and `website/` copy for any Months|Year
  mention and update in lockstep.
- Tests: any `Calendar.test.tsx` assertion that matches the "Months"/"Year" label text or the
  `'months'`/`'year'` value (grep before editing).

**Proposed approach (concrete).** Renaming the enum is the cleaner option because the values are
session-only (`useState<ViewDensity>` — never persisted, so no stored `'months'` string to
migrate) and the internal name `density` with values `large`/`compact` then reads self-evidently.
Do a single mechanical pass: type, three usages, the two option `value`s/`label`s/`title`s, and the
one render branch. No layout/CSS class changes — `.sr-cal-months` and `.sr-cal-year` CSS class
names can stay (they're internal selectors the user never sees; renaming them is optional churn and
NOT required — leave them to keep the diff tight, or rename for consistency as a judgment call).

**Decisions / semantics.** Pure relabel; "Large" == the former "Months" big-grid view, "Compact"
== the former "Year" thumbnail view. No behavior, layout, or data change. The user-facing model
becomes "one calendar, two cell sizes" instead of the misleading "months vs year."

**Edge cases.** `expandMonth` (clicking a mini-month's "Open →") still switches to the Large view
and scrolls to that month — verify the renamed `setDensity('large')` preserves that. No persisted
value to migrate (session-only). Grep for stray "Months"/"Year" strings in help/readme/website so
the docs don't drift.

**What done looks like.** The *View* toggle reads **Large | Compact**; picking Large shows the big
month grids, Compact shows the 3×4 thumbnail grid (unchanged behavior); "Open →" from a compact
mini-month still expands to Large and scrolls to that month; `docs/HELP.md`, `README.md`, and
`website/` say Large/Compact; no test references the old labels/values; `npm run build` + vitest
green.

---

### 3 Show day numbers in the Compact (mini-month) cells

**What is changing.** The Compact view's mini-month cells (`MiniDayCell`, lines 322–332) currently
render **shading only** — no day number (the v0.5.58 decision explicitly dropped numbers at
thumbnail size). The user wants the count number shown in the compact cells too, so a day's value
is legible without expanding to Large.

**Files / symbols.**
- `frontend/src/components/Calendar.tsx`
  - `MiniDayCell` (lines 322–332): render the metric count (`desc.count`) centered in the data-kind
    cell (and optionally a muted "0" in the `zero`-kind cell, matching the Large view's `zero`
    cell). The descriptor already carries `count` (built by `buildMonthCells`, line 244), so **no
    data plumbing changes** — this is purely presentational. Use `--sr-cal-fg` (white) for the
    on-tier number, `fontVariantNumeric: 'tabular-nums'`, a small `font-size` (~`0.5rem`), and
    `line-height: 1`, matching the Large `DayCellButton` number treatment (lines 206–208) at a
    smaller size. In **textures** mode, apply the same tier-color pill background the Large cell
    uses (`numStyle`, lines 189–191) so the number stays legible over the crosshatch.
  - `MiniMonth` grid (line 315): the mini-cells are a 7-column `1fr` grid with `aspectRatio 1/1`
    and `gap: 2` inside a card padded `12px 14px 14px`. See the sizing note below — a **minimum
    mini-cell size** may be needed for the number to be legible at 320px.
  - `.sr-cal-year` / `.sr-cal-minimonth` in `globals.css` (lines 687–698, responsive at 1024/640):
    if a minimum cell size is required, set it here (lifted to a class, per the responsive
    convention — never an inline breakpoint).
- Tests: `Calendar.test.tsx` — assert a mini-cell renders its count number in Compact view.
- Guard: `calendarContrast.test.ts` already asserts `--sr-cal-fg` ≥ 4.5:1 on every tier in both
  themes — the mini-cell number reuses that token, so it is **already covered** (no new contrast
  token/test needed).

**Proposed approach (concrete).** Render `desc.count` as a centered `<span>` inside the data
mini-cell using `--sr-cal-fg`, tabular-nums, `~0.5rem`, `line-height: 1`, `pointerEvents: none`
(the whole mini-month is one button; the numbers are decorative-inside-button, keep them
`aria-hidden`-neutral — the existing `title` tooltip already carries the value for assistive tech,
and the mini-month's `aria-label` names the month). Keep the second diagonal absent in textures
mode (the mini hatch is single-direction) and, in textures mode, back the number with the tier
pill so it reads over the hatch. **Legibility / minimum cell size:** at 320px the Compact grid is
already single-column (`.sr-cal-year → 1fr` at ≤640), so each mini-month spans nearly the full
width and its 7 cells are ~35–40px — comfortably large enough for a 1–2 digit number. The tight
case is the **desktop 3-up** layout inside a narrow panel, where a mini-cell can fall to ~14–18px;
a two- or three-digit Total count ("312") will not fit legibly there. **Decision:** show the number
whenever the cell can host it, and set a **minimum mini-cell size of ~16px** (via a `min-width`/
`min-height` or a `minmax()` floor on the mini grid, lifted to `.sr-cal-minimonth`'s inner grid in
`globals.css`); below that the cell keeps shading only (graceful degrade). For multi-digit Total
counts that overflow even at the floor, allow the number to shrink one step or clamp with
`overflow: hidden` rather than distort the grid — the shading still conveys magnitude and the Large
view / popup give the exact figure. The 3×4 grid structure and the `aspectRatio 1/1` cells are
preserved.

**Decisions / semantics.** The compact number is the **same active-metric count** the Large view
shows (`desc.count` from `metricCount`), so Species/Checklists/Total-count all display their value
in compact cells. It is a secondary read of magnitude alongside the shade; the shade remains the
primary signal (numbers may be tiny). Zero-kind cells may show a muted "0" (matching Large) or stay
blank-shaded — **recommend muted "0"** for parity with the Large view's present-but-zero treatment.

**Edge cases.** Single-column phone (≤640) → mini-cells are large, numbers fit easily. Desktop 3-up
narrow panel → the ~16px floor keeps numbers legible; genuinely sub-floor cells degrade to
shading-only (never a distorted grid). Multi-digit Total counts → clamp/shrink, exact value stays in
the Large view + popup. Textures mode → number sits on the tier pill so it reads over the hatch.
Both themes → `--sr-cal-fg` already AA-guarded. 200% in-app text scale → sizes are in rem so they
scale; the min-cell floor is the one px allowance (a legibility floor, the sanctioned exception
like `.sr-input-16`). No-data cells stay empty (no number).

**What done looks like.** In Compact view every populated mini-cell shows its count number
(white/`--sr-cal-fg`, tabular-nums) legibly at 320px and in the phone single-column layout;
present-but-zero mini-cells show a muted "0" (parity with Large); numbers stay readable in textures
mode (tier pill) and in both themes (existing AA guard); the 3×4 grid and `aspectRatio 1/1` cells
are intact; where a mini-cell falls below the ~16px legibility floor it degrades to shading-only
without distorting the grid; `Calendar.test.tsx` asserts a compact-cell number; `npm run build` +
vitest + `calendarContrast.test.ts` green.

---

**Batch close-out reminder.** One patch release **v0.5.60**: version bump in BOTH
`frontend/package.json` and `src-tauri/tauri.conf.json`, plus `CHANGELOG.md`, `docs/HELP.md`
(Calendar section — new Total-count metric, Large/Compact rename, compact numbers), `README.md`,
and `website/` (feature list + version pill/footer) all updated together; log a short new
`DECISIONS.md` entry covering (a) the **Total-count metric + "X"/present-not-counted → 0** rule
(and its consistency with Statistics `individualCount`), (b) the Large/Compact relabel, and (c)
the compact mini-cell now carrying a number — noting the v0.5.58/v0.5.59 Calendar entries are
**extended, not reversed**; then push → tag `v0.5.60` → wait for Windows CI → `./release.sh`.
