# Design Spec — Birding Statistics Tab

## Layout

**Container:** `max-w-[900px]` centered, matching existing tab layouts. Sections render as a vertical stack of `SectionCard`s — no tabs-within-tabs, no sidebar navigation.

**Page header:** Tab title ("Statistics") with bar-chart icon + data freshness subtitle ("2,156 checklists · eBird backup from May 22, 2026"). Spuh/slash toggle lives here as a persistent control that recomputes all species counts globally.

**Section order (FR-06):**
1. Life List Totals
2. Firsts & Milestones
3. Temporal Stats
4. Geographic Stats
5. Effort & Methodology
6. Data Quality
7. Breeding Stats
8. Fun Stats

---

## Components

### SectionCard
Standard `SectionCard` with `SectionHead` (icon + title). All sections use the existing card pattern — no new card variants needed.

### Stat Grid
Borderless grid of cells separated by 1px `var(--sr-border-subtle)` lines. Used for hero numbers in Life List Totals and Effort sections.

- Primary stats: `text-[28px] font-bold` with `-tracking-[0.02em]`
- Secondary stats: `text-[22px] font-bold`
- Labels: `text-[11px] text-[var(--sr-text-muted)]`
- Sub-labels (e.g. "161 full days"): `text-[11px] text-[var(--sr-text-muted)]`

### Bar Histogram
Reusable pattern: label | fill bar | value. Used for all temporal histograms (year, month, day-of-week, hour). The fill bar uses `var(--sr-accent)` for primary data (checklists/species) and `#3B82F6` for secondary comparisons.

### Accumulation SVG
Inline `<svg>` rendered with an area+line composite. Data points derived from per-year new-species totals accumulated. Axis labels at year boundaries. No external charting dependency — uses the same SVG approach as the existing map pins.

### Rank Bar List
Species name | proportional fill bar | percentage. The "Most Reported" list uses `var(--sr-accent)` fill; "Least Reported" uses `#F59E0B` (amber) to visually distinguish rarity.

### Milestone List
Numbered badge | species name | date. Badge uses `var(--sr-accent-bg)` / `var(--sr-accent)` for reached milestones; `var(--sr-surface-subtle)` / muted for future milestones.

### Protocol Bar
Stacked horizontal bar (full-width, 12px tall, 6px radius) showing protocol proportions by color, with a legend grid below listing name, proportional bar, percentage, and checklist count.

### Observation Map
Reuses the existing Leaflet + Pins/Heatmap pattern from Map Explorer. Toggle between Pins and Heatmap view using the existing `toggle-group` button pattern. The map renders `ChecklistEntry.latitude/longitude` coordinates. When no default location is saved, the map still renders (showing all observation coordinates).

### Nemesis Birds
Location pill shows saved default location (lat/lng → reverse-geocoded name from existing Settings state). Bird list rendered as rows with colored dot freshness indicator: red = last 7 days, amber = 8–14 days, gray = 15–30 days. When no default location is saved, shows a prompt card directing user to Settings → Map Defaults.

### Big Year Dropdown
Native `<select>` styled to match existing selects. Year options = all years present in the observation data. Switching year rerenders the stats block via `useMemo` keyed on selected year.

### Expandable Sections
"One-and-done birds" and county/state full lists use the existing expand/collapse pattern: button with chevron icon + count, hidden content revealed on click.

---

## Colors

All colors via `var(--sr-*)` tokens — no hardcoded values in component files.

| Element | Token |
|---|---|
| Primary bars / accent numbers | `var(--sr-accent)` |
| Secondary bars (day-of-week, hour after noon) | `#3B82F6` (graph-photo token) |
| Rarity / amber indicators | `#F59E0B` (graph-audio token) |
| Breeding tier pills | `var(--sr-tier-1/2/3/4)` and rgb counterparts |
| Nemesis dot: recent | `#EF4444` |
| Nemesis dot: mid | `#F59E0B` |
| Nemesis dot: older | `var(--sr-text-disabled)` |

---

## Interactions

| Element | Behavior |
|---|---|
| Spuh/slash toggle | Header-level; recomputes all species-count stats (life list, milestones, one-and-done) via a single `includeSpuh` boolean in `useMemo` dependencies |
| One-and-done expand | Reveals full list below the "N one-and-done birds" button; chevron rotates 180° |
| County/State expand | Same pattern as one-and-done |
| Map pins/heatmap toggle | Swaps Leaflet layer; no data change |
| Big Year dropdown | Switches `selectedYear` state; all Big Year stats re-derive from `useMemo(observations.filter(year))` |
| Nemesis "Refresh" | Not shown in mockup — the nemesis fetch triggers once on mount (or when default location changes); a manual refresh button is a v2 consideration |

---

## Responsive Behavior

The tab targets desktop-first (matching all other tabs). Two-column grids collapse to single column below ~600px viewport width. Stat grids drop from 4-column to 2-column. Histograms remain full-width.

---

## Empty / Loading States

- **No eBird backup stored:** Shows the standard `SetupRequiredCard` used by all other tabs. No stats content renders.
- **No ML export stored:** Media counts show "–" / "No ML export". All other stats render normally.
- **No default location saved (Nemesis section):** Shows an inline prompt card: "Set a default location in Settings to see Nemesis Birds nearby."
- **Loading (files being parsed):** Existing `LoadingCard` spinner.

---

## Data Sources

All stats derive from props passed by `App.tsx`:
- `observations: ObservationEntry[]` — full parsed eBird backup
- `mlRows: MLExportRow[]` — full parsed ML export (or `[]` if not uploaded)
- `mapDefaults: MapDefaults | null` — default location from Settings state (for Nemesis section)

No new props introduced beyond what the schema specifies.
