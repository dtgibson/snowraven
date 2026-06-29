## What We Accomplished

Shipped **Map Explorer fixes** as **v0.5.48** — five refinements to the county overlay:

1. **Sharper county lines.** Regenerated the bundled US Census boundary geometry at
   10%-keep (from 2.5%), so the lines trace coastlines and edges crisply instead of
   looking blocky. The on-demand county chunk grows ~310 KB → ~751 KB gz (off first
   paint, fetched only when the overlay is first opened, then cached).
2. **A finer 10-step shading scale.** The "Shade by species seen" choropleth widened
   from 4 to 10 data-driven quantile steps so well-birded counties stand apart.
3. **Clearer popup counts.** The county popup count is now plainly your *checklists*
   (not individual birds) — caption, tooltips, and a "Records" → "Checklists" relabel.
4. **No more popup overflow.** Long county names wrap inside the popup.
5. **Collapsible "… in view" lists.** A chevron collapses the Sightings/Hotspots/
   Targets/Nearby-Lifers in-view lists; the count stays visible when collapsed.

Frontend-only; no new providers, no new network calls; privacy unchanged. All six
Improve-lane stages passed in Studio Style: 1163 tests green, security clean, full CI
mirror (lint, typecheck, test, build) green.

## What Has Been Saved

- Release commit on `main`, tagged `v0.5.48` (both pushed; Windows CI building).
  - Changed: `frontend/src/components/map/CountyLayer.tsx`,
    `frontend/src/components/map/MapSidebarUI.tsx`, `frontend/src/components/MapExplorer.tsx`,
    `frontend/src/lib/countyShading.ts`, `frontend/src/globals.css`,
    `frontend/src/assets/us-counties.json` (regenerated), `scripts/build-county-boundaries.mjs`,
    the version files, `CHANGELOG.md`, `docs/HELP.md`, `website/index.html`, and the records
    (`CLAUDE.md`, `DECISIONS.md`, `ROADMAP.md`).
  - New/extended tests: `countyShading.test.ts` (10-class), `countyContrast.test.ts`
    (tiers 1..10), `MapExplorerInViewList.test.tsx` (collapse disclosure).
  - Feature artifacts in `pipeline/map-explorer-fixes/` (change-brief, pr-description,
    qa-report, security-report).

## Where We Are

Improvement complete — all six Improve-lane stages approved/closed. Source is pushed
and tagged. The **binary release is the Mac's step.**

**Next action (the Mac): release v0.5.48.**
1. `git checkout main && git pull --ff-only origin main`
2. `nvm install $(cat .nvmrc) && nvm use $(cat .nvmrc)`
3. `zsh -lc ./release.sh`
4. Verify: `gh release view v0.5.48`

**v0.5.48 supersedes the still-unreleased v0.5.45, v0.5.46, and v0.5.47** — its source
rolls up all of them, so releasing 0.5.48 alone is sufficient (one consolidated binary).
After the tag push, confirm the selected `windows-build.yml` run's `headSha` equals
`git rev-parse v0.5.48^{commit}` before running `release.sh`.

## Resume Prompt

To resume work, run `/weft` in a Claude Code session in this project — it reads saved
state and picks up from the current (idle) state.
