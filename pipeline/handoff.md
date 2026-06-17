## What We Accomplished

Shipped SnowRaven 0.5.41 — an Improve-lane reorder of the app's out-of-the-box defaults, live on both macOS and Windows. The default tab order is now Weather, Statistics, Species Detail, Map Explorer, Checklists, Multimedia, Breeding Codes, List Comparer, Named Birds, with Settings pinned last; the List Comparer opens on checklist comparison first; and the Map Explorer shows Nearby Lifers before Media Targets. This changes defaults and normalization only — persistence through the storage seam is untouched and any saved custom tab layout is preserved.

## What Has Been Saved

- `frontend/src/lib/tabLayout.ts` (+ `tabLayout.test.ts`)
- `frontend/src/components/ListComparer.tsx` (+ `ListComparer.test.tsx`)
- `frontend/src/components/MapExplorer.tsx`
- `frontend/src/lib/mapViewModes.ts` (+ `mapViewModes.test.ts`)
- `pipeline/tab-and-map-default-order/change-brief.md`, `qa-report.md`, `security-report.md`, `pr-description.md`, `how-to-see.md`
- `CHANGELOG.md`, `docs/HELP.md`, `website/index.html`
- `frontend/package.json`, `src-tauri/tauri.conf.json` (both 0.5.41)
- `DECISIONS.md`, `PRODUCT_CONTEXT.md`, `ROADMAP.md` (Chronicler — records updated; shipped count 76)

## Where We Are

Improvement complete. 0.5.41 is published and verified live (GitHub release is Latest, all six assets resolve, `latest.json` correct for the in-app updater on all three platform keys). The pipeline is idle.

## Resume Prompt

To resume: run `/weft` in this project. It reads saved state and starts the next thing.

---

SnowRaven `tab-and-map-default-order` Improve run is complete and released as 0.5.41 on both platforms. Pipeline is idle (no active feature). Optional follow-up: confirm the in-app updater detects 0.5.41 by opening the desktop app. Run `/weft` to begin new work.
