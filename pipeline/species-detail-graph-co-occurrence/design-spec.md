# Design Spec — Species Detail: Graph Options and Co-occurring Species

**Feature:** species-detail-graph-co-occurrence
**Session:** 001
**Stage:** 4 — The Designer
**Source:** prd.md (approved), design.html (approved)

---

## Layout

The Species Detail ready-state render block gains two new SectionCards. The overall vertical order is:

1. Graph Options *(new — above both graphs)*
2. Sightings Over Time *(existing — Per Year/Cumulative toggle removed from header)*
3. Media Over Time *(existing)*
4. Breeding Codes *(existing)*
5. **Reported With** *(new — below Breeding Codes)*
6. Top Locations *(existing)*

---

## Graph Options Card

### Card Header
- Icon: settings/sliders (14px stroke icon)
- Title: "Graph Options"
- No trailing controls in header

### Card Body
Two `opt-group` rows, laid out horizontally (flex, gap 24px, wrapping on narrow viewports):

**Interval**
- Label: uppercase 11px muted — "INTERVAL"
- Segmented control: `[ Yearly ]  [ Monthly ]`
- Default active: Yearly
- State: `interval: 'yearly' | 'monthly'`

**View**
- Label: uppercase 11px muted — "VIEW"
- Segmented control: `[ Per Period ]  [ Cumulative ]`
- Default active: Per Period
- State: `viewMode: 'per-period' | 'cumulative'`

Both controls use the existing segmented-button pattern (surface-subtle background, white active pill with shadow).

---

## Sightings Over Time Card (updated)

- Header unchanged except the embedded Per Year/Cumulative toggle is **removed**
- Sub-label below header updates dynamically:
  - Per Period + Yearly → "Individuals per year"
  - Per Period + Monthly → "Individuals per month"
  - Cumulative + Yearly → "Cumulative individuals (yearly)"
  - Cumulative + Monthly → "Cumulative individuals (monthly)"
- Graph responds to both `interval` and `viewMode` props

---

## Media Over Time Card (updated)

- Header unchanged
- Sub-label:
  - Per Period + Yearly → "Items per year"
  - Per Period + Monthly → "Items per month"
  - Cumulative → "Cumulative items (yearly/monthly)"
- Graph responds to both `interval` and `viewMode` props

---

## Reported With Card

### Card Header
- Icon: network/node graph (14px stroke icon — circles with connecting lines)
- Title: "Reported With"
- Trailing text: "of N checklists" (11px, muted — shows total filtered target checklists)

### Column Headers (above list)
Four columns, same widths as data rows:
- Rank (20px, flex-shrink 0) — blank header
- Species (flex: 1) — "SPECIES" uppercase 10px disabled
- Bar track (100px, flex-shrink 0) — blank
- Rate (38px, right-aligned) — "RATE"
- Checklists (80px, right-aligned) — "CHECKLISTS"

### Data Rows
Each row (`rw-row`):
- **Rank** — right-aligned 11px disabled text (1, 2, 3…)
- **Species name** — 13px semibold, truncated with ellipsis on overflow
- **Bar** — 100px track (surface-subtle), filled with accent color at 55% opacity; width = pct of max coefficient in list (not absolute)
- **Rate** — 13px semibold accent color (e.g. "82%")
- **Checklist count** — 11px muted (e.g. "116 checklists")

Row separator: 1px border-subtle bottom, last row has none.

### Expand / Collapse
- Top 10 shown by default
- When more than 10 qualify: "Show all N species" button (12px, accent color, text button)
- When expanded: "Show top 10" collapse button
- Button centered below list, accent hover background

### Empty States
- `speciesObs` is empty → "No checklist data available" (centered muted text in card body)
- Data present but no species meet minimum threshold → "No species met the minimum co-occurrence threshold."

---

## Token Usage

All colors use existing `var(--sr-*)` tokens:
- `var(--sr-text)` — primary text
- `var(--sr-text-muted)` — labels, secondary text
- `var(--sr-text-disabled)` — rank numbers, column headers, trailing checklist count in card header
- `var(--sr-surface-subtle)` — segmented control background, bar track
- `var(--sr-accent)` — rate percentage, bar fill, expand button text
- `var(--sr-accent-bg)` — expand button hover background
- `var(--sr-border-subtle)` — row separators

---

## Interaction Notes

- Interval and View Mode selectors are siblings in a shared flex row — they do not stack
- Switching either control updates both Sightings and Media graphs simultaneously (shared state lifted to call site)
- On species change, Graph Options resets to Yearly / Per Period (FR-09)
- The "of N checklists" header annotation in Reported With updates when filters change
