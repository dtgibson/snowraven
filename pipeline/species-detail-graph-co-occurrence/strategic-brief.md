# Strategic Brief — Species Detail: Graph Options and Co-occurring Species

## What We're Building

Two enhancements to the Species Detail tab: a "Graph Options" control card that lets users explicitly choose yearly or monthly graph intervals (replacing the current auto-detect), and a new "Reported With" section that ranks the species most frequently seen alongside the selected species on the same checklists.

## Why Now

The Species Detail tab already holds all sightings data in memory. Both additions are pure derivations from data that's already there — no new backend calls, no new data sources. The graph improvement fixes a control gap that becomes more noticeable the more a birder uses the tab; co-occurrence is the natural next analytical question once someone is exploring a single species in depth.

## The User Problem

For the graph: interval selection is currently implicit — the graph auto-switches to monthly only when all sightings fall within a single year. A birder with many years of data for a common species has no way to see monthly patterns without that condition being true. Moving the toggle to a labeled "Graph Options" card also makes the cumulative/per-period control easier to find and understand.

For co-occurrence: once you're looking at where and when a species appears, the obvious next question is "what else was around?" The answer is in the checklist data already loaded, but nothing currently surfaces it. A ranked list with a coefficient gives birders a fast view of habitat associates and unexpected combinations in their personal data.

## Success Criteria

- A birder can switch between yearly and monthly intervals on any species, regardless of how many years of data they have
- The Per Year / Cumulative toggle is in a dedicated "Graph Options" card above both graphs and is no longer embedded in the Sightings graph card header
- A "Reported With" section appears in the Species Detail view listing the top co-occurring species, ranked by what fraction of the selected species' checklists they also appeared on
- Co-occurrence respects the active county and date-range filters
- All changes are purely client-side — no new backend endpoints

## Scope

- "Graph Options" card with Interval (Yearly / Monthly) and Cumulative (Per Period / Cumulative) controls; both graphs respond to the same controls
- Remove the per-period/cumulative toggle from the Sightings graph card header
- Yearly remains the default; monthly is always available as an explicit choice
- "Reported With" section using conditional co-occurrence coefficient: (checklists with both species) ÷ (checklists with target species)
- Top 10 co-occurring species shown by default, with an expand option for more
- Co-occurrence data computed from `ObservationEntry[]` (parsed from the eBird backup, checklist-keyed via `submissionId`)
- Respects active county and date-range filters

## Out of Scope

- Jaccard index or bidirectional co-occurrence coefficients (conditional probability is sufficient and easier to explain)
- Co-occurrence across subspecies variations (normalized names, consistent with rest of app)
- Any new API calls or backend endpoints
- Graph export or download

## Key Decisions

- Coefficient definition: (checklists with both) ÷ (checklists with target species in the filtered set) — "given this species, what fraction of those checklists included X?"
- Graph interval choice is user-controlled, not auto-detected; the auto-detection logic can be removed
- "Graph Options" card sits above both graphs and controls both simultaneously
- Co-occurrence minimum threshold: species must appear on at least 2 shared checklists to be listed (prevents noise from one-off sightings)
