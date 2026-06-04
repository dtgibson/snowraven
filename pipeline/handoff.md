# Handoff — standard-bird-name-format (New Feature lane)

## What We Accomplished
Shipped **v0.5.8** — an app-wide standardized, clickable bird-name format.
Every user-facing bird name renders through a shared `<BirdName>`: common name
links to its Species Detail entry (when the user has one), eBird/BoW favicons
always, scientific name where there's room. Clicking any name navigates to and
selects that species on Species Detail. Where a name previously carried a link,
the count/element took it over; birds not in the user's data show name +
favicons with no dead link.

## Where We Are
**Feature complete — all 9 stages done.** v0.5.8 live on all platforms.

## Release facts
- Version `0.5.8` (patch). Tag `v0.5.8`; release: https://github.com/dtgibson/snowraven/releases/tag/v0.5.8
- Assets verified: latest.json, macOS updater bundle + .sig, universal.dmg, x64-setup.exe + .sig. latest.json 0.5.8 with all three platform keys.

## Key files
- NEW `frontend/src/components/BirdName.tsx` (+ `BirdName.test.tsx`, jsdom per-file env)
- `App.tsx` (requestedSpecies + navigateToSpeciesDetail; props to all tabs)
- `SpeciesDetail.tsx` (consume effect, openSpeciesInTab, taxonCodeFor, Reported With → BirdName)
- `BirdingStats.tsx` (all lists; backboneNames/hasEntryFor/codeFor; all-observed taxon resolution)
- `MapExplorer.tsx` (target popups + nearest-targets, pan → Crosshair locate icon)
- `LifeListTable.tsx`, `BreedingCodeTable.tsx`, `SpeciesPanel.tsx` (+ ListComparer/ResultsView/LifeList/BreedingCodeList wiring)
- `globals.css` (.sr-birdname*), `docs/HELP.md`, `CHANGELOG.md`

## Live-iteration log (Dave)
- Single-checklist / one-and-done pills had inconsistent favicons → Stats only
  resolved ML-species taxon codes. Fixed: resolve codes for ALL observed
  species + normalized lookup. Confirmed consistent.

## Chronicle updates made
- ROADMAP.md → Shipped v0.5.8 (48 versions).
- PRODUCT_CONTEXT.md → new "Standardized Bird-Name Format" entry.
- DECISIONS.md → the BirdName decision + rules (link-when-hasEntry, move-the-link, D1).
- CLAUDE.md → new "Bird names" convention section.
- CHANGELOG, HELP updated in the feature commit.

## Outstanding / future
- Carried: verify Windows install + in-app updater end-to-end on a Windows machine.
- Deferred bet (from v0.5.7): vector basemap (MapLibre + OpenFreeMap).

## Resume Prompt
No active feature. Run `/weft` to start the next lane.

---
Project: snowraven. Feature: standard-bird-name-format — COMPLETE (v0.5.8 shipped). No active session.
