# PRD — Species Detail Enhancements
**Feature:** species-detail-enhancements  
**Session:** 001  
**Date:** 2026-05-24  
**Stage:** 2 — The Planner  
**Source:** strategic-brief.md (approved)

---

## Feature Overview

Three targeted additions to the existing Species Detail tab: a weekly graph interval (with monthly as the new default), a Checklists Over Time graph card, and a frequency statistic showing how often the selected species appears across the user's checklists. All changes are frontend-only and build on the existing `sightingsGraph.ts` + `SpeciesDetail.tsx` architecture.

---

## User Stories

**US-01** — As a birder reviewing a common species, I want to see checklists grouped by week, so that I can identify seasonal peaks that monthly grouping obscures.

**US-02** — As a birder opening the Species Detail tab, I want monthly interval selected by default, so that I get a useful first view without needing to change the setting.

**US-03** — As a birder studying a species, I want to see how many of my checklists recorded it over time (not just how many individuals), so that I can distinguish frequent low-count sightings from rare high-count flocks.

**US-04** — As a birder curious about my personal relationship with a species, I want to see what percentage of all my checklists include it, so that I can understand whether it's a species I see constantly or occasionally.

**US-05** — As a birder with an active county or date filter, I want the frequency stat to reflect that filtered scope, so that the number stays consistent with the other filtered stats on the page.

---

## Functional Requirements

### Graph Options

**FR-01** — The Graph Options card shall display interval options in the order: Weekly, Monthly, Yearly.

**FR-02** — The default value of `graphInterval` shall be `'monthly'`, both on initial component mount and on every call to `selectSpecies()`.

**FR-03** — The `graphInterval` state type shall be `'weekly' | 'monthly' | 'yearly'`.

### Weekly Interval

**FR-04** — `buildGraphData` shall accept `'weekly'` as a valid interval value.

**FR-05** — When interval is `'weekly'`, each observation shall be bucketed into an ISO week key of the form `YYYY-Www` (e.g. `2024-W03`), where the year is the ISO week-year and the week number is zero-padded to two digits.

**FR-06** — When interval is `'weekly'`, the gap-fill algorithm shall generate one key per calendar week between the first and last observed week (inclusive), with no missing weeks.

**FR-07** — `buildGraphData` shall return the active interval (or equivalent booleans) so that `SightingsGraph` and `GraphTooltip` can format axis labels and tooltip titles correctly for all three intervals.

**FR-08** — Weekly keys shall display on the x-axis and in tooltips as `Wk N 'YY` (e.g. `Wk 3 '24`).

### Checklists Over Time Graph

**FR-09** — `GraphPoint` shall include a `checklists` field: the count of observation rows (checklist entries) whose date falls in that period.

**FR-10** — A "Checklists Over Time" graph card shall render below "Sightings Over Time" and above "Media Over Time" (when Media Over Time is present).

**FR-11** — "Checklists Over Time" shall use the same `displayData` array as "Sightings Over Time", plotting the `checklists` field.

**FR-12** — When `viewMode` is `'cumulative'`, the running sum shall include the `checklists` field alongside `individuals`, `photo`, `audio`, and `video`.

**FR-13** — "Checklists Over Time" shall only render when `hasGraphData` is true (same condition as "Sightings Over Time").

### Frequency Statistic

**FR-14** — The Sightings section of the Summary card shall display a "Frequency" statistic showing the percentage of the user's checklists (within the active filter scope) on which the selected species appears.

**FR-15** — The frequency denominator shall be the count of unique, non-empty `submissionId` values across all observations in `phase.observations` that pass the active county and date-range filters (identical filter logic to `speciesObs`, but applied to the full observation set rather than the species-filtered set).

**FR-16** — The frequency numerator shall be `speciesObs.length`.

**FR-17** — Frequency shall display as `X%` (rounded to the nearest integer, minimum display value `<1%` when the computed value rounds to 0 but the species appears at least once).

**FR-18** — When the frequency denominator is 0 (no submission IDs in scope), the frequency stat shall not render.

---

## Non-Functional Requirements

**NFR-01 — Performance:** Weekly gap-fill iterates week-by-week between first and last observation. For users with multi-decade eBird histories this could produce ~1,500+ data points. The existing Recharts `<LineChart>` handles this without additional virtualization; no special optimization is required.

**NFR-02 — Type safety:** `buildGraphData`'s return type shall be updated so callers do not need to infer the active interval from booleans. The `GraphPoint` type update is a breaking change to the existing interface — the Engineer shall update all consumers.

**NFR-03 — Test coverage:** `sightingsGraph.test.ts` shall be updated to cover weekly bucketing, weekly gap-fill, and the `checklists` field.

**NFR-04 — Color tokens:** No new color tokens are needed. The `checklists` line shall use `var(--sr-graph-individuals)` at reduced opacity (0.6) to visually distinguish it from the individuals line without requiring a new token.

---

## Out of Scope

- Frequency ranking across species ("you're in the top 10% of observers for this species")
- Weekly interval on the Media Over Time graph behaving differently than monthly/yearly (it uses the same data and will show many zero weeks — acceptable)
- Any backend changes
- Changing the Graph Options card layout beyond the toggle order and default value

---

## Open Questions

None — all decisions are resolved in this document.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Graph Options toggle order | Options appear as: Weekly · Monthly · Yearly (left to right) |
| QA-02 | Default interval on load | Monthly is the active option when a species is first selected |
| QA-03 | Default interval on species change | Switching species resets interval to Monthly |
| QA-04 | Weekly bucketing | Selecting Weekly groups observations by ISO week; a single observation on 2024-01-10 (W02) appears in week `2024-W02` |
| QA-05 | Weekly gap-fill | If species appears in `2024-W01` and `2024-W04`, weeks W02 and W03 appear as zero data points in the chart |
| QA-06 | Weekly x-axis label | `2024-W03` displays as `Wk 3 '24` on the chart axis |
| QA-07 | Checklists field | `GraphPoint.checklists` equals the count of `speciesObs` entries whose date falls in that period |
| QA-08 | Checklists Over Time renders | Card appears below "Sightings Over Time" when `hasGraphData` is true |
| QA-09 | Checklists cumulative mode | Switching to Cumulative shows a non-decreasing checklists line |
| QA-10 | Frequency stat appears | A frequency percentage is visible in the Sightings section when a species is selected and submission IDs are present |
| QA-11 | Frequency calculation | Frequency = species checklist count ÷ total filtered checklists × 100, rounded to nearest integer |
| QA-12 | Frequency filter-aware | Applying a county filter changes both the numerator and denominator; the percentage updates |
| QA-13 | Frequency edge: <1% | A species appearing on 1 of 500 checklists shows `<1%` rather than `0%` |
| QA-14 | Frequency hidden when no IDs | Frequency stat does not render if no submission IDs exist in the filtered observation set |
| QA-15 | All existing tests pass | `npm run test` exits green with no regressions |
