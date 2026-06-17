## What We Accomplished

Scoped, implemented, QA-verified, and security-reviewed an Improve pass for SnowRaven's default navigation order, on top of the live 0.5.40 release. The app now defaults to Weather, Statistics, Species Detail, Map Explorer, Checklists, Multimedia, Breeding Codes, List Comparer, Named Birds, with Settings pinned last; List Comparer opens on Checklists first; Map Explorer shows Nearby Lifers before Media Targets.

## What Has Been Saved

- `pipeline/tab-and-map-default-order/change-brief.md`
- `pipeline/tab-and-map-default-order/pr-description.md`
- `pipeline/tab-and-map-default-order/how-to-see.md`
- `frontend/src/lib/tabLayout.ts`
- `frontend/src/components/ListComparer.tsx`
- `frontend/src/components/MapExplorer.tsx`
- `frontend/src/lib/mapViewModes.ts`
- `frontend/src/lib/tabLayout.test.ts`
- `frontend/src/components/ListComparer.test.tsx`
- `frontend/src/lib/mapViewModes.test.ts`
- `docs/HELP.md`
- `CHANGELOG.md`
- `frontend/package.json`
- `src-tauri/tauri.conf.json`
- `website/index.html`
- `pipeline/tab-and-map-default-order/qa-report.md`
- `pipeline/tab-and-map-default-order/security-report.md`

## Where We Are

Stage 4 is complete. The Deployer is preparing the 0.5.41 release path: commit and push main here, push tag `v0.5.41` here to trigger Windows CI, then the Mac runs `zsh -lc './release.sh'`. After the Mac release is verified live, continue here through The Chronicler.

## Resume Prompt

To resume this session: run `$weft` in this project. It reads saved state and picks up exactly here.

---

Resume SnowRaven's `tab-and-map-default-order` Improve run. Load `pipeline/session-state.json`, then continue at Stage 5 — The Deployer. The approved change brief is `pipeline/tab-and-map-default-order/change-brief.md`; implementation, QA, and security artifacts are listed above. Release plan: VM pushes main and tag `v0.5.41`; Mac runs `zsh -lc './release.sh'`; Chronicler runs back here after the release is live.
