## What We Accomplished

Built **offline support** for SnowRaven (v0.5.45) and ran it through the full pipeline. The app now
works with a weak connection or none: maps open offline and draw your own sightings/heatmap/atlas
once they've loaded online once; a checklist's weather and tide that you loaded online re-show
offline (marked as the last loaded result); bird names sort taxonomically with their icons even on
a first-ever cold start; and a live feature that can't run shows an honest "you're offline" message,
distinct from "no API key" and from a server error. On the desktop app you can opt in to downloading
the counties you bird (or whole states) and pan/zoom them offline with full street detail, managed
from a new Settings "Offline maps" section (off by default). The build is committed to `main`; the
actual binary release and the release-time map assets are the Mac's steps.

## What Has Been Saved

- **Backend:** `routers/settingskv.py` (+ test), `routers/taxonomy.py` (disk-persist + bundled floor),
  `routers/version.py` (404-not-up-to-date fix), `staticdata/ebird_taxonomy.json`.
- **Frontend libs:** `lib/mapPmtiles.ts`, `lib/regionDownload.ts`, `lib/persistedStyle.ts`,
  `lib/replayStore.ts`, `lib/offlineDetect.ts`, `lib/offlineMessage.ts`, `lib/mapStyle.ts`,
  `lib/storage.ts`, `lib/transport.ts`, `lib/tauri/{taxonomyService,versionService,updateManager}.ts`,
  `src/assets/{ebird-taxonomy,regions-catalog}.json` (+ tests for all).
- **Frontend UI:** `components/OfflineMapsSection.tsx`, `components/OfflineMessage.tsx`,
  `components/map/RegionBaseSource.tsx`, plus `Settings.tsx`, `SnowMap.tsx`, `MapExplorer.tsx`,
  `WeatherForecastPanel.tsx`, `App.tsx` wiring (+ tests).
- **Tooling/assets:** `scripts/build-ebird-taxonomy.mjs`, `tools/build-regions/`,
  `src-tauri/capabilities/default.json` (fs range-read grants).
- **Docs/version:** `CHANGELOG.md`, `PRIVACY_POLICY.md`, `README.md`, `docs/HELP.md`,
  `ACCESSIBILITY.md`, `website/index.html`, version `0.5.45` in `frontend/package.json` +
  `src-tauri/tauri.conf.json`.
- **Records:** `PRODUCT_CONTEXT.md`, `DECISIONS.md`, `ROADMAP.md`, `CLAUDE.md`.
- **Pipeline artifacts:** `pipeline/offline-support/` (brief, prd, schema, design, qa-report,
  security-report, **release-runbook**).

## Where We Are

Feature complete — all 9 stages approved, committed and pushed to `main` at `cef31b1`. **Not yet
released.** Scope was settled with Dave during a Mac shipping session: **ship offline base LABELS
(bundled glyphs + sprite, "Band 1" ~3.5 MB) together with the resilience half as 0.5.45** — NOT the
downloadable PMTiles regions (Path A stays deferred).

**One BUILD task remains before release, and it's DEV work → do it on the VM, not the Mac.** The Mac
session that started it (glyph capture/bundling + flipping `BUNDLED_MAP_ASSETS`) hit a broken dev
environment, reverted cleanly, and handed it back. The Mac is only for `release.sh`. Full, settled,
step-by-step spec — every decision already made, exact glyph ranges, the verbatim code edits, verify
steps, and the ship sequence — is in **`pipeline/offline-support/glyph-bundle-handoff.md`**. (The
`release-runbook.md` "Mac-side glyphs" framing is corrected there.)

## Resume Prompt

To resume **on the VM**: follow `pipeline/offline-support/glyph-bundle-handoff.md` end to end — fetch
the Band-1 glyphs + sprite into `frontend/public/mapassets/`, flip `BUNDLED_MAP_ASSETS=true` (+ doc
comment), add the `jsdom` docblock to `mapStyle.test.ts`, run the full build gate, update CHANGELOG +
runbook, commit + push `main`, then push tag `v0.5.45` (starts Windows CI). Then on the **Mac**:
`cd frontend && npm ci` in a normal Terminal (restore deps incl. new `pmtiles`), pull, wait for green
Windows CI, `zsh -lc ./release.sh`.
