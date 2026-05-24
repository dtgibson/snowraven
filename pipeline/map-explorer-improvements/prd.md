# PRD — Map Explorer Improvements
**Feature:** map-explorer-improvements
**Session:** 001
**Date:** 2026-05-23
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

Two targeted improvements to the Map Explorer tab. The first adds a missing-type filter to the Media Targets mode so birders can narrow the target list by what media they need. The second corrects a geometry bug where personal location pins in Hotspots mode appear outside the user's selected radius.

---

## User Stories

**US-01** — As a birder planning a photography session, I want to filter Media Targets to show only species missing a photo, so I can focus on what I actually need that day rather than scrolling a mixed list.

**US-02** — As a birder who records audio, I want to filter Media Targets to show only species missing an audio recording, so I can plan outings specifically around filling audio gaps.

**US-03** — As a birder with observations across multiple states, I want the Hotspots map to show only personal locations within my selected radius, so the map accurately reflects what's nearby rather than every place I've ever birded.

---

## Functional Requirements

### A — Media Target Type Filter

**FR-01** — The Media Targets sidebar shall include filter pills: **All**, **Photo**, **Audio**, **Video**. "All" is selected by default.

**FR-02** — Photo, Audio, and Video pills are multi-select. "All" is mutually exclusive — selecting it deselects all type pills; selecting any type pill deselects "All."

**FR-03** — When one or more type pills are active, the filter uses AND logic: only species missing *all* of the selected types are shown.

**FR-04** — The filter applies to both the map pin display and the nearest-10 sidebar list.

**FR-05** — The filter resets to "All" when the user clicks "Find Sightings" to fetch new data.

**FR-06** — The filter control is shown only in Media Targets mode.

**FR-07** — The species count label reflects the currently filtered count.

**FR-08** — When the active filter produces zero matching species, the sidebar shows: "No targets match this filter."

**FR-09** — Active filter pills use the amber `var(--sr-is-target-*)` token family already established for the "Is Target" concept.

### B — Personal Hotspot Radius Correction

**FR-10** — Personal location pins in Hotspots mode shall only appear when their coordinates fall within the selected radius of the current map center.

**FR-11** — Distance uses the existing `distanceMiles()` helper and the same `dist` state variable governing the public hotspot fetch.

**FR-12** — Personal locations without coordinates continue to be excluded.

**FR-13** — No UI indicator is shown for excluded personal locations.

---

## Non-Functional Requirements

**NFR-01** — Both changes are purely client-side. No new API calls or backend changes.

**NFR-02** — Filter state is React state only — not persisted.

**NFR-03** — Personal pin filtering belongs inside the existing useMemo that computes personal pins so it recomputes only when lat/lng/dist or backup data changes.

---

## Acceptance Criteria

| ID | Condition | Pass |
|---|---|---|
| QA-01 | "All" selected by default | Map shows all target pins |
| QA-02 | Photo selected | Only species with Photo in missingTypes shown |
| QA-03 | Audio selected | Only species with Audio in missingTypes shown |
| QA-04 | Photo + Audio selected | Only species missing both shown |
| QA-05 | All three selected | Only species missing all three shown |
| QA-06 | Filter resets on fetch | "Find Sightings" returns filter to "All" |
| QA-07 | Species count label | Shows filtered count |
| QA-08 | Empty state | "No targets match this filter" when zero results |
| QA-09 | Nearest-10 filtered | Shows only matching species |
| QA-10 | Filter hidden in other modes | Pills absent in My Sightings and Hotspots |
| QA-11 | Personal pins within radius | Pins outside dist miles of center hidden |
| QA-12 | Personal pins inside radius | Pins within dist miles remain visible |
| QA-13 | No coordinates excluded | Null lat/lng personal locations excluded |
| QA-14 | Radius change updates pins | New fetch with new radius updates personal set |
| QA-15 | No regression — My Sightings | Unaffected |
| QA-16 | No regression — public hotspots | Visited/unvisited pins unaffected |
| QA-17 | No regression — Media Targets fetch | Fetch and recency toggle still work |
