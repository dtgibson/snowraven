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
- Committed + pushed `main` and pushed tag **`v0.5.45`**; **Windows CI is GREEN** at the tag commit
  (`windows-build.yml` run `27993478562`, success, headSha == ac2ba49 — the only v0.5.45 run).

**What remains is Mac-only** (`release.sh` — Apple signing). See the Resume Prompt. Full spec:
`pipeline/offline-support/glyph-bundle-handoff.md`; the corrected `release-runbook.md`.

## Resume Prompt

The VM build + ship work is **done**: `main` and the annotated tag `v0.5.45` are pushed at commit
**ac2ba49**, and **Windows CI is GREEN at the tag commit** — `windows-build.yml` run **27993478562**
(conclusion success, headSha == `ac2ba499df0c6cedeb9e8bb3b3c99c7796fa924c` == the tag commit) is the
only v0.5.45 run, so the tag-re-push hazard is inert. No GitHub release exists for v0.5.45 yet —
`release.sh` will create it. **What remains is Mac-only** (Apple signing + the multi-platform assemble):

1. **In a NORMAL Terminal** (not a Claude tool call — Node networking is blocked in the tool sandbox):
   `cd frontend && npm ci`. This restores deps including the new **pmtiles@4.4.0** — the Mac's
   `node_modules` was wiped; `package-lock.json` is committed so the install is deterministic.
2. `cd ..` then `git fetch origin && git checkout main && git pull --ff-only origin main`. **Build
   `main` HEAD** — it equals the tag commit ac2ba49 (plus at most one app-identical records-only
   commit); release.sh's version guards key off `tauri.conf.json`/`Info.plist` (both 0.5.45), not the
   git ref. (A detached `git checkout v0.5.45` is equally correct but unnecessary.)
3. **Re-run the tag-re-push guard** (cheap; confirms no late run landed): `gh run list --repo
   dtgibson/snowraven --workflow windows-build.yml --status success --limit 1 --json
   databaseId,headSha` and `git rev-parse v0.5.45^{commit}`. **Expect** run `27993478562`, headSha
   `ac2ba49…924c` == the tag commit. **CI is already green — no waiting needed.** If the selected
   run's headSha != the tag commit, **STOP and investigate** (do not release; release.sh's
   filename-version guard cannot distinguish two same-version runs).
4. `zsh -lc ./release.sh` — **not** a bare `./release.sh`. `zsh -lc` sources the Mac LOGIN profile
   where `APPLE_SIGNING_IDENTITY` / `APPLE_API_KEY_PATH` / `APPLE_API_KEY_ID` / `APPLE_API_ISSUER_ID`
   live (a bare run aborts at preflight with "APPLE_SIGNING_IDENTITY is not set"). This builds the
   universal macOS DMG + updater bundle, downloads + re-signs the CI Windows `-setup.exe` with the
   real key, writes `latest.json`, and creates the v0.5.45 release. Do **not** use `gh release create`
   directly. `SKIP_WINDOWS=1` is the emergency macOS-only escape hatch only — not needed (Windows is
   green).
5. **Verify** with `gh release view v0.5.45`: the release must carry the macOS DMG
   (`SnowRaven_0.5.45_universal.dmg`), the macOS updater bundle (`.app.tar.gz` + `.sig`), the Windows
   `-setup.exe` (+ `.sig`), and `latest.json` with `darwin-aarch64`, `darwin-x86_64`, and
   `windows-x86_64` entries. The in-app updater will not detect 0.5.45 without `latest.json` present.

After release: the offline-support feature (v0.5.45) is fully shipped. DEFERRED to a later version:
downloadable PMTiles regions (Path A region bake). The pipeline is otherwise idle — run `/weft` for
new work.
