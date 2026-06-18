## What We Accomplished

Shipped SnowRaven 0.5.43 — a draggable center pin on the Map Explorer's Hotspots, Nearby
Lifers, and Media Targets maps. Right-click (desktop) or long-press (touch) drops a center
pin and re-runs that view's search for the spot; dragging fine-tunes. It reuses the Predict
tab's pin pattern and the existing shared center, is session-only, and the gestures are
distinct from left-click so existing pin selection is unchanged. Built, verified, recorded,
and committed on the VM; the release finishes from the Mac.

## What Has Been Saved

- `frontend/src/components/map/MapControls.tsx` (CenterPinDropper + CenterPin)
- `frontend/src/components/MapExplorer.tsx` (applyCenter + wiring)
- `frontend/src/components/map/CenterPinDropper.test.tsx` (8 tests)
- `frontend/package.json`, `src-tauri/tauri.conf.json`, `frontend/package-lock.json` (all 0.5.43)
- `CHANGELOG.md`, `docs/HELP.md`, `website/index.html`
- `pipeline/map-center-pin/` (change-brief, pr-description, how-to-see, qa-report, security-report)
- `DECISIONS.md`, `PRODUCT_CONTEXT.md`, `ROADMAP.md` (shipped count 78), `CLAUDE.md` (map-gesture rule)

## Where We Are

Improvement complete and recorded. The VM commits everything and pushes `main` + tag
`v0.5.43` (which triggers the Windows CI build). The release finishes from the Mac:
`zsh -lc ./release.sh` builds + notarizes macOS, fetches + signs the Windows installer, and
publishes the GitHub release + `latest.json`. Before running it, confirm the most-recent
successful `windows-build.yml` run's headSha equals the tag commit (tag-re-push guard).
(0.5.42 went live earlier today; 0.5.43 is stacked on its closeout commit.)

## Resume Prompt

To resume: run `/weft` in this project. The pipeline is idle. The one remaining step is the
Mac release — `zsh -lc ./release.sh`.
