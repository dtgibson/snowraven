# PRD — Stats Enhancements
**Feature:** stats-enhancements
**Session:** 001
**Date:** 2026-05-24
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

Six improvements to `BirdingStats.tsx`: a renamed and split one-and-done section, clickable nemesis bird links, a denser milestone schedule extending to 3,000, a verified streak algorithm, per-year species statistics, and a numbered Leaflet map for top locations in Geographic Stats.

---

## User Stories

**US-01** — As a birder, I want "single-checklist birds" and "one-and-done birds" to be clearly separate concepts, so that I can distinguish species I've only seen once from species I've only ever counted one individual of.

**US-02** — As a birder scanning my nemesis birds, I want each name to link to its eBird species page, so that I can quickly look up recent sightings without leaving the app to search manually.

**US-03** — As a birder building my life list, I want milestone pills at every 10 species below 100 and at tighter intervals overall, so that smaller achievements feel as celebrated as round-number ones.

**US-04** — As a birder reviewing my annual activity, I want to see species count and best single-day species count alongside checklist count for each year, so that I can compare the quality of birding years, not just quantity.

**US-05** — As a birder using Geographic Stats, I want to see my top locations on a map with numbered pins, so that I can understand where those locations are in relation to each other without having to look them up.

---

## Functional Requirements

### Section: Single-Checklist Birds (rename)

**FR-01** — The section currently labeled "One-and-Done Birds" in Fun Stats shall be renamed to "Single-Checklist Birds." All UI copy, headings, and any associated labels shall reflect this new name. The underlying data and logic are unchanged.

### Section: One-and-Done Birds (new)

**FR-02** — A new "One-and-Done Birds" section shall appear immediately below "Single-Checklist Birds" in Fun Stats. It shall list species whose total recorded individual count across all `filteredObs` is exactly 1.

**FR-03** — Only observations where `o.count` is a non-null number contribute to the individual total. Presence-only observations (`count === null`) are excluded from the sum entirely. A species qualifies if the sum of all its non-null `count` values equals exactly 1.

**FR-04** — The one-and-done birds list shall be sorted alphabetically by species name and display identically to the single-checklist birds list (pill-style layout, same visual treatment).

**FR-05** — If no species qualify (all counts are presence-only, or no species has a total of exactly 1), the section shall display "No one-and-done birds in your data."

### Nemesis Birds

**FR-06** — Each nemesis bird name shall be rendered as an `<a>` link to `https://ebird.org/species/{taxonCode}` opening in a new tab (`target="_blank" rel="noreferrer"`).

**FR-07** — Taxon codes for nemesis birds shall be sourced from `mlTaxonMap` when ML data is loaded. When ML data is not loaded (or the code is missing from `mlTaxonMap`), a `POST /taxonomy/codes` fetch shall be issued after nemesis results arrive, using the nemesis bird common names. The result shall populate a `nemesisTaxonMap` state used exclusively for nemesis link resolution.

**FR-08** — If a taxon code cannot be resolved for a nemesis bird after all fetch attempts, that bird's name shall render as plain text (not a broken link). The unresolvable case shall not block rendering of other birds whose codes are available.

### Milestone Pills

**FR-09** — The milestone threshold array shall be replaced with the following static list (43 thresholds total):
`[10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 350, 375, 400, 425, 450, 475, 500, 550, 600, 650, 700, 750, 800, 850, 900, 950, 1000, 1250, 1500, 1750, 2000, 2500, 3000]`

**FR-10** — Each milestone pill shall display only if the user has reached that threshold (i.e., `accumulation.milestones.get(threshold)` returns a value). Pills for unreached thresholds shall not render.

**FR-11** — The milestone computation (`milestoneMap`) shall iterate the new threshold array instead of the old generated array. All other milestone logic (species name, date, checklist link) is unchanged.

### Streak Verification

**FR-12** — The longest-streak algorithm shall count the number of consecutive calendar days on which at least one checklist was submitted. The current implementation (deduplicate dates → sort → check `diffDays === 1`) already satisfies this requirement. The Engineer shall verify it is correct and make no change if it is.

### Per-Year Statistics

**FR-13** — The Checklists by Year section shall display three values per year: checklist count (existing), species count (already computed in `byYearMap`), and best single-day species count for that year.

**FR-14** — The best single-day species count for a year shall be computed by finding the `ChecklistEntry` with the highest `speciesCount` among all checklists whose date begins with that year. If multiple checklists tie, the one with the earliest date is selected.

**FR-15** — The best single-day species count shall be displayed as a link to `https://ebird.org/checklist/{submissionId}` when the `submissionId` passes `SUBMISSION_ID_RE`. If it does not, it shall render as plain text.

**FR-16** — The per-year display shall present all three values in a compact layout, consistent with the existing bar-chart row design for that section.

### Top Locations Map

**FR-17** — The geo useMemo shall capture a representative lat/lng for each location: the first observation at that location (by iteration order) that has non-null `latitude` and `longitude`. This lat/lng shall be stored on the location object alongside existing fields.

**FR-18** — A Leaflet `MapContainer` shall render within the Geographic Stats section, below the two "Top Locations" text lists and above the Counties section.

**FR-19** — The map shall display two sets of custom markers:
  - **Set A (top by checklists):** green filled circle markers, numbered 1–N where N ≤ 10, showing only locations that have a resolved lat/lng
  - **Set B (top by species):** blue filled square markers, numbered 1–N where N ≤ 10, showing only locations that have a resolved lat/lng

**FR-20** — Each marker shall display its rank number (1, 2, 3…) as a text label centered inside the marker shape. The number corresponds to the location's rank in its respective list.

**FR-21** — A location that appears in both top-by-checklists and top-by-species shall receive one marker of each type (a green circle and a blue square), both positioned at the same lat/lng.

**FR-22** — Each marker popup shall show the location name and the metric value that earned its rank (e.g. "Radnor Lake — 47 checklists" for Set A, "Radnor Lake — 112 species" for Set B).

**FR-23** — The map shall auto-fit bounds to contain all visible markers, using `fitBounds` with 20px padding. If only one marker is present, `setView` at zoom 12 shall be used instead.

**FR-24** — The map section shall not render if no locations in either top list have a resolved lat/lng.

---

## Non-Functional Requirements

**NFR-01 — Performance:** The one-and-done computation iterates `filteredObs` once and is O(n) — no additional performance concern beyond what already exists in `funStats`. The milestone array change has no measurable performance impact (43 thresholds vs. 20).

**NFR-02 — Type safety:** `nemesisTaxonMap` shall be typed as `Record<string, string>`. Location objects in `geo` shall be extended with `lat: number | null` and `lng: number | null`.

**NFR-03 — Security:** All nemesis links must use `target="_blank" rel="noreferrer"`. Taxon codes used in URLs shall come only from the resolved `mlTaxonMap` or `nemesisTaxonMap` — never from raw user data. All eBird checklist links in per-year stats must pass `SUBMISSION_ID_RE` before rendering as `<a>` elements.

**NFR-04 — Color tokens:** All map colors shall use `var(--sr-*)` tokens or the existing map color tokens already defined in `globals.css`. No hardcoded hex values in component JSX (Leaflet popup inline styles excepted per existing convention).

---

## Out of Scope

- Sorting, filtering, or pagination of one-and-done or single-checklist bird lists
- Weekly or monthly streak views
- Maps for counties or states (top locations only)
- Exporting statistics
- Any backend changes beyond the `POST /taxonomy/codes` fetch for nemesis resolution (existing endpoint, no changes needed)

---

## Open Questions

None — all decisions are resolved in this document.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Section rename | Fun Stats heading reads "Single-Checklist Birds" (not "One-and-Done Birds") |
| QA-02 | New one-and-done section renders | "One-and-Done Birds" section appears below "Single-Checklist Birds" |
| QA-03 | One-and-done calculation | A species with one observation of count=1 appears in one-and-done; a species with two observations of count=1 each does not |
| QA-04 | Presence-only exclusion | A species with only count=null observations does not appear in one-and-done |
| QA-05 | One-and-done empty state | Section shows "No one-and-done birds in your data." when no species qualify |
| QA-06 | Nemesis links render | Each nemesis bird name is an `<a>` tag linking to `ebird.org/species/{code}` |
| QA-07 | Nemesis link target | All nemesis links open in a new tab with `rel="noreferrer"` |
| QA-08 | Nemesis fallback | A nemesis bird with no resolved taxon code renders as plain text, not a broken link |
| QA-09 | Milestone density below 100 | Milestone pills exist for 10, 20, 30, 40, 50, 60, 70, 80, 90 (when reached) |
| QA-10 | Milestone density 100–500 | Milestone pills exist at 125, 150, 175, 200, 225, 250, 275, 300, 325, 350, 375, 400, 425, 450, 475 (when reached) |
| QA-11 | Milestone extension above 1000 | Milestone pills exist at 1250, 1500, 1750, 2000, 2500, 3000 (when reached) |
| QA-12 | Streak algorithm | Streak = N for N consecutive calendar days with at least one checklist each; verified against known data |
| QA-13 | Per-year species count | Species count column shows correct distinct species per year |
| QA-14 | Per-year best day | Best single-day species count matches the highest-species checklist in that year |
| QA-15 | Per-year best day link | Best-day count is a clickable link to the checklist when submissionId passes validation |
| QA-16 | Top locations map renders | Leaflet map appears in Geographic Stats when locations have lat/lng data |
| QA-17 | Green circle markers | Top-by-checklists locations show as numbered green circle markers |
| QA-18 | Blue square markers | Top-by-species locations show as numbered blue square markers |
| QA-19 | Dual-list location | A location in both lists shows both a green circle and a blue square at its coordinates |
| QA-20 | Marker popup | Clicking a marker shows location name and the relevant metric value |
| QA-21 | Map hidden when no coords | Map section does not render when no top-location has lat/lng data |
| QA-22 | All existing tests pass | `npm run test` exits green with no regressions |
