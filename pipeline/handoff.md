# Session 1 Handoff — Species Detail: Graph Options and Co-occurring Species

**Completed:** 2026-05-23
**Feature:** species-detail-graph-co-occurrence
**Session:** 1 of 2

---

## What Was Accomplished

Session 1 defined and designed two enhancements to the Species Detail tab.

**Graph Options card:** A new dedicated card above both graphs replaces the auto-detection logic and the embedded Per Year/Cumulative toggle in the Sightings card header. Users can now explicitly choose Yearly or Monthly interval and Per Period or Cumulative view mode. Both the Sightings Over Time and Media Over Time graphs respond to the same controls simultaneously. The `buildGraphData` function signature changes to accept an explicit `interval` parameter instead of auto-detecting from data.

**Reported With section:** A new section below Breeding Codes lists the species most frequently appearing on the same eBird checklists as the selected species. Results are ranked by co-occurrence coefficient (shared checklists ÷ target checklists), expressed as a percentage. Top 10 are shown by default with expand/collapse for the full list. The section respects active county and date-range filters, excludes the target species itself, requires a minimum of 2 shared checklists, and handles both empty states cleanly.

---

## Artifacts

| File | Description |
|---|---|
| `pipeline/species-detail-graph-co-occurrence/strategic-brief.md` | Problem framing, scope, key decisions |
| `pipeline/species-detail-graph-co-occurrence/prd.md` | 21 functional requirements, 4 NFRs, 15 QA acceptance criteria |
| `pipeline/species-detail-graph-co-occurrence/schema.md` | Frontend-only confirmation, existing data structures, signature change spec |
| `pipeline/species-detail-graph-co-occurrence/design-spec.md` | Layout order, component structure, token usage, interaction notes |
| `pipeline/species-detail-graph-co-occurrence/design.html` | Interactive HTML mockup with working interval/view toggles and Reported With list |

---

## Key Engineering Notes for Session 2

- `buildGraphData` in `sightingsGraph.ts` needs its signature changed: replace auto-detect with explicit `interval: 'yearly' | 'monthly'` parameter. Update all call sites in `SpeciesDetail.tsx` and fix `sightingsGraph.test.ts`.
- `viewMode` and `interval` state moves up to the ready-state render block in `SpeciesDetail.tsx` (currently owned inside `SightingsGraph`). `SightingsGraph` becomes a controlled component.
- New `GraphOptions` SectionCard renders above `SightingsGraph`.
- Co-occurrence computed with `useMemo`, using a `Set<string>` of filtered `submissionId`s for O(1) checklist lookup across `phase.observations`.
- `normalizeSpeciesName()` applied to co-occurring names when `mergeSubspecies` is true.
- Reported With section position: below Breeding Codes, above Top Locations.

---

## Session 2 Entry

Run `/build-feature` to start Session 2. The Engineer will implement the code from these artifacts.
