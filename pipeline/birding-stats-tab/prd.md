# PRD — Birding Statistics Tab
**Feature:** birding-stats-tab
**Session:** 001
**Date:** 2026-05-23
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

A new Statistics tab that derives comprehensive birding analytics from the user's stored eBird backup CSV and Macaulay Library export. All computation runs client-side; one new backend endpoint (`GET /stats/nemesis`) supplies regional species frequency for the Nemesis Birds section.

---

## User Stories

**US-01** — As a birder, I want to see my headline life list numbers at a glance, so that I have an accurate summary of my birding history without digging through eBird.

**US-02** — As a birder, I want to see when I reached species milestones (50th, 100th, 500th species), so that I can relive those moments and share them.

**US-03** — As a birder, I want histograms of my activity by time of day, day of week, month, and year, so that I understand my personal birding patterns.

**US-04** — As a birder, I want to see my most-visited locations and geographic reach, so that I know where my productive patches are and how far I travel to bird.

**US-05** — As a birder, I want to see how my effort has changed over time (checklist duration, distance, species per hour), so that I can understand whether my birding is becoming more or less thorough.

**US-06** — As a birder, I want to see derived insights like nemesis birds and dry spells, so that I can engage with my data in a playful and motivating way.

**US-07** — As a birder, I want all stats to update automatically when I upload a new eBird backup in Settings, so that my data is always current without manual refresh.

---

## Functional Requirements

### A — General Behavior

**FR-01** — The tab shall initialize in a `loading-saved` phase, auto-load the stored eBird backup and ML export in parallel on mount, and transition to a `ready` state when parsing is complete.

**FR-02** — When no eBird backup is stored in Settings, the tab shall display the standard `SetupRequired` component with instructions to upload a file in Settings.

**FR-03** — Stats that depend on ML export data (media counts, most-photographed species) shall show an inline note "Load ML export in Settings" in place of those values when no ML export is stored.

**FR-04** — Stats that depend on the default saved location (Nemesis Birds, distance-from-home) shall show an inline note "Set a default location in Settings" in place of those sections when no location is saved.

**FR-05** — All species names used in stat computations shall be normalized using `normalizeSpeciesName()` (collapsing subspecies variants to the parent name) as the default. Spuh and slash species shall be excluded from life list counts by default; a toggle shall allow including them.

**FR-06** — Sections shall render in order: Life List Totals → Firsts & Milestones → Temporal → Geographic → Effort & Methodology → Data Quality → Breeding → Fun Stats.

---

### B — Life List Totals

**FR-07** — The tab shall display total unique species (normalized life list count, respecting the spuh/slash toggle).

**FR-08** — The tab shall display total observation rows in the loaded CSV.

**FR-09** — The tab shall display total unique checklists (unique submission IDs matching `/^S\d+$/`).

**FR-10** — The tab shall display total time birded, computed by summing the Duration (min) column across unique checklists, displayed as hours and minutes.

**FR-11** — The tab shall display total distance covered, computed by summing the Distance Traveled (km) column across unique checklists, displayed in kilometers.

**FR-12** — The tab shall display total individual birds counted: the sum of all numeric Count values, and separately the count of observation rows with a non-numeric count (X observations).

**FR-13** — The tab shall display the number of unique location IDs visited.

**FR-14** — The tab shall display geographic breadth: unique county names, unique state/province names, and unique country names recorded in.

**FR-15** — When ML export is loaded, the tab shall display media counts by type: total Photo, Audio, and Video catalog entries.

---

### C — Firsts and Milestones

**FR-16** — The tab shall display the date, location, and submission ID of the chronologically earliest checklist in the loaded data.

**FR-17** — The tab shall display the date and species of the chronologically earliest observation (first row by date, with earliest submission ID as tiebreaker).

**FR-18** — The tab shall display species milestones for each threshold in [1, 10, 50, 100, 200, 500, 1000]: the species name and date when that cumulative life list size was first reached. Milestones exceeding the current life list size shall display "Not yet reached."

**FR-19** — The tab shall display the longest streak of consecutive calendar dates on which at least one checklist was submitted, with the start and end dates of that streak.

**FR-20** — The tab shall display the longest gap (in calendar days) between any two consecutive birding dates, with those two dates shown.

**FR-21** — The tab shall display the five species that appear on the highest percentage of checklists (count of unique checklists containing that species ÷ total checklists × 100%), with both the percentage and checklist count shown.

**FR-22** — The tab shall display the five species that appear on the lowest percentage of checklists, excluding species that appear on exactly one checklist, with the percentage and checklist count shown.

**FR-23** — The tab shall display one-and-done species (species appearing on exactly one checklist), showing the five most recently recorded (by checklist date) by default, with an expand control to show the full list.

---

### D — Temporal Stats

**FR-24** — The tab shall display a bar chart of total checklists per calendar year.

**FR-25** — The tab shall display a bar chart of unique species per calendar year (species seen at least once that year).

**FR-26** — The tab shall display a bar chart of total checklists per calendar month (months 1–12 aggregated across all years).

**FR-27** — The tab shall display a bar chart of total checklists per day of week (Monday through Sunday, aggregated across all checklists).

**FR-28** — The tab shall display a bar chart of total checklists per hour of day (hours 0–23), using the Time column from the eBird backup. Checklists with no start time recorded shall be excluded from this chart.

**FR-29** — The tab shall display a species accumulation curve: a line chart where the x-axis is calendar date and the y-axis is the cumulative count of distinct species, with one data point for each date on which a new life species was first recorded.

**FR-30** — The tab shall display a bar chart of new species (lifers) added per calendar year.

**FR-31** — The tab shall display the busiest birding day: the calendar date with the most distinct species recorded, and separately the calendar date with the most checklists submitted. Both are shown with their counts.

**FR-32** — The tab shall display average checklist start time by season (Winter: Dec–Feb, Spring: Mar–May, Summer: Jun–Aug, Fall: Sep–Nov). Seasons with no checklists that have a start time shall be omitted.

---

### E — Geographic Stats

**FR-33** — The tab shall display the top 10 locations by species count (unique species recorded there), showing location name and count.

**FR-34** — The tab shall display the top 10 locations by number of checklist visits, showing location name and visit count.

**FR-35** — The tab shall display the top 10 locations by total time spent (sum of Duration across checklists at that location), showing location name and total hours/minutes.

**FR-36** — The tab shall display a ranked list of counties by species count and a ranked list of states/provinces by species count, both showing the count. Lists longer than 10 rows shall be collapsed to 10 with an expand control.

**FR-37** — The tab shall display an interactive Leaflet/OpenStreetMap map showing all observation coordinates as markers or a heatmap (using the existing Pins/Heatmap toggle pattern from Species Detail). The map shall be absent if no observations have coordinates.

**FR-38** — The tab shall display the count of unique counties birded and unique states/provinces birded as headline numbers above their respective ranked lists.

**FR-39** — The tab shall display new unique locations discovered per year as a bar chart (count of distinct locationIds appearing for the first time in each calendar year).

**FR-40** — When a default location is saved in Settings, the tab shall display: the average distance from that location to all checklist coordinates, the maximum distance, and the top 5 farthest locations with their distances. Distance is computed using the haversine formula. Checklists with no coordinates are excluded.

---

### F — Effort and Methodology

**FR-41** — The tab shall display average checklist duration (minutes), computed across checklists that have a Duration value.

**FR-42** — The tab shall display average checklist distance (km), computed across checklists that have a Distance value greater than zero.

**FR-43** — The tab shall display average number of observers per checklist, computed across checklists that have a Number of Observers value.

**FR-44** — The tab shall display a breakdown of checklists by Protocol Type as a bar chart (Traveling, Stationary, Incidental, Historical, and any others present), showing both count and percentage.

**FR-45** — The tab shall display species per hour (lifetime species count ÷ total hours birded) and species per km (lifetime species count ÷ total km covered), each displayed to one decimal place.

**FR-46** — The tab shall display a line chart of average checklist duration per year, showing how thoroughness has changed over time. Years with fewer than 3 checklists that have duration data shall be omitted.

**FR-47** — When the "All Obs Reported" column is present in the CSV, the tab shall display the complete-checklist ratio: count and percentage of checklists where all species were reported.

**FR-48** — The tab shall display average species per checklist (total observations ÷ total checklists) and a breakdown of this average by the top three protocol types.

---

### G — Data Quality

**FR-49** — The tab shall display the proportion of observation rows with a numeric count versus an X count, as both a percentage and a raw count for each.

**FR-50** — The tab shall display the top 10 biggest single-species counts: the 10 highest numeric Count values across all observations, showing species name, count, date, and location.

**FR-51** — The tab shall display the count of checklists that have at least one species-level comment in the Observation Details column, and the count with no comments.

---

### H — Breeding Stats

**FR-52** — The tab shall display the count of unique species with at least one breeding code of any kind recorded.

**FR-53** — The tab shall display the count of unique species with at least one Confirmed breeding code, at least one Probable code, and at least one Possible code (using the existing tier definitions from `breedingCodes.ts`). A species may appear in multiple categories.

**FR-54** — The tab shall display a bar chart of breeding code observations by calendar month (count of observation rows that have any breeding code, grouped by month 1–12).

---

### I — Fun Derived Stats

**FR-55** — The tab shall display the top 10 most-photographed species by ML catalog entry count (Photo type), showing species name and count. This section is absent when no ML export is loaded.

**FR-56** — When a default location is saved in Settings and an eBird API key is configured, the tab shall display Nemesis Birds: species frequently observed near the default location that are absent from the user's life list. The tab shall fetch this data from a new `GET /stats/nemesis` backend endpoint. Results shall show species name and an indication of recent local frequency. A maximum of 10 nemesis species shall be shown. When no eBird API key is configured, a "Configure eBird API key in Settings" note shall replace the list.

**FR-57** — The tab shall display the top 5 longest dry spells between consecutive new life species: each shown as the number of days between lifer N and lifer N+1, with both species names and their dates. Dry spells before the first lifer are excluded.

**FR-58** — The tab shall display a Big Year recap section with a year selector (dropdown of all years present in the data). For the selected year, the tab shall show: total species that year, new lifers that year (first-ever recorded that year), total checklists that year, top 3 locations by species count for that year, and the busiest day (most species) in that year.

**FR-59** — The tab shall display Shannon entropy (H = −Σ p_i ln p_i) and Simpson diversity index (D = 1 − Σ p_i²) for the top 5 most-visited locations. p_i is the proportion of individual birds of species i at that location (using numeric counts; X-count observations treated as count 1 for this purpose). Both indices shall be displayed to two decimal places.

---

### J — Backend

**FR-60** — A new `GET /stats/nemesis` endpoint shall accept `lat` (float), `lng` (float), and `dist` (integer, kilometers) query parameters. It shall validate all three parameters server-side (lat: −90 to 90, lng: −180 to 180, dist: 1 to 200). It shall call the eBird API to retrieve recently observed species near the provided coordinates, and return a list of species common names and their observation frequency. It shall require the `EBIRD_API_KEY` environment variable.

---

## Non-Functional Requirements

**NFR-01 — Performance:** All client-side stat computations shall complete within 3 seconds for a CSV with up to 100,000 observation rows. Each stat section shall use `useMemo` with precise dependency arrays so recomputations are isolated.

**NFR-02 — Graceful degradation:** Stats that depend on optional CSV columns (Duration, Distance, Time, Protocol, Number of Observers, All Obs Reported) shall handle missing, blank, or unparseable values without throwing errors or displaying NaN. Missing values are silently excluded from averages and totals.

**NFR-03 — Security:** The `GET /stats/nemesis` endpoint shall validate all query parameters before calling the eBird API. Malformed or out-of-range parameters shall return HTTP 400. The eBird API key shall never be returned in the response.

**NFR-04 — Consistency:** Species normalization shall use `normalizeSpeciesName()` from `speciesUtils.ts` throughout, matching the behavior of all other tabs. The spuh/slash toggle shall apply the same `isSpuhOrSlash()` check used elsewhere.

---

## Out of Scope

- Comparing the user's stats against other users or regional averages (except Nemesis, which uses regional data only to find gaps)
- Exporting or printing the Stats view (that is the separate Print / export view feature on the roadmap)
- Real-time or live eBird data sync — all stats are derived from the stored CSV snapshot
- Distinguishing eBird public hotspots from personal locations (requires an API call per location; not feasible client-side)
- Per-checklist-level comment text display (only the presence/absence count is shown)
- Map tiles beyond the standard OpenStreetMap layer

---

## Open Questions

**OQ-01 — Extended CSV parsing:** The current `ObservationEntry` type does not include Duration, Distance, Protocol, start Time, Number of Observers, All Obs Reported, or Checklist Comments. Stats in sections F and G require these. The Architect must decide whether to extend `parseEbirdObservations.ts` and `ObservationEntry` (touching all existing callers, which will ignore the new fields), or to create a parallel stats-specific data model.
*Default assumption if unresolved before Stage 5:* Extend `parseEbirdObservations.ts` with new optional fields; existing callers ignore them via TypeScript's structural typing.

**OQ-02 — Checklist-level deduplication:** Duration, Distance, Protocol, and related fields repeat on every observation row within the same checklist. Summing them requires deduplication by `submissionId`. The Architect should define whether this is done in the parser (producing a `ChecklistEntry[]` type) or in component-level `useMemo` hooks.
*Default assumption:* A `ChecklistEntry[]` derived type (one entry per unique `submissionId`) is computed client-side in a `useMemo`.

**OQ-03 — Nemesis eBird API endpoint:** Two eBird API paths are viable: `GET /v2/data/obs/geo/recent` (recent observations near lat/lng) or `GET /v2/data/obs/geo/recentSpeciesList` (just species codes seen recently). The Architect selects the most appropriate.
*Default assumption:* Use `GET /v2/data/obs/geo/recent` with `back=30` and deduplicate to unique species, then cross-reference against the user's life list.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Loading phase | Tab shows a spinner on mount when a stored eBird backup exists; transitions to stats view after parse |
| QA-02 | Setup required | Tab shows SetupRequired component (not stats) when no eBird backup is stored in Settings |
| QA-03 | Life list count | Total species matches unique normalized common names in the CSV (excluding spuh/slash by default) |
| QA-04 | Spuh/slash toggle | Toggling include-spuh/slash changes the total species count and updates the display |
| QA-05 | Total observations | Total observation count matches total rows in CSV (excluding header) |
| QA-06 | Total checklists | Total checklist count matches unique submission IDs matching `/^S\d+$/` |
| QA-07 | Total time | Total time birded equals sum of Duration column across unique checklists, shown in hours and minutes |
| QA-08 | Total distance | Total distance equals sum of Distance column across unique checklists, shown in km |
| QA-09 | Individual bird count | Individual birds total equals sum of numeric Count values; X count matches count of non-numeric rows |
| QA-10 | Geographic breadth | County, state, and country counts match distinct values in those columns |
| QA-11 | Media counts | Photo/Audio/Video totals match counts in loaded ML export (absent when no ML export) |
| QA-12 | First checklist | Displayed date and location match the earliest submission by date |
| QA-13 | Species milestones | The 10th species displayed matches the 10th distinct species when all observations are sorted chronologically |
| QA-14 | Milestone not reached | A milestone threshold exceeding life list size displays "Not yet reached" |
| QA-15 | Consecutive streak | Longest streak count is accurate for a known dataset with a known gap |
| QA-16 | Most-reported species | Top 5 species by checklist % are correct when verified against a known dataset |
| QA-17 | Least-reported species | Bottom 5 excludes one-and-done species |
| QA-18 | One-and-done | Displayed species each appear on exactly one checklist; top 5 are the most recent by date |
| QA-19 | One-and-done expand | Expand control shows all one-and-done species; collapse returns to top 5 |
| QA-20 | Checklists per year chart | Bar heights correspond to correct checklist counts per year |
| QA-21 | Species per year chart | Each bar equals distinct species seen at least once in that calendar year |
| QA-22 | Hour-of-day chart | Checklists with no Time value are excluded; hours with no checklists show zero |
| QA-23 | Accumulation curve | Curve is monotonically non-decreasing; final value equals total species count |
| QA-24 | New species per year | Annual totals sum to total species count |
| QA-25 | Busiest day | Displayed species count for the busiest species-day is verifiable against source data |
| QA-26 | Seasonal start time | Each season's average start time excludes checklists with no Time value |
| QA-27 | Top locations by species | Rankings match expected totals when verified against source data |
| QA-28 | County/state lists | Lists collapse to 10 rows with an expand control when more than 10 are present |
| QA-29 | Observation map | Map renders a marker or heatmap point for each unique lat/lng coordinate; absent when no coordinates exist |
| QA-30 | New locations per year | Each year's count equals distinct locationIds appearing for the first time in that year |
| QA-31 | Distance from home | Average, max, and top-5-farthest values display when default location is set; prompt displays when not set |
| QA-32 | Protocol breakdown | Protocol percentages sum to 100%; unknown or blank protocols appear as "Other" |
| QA-33 | Species per hour | Value equals life list size divided by total hours birded, to one decimal |
| QA-34 | Effort trend chart | Chart is absent or omits years with fewer than 3 duration-bearing checklists |
| QA-35 | Complete-checklist ratio | Section is absent when "All Obs Reported" column is not in the CSV |
| QA-36 | Biggest counts | Top 10 entries each have a valid numeric count; X-count observations are excluded |
| QA-37 | Checklist comments | Counts of with/without comments are mutually exclusive and sum to total checklists |
| QA-38 | Breeding species count | Count matches species with at least one non-null breeding code |
| QA-39 | Breeding by category | A species can appear in Confirmed, Probable, and Possible simultaneously |
| QA-40 | Breeding by month | Histogram counts rows (not species) with any breeding code, by month 1–12 |
| QA-41 | Most-photographed | Section is absent when no ML export is loaded |
| QA-42 | Nemesis absent, no location | Section shows "Set a default location in Settings" when no location is saved |
| QA-43 | Nemesis absent, no key | Section shows "Configure eBird API key in Settings" when no key is configured |
| QA-44 | Nemesis results | Displayed species do not appear in the user's life list |
| QA-45 | Dry spells | Each entry shows two consecutive lifers with their dates; the gap in days is accurate |
| QA-46 | Big Year — year selector | Dropdown contains only years present in the data |
| QA-47 | Big Year — lifer count | Lifers shown equal species seen for the first time in that selected year |
| QA-48 | Diversity indices | Shannon H = 0 for a single-species location; H increases with more even distribution |
| QA-49 | Nemesis endpoint validation | `GET /stats/nemesis` returns 400 for lat > 90, lat < −90, lng > 180, lng < −180, dist < 1, dist > 200 |
| QA-50 | Stats refresh on file change | Uploading a new eBird backup in Settings and returning to the Stats tab triggers a re-load |
