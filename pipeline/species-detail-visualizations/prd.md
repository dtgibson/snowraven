# PRD — Species Detail Visualizations

**Feature:** species-detail-visualizations
**Session:** 001
**Date:** 2026-05-21
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

Two new visualizations added to the existing Species Detail tab: a line graph showing sightings history over time (total individuals and media items per period, with a per-period / cumulative toggle), and a heatmap mode on the existing Leaflet map that shows where the selected species has been most frequently encountered. Both are entirely client-side and respond to the active county and date filters.

---

## User Stories

**US-01** — As a birder reviewing a species, I want to see a line graph of how many individuals I've reported over the years, so that I can understand whether my encounter rate with that species has changed over time.

**US-02** — As a birder, I want to switch between a per-year view (individuals per year) and a cumulative view (running total of individuals), so that I can see both my annual trend and my total accumulation.

**US-03** — As a birder who uploads media to Macaulay Library, I want overlay lines on the graph showing how many photos, audio recordings, and videos I have per year, so that I can see when my media coverage of a species began and how it has grown.

**US-04** — As a birder, I want the graph to reflect my active county and date-range filters, so that the visualization is consistent with the rest of the Species Detail view.

**US-05** — As a birder using the sighting map, I want to toggle between pin view and a heatmap overlay, so that I can see at a glance where a species is most concentrated in my data rather than reading individual pin locations.

**US-06** — As a birder, I want the heatmap to reset to pin view when I select a new species, so that I'm never looking at a heatmap that belongs to the previous species.

---

## Functional Requirements

### Time-Series Graph

**FR-01** — The app shall display a line graph section in the Species Detail tab when a species is selected and has recorded observations in at least 2 distinct calendar years.

**FR-02** — When a species has observations spanning only a single calendar year, the app shall display the graph with monthly granularity instead of yearly.

**FR-03** — The x-axis shall represent time periods (years by default; months when FR-02 applies), running from the first period with any observation to the most recent.

**FR-04** — The primary line shall represent total individuals reported per time period: the sum of numeric `howMany` values across all matching observations. Presence-only observations (null or X) contribute 0 to this sum.

**FR-05** — When an ML export is loaded, the graph shall display up to three additional overlay lines: one for photo items, one for audio items, one for video items — each showing the count of ML catalog items with an observation date falling in that time period.

**FR-06** — When no ML export is loaded, the overlay lines (FR-05) shall not appear. The graph shall render correctly with only the primary line.

**FR-07** — A toggle control shall appear above or within the graph allowing the user to switch between **Per Year** and **Cumulative** views. Cumulative view shows a running total for each line from the earliest period to the current.

**FR-08** — Each line shall be rendered in a distinct color using `var(--sr-*)` CSS custom property tokens. Colors shall be legible in both light and dark themes.

**FR-09** — The graph shall display a legend identifying each visible line (Individuals, Photo, Audio, Video). Lines with no data (e.g. overlay lines when ML export is absent) shall be omitted from the legend.

**FR-10** — Hovering over any point on the graph shall display a tooltip showing the time period label and the exact value for each visible line at that period.

**FR-11** — The graph shall display an empty state ("Not enough data to show a graph") when the selected species has fewer than 2 distinct time periods with observations, rather than rendering a degenerate single-point chart.

**FR-12** — The graph shall re-render whenever the active county filter or date-range filter changes, using only the filtered subset of observations.

**FR-13** — The graph section shall appear in the Species Detail layout between the Sightings / Media statistics cards and the Breeding Codes section.

### Sighting Map Heatmap

**FR-14** — A toggle control shall appear in the map section header allowing the user to switch between **Pins** (the existing marker view) and **Heatmap** modes.

**FR-15** — In Heatmap mode, the map shall render a heatmap overlay in place of the individual markers. Each unique lat/lng coordinate shall be weighted by the number of observations at that location.

**FR-16** — In Heatmap mode, the individual Leaflet markers and their popups shall not be visible.

**FR-17** — The heatmap toggle shall reset to Pins mode whenever the user selects a different species.

**FR-18** — The heatmap shall use the same filtered observation set as the rest of the Species Detail view (county + date filters applied).

**FR-19** — When the map has no coordinate data (currently hidden per the existing Species Detail behavior), neither the toggle nor the heatmap shall appear.

---

## Non-Functional Requirements

**NFR-01 — Performance:** Graph data shall be computed synchronously from the already-parsed `ObservationEntry[]` array. No additional network requests shall be made for graph rendering.

**NFR-02 — Performance:** Switching between Per-Year and Cumulative views, and toggling Pins/Heatmap, shall feel instant (no loading spinner, no re-fetch).

**NFR-03 — Theming:** All graph colors, axis labels, gridlines, and tooltip styles shall use `var(--sr-*)` CSS custom properties. No hardcoded hex or RGB values.

**NFR-04 — Responsiveness:** The graph shall be full-width within the Species Detail layout and remain legible at mobile viewport widths (≥320px). Axis labels may abbreviate on narrow viewports.

**NFR-05 — Accessibility:** The graph toggle (Per Year / Cumulative) and the map toggle (Pins / Heatmap) shall be keyboard-accessible and have visible focus states using existing focus styles.

**NFR-06 — Dependencies:** The charting library shall be chosen to minimize bundle size impact. The Architect shall evaluate Recharts vs. a native SVG implementation before Stage 3 concludes and document the decision.

---

## Out of Scope

- Comparing two species on the same graph
- Exporting or saving the graph as an image or data file
- Per-month granularity as a user-selectable option (granularity is automatic per FR-02)
- Heatmap configuration controls (radius, blur, intensity)
- Heatmap on any tab other than Species Detail
- Graph on any tab other than Species Detail
- Handling the case where `howMany` is a range (e.g. "3-5") — treat as 0 (presence-only)

---

## Open Questions

**OQ-01 — ML export observation date column:** The overlay lines (FR-05) require per-period counts from the ML export. This assumes the ML export CSV contains an observation date column that is already parsed into `MLExportRow`. The Engineer should verify this before implementing the overlay lines.
*Default assumption if unresolved:* If `MLExportRow` has no parseable observation date, the overlay lines are omitted from v1 and FR-05, FR-06, FR-09 are descoped. The primary individuals line is unaffected.

**OQ-02 — Heatmap library compatibility:** Leaflet.heat is the standard heatmap plugin for Leaflet, but react-leaflet v5's architecture (based on React context hooks) may require direct Leaflet API integration via `useMap()` rather than a declarative wrapper component. The Architect should confirm the integration approach.
*Default assumption if unresolved:* Use `leaflet.heat` directly via `useMap()` hook inside a custom React component, loading the Leaflet map instance imperatively.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Graph appears for multi-year species | Selecting a species with observations across ≥2 years shows the graph section |
| QA-02 | Graph hidden for single-period species | Selecting a species with <2 distinct periods shows the empty state, not a broken chart |
| QA-03 | Primary individuals line accuracy | Graph per-year values match a manual sum of `howMany` from the eBird backup for that species and year |
| QA-04 | Cumulative toggle | Switching to Cumulative changes each data point to the running total of all prior periods; switching back restores per-period values |
| QA-05 | Overlay lines appear with ML export | Loading an ML export causes photo/audio/video overlay lines to appear on the graph (when OQ-01 resolves affirmatively) |
| QA-06 | Overlay lines absent without ML export | When no ML export is loaded, only the primary individuals line is rendered |
| QA-07 | Filter responsiveness | Applying a county or date filter updates the graph to reflect only matching observations |
| QA-08 | Monthly fallback | Selecting a species observed only within a single calendar year shows the x-axis in months |
| QA-09 | Heatmap toggle renders | Clicking Heatmap shows a heatmap overlay on the map; individual pins are not visible |
| QA-10 | Pins toggle restores | Clicking Pins returns the map to the existing marker/popup view |
| QA-11 | Heatmap resets on species change | Selecting a different species while in Heatmap mode resets the map to Pins |
| QA-12 | No heatmap when no coordinates | A species with no lat/lng data shows neither the heatmap toggle nor an empty heatmap |
| QA-13 | Theming | Graph and heatmap toggle are visually correct in both light and dark themes; no hardcoded colors |
| QA-14 | Keyboard accessibility | Graph toggle and map toggle are reachable and operable by keyboard |
