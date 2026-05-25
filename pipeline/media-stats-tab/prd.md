# PRD — Media Card on the Statistics Tab
**Feature:** media-stats-tab
**Session:** 001
**Date:** 2026-05-24
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview

A new Media card on the Statistics tab that consolidates all media-centric statistics: a multi-series line chart showing how photo, audio, video, and total media counts have grown over time, plus the Most Photographed / Most Audio / Most Video rankings currently scattered at the bottom of Other Statistics.

## User Stories

**US-01** — As a birder with years of Macaulay Library uploads, I want to see how my photo, audio, and video counts have grown over time, so that I can understand which periods were most productive for each media type.

**US-02** — As a birder, I want to toggle between weekly, monthly, yearly, and total views of my media growth, so that I can zoom in on active periods or see the long arc of my catalog.

**US-03** — As a birder, I want to switch between cumulative and per-period views, so that I can see both the total catalog size at any point in time and the rate of new additions per period.

**US-04** — As a birder, I want to see which species I've photographed, recorded audio of, and recorded video of most, so that I can quickly identify my most-covered species.

**US-05** — As a birder, I want all media statistics in one dedicated card, so that I don't have to hunt across the Statistics tab for media-related content.

## Functional Requirements

### Card Visibility

**FR-01** — The Statistics tab shall include a Media card positioned between the Breeding Stats card and the Other Statistics card.

**FR-02** — The Media card shall only render when ML export data is loaded (mlRows.length > 0). When no ML data is present, the card shall be entirely absent — no empty state, no placeholder.

### Chart

**FR-03** — The Media card shall contain a line chart with four series: Photo, Audio, Video, and Total. Total equals Photo + Audio + Video for each period.

**FR-04** — Each series shall use a distinct color token: Photo → `var(--sr-graph-photo)`, Audio → `var(--sr-graph-audio)`, Video → `var(--sr-graph-video)`, Total → a new `var(--sr-graph-media-total)` token. The new token shall be added to both `:root` and `[data-theme="dark"]` in `globals.css` before use.

**FR-05** — The chart shall support a segmented interval control: Weekly · Monthly · Yearly · Total. Monthly shall be selected by default on every Statistics tab load.

**FR-06** — In Weekly interval, periods use ISO week bucketing (format: `YYYY-Www`). In Monthly, `YYYY-MM`. In Yearly, `YYYY`. X-axis labels shall use the same `formatPeriodLabel` helper as the Species Detail graphs.

**FR-07** — In Total interval, the chart shall display the cumulative count by calendar date — one data point per date that has at least one media item — rendered as a step-line. The per-period / cumulative toggle shall be hidden when Total is selected; Total always implies the full cumulative arc.

**FR-08** — The chart shall support a Per Period / Cumulative segmented control. Per Period shall be the default. In Cumulative mode, each data point reflects the running total of all media items recorded up to and including that period. This control shall be hidden when the interval is Total (FR-07).

**FR-09** — The chart shall not render when the data spans fewer than 2 distinct periods. The Media card shall still render with the rankings sections (FR-11 through FR-13) in that case.

**FR-10** — All four series shall appear in the Recharts legend, labeled "Photo", "Audio", "Video", "Total". Chart construction shall follow the same Recharts patterns used in BirdingStats (LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend).

### Rankings

**FR-11** — The Media card shall include three ranking sub-sections below the chart: Most Photographed, Most Audio, Most Video. Each shall list the top 10 species for that format.

**FR-12** — Each ranking entry shall display the species common name, item count, SpeciesLinks icons (eBird + BOW), and an ML catalog link using the existing `mlCatalogUrl()` pattern. Behavior shall be identical to the current Other Statistics implementation.

**FR-13** — The Most Photographed, Most Audio, and Most Video sections shall be removed from the Other Statistics card. The Nemesis Birds section shall remain in Other Statistics unchanged. If those three sections were the only content above Nemesis Birds, the Other Statistics card heading shall remain — the card is not removed.

**FR-14** — The chart and rankings shall use ML data (mlRows, mediaMap) already available in the BirdingStats component. No additional fetch, parse, or backend endpoint is required.

## Non-Functional Requirements

**NFR-01 — Performance:** Media graph data shall be computed in a `useMemo` hook, consistent with all other derived data in `BirdingStats.tsx`. No inline computation on render.

**NFR-02 — Consistency:** The interval and per-period/cumulative segmented controls shall match the visual style of the Graph Options card in Species Detail.

**NFR-03 — Token hygiene:** `--sr-graph-media-total` shall be defined in both `:root` and `[data-theme="dark"]` before any component references it. No hardcoded hex values in component code.

## Out of Scope

- Per-species media trends over time (already in Species Detail)
- Changes to ML export parsing or data sourcing
- New tabs or changes to the tab order
- Any changes to the Media List tab
- Filtering the media chart by county or date range

## Open Questions

**OQ-01 — Date field on MLExportRow:** The chart requires a date per ML row. The default assumption is the observation date from the "Observation Date" column, consistent with how all time-based features in the app use eBird observation dates. The Architect should confirm this field name in `parseMLExport.ts` before building the graph utility.

**OQ-02 — New graph utility vs. reusing buildGraphData:** `buildGraphData` (in `sightingsGraph.ts`) aggregates media per period for a single species. The media card needs media aggregated across all species. The Architect should determine whether to extend `sightingsGraph.ts` with a new function or create a separate utility.

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Card renders when ML is loaded | Media card is visible on Statistics tab when ML export is loaded in Settings |
| QA-02 | Card absent with no ML export | Media card does not render when no ML export is loaded |
| QA-03 | Four chart series present | Chart legend shows Photo, Audio, Video, Total labeled lines |
| QA-04 | Monthly is the default interval | On Statistics tab load, chart displays monthly granularity |
| QA-05 | Weekly interval | Selecting Weekly shows ISO week X-axis labels |
| QA-06 | Yearly interval | Selecting Yearly shows year X-axis labels |
| QA-07 | Total interval hides toggle | Selecting Total renders step-line at daily granularity; per-period/cumulative control is not visible |
| QA-08 | Per Period view | Per Period mode: each point shows count of new media items in that period only |
| QA-09 | Cumulative view | Cumulative mode: each point shows running total of all media up to and including that period |
| QA-10 | Most Photographed ranking | Top 10 most-photographed species listed with counts and ML links |
| QA-11 | Most Audio ranking | Top 10 most audio-recorded species listed with counts and ML links |
| QA-12 | Most Video ranking | Top 10 most video-recorded species listed with counts and ML links |
| QA-13 | Rankings removed from Other Statistics | Most Photographed / Most Audio / Most Video absent from Other Statistics |
| QA-14 | Nemesis Birds unchanged | Nemesis Birds section still renders in Other Statistics |
| QA-15 | Chart hidden when < 2 periods | With only one period of data, chart does not render; rankings still appear |
| QA-16 | New token defined | `--sr-graph-media-total` present in both `:root` and `[data-theme="dark"]` in globals.css |
