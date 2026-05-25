# Design Spec — Media Card on the Statistics Tab
**Feature:** media-stats-tab
**Session:** 001
**Stage:** 4 — The Designer
**Source:** prd.md + schema.md (approved)

---

## Card Layout

The Media card uses the existing `SectionCard` pattern:
- `borderRadius: 12`, `padding: 24`, `box-shadow: var(--sr-card-shadow)`
- Header row: Video icon (Lucide `Video`, `var(--sr-accent)` green) + "Media" title (`font-size: 18px, font-weight: 600, var(--sr-text)`)
- Positioned between the Breeding Stats card and the Other Statistics card (FR-01)
- Entirely absent when no ML data is loaded (FR-02)

---

## Chart Section

### Interval Control
Segmented control above the chart, right-aligned (matches Graph Options card in Species Detail):
- Segments: Weekly · Monthly · Yearly · Total
- Monthly is selected on every tab load (FR-05)
- Implemented as a button group with `var(--sr-accent)` background + white text for the active segment; `var(--sr-surface-2)` background + `var(--sr-text-muted)` for inactive

### Per Period / Cumulative Toggle
- Segmented control, left-aligned, on the same row as the interval control
- Segments: Per Period · Cumulative
- Per Period is selected by default (FR-08)
- **Hidden** (opacity: 0, pointer-events: none, or conditional render) when interval = Total (FR-07)
- When Total is active, the row collapses to just the interval control

### Chart
- Recharts `LineChart` inside `ResponsiveContainer` (100% width, 240px height — matching existing graphs)
- Four `Line` components, each `type="monotone"` for weekly/monthly/yearly; `type="stepAfter"` for Total interval (FR-07)
- Colors via CSS custom properties:
  - Photo: `var(--sr-graph-photo)` (#3B82F6)
  - Audio: `var(--sr-graph-audio)` (#F59E0B)
  - Video: `var(--sr-graph-video)` (#8B5CF6)
  - Total: `var(--sr-graph-media-total)` (new token — #64748b light / #94a3b8 dark)
- `dot={false}` on all lines (consistent with existing graphs)
- `XAxis`: `dataKey="key"`, `tickFormatter` using `formatPeriodLabel(key, interval)`; reduced tick count for readability
- `YAxis`: left-side, integer ticks
- `Tooltip`: shared crosshair (`isAnimationActive={false}`, consistent with existing)
- `Legend`: bottom, labels "Photo", "Audio", "Video", "Total"
- Chart does not render when fewer than 2 distinct period keys exist (FR-09); rankings still appear below

### Margin from controls to chart
`margin-top: 12px`

---

## Rankings Section

Three sub-sections in a single-column stack below the chart, separated by a `1px solid var(--sr-border)` divider:

### Sub-section headers
`font-size: 13px`, `font-weight: 600`, `color: var(--sr-text-muted)`, `text-transform: uppercase`, `letter-spacing: 0.05em`
Labels: **Most Photographed** · **Most Recorded** · **Most Filmed**

### Ranking rows (top 10 each)
Each row is a flex row: `align-items: center`, `gap: 8px`, `padding: 4px 0`

| Element | Style |
|---|---|
| Rank number | `font-size: 11px`, `color: var(--sr-text-muted)`, `width: 16px`, `text-align: right` |
| Species name | `font-size: 13px`, `color: var(--sr-accent)` (clickable link), `flex: 1` |
| Count | `font-size: 11px`, `color: var(--sr-text-muted)` |
| SpeciesLinks icons | eBird + BOW icons (existing component), `margin-left: 4px` |
| ML catalog link | Camera/Audio/Video icon (Lucide), links to `mlCatalogUrl(name, format, mlUserId, taxonCode)` |

The pattern is identical to the existing Most Photographed rows in Other Statistics.

### Rankings spacing
`gap: 20px` between the three sub-section blocks; `padding-top: 20px` between the chart and the first sub-section.

---

## Removed from Other Statistics

The Most Photographed, Most Audio/Recorded, and Most Video/Filmed sub-sections are removed from the Other Statistics card. The Nemesis Birds section remains unchanged. The Other Statistics card heading is retained.

---

## Responsive Behavior

- `ResponsiveContainer` handles chart width — no fixed pixel widths
- Rankings grid stays single-column on all widths (consistent with existing rankings in Other Statistics)
- Segmented controls wrap naturally if viewport is very narrow

---

## Token Summary

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--sr-graph-photo` | existing | existing | Photo line |
| `--sr-graph-audio` | existing | existing | Audio line |
| `--sr-graph-video` | existing | existing | Video line |
| `--sr-graph-media-total` | `#64748b` | `#94a3b8` | Total line (new) |

The new token must be added to both `:root` and `[data-theme="dark"]` in `globals.css` before the component references it.
