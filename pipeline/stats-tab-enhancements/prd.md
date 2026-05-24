# PRD — Statistics Tab Enhancements
**Feature:** stats-tab-enhancements
**Session:** 001
**Date:** 2026-05-23
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

A comprehensive upgrade to the Birding Statistics tab that adds clickable links to eBird records throughout, enriches milestone and observation cards with missing context (species names, location names), introduces pie charts to temporal distribution sections, and replaces the text-heavy Effort & Methodology and Data Quality sections with chart-driven visualizations. All changes are client-side; no new backend endpoints or data sources are introduced.

---

## User Stories

**US-01** — As a birder reviewing my milestones, I want each milestone entry to name the species that hit that threshold and link to its checklist, so I can relive those exact moments without searching eBird.

**US-02** — As a birder reviewing my first and last observations, I want the location name and a clickable checklist link to appear on each card, so I have full context about those key sightings and can navigate directly to the record.

**US-03** — As a birder reviewing my life list accumulation, I want a "Total" granularity option that plots one point per new lifer, so I can see exactly when each species joined my life list.

**US-04** — As a birder reviewing my statistics, I want every date or count that corresponds to a specific eBird checklist to be a clickable link, so I can navigate to any source record without leaving my stats session.

**US-05** — As a birder reviewing temporal distributions, I want pie charts alongside my protocol, month, and day-of-week bar charts, so I can see proportional breakdowns at a glance alongside the raw counts.

**US-06** — As a birder reviewing county and state entries, I want each one to link to its eBird region page, so I can explore that region's sightings directly.

**US-07** — As a birder reviewing my effort and data quality sections, I want chart-driven visualizations instead of text blocks, so I can scan and compare values quickly.

---

## Functional Requirements

### Life List Accumulation

**FR-01** — The granularity toggle shall offer four options: Total, Weekly, Monthly, Yearly — in that order.

**FR-02** — "Total" shall be the default selected granularity (replacing the previous default).

**FR-03** — In "Total" mode, the chart shall plot one data point per new life species. The x-axis position of each point shall be the date of that species' first-ever observation; the y-axis value shall be the running cumulative count of distinct species at that moment.

**FR-04** — In "Total" mode, x-axis tick labels shall show the full date of each data point (formatted `MMM D, 'YY`, e.g. "Apr 12, '22"). When many points are present, the chart shall show a representative subset of ticks without overlapping.

**FR-05** — The existing Weekly / Monthly / Yearly modes shall be unchanged.

### First & Last Observations

**FR-06** — The "First Observation" card shall display the location name on a second line below the date.

**FR-07** — The "Last Observation" card shall display the location name on a second line below the date.

**FR-08** — When the checklist has a submissionId that matches `/^S\d+$/`, the date in both the First and Last Observation cards shall be rendered as a link to `https://ebird.org/checklist/{submissionId}` opening in a new tab.

**FR-09** — When no valid submissionId is available, the date shall render as plain text (unchanged from current behavior).

### Milestones

**FR-10** — Each reached milestone entry shall display the common name of the species whose first observation date is the date of that milestone (i.e., the species at position N in the cumulative life list, where N is the milestone threshold).

**FR-11** — When the milestone checklist has a valid submissionId (matches `/^S\d+$/`), the milestone date shall be rendered as a link to `https://ebird.org/checklist/{submissionId}` opening in a new tab.

**FR-12** — "Not yet reached" milestones shall continue to display as-is, with no species name and no link.

### Biggest Single Day

**FR-13** — When the biggest-single-day checklist has a valid submissionId (matches `/^S\d+$/`), the species count (e.g. "47 species") shall be rendered as a link to `https://ebird.org/checklist/{submissionId}` opening in a new tab.

**FR-14** — When no valid submissionId is available, the species count shall render as plain text.

### Temporal Stats — Pie Charts

**FR-15** — A pie chart shall appear alongside the "Protocol breakdown" bar chart in the Temporal section, showing the same protocol data as proportional slices with the protocol name and percentage as labels.

**FR-16** — A pie chart shall appear alongside the "Checklists per month" bar chart, showing month proportions.

**FR-17** — A pie chart shall appear alongside the "Checklists per day of week" bar chart, showing DOW proportions.

**FR-18** — The label "By hour of day" shall be renamed to "By start hour." The hourly bar chart itself is otherwise unchanged; no pie chart is added for hourly distribution.

### Top Counties / Regions

**FR-19** — Each county entry in the "Top counties" list shall be rendered as a link to `https://ebird.org/region/{stateProvince}` (using the `stateProvince` value already parsed from the eBird backup CSV, e.g. `US-MI`), opening in a new tab.

**FR-20** — Each state/province entry in the geographic stats section shall be rendered as a link to `https://ebird.org/region/{stateProvince}`, opening in a new tab.

**FR-21** — When the stateProvince value is empty, null, or does not contain a hyphen (indicating it may not be a valid eBird region code), the entry shall render as plain text.

### One-and-Done Birds

**FR-22** — Each one-and-done species pill shall be rendered as a link to `https://ebird.org/checklist/{submissionId}` opening in a new tab, when that species' single checklist has a valid submissionId (matches `/^S\d+$/`).

**FR-23** — When no valid submissionId is available for a one-and-done species, the pill shall render as plain text (unchanged from current behavior).

### Nemesis Birds

**FR-24** — The Nemesis Birds section shall include a one-sentence explanation displayed inline above the species list. The sentence shall read: "Nemesis birds are species recently reported within your area that don't yet appear on your life list, ranked by how frequently they've been seen."

### Effort & Methodology — Redesign

**FR-25** — The protocol distribution in Effort & Methodology shall be displayed as a horizontal bar chart. Each bar represents one protocol; bar width is proportional to checklist count; a percentage label appears at the right of each bar. The text-only protocol list is removed.

**FR-26** — A key-metrics grid with four cells shall appear below the protocol bar chart, displaying: Average Duration (min), Average Distance (mi), Species Per Hour, and Species Per mi. Each cell shows the metric name and its computed value. Distance values shall be converted from the km values stored in the eBird CSV (multiply by 0.621371). Cells with no data (e.g. no distance-bearing checklists) shall display "—".

**FR-27** — An average-by-protocol table shall appear below the key-metrics grid. Columns: Protocol, Avg Duration (min), Avg Distance (mi), Checklist Count. Rows are sorted by checklist count descending. Distance values shall be converted from km to miles. Protocols with no duration data show "—" in the duration column; same for distance.

**FR-28** — The observer distribution shall be displayed as a bar chart. The x-axis shows observer counts (1, 2, 3, 4, 5+); the y-axis shows the number of checklists. The existing text-only observer summary is removed and replaced by this chart.

**FR-29** — The complete-checklist ratio shall remain as a text stat and is not replaced by a chart. It shall continue to appear only when the "All Obs Reported" column is present in the eBird backup.

### Data Quality — Redesign

**FR-30** — The count-method breakdown (numeric count vs. X/presence-only) shall be displayed as a horizontal proportional bar chart. The bar shows two segments: one for the percentage of observations with numeric counts and one for presence-only. Percentage labels appear on each segment. The text-only description is removed.

**FR-31** — The comment coverage (checklists with vs. without checklist-level comments) shall be displayed as a horizontal proportional bar chart in the same style as FR-30. The text-only description is removed.

**FR-32** — The top 10 biggest single-species counts shall be displayed as a styled data table. Columns: Species, Count, Date, Location. Each row's Date shall be a link to the corresponding checklist when a valid submissionId is available.

---

## Non-Functional Requirements

**NFR-01 — Security:** All `submissionId` values used in `href` attributes shall be validated against `/^S\d+$/` before rendering as links. Values that do not match shall produce plain text, not an anchor element.

**NFR-02 — Security:** All `stateProvince` values used in eBird region `href` attributes shall be non-empty and contain at least one hyphen (e.g. `US-MI`) before being rendered as links. Empty or non-conforming values shall produce plain text.

**NFR-03 — Performance:** All new computations shall use `useMemo` hooks consistent with the existing stat section patterns in `BirdingStats.tsx`. No new backend endpoints or network calls are introduced.

**NFR-04 — Link behavior:** All eBird links shall open in a new tab using `target="_blank" rel="noreferrer"`, consistent with every other outbound link in the app.

**NFR-05 — Styling:** All colors shall use `var(--sr-*)` CSS custom properties. No hardcoded hex or RGB values in any component JSX. New tokens, if needed, go in both `:root` and `[data-theme="dark"]` in `globals.css` before use.

**NFR-06 — Chart library:** All new charts shall use Recharts (already a project dependency), consistent with existing stat charts. No new chart libraries shall be added.

---

## Out of Scope

- New backend endpoints — all link URLs are constructed from data already parsed from the eBird CSV
- New data sources — no new CSV columns are introduced beyond what's already parsed
- Exporting or printing the statistics tab
- Adding new statistical sections not currently present (e.g., big year, year lists)
- Hourly distribution pie chart — the "By start hour" bar chart is unchanged except for the label
- County-level eBird links — county entries link to the state/province region page (`/region/US-MI`), not a county-level URL, because county-level eBird region codes cannot be derived reliably from the eBird backup CSV alone

---

## Open Questions

None — all decisions are resolved in this document and the approved strategic brief.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | "Total" granularity option exists | A fourth tab labelled "Total" appears in the life list accumulation toggle |
| QA-02 | "Total" is the default | On tab load, the accumulation chart renders in Total mode without any user interaction |
| QA-03 | Total mode data point count | With a real eBird CSV, the chart renders exactly as many data points as the user has distinct life species |
| QA-04 | Total mode x-axis | Each point's x position corresponds to the date of that species' first observation |
| QA-05 | First observation location | The First Observation card displays a location name on a second line |
| QA-06 | Last observation location | The Last Observation card displays a location name on a second line |
| QA-07 | First/last observation links | The date in both cards is a clickable `<a>` element linking to `https://ebird.org/checklist/S…` |
| QA-08 | Milestone species name | Each reached milestone entry displays a species common name alongside its date and count |
| QA-09 | Milestone checklist link | Each reached milestone date is a clickable link to the corresponding eBird checklist |
| QA-10 | Biggest single day link | The species count on the biggest single day card is a clickable link to the eBird checklist |
| QA-11 | Protocol pie chart | A pie chart appears alongside the protocol bar chart in the Temporal section |
| QA-12 | Month pie chart | A pie chart appears alongside the checklists-per-month bar chart |
| QA-13 | DOW pie chart | A pie chart appears alongside the checklists-per-day-of-week bar chart |
| QA-14 | Hourly label rename | The hourly bar chart section is labelled "By start hour" (not "By hour of day") |
| QA-15 | No hourly pie chart | No pie chart appears in the hourly distribution section |
| QA-16 | County region links | Each county entry in the Top Counties list is a clickable link to `https://ebird.org/region/US-XX` |
| QA-17 | State/province region links | Each state/province entry in geographic stats is a clickable link to `https://ebird.org/region/US-XX` |
| QA-18 | One-and-done links | Each one-and-done species pill is a clickable link to the single checklist it appeared on |
| QA-19 | Nemesis methodology text | The Nemesis Birds section displays the one-sentence explanation above the species list |
| QA-20 | Effort protocol bar chart | A horizontal bar chart of protocol distribution replaces the text-only list |
| QA-21 | Key-metrics grid | Four stat cells (avg duration, avg distance, spp/hr, spp/km) appear below the protocol chart |
| QA-22 | Average-by-protocol table | A table with Protocol / Avg Duration / Avg Distance / Count columns appears |
| QA-23 | Observer distribution chart | A bar chart of checklists-by-observer-count replaces the text-only observer summary |
| QA-24 | Count method bar chart | A horizontal proportional bar shows numeric vs X-count percentage |
| QA-25 | Comment coverage bar chart | A horizontal proportional bar shows comment vs no-comment percentage |
| QA-26 | Biggest-counts table | A data table of top 10 single-species counts with Date links appears |
| QA-27 | submissionId link safety | Inspecting any eBird checklist link shows the submissionId matches `S\d+`; no links are created from invalid IDs |
| QA-28 | Dark mode | All new UI elements render correctly in dark mode with no hardcoded colors |
