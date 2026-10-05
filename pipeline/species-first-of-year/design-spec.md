# Design Spec - First of Year on Species Detail

**Status: APPROVED (2026-10-03).** The user approved the direction as shown in `design.html`, with all three sub-decisions at their defaults. This spec is final; the Engineer builds from it and from the mockup.

**Feature:** species-first-of-year
**Date:** 2026-10-03
**Stage:** 4 - The Designer
**Mockup:** `pipeline/species-first-of-year/design.html` (self-contained; the toolbar at the top switches theme, frame width, in-app text size, data state and the date-range filter; it is mockup chrome, not part of the design)
**Sources:** prd.md, schema.md section 10, strategic-brief.md, `pipeline/design-system.md`

## Visual Direction

The section is the Sightings card's "First seen" cell, repeated per year and given a picture. It sits in the exact register of the two cards above it (same `SectionCard` and `SectionHead`, same type scale, same accent-only-on-the-link rule), so it reads as something the tab always had. The chart is the focal point and comes first; the dated rows are the record and sit beside it on a wide screen, below it on a phone. Color is spent once: the chart's line and points are the Sightings graph's `--sr-graph-individuals`, the dates are accent links, everything else is ink, muted ink and hairlines.

The design system is established (`pipeline/design-system.md`) and this feature designs within it. No new token, no new pattern, no deviation to log.

## Placement (OQ-03)

Default kept: directly after the Sightings and Media row, before Subspecies and Forms, full width, inside the `{sightingsStats && ...}` fragment (schema section 6). It is the natural neighbor of First seen and Last seen, which it generalizes. The Help bullet goes after `Media:` and before `Subspecies and Forms:`.

## Screens / Views

### The section (two or more years)

Layout, wide tier (641px and up):

- `SectionCard` > `SectionHead` (icon `CalendarDays` at 14px / stroke 2.2 in the accent tile, title "First of Year") > body with the card's `16px 18px` padding.
- The date-range note, when present, is the first thing in the body (see Copy Notes).
- Then one flex row, `align-items: flex-start`, `gap: 22px`: the chart (`flex: 1 1 0; min-width: 0`, capped by `firstOfYearChartMaxWidth`, below) and the row list (`flex: 0 1 auto; max-width: 16rem; min-width: 0`). The list follows the chart's right edge, so a short span (two or three years) is a compact strip with the dates beside it rather than a line stretched across the card.
- No positive `min-width` anywhere in the pattern. The list column sizes to its own rows and is capped, never floored. (The first draft floored it at 11rem and leaked 78px of page scroll at 320px / 200%; measured and removed.)

Layout, phone tier (640px and down, the app's established boundary, inside the existing `@media (max-width: 640px)` block):

- The flex row becomes a column (`flex-direction: column; align-items: stretch; gap: 10px`): chart, then rows, each full width. DOM order is visual order in both tiers; no CSS `order`.
- Rows take `min-height: 2.5rem` so each date link has a comfortable tap target.

The row list:

- A `<ul>` with one `<li>` per year, **newest year first** (OQ-04 default kept: the usual question is this year against earlier ones; the chart reads oldest to newest left to right). No sort control.
- Each row: `display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px 14px; min-height: 2rem; padding: 0.3125rem 8px; margin: 0 -8px; border-radius: 6px`. The negative margin lets the hover tint bleed 8px past the text column, the way list rows do elsewhere in the app.
- Left: the four-digit year, `0.8125rem / 600 / --sr-text`, tabular numerals.
- Right: the first date through `ChecklistLink` with `label={formatDate(date)}`, `size="sm"`, and `style={{ fontSize: '0.8125rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}`. Accent text, 10px external-link glyph, underline on hover, the component's own accessible name (`May 2, 2026: open checklist on eBird (opens in a new tab)`) and its own new-tab dispatch. A junk submission id renders the formatted date as plain `--sr-text` (the component's fallback; nothing to add).
- Rows are separated by a 1px `--sr-border-subtle` hairline drawn as a `::before` on every row after the first, inset 8px from each side so it does not cross the hover tint. The hairline is hidden on a hovered or focused row and on the row below it.
- `flex-wrap: wrap` is what lets a long date (a day-first or ISO format at 200% text on a 320px phone) drop under its year instead of widening the row. Measured: at 320px / 200% the rows wrap to two lines, year over date, and nothing leaks.
- The year appears twice on a row (`2026` and `May 2, 2026`). This is FR-12 as written (the year plus the date in the user's format, and QA-15 pins the link label to `formatDate(date)`), and the aligned year column is what makes the list scannable. Approved by the user as final.

The chart (`FirstOfYearChart`, lazy):

- Wrapper `div.sr-foy-chart` with `role="img"` and the single accessible name (Interaction Notes). Inline `height` from `firstOfYearChartHeight(wide)` and inline `maxWidth` from `firstOfYearChartMaxWidth(yearCount)`; both are pure functions in the geometry module, both also read by the `Suspense` fallback, so nothing moves when the chunk lands (FR-24).
- Inner `div` with `aria-hidden="true"` and `inert`; `LineChart` with `accessibilityLayer={false}`; no `Tooltip`, no handlers of its own (FR-25).
- Horizontal axis: calendar year, continuous integers from the earliest to the latest row year. One tick per year; labels thinned `preserveStartEnd` style so none overlap (at phone width over ten years the mockup shows 2017, 2019, 2021, 2023, 2026: every other year, the last always kept, and a neighbor that would collide with the last yields to it). Tick text `11px`, `--sr-text-muted`, centered under the tick in the 24px axis lane. No axis line, no tick lines, matching the Sightings graph.
- Vertical axis: day of year 1 to 366, increasing upward. Month-start gridlines, dashed `3 3` in `--sr-border-subtle` (the Sightings graph's gridline), labeled at the left in `11px` `--sr-text-muted`, right-aligned 8px before the plot. Which months are labeled is `monthTicks(plotPx)` (schema section 9) with the minimum gap raised to 18px: at both tier heights that resolves to **Jan, Apr, Jul, Oct, Dec**, which keeps January and December (FR-20), never overlaps, and reads as quarters rather than a dense ladder.
- Points: `r=4`, fill `--sr-graph-individuals`, 1.5px stroke in `--sr-surface` (the ring that punches a gap where a point sits on its line; the Sightings graph hardcodes `white` here, this chart uses the token so it holds in dark). A **lone point** (no segment on either side, such as 2021 between two gap years) is `r=5` so it reads as a point rather than a speck.
- Segments: 2px `--sr-graph-individuals`, round caps and joins, `type="linear"` (straight lines between years, deliberately not the Sightings graph's `monotone` curve: a curve would imply values between years, and these are discrete annual facts). `connectNulls={false}`, so a gap year breaks the line (FR-21).
- Chart text is px on fixed-px lanes and does not follow the in-app text scale, per the design system's Planner rule (the rows are the rem-sized record of every date the chart draws). The sibling Sightings graph sizes its ticks in rem; at 100% the two are identical, and the difference at 200% is accepted because this chart's height is a pure function of tier (FR-24) and its lanes cannot grow.

### One year

The heading and the one row, exactly as it would render among many; no chart, no placeholder, no sentence (FR-18, OQ-05). The list takes `max-width: 22rem` and `flex: 1 1 auto` in this state so a single row does not sit in a hairline-wide column. Mockup: Data > One year.

### Zero years

No section (FR-10). Not shown in the mockup because there is nothing to show; the Engineer returns `null`.

### Date-range filter active

One muted line above the chart and rows: `First dates within the selected date range.` (`0.75rem`, `--sr-text-muted`, `line-height 1.45`, `margin: -4px 0 12px`). Absent otherwise; a county filter alone adds nothing (FR-16). Mockup: Date filter > On.

## Component Usage

| Component / primitive | Use |
|---|---|
| `SectionCard`, `SectionHead` (`speciesDetail/ui.tsx`) | the card and its heading, unchanged |
| `ChecklistLink` (`components/ChecklistLink.tsx`) | every row's date; `size="sm"`, label = formatted date |
| `Link` primitive | inherited through `ChecklistLink` (the WebKit tab stop) |
| lucide `CalendarDays` | the heading icon, 14px, stroke 2.2 |
| Recharts `ResponsiveContainer`, `LineChart`, `Line`, `XAxis`, `YAxis`, `CartesianGrid` | the chart, in `FirstOfYearChart.tsx` only; custom `dot` renderer for the lone-point size and the active state |
| `useIsPhone` | the tier for `firstOfYearChartHeight(!isPhone)` |

## Design Tokens Applied

Every color is a `var(--sr-*)` token defined in both themes; no new token.

- Card: `--sr-surface`, `--sr-border`, `--sr-card-shadow`; head rule `--sr-border-subtle`; icon tile `--sr-accent-bg` / `--sr-accent`.
- Text: title and year `--sr-text`; note, axis labels, month labels `--sr-text-muted`; date links `--sr-accent` (through `ChecklistLink`).
- Chart: line and points `--sr-graph-individuals`; point ring `--sr-surface`; gridlines `--sr-border-subtle`; active year label `--sr-text`.
- Row hover / focus tint: `--sr-surface-subtle`.
- Focus ring: the global `a:focus-visible` rule (3px `--sr-accent` outline, offset 3px); nothing added.

Type roles on this surface, all from the design system's scale: card title `0.8125rem / 600`; year and date `0.8125rem / 600` tabular; note `0.75rem` muted; chart labels `11px` muted (px by rule, above).

## Geometry (the pure module, `lib/firstOfYearChartGeometry.ts`)

Changes to the schema section 4 defaults, each a design decision and each a constant the fallback and the chart both read:

| Constant | Schema default | Design | Why |
|---|---|---|---|
| `FOY_PLOT_PX` (phone) | 140 | **150** | a little more vertical resolution for an April-to-May spread; total 182 |
| `FOY_WIDE_PLOT_PX` | 180 | **200** | same; total 232, which sits well beside an eight-row list |
| `FOY_LABEL_MIN_GAP_PX` | 14 | **18** | 14 admitted twelve month labels 14px apart on the wide tier; 18 resolves to quarters plus Dec at both tiers |
| `FOY_TOP_PX`, `FOY_AXIS_LANE_PX` | 8, 24 | unchanged | |
| `FOY_GUTTER_PX` (new) | | **34** | month labels left of the plot (Recharts `YAxis width`) |
| `FOY_RIGHT_PX` (new) | | **14** | the last year label's right half |
| `FOY_X_PAD_PX` (new) | | **10** | `XAxis padding`, keeps an end point's dot inside the plot |
| `FOY_MAX_YEAR_PITCH_PX` (new) | | **120** | caps the chart width by year count |
| `FOY_MIN_CHART_PX` (new) | | **260** | the floor the month and year labels need |

New pure function: `firstOfYearChartMaxWidth(yearCount) = max(FOY_MIN_CHART_PX, FOY_GUTTER_PX + FOY_RIGHT_PX + 2 * FOY_X_PAD_PX + max(1, yearCount - 1) * FOY_MAX_YEAR_PITCH_PX)`, where `yearCount` is the axis span (`yearDomain[1] - yearDomain[0] + 1`). Ten years give 1,160px (no effect at any shipped width); two years give 260px; four give 428px. Applied as the wrapper's `maxWidth`, so a `ResponsiveContainer width="100%"` fills the capped box. Unit-testable beside `firstOfYearChartHeight`.

`firstOfYearChartHeight(wide)` is `8 + plot + 24`: **182 phone, 232 wide**.

Year-label thinning (what `interval="preserveStartEnd"` does; stated so the test can pin it): with pitch `p` px per year and a label budget of 28px, show every `ceil(28 / p)`th year from the first; always show the last; if the last would sit within 28px of the previous shown label, drop that previous one.

## Interaction Notes

- **Row hover and focus highlight the year's point.** Hovering a row, or moving keyboard focus into its link, tints the row `--sr-surface-subtle`, grows that year's point from `r=4` to `r=6` (a lone point from 5 to 6), draws a 2px halo ring at `r=10` in `--sr-graph-individuals` at `stroke-opacity 0.28`, and sets that year's axis label to `--sr-text / 600`. Leaving the row or its link clears it. The state lives in the section (`activeYear: number | null` from the row's `onMouseEnter` / `onMouseLeave` / `onFocus` / `onBlur` on the `li`) and is passed to the chart as a prop; the chart's custom `dot` renders the halo and dot circles with a class per state, and **the chart itself keeps no handlers and no tab stops** (FR-25 holds; the interaction is on the rows, which are already the reachable record). The halo and dot are plain `<circle>`s so `r` can transition in CSS (a presentation property in Chromium and WebKit). Approved by the user as final.
- **Chart accessible name** (FR-23): `First of year, one point per year by day of year. The dates are listed in this section.` It states what is charted and that the rows carry the dates, and it is true on both tiers (beside on wide, below on phone), which "listed above" would not be.
- **Keyboard:** Tab reaches each row's link in order (newest first) through the `Link` primitive; the global focus ring shows on the link; `focus-within` tints the row and lights the point; the chart subtree contributes no stop (QA-24).
- **Theme:** every color is a token; the mockup's Dark toggle shows both.
- **Loading:** the `Suspense` fallback is an empty `div` at the same `height` and `maxWidth` as the chart, so the chunk's arrival moves nothing (QA-25). No spinner: the rows are already there and the chart's box is reserved.

## Motion Spec

- Row tint on hover / focus-within: `background-color` 120ms `ease-out`, origin n/a (a fill), reduced motion: instant; CSS.
- Point grow on row hover / focus: `r` 140ms `cubic-bezier(0.2, 0, 0, 1)` (ease-out), origin the point's own center (an `r` change is radial by nature), reduced motion: instant; CSS on the SVG circle.
- Halo ring reveal: `stroke-opacity` 140ms `cubic-bezier(0.2, 0, 0, 1)`, same origin, reduced motion: instant; CSS.
- Active year label: `fill` 140ms `ease-out`, reduced motion: instant; CSS.
- Chart entrance: none. The box is reserved at final size and the chart appears in place; a static section does not animate on mount.
- Everything is under 300ms, ease-out only, and the app's global `prefers-reduced-motion` block collapses the transitions (the mockup carries its own block for the same classes).

## Content Notes

- Heading: `First of Year` (FR-16). Title case, matching `Sightings Over Time`.
- Filter note: `First dates within the selected date range.` exactly as FR-16 states it; shown only while a date range is set.
- No empty-state copy, no "one year only" sentence, no chart caption; the heading and the accessible name carry the meaning.
- No em dash anywhere; American spelling; the register is the tab's informational register. No held copy is proposed for the website, README, App Store listing or privacy policy (FR-27 default).
- Help bullet (FR-26), proposed: `First of Year: one row per calendar year with the first date you reported the species that year, each date opening its eBird checklist, and from two years on a small chart of those first dates by day of year across the years. It follows Show subspecies and the county and date filters, and reads only your loaded export.`

## Self-audit

- `~/.weft/bin/weft-design-lint check pipeline/species-first-of-year/design.html`: clean, 0 findings. (The mockup writes the card shadow with the app's ink, `rgba(15,17,23,...)`, rather than globals.css's pure-black alpha, so it lints clean; the shipped card reads `var(--sr-card-shadow)` through `SectionCard` and is unaffected.)
- Rendered in Chromium and WebKit at Mac 900, iPad 744, iPhone 390 and iPhone 320, at 100% and 200% in-app text, light and dark, eight / two / one years, filter on and off: 18 readings, every element inside its frame, `document.scrollWidth` equal to the viewport in all of them.
- Doctrine pre-flight: display face is the design system's (Inter / system-ui, a stated specific of this product, and the doctrine defers to `design-system.md` on specifics); three type roles with size and weight contrast (card title 600, year/date 600 tabular, muted 0.75rem note and 11px chart labels); neutrals are the app's tinted zinc tokens, no pure black or dead gray; one dominant color (ink on surface) and one accent spent on the links and the data line; depth is the card's shadow and hairlines, the house register rather than atmosphere, by design; motion is ease-out, under 150ms, with a reduced-motion fallback; no anti-slop patterns (no mount animation, no breathing, no hover-scale); layout is content-driven (chart beside its record), no card inside a card; content is real (Swainson's Thrush, Bay Area April arrivals, two gap years, real-shaped checklist ids); empty, one-year and loading states are designed; components are the app's own primitives with their states set on purpose.

## Decisions approved by the user (final)

1. **Chart beside the rows on a wide screen (641px and up), rows below the chart on a phone (640px and down).** Approved.
2. **Hovering or tabbing to a year row lights that year's point in the chart; the chart itself stays inert, with no handlers and no tab stops.** Approved. QA-26 holds as written; the highlight is row state passed to the chart as a prop.
3. **Each row shows the year and the full date in the user's date format (`2026` and `May 2, 2026`).** Approved. The link label is `formatDate(date)` per QA-15; the year is the aligned scan column.

## Notes for the Engineer

- The active-point state is expressed through a Recharts custom `dot` without a tooltip or an `activeDot`: `dot` receives the datum and renders the halo and dot circles; the segments and axes stay as specified.
- Placement is final (after the Sightings and Media row, before Subspecies and Forms), so the Help bullet goes after `Media:` and before `Subspecies and Forms:`.
