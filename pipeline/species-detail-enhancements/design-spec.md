# Design Spec — Species Detail Enhancements

## Visual Direction
Quiet utility — additions integrate seamlessly with the existing Species Detail tab without introducing new visual patterns. The green accent (#2D8653) carries the frequency stat and new chart line, keeping the three additions visually coherent with the rest of the tab. No new tokens required.

## Screens / Views

### Summary Card — Sightings Section
The existing stats grid expands from three cells to four by adding a Frequency cell between Individuals and Personal Best.

- **Frequency cell:** label "Frequency", value shown as `X%` in `var(--sr-accent)` green to signal a positive/notable metric, sub-label "of your checklists"
- A slim 3px fill bar directly below the sub-label visualizes the percentage at a glance: background in `var(--sr-border)`, fill in `var(--sr-accent)`, width = frequency %
- The frequency value is the only colored stat value in the grid — this draws the eye without disrupting the existing layout
- Cell padding and border-left divider follow the existing pattern of all other stat cells

### Graph Options Card — Interval Toggle
- Toggle order updated to: **Weekly · Monthly · Yearly** (left to right)
- Monthly is the active/selected state on load and on every species change
- No visual changes to the segmented control itself — same border, radius, background, active green fill

### Sightings Over Time Card
- Unchanged visually
- X-axis labels in weekly mode: `Wk N 'YY` format (e.g. `Wk 14 '26`), rendered by updating `formatPeriodLabel`

### Checklists Over Time Card (new)
- Identical card structure to Sightings Over Time: same `SectionCard` + `SectionHead` + `TrendingUp` icon + axis sub-label
- Title: "Checklists Over Time"
- Renders immediately below Sightings Over Time, above Media Over Time
- Single line: `var(--sr-graph-individuals)` green at `opacity: 0.6` — lighter weight than the individuals line, visually subordinate but clearly related
- Axis sub-label reflects active view mode: "Checklists per [week/month/year]" or "Cumulative checklists"
- No legend needed (single line)

## Component Usage
- `SectionCard`, `SectionHead` — existing shared inline components, no changes
- `StatLabel` — existing, used for Frequency label
- Recharts `LineChart`, `ResponsiveContainer`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip` — existing imports, reused for Checklists Over Time chart
- `TrendingUp` from lucide-react — reused icon for Checklists Over Time section head

## Design Tokens Applied
- `var(--sr-accent)` — Frequency percentage value, frequency fill bar, checklists line color
- `var(--sr-border)` — frequency bar background track
- `var(--sr-border-subtle)` — grid lines in charts, stat cell dividers
- `var(--sr-text-disabled)` — stat labels, axis tick labels
- `var(--sr-text-muted)` — chart sub-labels, stat sub-text
- `var(--sr-graph-individuals)` — checklists line (same token, applied at 0.6 opacity)

## Interaction Notes
- Switching interval redraws all three graph cards simultaneously (Sightings, Checklists, Media)
- Switching Per Period / Cumulative redraws all three simultaneously
- Frequency stat updates reactively when county or date-range filter changes
- Frequency fill bar width is a CSS inline style: `width: ${frequencyPct}%`

## Content Notes
- Frequency sub-label: "of your checklists" — possessive, personal, consistent with the tab's voice
- Chart axis sub-labels follow existing pattern: lowercase, muted, descriptive (e.g. "Checklists per month", "Cumulative checklists")
- `<1%` displayed when species appears on at least one checklist but rounds to 0%
- No label or tooltip change needed for the checklists chart — the card title makes it self-explanatory
