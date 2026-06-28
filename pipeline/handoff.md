## What We Accomplished

Shipped **Map Explorer shading polish** as **v0.5.47** — three refinements to the
v0.5.46 county/atlas shading on the Map Explorer:

1. **The "… in view" list is now the last section in every Map Explorer panel.** It was
   pushing the overlay controls down on the My Sightings and Hotspots views; it now sits
   at the bottom of all four panels, so the controls stay near the top.
2. **The two shadings are mutually exclusive.** Turning county shading (green) on switches
   off atlas breeding shading (purple) and vice-versa — their ramps competed for the same
   map. The boundary *lines* can still both show; a tooltip and caption make the switch
   discoverable.
3. **The basemap mutes while a shading ramp is active.** The basemap's green land fills
   turn grey (water/roads/labels keep color; satellite/topo desaturate; Trails stays
   colored) so the active ramp pops, restoring when shading is off. In heatmap mode the
   heatmap now also dims and sits under the county ramp, as it already did for the atlas
   ramp.

Frontend-only, no new controls and no new network calls (the muting reuses tiles already
loaded). The run went through all six Improve-lane stages in Studio Style: 1158 tests
pass, the security review was clean, and the full CI mirror (lint, typecheck, test,
build) is green with the entry-chunk guard holding.

## What Has Been Saved

- Release commit on `main`, tagged `v0.5.47` (both pushed; Windows CI building).
  - New: `frontend/src/components/map/BasemapDesaturation.tsx` (+ test),
    `frontend/src/lib/shadingExclusion.ts` (+ test), `frontend/src/lib/basemapMute.test.ts`.
  - Changed: `frontend/src/components/MapExplorer.tsx`,
    `frontend/src/components/map/SightingMarkers.tsx` (+ test),
    `frontend/src/lib/mapStyle.ts`, the version files, `CHANGELOG.md`, `docs/HELP.md`,
    `README.md`, `website/index.html`, and the records (`CLAUDE.md`, `PRODUCT_CONTEXT.md`,
    `DECISIONS.md`, `ROADMAP.md`).
  - `DECISIONS.md` logs the explicit reversal of the v0.5.46 "the two ramps are designed
    to coexist" contract; `CLAUDE.md`'s coexistence note, heatmap-re-order note, and the
    new basemap-muting mechanism are updated to match.
  - Feature artifacts in `pipeline/map-explorer-shading-polish/` (change-brief, decisions,
    how-to-see, pr-description, qa-report, security-report).

## Where We Are

Improvement complete — all six Improve-lane stages approved/closed. Source is pushed and
tagged. The **binary release is the Mac's step.**

## Resume Prompt

To resume work, run `/weft` in a Claude Code session in this project — it reads saved
state and picks up from the current (idle) state.

**Next action (the Mac): release v0.5.47.**
1. `git checkout main && git pull --ff-only origin main`
2. `nvm install $(cat .nvmrc) && nvm use $(cat .nvmrc)`
3. `zsh -lc ./release.sh` (builds + notarizes the universal macOS DMG, fetches + signs the
   Windows installer from the v0.5.47 CI run, publishes the GitHub release + `latest.json`)
4. Verify: `gh release view v0.5.47`

**v0.5.47 supersedes the still-unreleased v0.5.45 and v0.5.46**, so releasing 0.5.47 is
sufficient.
