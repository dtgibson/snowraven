# Design Spec — Species Detail Visualizations

## Visual Direction

Quiet utility matching the existing SnowRaven aesthetic: white surfaces, subtle borders, green (#2D8653) accent for primary elements, muted gray for supporting text. Both new sections slot into the existing SectionCard / SectionHead pattern without visual disruption. The graph uses a subtle area fill under the individuals line for visual weight without clutter.

## Screens / Views

### Sightings Over Time — Graph Section

Placed between the Sightings/Media cards and the Breeding Codes section in the Species Detail layout.

**Section header:** Standard SectionHead with a trending-up icon in the green icon container, title "Sightings Over Time."

**Chart header row:** Left side shows a small axis label ("Individuals reported per year" / "Cumulative individuals reported") that updates with the toggle. Right side holds the Per Year / Cumulative segmented toggle — two buttons in a pill container matching the existing A-Z/Taxonomic toggle style (`background: var(--sr-surface-subtle)`, `border-radius: 7px`, active button gets white background and subtle shadow).

**Chart area:** Full-width SVG rendered via Recharts `<ResponsiveContainer>`. Viewbox equivalent: 560×230px with left padding of ~52px for y-axis labels and bottom padding of ~28px for x-axis labels.
- Y-axis: 5 gridlines, labels in `var(--sr-text-disabled)` (10px), no axis line
- X-axis: year labels every other year to avoid crowding, same muted style
- Individuals line: 2.5px stroke, `var(--sr-graph-individuals)` green, with a subtle gradient area fill (12% opacity at top → 1% at bottom) below the line
- Photo, Audio, Video overlay lines: 1.8px stroke, 85% opacity, their respective graph tokens
- Dots at each data point: 3.5px radius for individuals, 2.5px for media lines; white stroke ring
- Hover: vertical dashed indicator line + floating tooltip card (`var(--sr-surface)` background, `border-radius: 8px`, showing year and all four values)

**Legend strip:** Below the chart, separated by a subtle border. Four items inline: a short colored swatch (20×3px, `border-radius: 2px`) followed by the line label in muted gray. Media lines that have no data for the selected species are not shown.

### Sighting Locations — Heatmap Toggle

Existing SectionCard. Only change is in the section header: the map-mode toggle is appended flush-right to the SectionHead row.

**Toggle:** Two-button pill (`border-radius: 6px`, smaller than the chart toggle — 4px padding vertical, 10px horizontal, 11px font). Each button shows a small icon + label:
- Pins: map-pin icon + "Pins"
- Heatmap: globe-style icon + "Heatmap"
Active state: white background, subtle shadow. Inactive: muted text, transparent background.

**Pins mode (default):** Existing Leaflet marker behavior unchanged.

**Heatmap mode:** Leaflet.heat overlay with warm color gradient (low = yellow, high = red-orange). A compact legend in the bottom-right corner of the map shows "Low ── High" with the gradient bar. Individual pin markers are hidden. The overlay fades at low-density edges.

**Map hidden state:** When a species has no coordinate data, neither toggle nor heatmap appears (existing behavior preserved).

## Component Usage

- `SectionCard` / `SectionHead` — existing inline components in SpeciesDetail.tsx; no changes
- `SightingsGraph` — new inline component; uses Recharts `ResponsiveContainer`, `LineChart`, `Line`, `XAxis`, `YAxis`, `Tooltip`, `Legend`
- `HeatmapLayer` — new inline component; uses `useMap()` + imperative `L.heatLayer`
- Segmented toggle buttons — plain `<button>` elements with `.seg-toggle` / `.map-toggle` style classes, no external component library

## Design Tokens Applied

| Token | Usage |
|---|---|
| `--sr-surface` | Card backgrounds, tooltip background, active toggle button |
| `--sr-surface-subtle` | Toggle pill background |
| `--sr-border` | Card borders, tooltip border |
| `--sr-border-subtle` | Legend strip separator |
| `--sr-text` | Chart tooltip values, section titles |
| `--sr-text-muted` | Axis labels, legend labels, toggle inactive text |
| `--sr-text-disabled` | Y-axis tick labels |
| `--sr-accent` | Section icon color, individuals graph line |
| `--sr-accent-bg` | Section icon background |
| `--sr-graph-individuals` | Primary line (`= var(--sr-accent)`) |
| `--sr-graph-photo` | Photo overlay line (#3B82F6 light / #60A5FA dark) |
| `--sr-graph-audio` | Audio overlay line (#F59E0B light / #FCD34D dark) |
| `--sr-graph-video` | Video overlay line (#8B5CF6 light / #A78BFA dark) |
| `--sr-card-shadow` | SectionCard box shadow |

## Interaction Notes

- **Per Year / Cumulative toggle:** Updates chart lines and axis label instantly; no loading state
- **Chart hover tooltip:** Shows on `mousemove` over the chart SVG; a vertical dashed line tracks the nearest year; tooltip repositions left/right based on horizontal position to avoid edge clipping; hidden on `mouseleave`
- **Dots:** Rendered at each data point; media line dots omitted for years with zero value
- **Pins / Heatmap toggle:** Switches Leaflet map mode instantly; resets to Pins whenever a new species is selected
- **Heatmap weight:** Each coordinate point weighted by observation count at that location (derived from existing `coordMarkers[].count`)
- **Filter reactivity:** Both graph and heatmap re-derive from `speciesObs` (the already-filtered array) — they update automatically when county or date filters change

## Content Notes

- Chart axis label reads "Individuals reported per year" in Per Year mode and "Cumulative individuals reported" in Cumulative mode
- Tooltip year label: plain 4-digit year (e.g. "2022") or "Jan 2024" format in monthly fallback mode
- Legend omits any line with no data for the current species (e.g. no media lines when ML export is absent)
- Heatmap legend reads "Low" and "High" — no numeric values
- Empty state message for graph: "Not enough data to show a graph" (shown when fewer than 2 distinct time periods exist)
