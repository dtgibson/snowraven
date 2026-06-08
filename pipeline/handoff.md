# Handoff — 0.5.18 batch — BUILT, set aside for batched deploy (Mac)

## What We Accomplished

Three efforts are built, tested, and on `main`, all batched under **0.5.18**,
undeployed (ships together from the Mac):

1. **Checklist Comparer: Weather + Badges** — each checklist card shows badges for
   media types reported (photo/audio/video), whether breeding codes were noted, and
   whether the comment already contains a SnowRaven weather block and/or tide block
   (separate weather + tide badges). A new **Weather & Tide** section pulls a fresh
   weather + tide lookup for each checklist side by side (explicit "Load" button, no
   auto-fetch, **no auto-copy**; per-side Copy weather / tide / both; an always-note
   about OpenWeather revising historical data; graceful degradation to a Settings
   nudge when keys are absent). Frontend-only.

2. **weather-info-copy** — Weather-tab helper text reworded to mention weather
   auto-copy on a successful lookup + tides appearing below.

   **Weather & tide block coverage in Statistics → Data Quality** — when any
   checklist comment carries a weather/tide block, a "Weather & tide blocks"
   breakdown shows the count + % of checklists with: any weather (either app),
   Raincrow weather (identified by its raincrow.app credit), SnowRaven weather,
   SnowRaven tide, and SnowRaven weather+tide. Offline over the loaded backup;
   hidden when no blocks. New detectors `hasSnowravenWeatherBlock` /
   `hasRaincrowWeatherBlock` in `lib/commentBlocks.ts`; counts in
   `computeQuality`. Adversarially reviewed.

   **Media Comments section on the Multimedia tab** — a section below the species
   table surfacing the ML export's free-text notes (Caption, Media notes,
   Observation Details), mirroring the Species Detail comments box: keyword
   filter, Newest/Oldest, recent-10 + "Show all", per-row species/type/date/place
   + Macaulay asset link. New `lib/mediaComments.ts`, `MediaCommentsSection.tsx`;
   `parseMLExport.ts` now reads the comment fields + the real "Locality" column
   and is record-aware (multi-line comments). Adversarially reviewed.

3. **quality-accessibility-sweep** (maintain lane, 5 items):
   - **Date formats** — one canonical `lib/formatDate.ts` + a **Settings → Appearance
     → Date format** control (month-first default / day-first / ISO), persisted.
   - **Component-test coverage** — *found already shipped in v0.5.11; verified, not redone.*
   - **Accessibility / simplification / onboarding** — *found already shipped in
     v0.5.11; verified, not redone.*
   - **Keyboard-operable map markers** — focusable in-view sidebar lists
     ("Sightings in view" / "Hotspots in view") wired to the same MapLibre popup a
     marker click opens; nearest-unvisited + nearest-targets rows open it too.
   - **Component splits** (behavior-preserving, in place): `BirdingStats` 2036→1893,
     `SpeciesDetail` 1793→1461, `MapExplorer` 2249→1515 — pure helpers/types pulled to
     `lib/`, sub-components to `components/statsPrimitives.tsx`, `components/speciesDetail/*`,
     `components/map/*`. Map marker components keep their popup/cursor/sprite contracts.

All CI-green on `main`. 561 frontend tests pass.

## What Has Been Saved (committed to `main`)

- Comparer code: `frontend/src/lib/{commentBlocks,checklistBadges,tideNotice,keyStatus}.ts`
  (+ tests), `frontend/src/components/{ChecklistBadges,WeatherTidePanel,WeatherTideSection}.tsx`
  (+ tests); shared-helper refactors in `lib/{tide,tideFormatter}.ts`; edits to
  `components/{ChecklistComparer,ListComparer}.tsx`, `App.tsx`; `--sr-accent-strong` token.
- Date formats: `frontend/src/lib/formatDate.ts`, `Settings.tsx` (DateFormatRow), `App.tsx`.
- Keyboard markers: `frontend/src/lib/markersInView.ts` (+ test),
  `components/MapExplorerInViewList.test.tsx`, `MapExplorer.tsx`, `ACCESSIBILITY.md`.
- Component splits: new `lib/{statsFormat,fitBounds,mlCatalog,mapExplorerTypes,mapExplorerFormat}.ts`,
  `lib/sightingsGraph.ts` (+labels), `components/statsPrimitives.tsx`,
  `components/speciesDetail/{ui,SightingsGraph,HeatmapLayer,MapBoundsFitter}.tsx`,
  `components/map/{MapSidebarUI,MapControls,SightingMarkers,HotspotMarkers,TargetMarkers}.tsx`.
- Version 0.5.17 → **0.5.18** (`frontend/package.json` + `src-tauri/tauri.conf.json`);
  `CHANGELOG.md` 0.5.18 covers all of the above; `docs/HELP.md`, `README.md`.
- Pipeline artifacts under `pipeline/comparer-weather-badges/` and
  `pipeline/quality-accessibility-sweep/`.

## Where We Are

The Weft session is **cleared** (`activeFeature: null`) so new feature work can
start now. Everything above is **built/tested but undeployed** — the Deployer +
Chronicler steps happen at the batched deploy on the Mac. Pending-deploy detail
also in `session-state.json` → `remainingBacklog`.

## Deploy / resume prompt (on the Mac, when ready to ship)

1. Confirm version **0.5.18** in BOTH `frontend/package.json` and
   `src-tauri/tauri.conf.json`; confirm `CHANGELOG.md` 0.5.18 covers the whole batch
   (comparer + weather-info-copy + date-format picker + keyboard map markers +
   component splits).
2. `main` is already up to date — push the **`v0.5.18`** tag, wait for Windows CI,
   then run **`./release.sh`** (macOS notarized universal + Windows signed +
   `latest.json`). Web/Pi update on a plain `git pull`.
3. Then the **Chronicler**: update `PRODUCT_CONTEXT.md` / `DECISIONS.md` /
   `ROADMAP.md` for the user-facing additions (comparer badges + side-by-side
   weather/tide, the date-format picker, keyboard-operable map markers, the
   Statistics weather/tide-block coverage breakdown, the Multimedia tab's Media
   Comments section — the splits are internal), and **update `website/`** (the
   List Comparer description + Statistics + Multimedia copy + any feature copy) —
   the website is live, so do this when the features actually ship.

> Note: **0.5.18 is the in-progress batch version.** Additional features built
> before this deploy should accumulate under the 0.5.18 changelog rather than
> re-bumping, so the whole batch ships as one version (the 0.5.17 three-effort
> batch is the precedent).
