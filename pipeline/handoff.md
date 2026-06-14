# Handoff — Nearby Lifers Map COMPLETE; v0.5.35 pushed to GitHub (release pending from the Mac)

## What We Accomplished

Moved **Nearby Lifers** off the Statistics tab and rebuilt it as its own section of the **Map Explorer**. Instead of a flat list of species names, you now see *where* the birds you've never recorded were reported recently near a point you choose: each spot is a labeled pin (the species name, or "{n} species" where several turned up together), colored by how recently it was seen, with a matching list in the panel and click-through to dates and eBird checklist links. It opens on your saved default location and uses the same controls as the other map sections (use my location, place search, radius), plus a new **Time Range** filter (last day / week / 30 days) that was also added to the Media Targets section so the two match.

## What Has Been Saved

- **Code:** new `frontend/src/lib/nearbyLifers.ts` (+ test), `frontend/src/components/map/NearbyLiferMarkers.tsx` (+ test); `frontend/src/components/MapExplorer.tsx` (the new "lifers" mode + shared Time Range control on both panels), `lib/mapExplorerTypes.ts`, `lib/tauri/mapService.ts`, `lib/transport.ts`, `components/BirdingStats.tsx` (removed the old block). Backend `routers/map.py` (codes-optional `/map/recent-obs` + restored lat/lng/dist bounds), `routers/stats.py` deleted, `main.py`, `tests/test_map_router.py`. Removed `lib/tauri/statsService.ts` + `tests/test_stats_router.py`.
- **Version + docs:** `frontend/package.json` + `src-tauri/tauri.conf.json` → 0.5.35; `CHANGELOG.md`; `PRODUCT_CONTEXT.md`, `DECISIONS.md`, `ROADMAP.md`, `CLAUDE.md`, `README.md`, `docs/HELP.md`, `website/index.html`.
- **Pipeline artifacts:** `pipeline/nearby-lifers-map/` (strategic-brief, prd, schema, design-spec, design.html, PR, how-to-see, qa-report, security-report).
- **Committed on the VM, rebased onto the Mac's 0.5.34-released commit (`83364e8`) so `main` stays linear, then pushed to `main`; tag `v0.5.35` pushed** (starts Windows CI).

## Where We Are

Feature complete and verified (frontend 911 vitest, backend 129 pytest, typecheck/eslint/build/ruff clean; live-verified; security PASS, no privacy change), committed, rebased, and pushed to `main` with the `v0.5.35` tag. Pipeline idle. (0.5.34 is already released live on both platforms.)

## To Release v0.5.35 (your steps from the Mac)

`main` and the `v0.5.35` tag are on GitHub; Windows CI is building. After CI finishes, run `./release.sh` from the Mac.

**Tag re-push hazard — read first.** The `v0.5.35` tag was pushed once at the pre-rebase commit, then moved to the rebased commit, so two Windows CI runs exist. Per the CLAUDE.md standing check, BEFORE running `release.sh` verify the selected run's commit matches the tag: `gh run list --workflow windows-build.yml --status success --limit 1 --json databaseId,headSha` and confirm `headSha == git rev-parse v0.5.35^{commit}`. Wait for the correct (newer-created) run to go green first.

## Resume Prompt

Run `/weft` to start the next thing. Load `pipeline/session-state.json` first.
