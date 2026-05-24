# Handoff — species-detail-enhancements (v0.1.11)

## What was built

Three additions to the Species Detail tab — shipped, tested, and deployed.

**Weekly graph interval** — The Graph Options toggle now includes Weekly as the first option (Weekly · Monthly · Yearly). Monthly is the new default on every species selection. Weekly groups observations by ISO week (`YYYY-Www`) with a Monday-anchored gap-fill and `Wk N 'YY` axis labels.

**Checklists Over Time graph** — A new chart card between "Sightings Over Time" and "Media Over Time" showing how many of your checklists recorded the species per period (per week/month/year, or cumulative). Uses the same interval and view-mode controls as the other graphs. Rendered in the same accent green as the individuals line, at 0.6 opacity to visually subordinate it.

**Frequency statistic** — A "Frequency" cell in the Sightings section shows what percentage of your checklists include the selected species. Displays as `X%` (rounded) or `<1%` in accent green with a slim fill bar. Updates reactively when county or date-range filters are active; hidden when no valid submission IDs are in scope.

## Artifacts

**Session 1:**
- `pipeline/species-detail-enhancements/strategic-brief.md`
- `pipeline/species-detail-enhancements/prd.md`
- `pipeline/species-detail-enhancements/schema.md`
- `pipeline/species-detail-enhancements/design-spec.md`
- `pipeline/species-detail-enhancements/design.html`

**Session 2 (code):**
- `frontend/src/lib/sightingsGraph.ts` — complete rewrite; `GraphInterval` type, `checklists` field, ISO week support, returns `{ data, interval }`
- `frontend/src/lib/sightingsGraph.test.ts` — 18 tests (up from 9)
- `frontend/src/components/SpeciesDetail.tsx` — weekly interval, checklists graph, frequency stat, monthly default

**Release:** v0.1.11 — deployed and published at https://github.com/dtgibson/snowraven/releases/tag/v0.1.11

## Status

Feature complete. All 9 stages approved. No open issues.

---

To start the next feature, run `/new-feature`.
