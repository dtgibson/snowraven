# Feature Complete — Birding Statistics Tab

**Completed:** 2026-05-23
**Version:** v0.1.6
**Feature:** birding-stats-tab

---

## What Was Built

A new Statistics tab in SnowRaven that turns the stored eBird backup CSV and ML export into a full personal birding analytics dashboard. All computation is client-side; one new backend endpoint (`GET /stats/nemesis`) fetches regional species frequency data for the Nemesis Birds section.

The tab covers:
- **Life List Totals** — headline counts (species, observations, checklists, time, distance, locations, geographic breadth, media)
- **Firsts & Milestones** — first checklist, first species, species milestones at every 50 species up to 1,000, longest streak + dry spell with dates, most/least-reported species, one-and-done species
- **Species Accumulation Curve** — line chart with Weekly / Monthly / Yearly granularity toggle
- **Temporal** — bar charts for checklists/lifers/species/locations per year, monthly/DOW/hourly activity, busiest day, seasonal average start time
- **Geographic Stats** — top locations by species/visits/time, county + state lists, distance-from-home stats when a default location is configured
- **Effort & Methodology** — protocol breakdown, duration/distance averages, species-per-hour, observer distribution, effort trend chart, complete-checklist ratio
- **Data Quality** — count vs X proportion, biggest single counts, comment coverage
- **Breeding Stats** — species by code category, breeding activity by month
- **Fun Stats** — Most Photographed, Most Audio, Most Video; Nemesis Birds

**PRD deviations made at user direction:**
- FR-37 (map) removed — redundant with Species Detail and Map Explorer
- FR-58 (Big Year dropdown) removed — user direction
- FR-43 (average observers) replaced with observer distribution chart

---

## All Artifacts and Files Produced

**Pipeline artifacts:**
- `pipeline/birding-stats-tab/strategic-brief.md`
- `pipeline/birding-stats-tab/prd.md`
- `pipeline/birding-stats-tab/schema.md`
- `pipeline/birding-stats-tab/design-spec.md`
- `pipeline/birding-stats-tab/design.html`

**New source files:**
- `frontend/src/components/BirdingStats.tsx`
- `backend/routers/stats.py`
- `backend/tests/test_stats_router.py`

**Modified source files:**
- `frontend/src/lib/parseEbirdObservations.ts` — 9 optional checklist-level fields added
- `frontend/src/lib/parseEbirdObservations.test.ts` — tests updated
- `frontend/src/types.ts` — `MLExportRow` type added
- `frontend/src/App.tsx` — Statistics tab wired in
- `backend/main.py` — stats router registered
- `frontend/vite.config.ts` — `/stats` proxy added
- `frontend/package.json` — v0.1.6
- `CHANGELOG.md` — v0.1.6 entry

---

## Feature Complete

This feature is fully deployed. v0.1.6 is live at https://github.com/dtgibson/snowraven/releases/tag/v0.1.6.

To start the next feature, run `/new-feature`.
