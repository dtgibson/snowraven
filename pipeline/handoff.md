## What We Accomplished

Shipped **county-overlay-precision** as **v0.5.49** (source) — two fixes to the Map
Explorer county overlay:

1. **Accurate county lines at every zoom.** The overlay's boundary *lines* now come
   straight from the basemap's own vector tiles (OpenFreeMap's `openmaptiles`
   `boundary` source-layer, `admin_level == 6`, z9+), so they trace the true county
   edge crisply up close instead of the blocky bundled geometry — they *are* the
   line the basemap already shows underneath. The bundled `us-counties.json` is kept
   for the shade fills, the popups, the (state,county) join, and the below-z9 /
   offline line fallback (the bundled line is maxzoom-capped at 9). `boundary_3` was
   narrowed to `admin_level ≤ 4` so counties are overlay-only and don't double-draw.
   **No new download, no new provider, no privacy-policy change** — the lines ride
   tiles the map already fetches.
2. **Popup overflow fix.** The shared `HotspotLink` public-hotspot link branch was
   missing `max-width:100%`, so a long place name in the shaded county popup's
   "top locations" list ran off the right edge. Added it (gated on `truncate`),
   which also fixes every other truncating hotspot-link spot.

Chosen approach was **A-minimal** (user pick over A-plus / D after a tradeoff
review). Accepted residuals: a hair-thin shaded-fill sliver when shading is on and
zoomed past z9, and no county lines when fully offline with no region downloaded
above z9.

## What Has Been Saved

- Release commit on `main`, tagged **`v0.5.49`** (both pushed; Windows CI building).
  - Code: `frontend/src/components/HotspotLink.tsx`,
    `frontend/src/components/map/CountyLayer.tsx`, `frontend/src/lib/mapStyle.ts`.
  - Tests: `frontend/src/components/map/CountyLayer.test.tsx` (new),
    `frontend/src/components/HotspotLink.test.tsx`, `frontend/src/lib/mapStyle.test.ts`.
  - Version: `frontend/package.json` + `src-tauri/tauri.conf.json` → 0.5.49;
    `CHANGELOG.md`, `docs/HELP.md`, `README.md`, `website/index.html`.
  - Records: `CLAUDE.md`, `DECISIONS.md`, `ROADMAP.md`.
  - Feature artifacts in `pipeline/county-overlay-precision/` (change-brief,
    qa-report, security-report).
- Full CI mirror green (lint, typecheck, **1168 tests**, build); security clean.

## Where We Are

Improvement complete — all six Improve-lane stages approved/closed. Source is pushed
and tagged. The **binary release is the Mac's step.**

**Next action (the Mac): release v0.5.49.**
1. `git checkout main && git pull --ff-only origin main`
2. `zsh -lc ./release.sh`  (Homebrew node; `nvm` not needed)
3. Verify: `gh release view v0.5.49`

After the tag push, confirm the selected `windows-build.yml` run's `headSha` equals
`git rev-parse v0.5.49^{commit}` before running `release.sh`. Recommended in-app spot
check: at z10–12 over a US area, the accurate county line renders and hands off from
the bundled line at ~z9 with no visible pop.

## Resume Prompt

To resume work, run `/weft` in a Claude Code session in this project — it reads saved
state and picks up from the current (idle) state.
