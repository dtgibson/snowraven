# Handoff — stats-enhancements (v0.1.12)

## What was built

Eight improvements to the Statistics tab, shipped and deployed.

**Denser milestone schedule** — 43 thresholds replacing 20. Every 10 species below 100, every 25 from 100–475, every 50 from 500–950, sparse from 1,000–3,000. Milestone pills moved from Life List Totals to the bottom of Firsts & Milestones. Four color tiers (sage green, medium green, deep green, amber/gold).

**Per-year statistics** — Checklists by Year now shows checklist count, distinct species count, and best single-day species count per year. Best-day count links to the eBird checklist when the submission ID is valid.

**Top Locations Leaflet map** — Numbered green circle markers (top-by-checklists) and blue square markers (top-by-species) in the Geographic Stats card. Placed at the top of the card above the text lists. `invalidateSize()` called before `fitBounds` to prevent the "grey corner" Leaflet rendering bug.

**Single-Checklist Birds / One-and-Done Birds split** — Renamed and separated into two distinct concepts. One-and-done now means total individual count = 1 (not seen on one checklist). Pills link to eBird checklists matching single-checklist bird behavior. Submissionid tracking added to the one-and-done computation.

**Nemesis bird links** — Each nemesis bird name links to its eBird species page. Taxon codes resolved from ML export data or a fire-and-forget `/taxonomy/codes` fetch. Unresolvable names fall back to plain text.

**Accumulation pill order** — Weekly · Monthly · Yearly · Total.

**Day-of-week chart layout** — Pie chart and legend stacked below the bar chart.

**"Fun Stats" renamed** — Section is now "Other Statistics."

## Artifacts

**Session 1:**
- `pipeline/stats-enhancements/strategic-brief.md`
- `pipeline/stats-enhancements/prd.md`
- `pipeline/stats-enhancements/schema.md`
- `pipeline/stats-enhancements/design-spec.md`
- `pipeline/stats-enhancements/design.html`

**Session 2 (code):**
- `frontend/src/components/BirdingStats.tsx` — all feature changes
- `frontend/package.json` — version bumped to 0.1.12
- `CHANGELOG.md` — v0.1.12 entry
- `PRODUCT_CONTEXT.md` — Statistics tab section updated
- `DECISIONS.md` — Top Locations map decision added

**Release:** v0.1.12 — deployed and published at https://github.com/dtgibson/snowraven/releases/tag/v0.1.12

## Status

Feature complete. All 9 stages approved. No open issues.

---

To start the next feature, run `/new-feature`.
