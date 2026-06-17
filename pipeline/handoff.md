## What We Accomplished

Shipped SnowRaven 0.5.42 — a bundled Improve run with three threads: the default tab order now puts Checklists between Breeding Codes and List Comparer; the maplibre map library (~273 KB gzip) was taken off the app's first-paint path so initial load is lighter (the per-row map and the List Comparer / Checklists tabs now load on demand, warmed at idle); and the confusing npm "security risks" notice when self-hosting on a Pi was cleared and explained (the advisories were dev-only build tooling that never ships). Built, verified, recorded, and committed on the VM; the release finishes from the Mac.

## What Has Been Saved

- `frontend/src/lib/tabLayout.ts` (+ `tabLayout.test.ts`)
- `frontend/src/components/NamedBirdRow.tsx` (+ `NamedBirdsTable.test.tsx`)
- `frontend/src/App.tsx`, `frontend/vite.config.ts`
- `frontend/package.json`, `src-tauri/tauri.conf.json`, `frontend/package-lock.json` (all 0.5.42)
- `CHANGELOG.md`, `README.md`, `update.sh`, `website/index.html`
- `pipeline/tab-order-and-load-optimization/` (change-brief, qa-report, security-report, pr-description, how-to-see)
- `DECISIONS.md`, `PRODUCT_CONTEXT.md`, `ROADMAP.md` (shipped count 77), `CLAUDE.md` (new maplibre-off-entry rule)

## Where We Are

Improvement complete and recorded. The VM commits everything and pushes `main` + tag `v0.5.42` (which triggers the Windows CI build). The release then finishes from the Mac: `zsh -lc ./release.sh` builds + notarizes macOS, fetches + signs the Windows installer, and publishes the GitHub release + `latest.json`. Before running it, confirm the most-recent successful `windows-build.yml` run's headSha equals the tag commit (tag-re-push guard).

## Resume Prompt

To resume: run `/weft` in this project. The pipeline is idle. The one remaining step is the Mac release — `zsh -lc ./release.sh`.
