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

Feature complete, and the **offline base-label bundle is now DONE on the VM** (v0.5.45). Scope settled
with Dave: ship offline base **labels** (bundled glyphs + sprite, "Band 1") with the resilience half;
the downloadable PMTiles **regions** stay **deferred**. This VM session:

- Captured the Band-1 assets under `frontend/public/mapassets/` — 51 glyph `.pbf` files (3 Noto Sans
  stacks × 17 BMP ranges) + 4 sprite files, ~3.9 MB.
- Flipped `BUNDLED_MAP_ASSETS = true` (+ doc comment) and added the `jsdom` docblock to
  `mapStyle.test.ts`.
- Updated `CHANGELOG.md` (labels now ship), `release-runbook.md` (corrected the "Mac-side" framing),
  and these records.
- Ran the full gate green on the VM: lint, typecheck, **1094 vitest**, build, the QA-37 chunk
  invariant (maplibre/pmtiles off the entry path), and a `%20`-fontstack glyph-path static-serve
  smoke; backend **157** pytest.
- Committed + pushed `main` and pushed tag **`v0.5.45`** (starts Windows CI).

**What remains is Mac-only** (`release.sh` — Apple signing). See the Resume Prompt. Full spec:
`pipeline/offline-support/glyph-bundle-handoff.md`; the corrected `release-runbook.md`.

## Resume Prompt

The VM build + ship work is done and `main` + tag `v0.5.45` are pushed. **What remains is Mac-only:**
on the Mac, in a normal Terminal, `cd frontend && npm ci` (restore deps incl. the new `pmtiles@4.4.0`
— the Mac's `node_modules` was wiped), `git pull`, then wait for the `windows-build.yml` run **for the
tag commit** to go green — tag-re-push guard: confirm its `headSha` equals `git rev-parse
v0.5.45^{commit}` (a first, un-moved tag has no hazard, but verify CI points at the tag) — then
`zsh -lc ./release.sh`. After it finishes, confirm the GitHub release has the macOS DMG + updater
bundle + the Windows `-setup.exe` + `latest.json`. The pipeline is otherwise idle — run `/weft` for
new work.
