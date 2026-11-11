# Deployment record: hotspot-reports (1.0.71)

## Part one: preparation, applied, bumped, verified, committed locally (2026-11-11 PST)

Run by The Deployer (feature lane, the ship stage) on `main` in the main checkout. Six local commits; nothing was pushed, tagged, released, built for a store or uploaded. GitHub, App Store Connect (GET only, metadata key) and F-Droid were only read.

### Preconditions

- **The Tester passed with notes** (`qa-report.md`, gitignored, on disk). QA-59 (the version set) and QA-60 (the screenshots) were deferred to this stage and close here.
- **The Auditor passed with notes** (`security-report.md`, gitignored, on disk): no Critical, High or Medium. Dispositions are in `decisions.md` D-26.
- No staging environment and no new key, environment variable, host or provider setting, so the production sign-off is the one gate and there is no external setup to offer.

### The user's decisions (2026-11-11, recorded by the Guide at the gates)

- Copy, live app and screenshots: "Yes to the app, the copy, and the screenshots". Approved verbatim as held: the one sentence (README section, website row, App Store bullet with its first letter lowercased), the What's New text (also the F-Droid changelog text), the caption `Hotspot Reports | Your own record at any one place`, and the website alt text.
- Screenshots per the table shown: website replace eleven, add `hotspot-reports.webp`, keep `weather.webp`; the iPhone, iPad and iPhone Duo App Store sets each replaced whole with seven frames.
- Release gate: "Confirm: release 1.0.71 now".
- CI basis: the Pipeline frontend job has been red on `main` since 1.0.70 on `lifeListsLinearity.test.ts` timing rows only (life-list-region-filter D-12). The run of record for this ship is judged the same way: timing-ratio rows failing only on the CI runner are recorded; any other red stops the ship.

### Screenshots and how they were taken

- All from the synthetic demo dataset, which the held `website-tools.patch` extends with weather blocks on every third Jamaica Bay Wildlife Refuge checklist (14 blocks; only `Checklist Comments` changes, on 302 rows; the ML export is byte-identical). Both capture scripts' demo-dataset guards passed (368 synthetic checklists).
- First pass: a scratch backend (repository code, `SR_DATA_DIR` on a copy of the demo data only, no eBird key) with every outbound request it tried refused at a local logging proxy. 63 eBird-backed requests reached that backend (34 hotspot lookups answered 401 by the keyless backend, 29 taxonomy-code lookups served from the bundled taxonomy); 113 more were answered inside the browser by the committed stubs. **None reached eBird.**
- The iPad and iPhone Duo Weather frames were recaptured live, once each, on the Guide's scratch backend that reads the keys from its own scratch-only env file, with every other eBird-backed path answered or blocked in the browser and a cap of one `/weather` and one `/tide` request per capture. Outbound, logged by host and path only: **eBird 8, OpenWeather 4, NOAA 6**, all 200. Each lookup route fetches the checklist itself (checklist view plus region info), so one Weather capture costs four eBird requests.
- Kept as committed: the website `weather.webp` and the iPhone `03-weather-tide.png` (neither shows anything this release changes). Recomposing changed only the two recaptured frames among the existing ones.
- Found on the way: the committed iPhone Species Detail frame read "Splits and lumps 10 species" where the app reads 11; the regenerated frame replaces it.
- Applied frames match their recorded SHA-256 (57 files). `pipeline/app-store-listing-polish/asc/` now uploads seven frames per family (`asc-screens.mjs` ORDER), and `composed-frames-checksums.{txt,json}` record the 21 committed frames.

### Commits (local, on `main`, in order)

1. `test(weather)`: the markup golden, captured before the extraction.
2. `refactor(weather)`: the distribution row moved to `WeatherDistRow.tsx`.
3. `refactor(life-lists)`: `compareDisplay`'s type-only widening.
4. `feat(hotspot-reports)`: the tab, Help, the rules and these pipeline records.
5. `docs(hotspot-reports)`: the approved README, website and listing copy, the screenshots, the demo data, the capture tools (the held patch plus the approved scratch edits: the key-presence mock, the Life Lists job and its `process-img.mjs` row, Wood Thrush, the seventh `FRAMES` and `APPROVED` rows) and `verify-hotspot-reports.mjs` with its `ORDER` entry and a 900,000 ms budget.
6. `chore(release): 1.0.71`: the version set and this record.

Commits 1 and 2 were checked on their own trees (exported to scratch): the weather suites pass, 3 files and 76 tests at the golden commit, 4 files and 80 tests at the extraction commit.

### The version set at 1.0.71

`frontend/package.json` and its lockfile; `src-tauri/tauri.conf.json` (`versionCode` 1000071); `CHANGELOG.md` (from `held/changelog-entry.md`, dated, with the More sheet line the draft asked for, scoped to the measured 393 by 852 screen); the website version pill, its `aria-label` and the footer; `fastlane/metadata/android/en-US/changelogs/10000711.txt`, `10000712.txt` and `10000714.txt` (the approved text and one newline, 377 bytes each, identical); the in-repo F-Droid recipe (versions, codes, `CurrentVersion` 1.0.71, `CurrentVersionCode` 10000714; its commit lines move after the tag). The iOS plist is stamped later by `tauri ios build`.

### Verification on the final tree

- `npm run typecheck` rc 0; `npx eslint .` rc 0; `npm run build` rc 0.
- Full vitest: 513 files passed, 1 failed, 5 skipped; 11,170 tests passed, 2 failed, 8 skipped. The two failures were `lifeListsLinearity.test.ts` timing ratios (20.6 and 21.1 against 20) while the suite drove the load average to 617. Re-run alone on the settled machine: 20 of 20, twice. Nothing else was red.
- Backend: 2,080 passed. `website/tools` `npm test`: 15 of 15, the composer's committed-frame check included.
- Real-engine gate (`npm run verify`): 9 of 9 harnesses green in about 9 minutes, `verify-hotspot-reports.mjs` with 344 of 344 window configurations measured and none failing.
- Nothing committed under `website/` carries a local path, hostname, tailnet name, key value or real user data (scanned: every added line and every new text file).

### Read-only checks for part two

- `origin/main` is `ed279be9`, no `v1.0.71` tag, no newer release. The other worktree's branch (`life-list-filter-toggle-state`, 1.0.65) has no commits beyond `main`, so no other ship is in flight.
- App Store Connect: 34 version records, all `READY_FOR_SALE`; 1.0.70 (`21fd36c0`, build 1.0.70.1) is live and its submission `a3be255f` is `COMPLETE`. 94 TestFlight trains, 102 builds, all `VALID`, none for 1.0.71. The 25 trains from 1.0.13 on with no record of their own are the ones `RELEASE_LEDGER.md` already accounts for. **Route for 1.0.71: its own new record.** 1.0.70 is released, so its train is closed and there is nothing in review to roll into, and nothing is deferred.
- F-Droid: 1.0.68 included and this tag picked up (all three codes built and published); 1.0.69 superseded on F-Droid by 1.0.70 (the bot added it on 2026-11-10 and a maintainer's "keep latest" sweep removed it on 2026-11-11); 1.0.70 included and this tag not yet built (in the recipe since 2026-11-11, the three build logs 404, not published).
- Xcode 27.2 (27B52), first launch done (`-checkFirstLaunchStatus` rc 0), iOS SDK 27.2; the login keychain is unlocked.
