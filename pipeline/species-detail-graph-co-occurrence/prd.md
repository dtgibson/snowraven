# PRD — Species Detail: Graph Options and Co-occurring Species
**Feature:** species-detail-graph-co-occurrence
**Session:** 001
**Date:** 2026-05-23
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

Two enhancements to the Species Detail tab. First, a "Graph Options" card replaces the embedded Per Year/Cumulative toggle with a dedicated section above both graphs that also adds explicit Yearly/Monthly interval control. Second, a new "Reported With" section lists the species most frequently appearing on the same eBird checklists as the selected species, ranked by co-occurrence coefficient.

---

## User Stories

**US-01** — As a birder reviewing a common species with years of data, I want to switch the graph to monthly intervals, so that I can see seasonal patterns that are invisible at yearly resolution.

**US-02** — As a birder, I want the Per Year/Cumulative toggle in an obvious, labeled location, so that I don't have to scan the graph card header to find it.

**US-03** — As a birder looking at a species I see often, I want a ranked list of what else was on those checklists, so that I can understand what habitat associates this species has in my own data.

**US-04** — As a birder using county or date filters, I want the "Reported With" list to reflect only the filtered checklists, so that I can see co-occurrence patterns for a specific region or season.

**US-05** — As a birder, I want to expand the "Reported With" list beyond the top 10, so that I can see the full co-occurrence picture for a species with a large checklist history.

---

## Functional Requirements

### Graph Options Card

**FR-01** — A "Graph Options" card shall appear above the Sightings Over Time card whenever the graph data is present (i.e., when `SightingsGraph` would not return null). It shall not appear if there is insufficient data to render graphs.

**FR-02** — The Graph Options card shall contain two controls: an Interval selector (Yearly / Monthly) and a View Mode selector (Per Period / Cumulative). Both shall use the existing segmented-button style used for other toggles in this tab.

**FR-03** — The Interval selector shall default to Yearly. The user may switch to Monthly at any time, regardless of how many years of data exist for the species.

**FR-04** — The View Mode selector shall replace the Per Year/Cumulative toggle currently embedded in the Sightings Over Time card header. The embedded toggle shall be removed.

**FR-05** — Both the Sightings Over Time graph and the Media Over Time graph shall respond to the same Interval and View Mode selections from the Graph Options card.

**FR-06** — The `buildGraphData` function in `sightingsGraph.ts` shall accept an explicit `interval: 'yearly' | 'monthly'` parameter instead of auto-detecting from the number of distinct years. The auto-detection logic (`years.size <= 1`) shall be removed.

**FR-07** — X-axis labels and tooltip formatting shall respond correctly to the chosen interval: years as four-digit strings (e.g. "2023"), months as abbreviated month + year (e.g. "May 2023") — matching the existing `formatPeriodLabel` logic.

**FR-08** — The axis sub-label ("Individuals per year", "Individuals per month", "Cumulative individuals", etc.) shall update to reflect both the active interval and view mode.

**FR-09** — When the selected species changes, Graph Options state shall reset to Yearly / Per Period.

### Reported With Section

**FR-10** — A "Reported With" section shall appear in the Species Detail view below the Breeding Codes section and above the Top Locations section.

**FR-11** — The section shall compute a co-occurrence coefficient for each species: (number of filtered target-species checklists also containing that species) ÷ (total filtered target-species checklists). The coefficient shall be expressed as a percentage (e.g. "78%").

**FR-12** — Only observations with a non-empty `submissionId` shall be used as the checklist key. Observations with an empty `submissionId` shall be excluded from both the target set and the co-occurrence scan.

**FR-13** — The co-occurrence scan shall cover all `phase.observations` (the full unfiltered observation set), restricted to `submissionId`s that appear in the filtered `speciesObs`. This means county and date filters affect which checklists are included but not which species are counted on those checklists.

**FR-14** — The section shall exclude the selected species itself (and any subspecies/normalized variants when `mergeSubspecies` is true) from the results.

**FR-15** — Only species appearing on at least 2 of the target species' filtered checklists shall be listed. Species appearing on only 1 checklist shall be suppressed.

**FR-16** — Results shall be sorted by coefficient descending. Ties shall be broken by raw count descending.

**FR-17** — The top 10 results shall be shown by default. A "Show all N species" expand button shall appear when more than 10 qualify. A "Show top 10" collapse button shall appear when expanded.

**FR-18** — Each row shall display: species common name, co-occurrence percentage, and raw count (e.g. "34 checklists"). The count shows how many of the target's checklists contained this species.

**FR-19** — Species names in the "Reported With" list shall use the same normalization as the rest of the tab: if `mergeSubspecies` is true, normalized names are used; if false, exact names are used — consistent with how `speciesObs` is filtered.

**FR-20** — When `speciesObs` is empty (no checklists match the current filters), the section shall show "No checklist data available" rather than an empty list.

**FR-21** — When `speciesObs` is non-empty but no co-occurring species meet the minimum threshold, the section shall show "No species met the minimum co-occurrence threshold."

---

## Non-Functional Requirements

**NFR-01 — Performance:** The co-occurrence `useMemo` scans `phase.observations` (potentially tens of thousands of rows) for each species change. The implementation shall use a `Set<string>` for checklist ID lookup (O(1) per row) to keep this scan fast. No visible lag on typical eBird backup sizes (up to ~50,000 rows).

**NFR-02 — Tokens:** All new colors shall use `var(--sr-*)` CSS custom properties. No hardcoded hex in component files.

**NFR-03 — Reactivity:** Co-occurrence results shall recompute automatically when `speciesObs` changes (i.e., on species change, county filter change, or date filter change).

**NFR-04 — Type safety:** `buildGraphData` signature change shall not break the existing test suite. The auto-detected `useMonthly` return field shall be driven by the explicit `interval` parameter — update tests accordingly.

---

## Out of Scope

- Bidirectional Jaccard index (co-occurrence as a fraction of either species' checklists)
- Clickable co-occurring species (navigating to that species' detail view)
- Co-occurrence heatmap or matrix view
- Any backend changes or new API endpoints
- Graph export or download
- Graph interval persisting across species changes (resets by design per FR-09)

---

## Open Questions

**Q1: Should the "Reported With" section appear when ML data is loaded but no eBird backup is present?**
Default assumption: The section requires `speciesObs` (eBird data). If `phase.tag !== 'ready'` or `speciesObs` is empty due to no eBird backbone, hide the section entirely.

**Q2: How should subspecies be handled in co-occurrence counting?**
Default assumption: Apply the same `mergeSubspecies` normalization to co-occurring species names as to the target species. If `mergeSubspecies` is true, normalize all co-occurring names before counting.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Graph Options card appears | Selecting a species with ≥2 data points shows a Graph Options card above Sightings Over Time |
| QA-02 | Interval selector — Yearly default | On species load, graph x-axis shows years (e.g. "2021", "2022") |
| QA-03 | Interval selector — Monthly | Switching to Monthly shows month-year labels (e.g. "May 2021") on both graphs |
| QA-04 | View Mode removed from graph card | Sightings Over Time card header no longer contains Per Year/Cumulative buttons |
| QA-05 | View Mode — Cumulative | Selecting Cumulative shows monotonically non-decreasing values on both graphs |
| QA-06 | Both graphs respond | Switching interval or view mode updates both Sightings and Media graphs simultaneously |
| QA-07 | Reset on species change | Selecting a different species resets Graph Options to Yearly / Per Period |
| QA-08 | Reported With section renders | A "Reported With" section appears below Breeding Codes with a ranked list |
| QA-09 | Coefficient calculation | First species in list: verify manually that (shared checklists ÷ target checklists) × 100 matches the displayed % |
| QA-10 | Self-exclusion | The selected species does not appear in its own "Reported With" list |
| QA-11 | Minimum threshold | Species on only 1 shared checklist does not appear in the list |
| QA-12 | Filter reactivity | Applying a county filter changes the "Reported With" list to reflect only checklists from that county |
| QA-13 | Expand/collapse | "Show all N species" button appears when >10 qualify; clicking it shows all; "Show top 10" collapses |
| QA-14 | Empty state — no filters match | Applying a filter that excludes all target checklists shows "No checklist data available" |
| QA-15 | vitest suite | All existing tests pass; updated buildGraphData tests pass with explicit interval parameter |
