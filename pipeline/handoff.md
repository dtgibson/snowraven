# Feature Complete — Species Detail: Graph Options and Reported With

**Completed:** 2026-05-23
**Version:** v0.1.5
**Feature:** species-detail-graph-co-occurrence
**Sessions:** 2 (complete)

---

## What Was Built

Two enhancements to the Species Detail tab, shipped in v0.1.5.

**Graph Options card** — a new `SectionCard` above both graphs that gives users explicit control over interval (Yearly / Monthly) and view mode (Per Period / Cumulative). Replaces the old auto-detect logic that silently switched to monthly when a species was only observed in a single year. Both the Sightings Over Time and Media Over Time graphs respond to the same controls simultaneously. The card only appears when there are at least 2 distinct time periods. Controls reset on species change.

**Reported With section** — a new `SectionCard` between Breeding Codes and Top Locations that lists the species most frequently appearing on the same eBird checklists as the selected species. Ranked by co-occurrence coefficient (shared checklists ÷ target checklists), shown as a percentage with a relative bar. Top 10 shown by default, expand/collapse for the full list. Fully respects active county and date-range filters. Minimum 2 shared checklists required. Handles both empty states: no-data (no valid checklist IDs in filtered observations) and zero-results (threshold not met by any species).

---

## Artifacts Produced

| File | Description |
|---|---|
| `pipeline/species-detail-graph-co-occurrence/strategic-brief.md` | Problem framing, scope, key decisions |
| `pipeline/species-detail-graph-co-occurrence/prd.md` | 21 functional requirements, 4 NFRs, 15 QA acceptance criteria |
| `pipeline/species-detail-graph-co-occurrence/schema.md` | Frontend-only confirmation, existing data structures, signature change spec |
| `pipeline/species-detail-graph-co-occurrence/design-spec.md` | Layout order, component structure, token usage, interaction notes |
| `pipeline/species-detail-graph-co-occurrence/design.html` | Interactive HTML mockup with working interval/view toggles and Reported With list |

## Files Changed

| File | Change |
|---|---|
| `frontend/src/components/SpeciesDetail.tsx` | Graph Options card, Reported With section, controlled SightingsGraph, coOccurrence useMemo |
| `frontend/src/lib/sightingsGraph.ts` | Explicit `interval` parameter replaces auto-detection |
| `frontend/src/lib/sightingsGraph.test.ts` | All call sites updated to pass explicit interval |
| `frontend/package.json` | Bumped to v0.1.5 |
| `CHANGELOG.md` | v0.1.5 entry |
| `PRODUCT_CONTEXT.md` | Updated Species Detail Visualizations; added Graph Options and Reported With entry |
| `DECISIONS.md` | Added buildGraphData interval and co-occurrence Set decisions |

---

## Feature Complete

This feature is fully deployed. Start the next feature with `/new-feature`.
