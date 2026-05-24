# Strategic Brief — Statistics Tab Enhancements
**Feature:** stats-tab-enhancements
**Session:** 001
**Date:** 2026-05-23
**Stage:** 1 — The Strategist

---

## What We're Building

A significant upgrade to the Birding Statistics tab that adds interactivity (clickable links to eBird checklists, hotspots, and county pages), richer data presentation (per-species milestones, locations on first/last observations, pie charts, nemesis methodology explanation), and proper chart-driven visualizations for the Effort & Methodology and Data Quality sections.

## Why Now

The Statistics tab launched as SnowRaven's most ambitious feature and it computes the right things — but the presentation is still text-heavy and static. The tab now gets regular use, which makes its rough edges more visible. Making data points linkable to eBird closes the loop between SnowRaven's analysis and the underlying records, and adding the protocol/quality visualizations (already proven in the early design mockup) brings the tab up to its own potential.

## The User Problem

A birder reviewing their statistics finds numbers without context — milestones don't name the bird, one-and-done entries can't be visited on eBird, the effort section is a wall of text where the mockup prototype showed it should be charts. The tab generates the right insights but doesn't give the user anywhere to go with them.

## Success Criteria

- Every data point that corresponds to a real eBird record (checklist, species, location) links directly to it
- Milestones show the species that triggered them, not just the date and count
- The Effort & Methodology and Data Quality sections render charts matching the quality of the attached screenshot
- The nemesis section includes a short plain-English explanation of how candidates are determined
- A user can open the Statistics tab and navigate to any specific checklist on eBird without leaving the flow

## Scope

- **Life list accumulation:** add "Total" as the fourth granularity option (one point per new lifer, showing cumulative count at the moment each species was added)
- **First/last observations:** add location name and checklist link to both cards
- **Milestones:** add the species name that hit each threshold; make the milestone date a link to the corresponding eBird checklist
- **Biggest single day:** make the species count a link to that day's checklist on eBird
- **Temporal stats:** add pie charts for protocol breakdown, month distribution, and DOW distribution; relabel "By hour of day" → "By start hour"
- **Top counties/regions:** make each county/state entry a link to its eBird region page
- **One-and-done birds:** make each species pill a link to the single checklist it appeared on
- **Nemesis birds:** add a one-sentence explanation of the scoring logic directly in the UI
- **Effort & Methodology:** replace the text-heavy layout with the chart-driven design from the mockup (horizontal bar protocol breakdown, key-metrics grid, average-by-protocol table, observers stats)
- **Data Quality:** replace plain text with the bar-chart visualizations from the mockup (count method bar, comment coverage bar, biggest-counts table)

## Out of Scope

- No new backend endpoints — all links are constructed from existing data (submissionId, locationId, county names)
- No new data sources — all improvements derive from what's already parsed from the eBird CSV
- Exporting or printing the stats tab (separate roadmap item)
- Adding new statistical sections not currently present

## Key Decisions

- eBird checklist links use `https://ebird.org/checklist/{submissionId}` — existing `SUBMISSION_ID_RE` validation (`/^S\d+$/`) gates all links before rendering
- County/region eBird links use `https://ebird.org/region/{regionCode}` — region codes derived from the `stateProvince` field already parsed from the CSV (e.g. `US-MI` for Michigan)
- County links within a state link to the state region page; county-level eBird URLs are not deterministic from CSV data alone
- The "Total" accumulation granularity plots one point per new species added to the life list (date of first observation), y-axis is running cumulative count — not grouped by period
- Pie charts added to protocol, monthly, and DOW distributions only — hourly bar chart is unchanged
