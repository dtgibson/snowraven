# Design Spec — Tab Filters

## Visual Direction

Filter controls are quiet, toolbar-native elements that stay out of the way until they're doing something. Active filters announce themselves with SnowRaven's Irish clover green — a county selection turns the dropdown green, a date entry turns that input green — so the user always knows at a glance what's filtering the view. The overall aesthetic matches the existing tab toolbars exactly: same height, same radius, same pill-style density.

---

## Screens / Views

### Breeding Codes Tab — Filter Toolbar

The existing pill row (All / individual codes / Confirmed / Probable / Possible) gains two new controls after a divider:

**County dropdown** — a compact inline `<select>` (26px height, 5px border-radius, 1.5px border) with a map-pin icon prefix. Default label: "All Counties". Options populated from data only. When a county is selected, the control switches to the active state: green border (`rgba(45,134,83,0.65)`), green background (`#E8F5EE`), green text (`#2D8653`).

**Date range** — two adjacent date inputs ("From" and "To") separated by a `→` glyph. Each control is 26px height, same border radius and density as the county control. A calendar icon prefixes the From input. When a value is entered, the input switches to the same green active state as the county control. Empty inputs show placeholder text in disabled color.

A thin 1px vertical divider separates the pill cluster from the county/date cluster.

When any filter is active, a **filter strip** appears between the toolbar and the table: green background, icon + filter summary text ("Hennepin County · All time · 12 of 78 species"), and a right-aligned "Clear filter" text link.

---

### Media List Tab — Filter Toolbar + Total Column

Same toolbar pattern as Breeding Codes. The county dropdown shows a **loading state** while Nominatim resolution is in progress: dashed border, spinner icon, "Resolving counties…" label in disabled color. It becomes a normal interactive dropdown once resolution completes.

**Total column** — rightmost column in the table, after Video. Header text "Total" in green (`var(--sr-accent)`), separated from the Video column by a subtle 1px left border. Cell values are bold green numbers. The column is sortable (same header-click pattern as Photo/Audio/Video). Default sort is by Total descending when the user first clicks it.

**Checklists column** — plain numeric count, not a link. No special styling beyond tabular-nums alignment.

---

### Species Detail Tab — Filter Controls

The filter controls appear in a second toolbar row, directly below the species selector input. They sit in a flex-wrap row alongside the existing Subspecies merged / Hide spuh ghost buttons.

County dropdown and date range follow the same visual treatment as the other tabs. When both county and date are active simultaneously, a filter strip appears immediately above the Summary card (not above the toolbar), with rounded top corners and no top border — it visually connects to the Summary card below it. The strip text shows both active constraints: "Hennepin County · May 1 – Aug 31, 2022 · Showing 9 of 47 checklists".

All sections below the summary card (sightings, breeding codes, top locations, map, recent media) narrow to the filtered view without any additional UI change — the filter strip communicates that everything beneath it is scoped.

---

## Component Usage

| Component | Usage |
|-----------|-------|
| `<select>` (native, styled) | County dropdown — inline in toolbar, `-webkit-appearance: none` with custom chevron |
| `<input type="date">` | From / To date inputs — 26px height, same border/radius as other toolbar controls |
| Toolbar divider | 1px × 18px `div` separating pill cluster from filter cluster |
| Filter strip | Green `div` below toolbar, shows active filter summary + clear action |
| Spinner | 11px CSS border animation, used in county loading state |

---

## Design Tokens Applied

| Token | Usage |
|-------|-------|
| `--sr-accent` (#2D8653) | Active filter border/text, Total column header and values, filter strip text |
| `--sr-accent-bg` (#E8F5EE) | Active filter background, filter strip background |
| `rgba(45,134,83,0.65)` | Active filter border (strong) |
| `--sr-border` (#E4E4E7) | Inactive control borders, toolbar divider |
| `--sr-text-muted` (#71717A) | Inactive control labels, placeholder text |
| `--sr-text-disabled` (#A1A1AA) | Loading state text, date placeholder |
| `--sr-surface-subtle` (#F4F4F5) | Loading state background |

---

## Interaction Notes

- **County dropdown active state**: applies immediately on selection; reverts to default on "All Counties"
- **Date input active state**: applies as soon as a value is entered; clears when the input is blanked
- **Filter strip "Clear filter"**: resets county to null and both date inputs to empty; strip disappears
- **County loading state**: dashed border + spinner + disabled label; non-interactive until resolution completes
- **Total column sort**: clicking header sorts descending first; second click reverses; tiebreak is name sort
- **Filter composition**: all active filters (county + date + existing pills) combine with AND logic; the species count in the section subtitle always reflects the composed result
- **Reset on file load**: all filter state clears when a new file is uploaded on any tab

---

## Content Notes

- County dropdown option labels use the county name exactly as it appears in the data (e.g. "Hennepin County", not "Hennepin")
- Default dropdown option label: "All Counties"
- Filter strip date format: "May 1, 2022" (human-readable), not the raw YYYY-MM-DD input value
- Loading state label: "Resolving counties…" (with ellipsis)
- Checklists column: plain integer, no link, tabular-nums alignment
