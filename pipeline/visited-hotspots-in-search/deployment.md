# Deployment record: visited-hotspots-in-search (1.0.73)

## Part one: preparation up to the release sign-off (2026-11-13 PST, 21:56 to 22:15; 2026-11-14 UTC, 05:56 to 06:15, The Deployer)

**Scope.** Preparation only, from this build's own worktree (`snowraven-visited-hotspots-in-search`, branch `weft/visited-hotspots-in-search`). Nothing was pushed, tagged, uploaded, released or written to App Store Connect, GitHub, F-Droid or fdroiddata; no physical device, simulator or emulator was touched; no other worktree or the main folder was entered or changed. The commits below are local to this branch. App Store Connect was read with GETs only (metadata key `QJA25M7XHM` through `pipeline/app-store-listing-polish/asc/asc-lib.mjs`, from a script in the session scratchpad; no token, key, issuer or contact value printed or written). Scratch output is in the session scratchpad under `deploy/`. One slip, recorded for honesty: the first post-merge build wrote its log to `/Users/developer/devwork/build.log` (outside the worktree) for about a minute; it was moved into the scratchpad and nothing else was written outside the worktree and the scratchpad.

### 1. Reports

- QA: **PASSED** (`qa-report.md`, re-verified after E-09 and after the security fix E-10).
- Security: **PASSED WITH NOTES** (`security-report.md`): F-1 (Low) and F-2 (Informational) resolved, F-3 (Informational) open and non-blocking. No unresolved Critical or High finding.
- `git fetch origin --tags` (05:59 UTC): `origin/main` at `2cef2329` (1.0.72 closed out), 8 commits past this branch's base `2253d047`; newest tag `v1.0.72`.

### 2. This build's commits (local)

| Commit | What |
|---|---|
| `bd160b5f` | `feat(search)`: the feature code and its tests (25 files under `frontend/src`), `docs/HELP.md` and `ACCESSIBILITY.md` |
| `fbb980f7` | `docs(rules)`: the `paths` gates in `security.md`, `ui.md` and `maps.md` |
| `77f888c6` | `docs(pipeline)`: this run's records (brief, PRD, schema, design and spec, decisions, QA and security reports, PR description, the held What's New) |

Left out: nothing unexpected was present. `frontend/dist` is gitignored and was not staged; there is no `.env` in the worktree; no scratch output sits in the worktree.

### 3. Reconcile with the main line

- `git merge --no-ff origin/main` gave **`cb8b78f4`, clean, no conflicts.** The three files both sides touched (`.claude/rules/ui.md`, `docs/HELP.md`, `frontend/src/globals.css`) merged without markers. The merge brought no backend file and no dependency change (the lockfile moved only its own version string), so the backend suite was not owed.
- **Post-merge checks on `cb8b78f4`** (load 2.6 at the start): `npm run typecheck` exit 0; `npm run build` exit 0; eslint on the feature's 24 `.ts`/`.tsx` files plus the merged Hotspot Reports files (`HotspotReport.tsx`, `HotspotReportSections.tsx`, `HotspotReportsTab.test.tsx`, `hotspotReportsLocation.ts`) exit 0 with no finding; **the full vitest suite: 523 files passed, 5 skipped; 11,390 tests passed, 9 skipped (11,399), 0 failed** (82 s). No timing-ratio row tripped, so nothing needed a re-run alone.
- **Built-app probe of the merged build** (Chromium and WebKit, Playwright 1.62.1 through a scratchpad symlink to the main checkout's `website/tools/node_modules`; the main checkout's `backend/.venv` uvicorn, read-only, serving this worktree's `backend/` and `frontend/dist` on `127.0.0.1:18771` with `SR_DATA_DIR` at a synthetic 7-checklist backup in the scratchpad and the outbound proxies pointed at a closed port). Every request other than the app's own files and `/settings` reads was answered inside the browser and counted: **10** (`/map/hotspot-region` 2, `/taxonomy/codes` 6, OpenFreeMap tiles 2); the backend log shows only `/`, `/assets/*` and `/settings/*` GETs. Probe: `scratchpad/deploy/probe/landing.mjs`; output `landing.log`.

  | Leg (each engine) | Result |
  |---|---|
  | From the first tab: Search, type `zqmerge`, Arrow Down, Enter | **Pass, both engines.** Hotspot Reports is the selected tab, the picker reads "Zqmerge Pond", the header "Zqmerge Pond / Hennepin, MN", the live region "Zqmerge Pond: 5 species, 4 checklists.", focus on `main`, the page not scroll-locked. The report's headings run At a glance, Map, Visits and media, Weather on your visits, Checklists by protocol, Most-recorded species, Life list: 1.0.72's order, life list last. |
  | From Calendar: Search, `zqtwin`, choose the Dakota row of two namesakes | **Pass, both engines.** Header "Zqtwin Marsh / Dakota, MN", not Hennepin. |
  | From Hotspot Reports itself: Search, `zqother` | **Pass, both engines.** The report switches to "Zqother Woods / Ramsey, MN". |
  | Uncaught page errors | none, both engines |

  The backend was stopped (the port no longer listens) and the synthetic data deleted.

### 4. Parallel ships (read-only, 06:01 to 06:08 UTC)

| Check | Reading |
|---|---|
| `origin` | `main` at `2cef2329`; tags up to `v1.0.72` (on `5e596cf0`); no `v1.0.73` on origin or locally before this part. |
| GitHub releases | `v1.0.72` Latest (2026-11-14 00:25 UTC); nothing newer. |
| CI | Nothing running. Windows Build `43531087794` and Android Build `43531087702` (v1.0.72) success. The last four Pipeline runs on `main` are red on timing rows (see section 9). |
| Processes | No `release.sh`, `notarytool`, `altool`, `xcodebuild`, `tauri build`, `cargo tauri` or `gradle` process. One leftover from the 1.0.72 ship: `log stream --predicate process contains "altool" ...` (PID 78124, running 5 h 55 min). Not this session's; harmless; left alone. |
| Other worktrees (`git worktree list` only, none entered) | The main folder on `main` at `2cef2329`; `.claude/worktrees/life-list-filter-toggle-state` at `481b9ee3`, an ancestor of `origin/main`. **No other ship in flight.** |

### 5. App Store Connect and TestFlight (GETs only, 06:02 UTC; `scratchpad/deploy/asc-state.txt`)

- **36 version records: 35 `READY_FOR_SALE`, and 1.0.72 (`e674c73b`) `WAITING_FOR_REVIEW`** (`appVersionState` `WAITING_FOR_REVIEW`, `AFTER_APPROVAL`, no phased release) on build 1.0.72.1 (`6288dd5d`, `VALID`). **11 review submissions: `b8a1dfc7` `WAITING_FOR_REVIEW` (submitted 2026-11-14 03:16:07 UTC), 10 `COMPLETE`.**
- No 1.0.73 record and no 1.0.73 train. 96 trains, 104 builds, every build `VALID`; newest builds 1.0.72.1, 1.0.71.1, 1.0.70.1.
- From 1.0.13 on, 25 trains have no record of their own, the same 25 the ledger accounts for. **No unaccounted gap.**
- **So the version is 1.0.73**: `origin/main`'s `frontend/package.json` reads 1.0.72, no `v1.0.73` tag exists, and App Store Connect holds no 1.0.73 record or train.

### 6. F-Droid (06:07 UTC; `scratchpad/deploy/fdroid-read.txt`)

f-droid.org publishes 1.0.68, 1.0.61 and 1.0.60 (`suggestedVersionCode` 10000684). fdroiddata `master`: `CurrentVersion` 1.0.71 / 10000714, `Builds` for 1.0.53, 1.0.55, 1.0.56, 1.0.60, 1.0.61, 1.0.68, 1.0.70 and 1.0.71, newest recipe commit `1cd59422` ("bot: Update SnowRaven to 10000714", 2026-11-12 08:18 UTC). Logs: 10000701/2/4 end `Successfully built ... from 849506a2...`; 10000711/2/4 and 10000721/2/4 answer 404. **Unchanged since the 1.0.72 ship:** 1.0.70 included and built, not yet published; 1.0.71 and 1.0.72 included and this tag not yet built. A 1.0.73 tag will most likely be the one the bot adds next, which would leave 1.0.72 superseded on F-Droid by 1.0.73 at no cost. This release changes no toolchain pin and no recipe build step, so nothing is owed to fdroiddata.

### 7. The release machine (read-only, 06:08 UTC; `scratchpad/deploy/readiness.txt`)

- **Login keychain unlocked** (`security show-keychain-info` answered `no-timeout`, exit 0).
- Three valid code-signing identities: Developer ID Application, Apple Development, Apple Distribution (team `8QKC3L2FKP`).
- Release environment set in the login shell (`APPLE_SIGNING_IDENTITY`, `APPLE_API_KEY_PATH` with its file present, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID`); values not printed.
- Present: the updater signing key (`~/.tauri/snowraven-signing.key`, 0600), the Developer ID profile (to 2044-08-27), the iOS App Store profiles "SnowRaven iOS App Store iCloud AppGroup 20260924" and "SnowRaven Widgets App Store" (both to 2027-07-05), the export options plist, the Android keystore and its properties file (both 0600), and the ASC metadata key (0600).
- Node 24.18.0, cargo 1.96.1 with every Apple and Android target the skill names; `gh` logged in with `repo` and `workflow` scopes.
- Xcode 27.2 (27B52), iOS SDK 27.2, **`-checkFirstLaunchStatus` exit 0** (no first-launch install owed). Android build-tools 36.0.0 and exactly one NDK, 27.2.12479018.
- **This worktree has no root `node_modules`**, and its `src-tauri/target` is cold: the execution phase runs the root `npm ci` before the iOS build, and the first iOS build here compiles from cold, so the `swift` shim is required and the build is slower than from the main checkout.

### 8. The version set, committed locally as `23dc1dab`

`chore(release): 1.0.73, Search finds the places in your eBird backup`, nine files:

- `frontend/package.json` and `frontend/package-lock.json` (its two top-level version strings): 1.0.73.
- `src-tauri/tauri.conf.json`: 1.0.73, `bundle.android.versionCode` 1000073.
- `CHANGELOG.md`: a `## [1.0.73] - 2026-11-13` entry: under Added, the approved sentence alone, in bold; under Fixed, one plain line, "Choosing a bird in Search while a map on Statistics or Named Birds is fullscreen no longer leaves the page unable to scroll."; and two Internal lines. No em dash added (the file's count is unchanged at 352, all in older entries).
- `website/index.html`: the pill text `v1.0.73`, its `aria-label="Version 1.0.73"`, and the footer `SnowRaven v1.0.73`, nothing else (no `1.0.72` left in the file).
- `fastlane/metadata/android/en-US/changelogs/10000731.txt`, `10000732.txt`, `10000734.txt`: the approved sentence exactly and a newline, 92 bytes each, identical (SHA-256 `ff73f214c157316deb47959b4a6e64f826f22918fb70570f35f0ff28bb1279e2`); none under the unsplit code.
- `pipeline/android-release/fdroid/com.dtgibson.snowraven.yml`: `versionName` 1.0.73 three times, codes 10000731, 10000732 and 10000734, `CurrentVersion` 1.0.73, `CurrentVersionCode` 10000734. **Its three `commit:` lines stay at 1.0.72's hash** and move to the tag's full hash after the tag exists (the release phase).

Guards: `icloudKeysPublishedClaims` (the pill and footer row), `androidVersionSource`, `fastlaneMetadata`, `fdroidRecipe`, `iosSceneManifest`, `androidProjectPins`, `androidLicense` and `iosWidgetManifest`: **8 files, 213 of 213 green.** Mutations, each restored and checked byte-identical: one Fastlane file missing (2 red), the recipe's `CurrentVersion` left at 1.0.72 (4 red), `versionCode` left at 1000072 (1 red). The pill guard's known blind spot (one `toContain` over the whole file, and the `aria-label` can never fail it) was covered by reading the three strings by hand.

**Deferred to the release phase, as the skill directs:** the recipe's `commit:` lines (need the tag); the iOS plist stamp (`tauri ios build` writes it; committed after the archive); the `CHANGELOG.md` date, which moves to the ship date if the release lands after 2026-11-13 local.

**Final checks on the release commit `23dc1dab`** (22:09 to 22:11 PST, load 2.1 at the start, 17 at the end from other work on the machine): `npm run typecheck` exit 0; `npm run build` exit 0; **the full vitest suite: 523 files passed, 5 skipped; 11,390 tests passed, 9 skipped (11,399), 0 failed.**

### 9. The CI position

Every Pipeline run on `main` since 1.0.67 is red on timing-ratio rows, and the standing rule (life-list-region-filter D-12, applied as written at 1.0.72, D-15 there) accepts a run of record only when every failure is a `lifeListsLinearity.test.ts` row under twice its limit, Backend is green and nothing else fails. Read on the last three runs:

| Run | Commit | Failures | Under D-12 |
|---|---|---|---|
| `43535112529` | `21771893` | 3 `lifeListsLinearity` rows, worst 37.67 / 20 (1.88x) | accepted |
| `43550873079` | `bf7b099f` | 4 `lifeListsLinearity` rows, worst 32.38 / 25.55 (1.27x) | accepted |
| `43552440645` | `2cef2329` (`origin/main` now) | `alphaCodes.test.ts` "published names, a code query" 3.68 / 3.2, and a `lifeListsLinearity` row at 42.73 / 20 (2.14x) | **would stop the ship** |

**New with this build:** `paletteLocationsLinearity.test.ts` holds four timing rows of the same shape, which read 0.47 to 0.52 of their limits on this Mac (`qa-report.md`). The D-12 entry measured CI at about twice this Mac for `lifeListsLinearity`, so these rows may read near or over their limits on GitHub's runner, and **D-12 as written does not cover them: any such failure stops the ship before `./release.sh`.** That is a decision for the sign-off (hand-back).

### 10. Cargo: what a push of this branch to `main` carries (`git log origin/main..HEAD`)

| Commit | Class |
|---|---|
| `bd160b5f` feat(search) | this build's own |
| `fbb980f7` docs(rules) | this build's own (rule-file gates) |
| `77f888c6` docs(pipeline) | record-keeping only |
| `cb8b78f4` the merge of `origin/main` | carries nothing new to `origin` (its other parent is `origin/main`) |
| `23dc1dab` chore(release) 1.0.73 | this build's release commit |
| the commit carrying this record | record-keeping only |

**Nothing from another build or manual work.** The push is a fast-forward of `origin/main`.

### 11. The release plan for the execution phase (in order)

0. **Re-read before anything moves:** keychain; `git fetch origin --tags` (if `origin/main` moved past `2cef2329`, merge it again, re-run typecheck, build, the full suite and the version guards, and tag the new HEAD rather than `23dc1dab`); no `v1.0.73` on origin; no release process running; 1.0.72's App Store state (it decides the App Store option, step 9). Move the `CHANGELOG.md` date to the ship date if needed (one commit).
1. **Tag:** annotated `v1.0.73` on the release commit; push the tag alone (`git push origin v1.0.73`). Starts Windows Build and Android Build; it is the commit F-Droid builds from, and `10000731/2/4.txt` must be in it (they are).
2. **Recipe:** move the three `commit:` lines to `git rev-parse v1.0.73^{commit}` (full 40 characters), run `fdroidRecipe`, `fastlaneMetadata` and `androidVersionSource`, commit `fix(fdroid): the recipe names v1.0.73's commit`, then **push this branch to `main` as a fast-forward** (`git push origin HEAD:main`). Pages redeploys the website with the 1.0.73 pill and footer; check the live `index.html` against the committed file.
3. **iOS, during the CI wait** (no device): root `npm ci` in this worktree; the widget extension's Swift tests on a simulator (`-test-timeouts-enabled YES`), none left booted; move any `src-tauri/gen/apple/build/snowraven_iOS.xcarchive` aside (unconditional); recreate the three `/tmp/xcshim` shims (`xcodebuild`, `xcrun`, `swift`) first on `PATH`; `DEVELOPER_DIR` exported; `xcrun --sdk iphoneos --show-sdk-version` 27.1 or later; the Tauri signing names mapped from the login shell; `tauri ios build --export-method app-store-connect --build-number 1` outside the Bash sandbox (its own export will refuse with a cloud-signing wording, expected); confirm the fresh archive by its stamped `CFBundleVersion` 1.0.73.1, every `out/swift-rs/**/lib*.a` `platform 2` and `vtool` `platform IOS` (cold target); restore any `project.pbxproj` re-quoting; sign the archived `snowraven_widgets.appex` with its entitlements and confirm the App Group; manual `xcodebuild -exportArchive` with `~/.tauri/snowraven-ios-export-options.plist`; read `DistributionSummary.plist` (both bundles, the App Group on each, the app's three iCloud keys, `iCloudContainerEnvironment` Production); **`altool --validate-app` first, then `--upload-app`** with `DEVELOPER_DIR` exported in that shell; commit the stamp (`chore(ios): stamp iOS 1.0.73 build 1`, with the widget plist's `CFBundleVersion`) and push it. Its Pipeline run is the run of record (the run on the recipe commit is most likely cancelled by that push, as at 1.0.72, which the skill expects).
4. **CI:** Windows Build and Android Build green on the tag's commit, read with `--commit <tag sha>`; the run of record judged under D-12 as the user decides at the sign-off (section 9). A stop there goes to the user before `./release.sh`.
5. **Desktop:** `CI=true zsh -lc ./release.sh` from this worktree, alone on the machine (it builds into the shared `~/.snowraven-build`); then download the DMG back and require `codesign --verify`, `xcrun stapler validate` and `spctl ... accepted, Notarized Developer ID`; check `latest.json` (both darwin keys on the universal bundle, the Windows `-setup.exe`, every signature valid against the updater key) and that the published installer is byte-identical to the tag's Windows run artifact.
6. **Android:** the build-shell exports; `scripts/android/preflight.sh`; `sign.sh` with `SNOWRAVEN_ANDROID_SIGNER_SHA256=42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a`; the API 36 emulator opening check of the exact signed bytes (`-gpu host`, every `adb` call by serial `emulator-5554`; screenshots; crash buffer before and after); the WebView version read (133 unless the image changed); `attach.sh` with `ANDROID_DEVICE_CHECK=partial` (the standing no-device decision) and the checked file's SHA-256; downloaded back byte-identical.
7. **F-Droid:** the three-read after the tag; nothing sent to fdroiddata.
8. **TestFlight:** 1.0.73 (1) `VALID`; then **the user's iPhone check** (section 12) before anything is submitted.
9. **App Store**, on the option the user picks at the sign-off (below), after the iPhone check: every listing field read back against `appstore/LISTING.md` (the promotional text has arrived empty on 19 new records), the age rating checked on the editable app info, `asc-screens.mjs readback` to ALL MATCH (21 of 21; no frame changes this release), then the submission (`POST /v1/reviewSubmissions`, the item, `submitted: true`) and a read-back after it.
10. **`RELEASE_LEDGER.md`** in the same ship: the App Store sentence for 1.0.73 (and 1.0.72's disposition: rolled up, resolved, or deferred-behind in writing); the Android sentence for 1.0.73 with the APK's SHA-256 and signer; F-Droid updates in the 1.0.70 to 1.0.72 entries.

**Waits on the user:** the release sign-off; the CI-position decision (section 9); if the rollup is chosen, a yes on the combined What's New text; the iPhone check before the App Store submission. A keychain unlock only if the Mac restarts before the release (it is unlocked now). The Android device check is Partial under the standing decision and asks nothing of the user.

### App Store options, given 1.0.72 is `WAITING_FOR_REVIEW`

App Store Connect keeps one open (in preparation or in review) version per platform, so a separate 1.0.73 record cannot be created while 1.0.72's record is open.

| Option | What it involves | Cost |
|---|---|---|
| **A. Roll 1.0.72 up into 1.0.73 (recommended)** | After the iPhone check: re-read; if 1.0.72 is still `WAITING_FOR_REVIEW`, withdraw it (`DELETE /v1/appStoreVersionSubmissions/e674c73b...`, the record goes to `DEVELOPER_REJECTED`), `PATCH` the same record's `versionString` to 1.0.73, `PATCH` its build to 1.0.73.1, write the combined What's New, read every field back, check the screenshots (the record keeps them), resubmit through the new flow. The ledger names 1.0.72 as rolled into 1.0.73 with both record and submission ids. | 1.0.72 gives up the review time it has queued (submitted 03:16 UTC). Combined What's New is new published copy: one yes owed. The run closes with the App Store leg submitted. The ledger's usual handling of a predecessor still in review (most recently 1.0.62 into 1.0.63, 1.0.64 into 1.0.65 and 1.0.65 into 1.0.66, each withdrawn from `WAITING_FOR_REVIEW`). |
| B. Defer 1.0.73 behind 1.0.72 | Ship every other leg and TestFlight 1.0.73 now; leave 1.0.72 in review; once it is `READY_FOR_SALE`, a later session creates a plain 1.0.73 record on build 1.0.73.1 and submits it. Written in the ledger as a deferral with its reason. | 1.0.72 keeps its queue place; 1.0.73 reaches the App Store a review cycle later, and the App Store leg stays open after this run (the deferral is exactly the evidence shape of a skip unless its sentence is written). |
| C. Plain new record | Applies only if Apple approves 1.0.72 before the App Store leg (`releaseType` `AFTER_APPROVAL` releases it on approval, so it reads `READY_FOR_SALE`). A new 1.0.73 record with 1.0.73's What's New alone. | None; the leg re-reads the state and takes this path automatically if it applies. |

**Recommendation: A, falling back to C automatically if 1.0.72 has been approved by the time the App Store leg runs.** It finishes the run with every leg submitted, follows the ledger's usual handling of an in-review predecessor, and costs only the hours 1.0.72 has queued.

**Proposed combined What's New for A** (new published copy, held for the user's yes; both sentences are the user's own approved text, unchanged, older first as in the 1.0.70 rollup; 195 characters):

> Hotspot Reports now opens each place's report with an at a glance summary and puts the life list last.
>
> Search now finds the places in your eBird backup and opens each one's Hotspot Reports page.

The F-Droid files stay 1.0.73's sentence alone (F-Droid takes each version's changelog by its own code).

### 12. The device check the user will be asked for (only what this release touches)

Install TestFlight build **1.0.73 (1)**, the exact uploaded build, on your iPhone, then:

1. Open SnowRaven.
2. Open Search (the Search button, or Cmd-K on a keyboard), type part of a place name from your eBird backup, and choose that place from the Locations group.
3. Confirm Hotspot Reports opens on that place's report.

No widget steps: nothing in 1.0.73 touches the widgets, the vendored tao or any native iOS code (the merge brought none either: under `src-tauri/` it changed only `tauri.conf.json` and 1.0.72's two plist stamps, and this build changes nothing under `src-tauri/` but the version set).

## Part two: the release, phase 1 (2026-11-13 PST 22:16 onward; 2026-11-14 UTC 06:16 onward)

Run by The Deployer on the user's answers at the release gate, relayed by the Guide and recorded as G-01 to G-03 in `decisions.md`: "Confirm: release 1.0.73 now"; the App Store route "Roll 1.0.72 into 1.0.73" with the combined What's New approved (phase 2); and the CI rule extended to `paletteLocationsLinearity.test.ts` timing rows under twice their limit. Phase 1 is every leg up to and including the TestFlight upload; nothing is written to App Store Connect in this phase. No physical device and no iOS simulator is touched (the Guide's direction for this phase); the local Android emulator only.

0. **Starting state** (06:17 UTC, 22:17 PST): `git fetch origin --tags`: `origin/main` still `2cef2329`, no `v1.0.73` on origin, newest release `v1.0.72`, no workflow running; no `release.sh`, `notarytool`, `altool`, `xcodebuild`, `tauri` or `gradle` process (the 1.0.72 `log stream` PID 78124 still running, left alone); keychain `no-timeout` (unlocked). The local date is still 2026-11-13, so the CHANGELOG date stands.
1. **`2d5fbbeb`** `docs(pipeline): the 1.0.73 release sign-off and the CI allowance` (G-01 to G-03 here; the D-12 extension appended under D-12 in `pipeline/life-list-region-filter/decisions.md`).
2. **Tag.** Annotated **`v1.0.73`** (tag object `37b316a2901c3e22fe07c5dcffcaf27fb945afeb`) on the release commit **`23dc1dabec44f278fb69e7c3b14cf3710f6d7d01`**; at the tag `tauri.conf.json` reads 1.0.73 / 1000073 and `10000731/2/4.txt` are present. Pushed alone at 06:18:00 UTC. Windows Build `43565659858` and Android Build `43565659875` started on it.
3. **`b73bc44b`** `fix(fdroid): the recipe names v1.0.73's commit` (`fdroidRecipe`, `fastlaneMetadata`, `androidVersionSource` 57 of 57), then **`main` pushed as a fast-forward**, `2cef2329..b73bc44b`, at 06:18:13 UTC (`origin/main` re-read at `2cef2329` immediately before). Pipeline `43565677820` and Pages `43565677867` started on it.
4. **Website** (Pages `43565677867` success): https://snowraven.dtgibson.com/ answers 200 with last-modified 06:18:34 GMT, its `index.html` byte-identical to the committed file (`v1.0.73` pill, `aria-label="Version 1.0.73"`, `SnowRaven v1.0.73` footer).
5. **iOS** (during the CI wait; logs in the session scratchpad under `deploy/`):
   - Root `npm ci` in this worktree (it had no root `node_modules`); the three shims (`xcodebuild`, `xcrun`, `swift`) recreated in the scratchpad and first on `PATH`; Xcode 27.2, `xcrun --sdk iphoneos --show-sdk-version` 27.2; no earlier archive existed in this worktree (`src-tauri/gen/apple/build` absent), so nothing needed moving aside. iOS icons: all 36 PNGs `hasAlpha: no`.
   - **The widget extension's Swift tests were not run this time:** they run on an iOS simulator, and the Guide's direction for this phase excludes any simulator. Nothing in 1.0.73 touches the widgets, their Swift sources or any native iOS code.
   - `tauri ios build --export-method app-store-connect --build-number 1`, outside the Bash sandbox through a login shell with the three signing variables mapped (06:18:55 to 06:21:58 UTC; the cold Rust build took 1 min 31 s): **`** BUILD SUCCEEDED **`**, and Tauri's own export refused with the skill's third wording ("No Account for Team "Tauri"", "No profiles for 'com.dtgibson.snowraven' / '...widgets' were found"), expected. The fresh archive reads **1.0.73 / 1.0.73.1** (created 22:21:55 PST); `vtool -show-build`: `platform IOS`, minos 16.0, sdk 27.2; all 9 `swift-rs` libraries `platform 2` (iOS), so the `swift` shim held on the cold target. The build re-quoted the two `PRODUCT_NAME` lines in `project.pbxproj`; restored to HEAD.
   - The archived `snowraven_widgets.appex` was `not signed at all`; signed ad hoc with its entitlements, it lists `group.com.dtgibson.snowraven`.
   - Manual `xcodebuild -exportArchive` with `~/.tauri/snowraven-ios-export-options.plist`: **`** EXPORT SUCCEEDED **`**. `DistributionSummary.plist`: both bundles at 1.0.73 (1.0.73.1), Apple Distribution `1861F7A4`, team `8QKC3L2FKP`; the app on "SnowRaven iOS App Store iCloud AppGroup 20260924" with the App Group, `icloud-container-environment` Production, the container and ubiquity identifiers and `CloudDocuments`; the appex on "SnowRaven Widgets App Store" with the App Group and nothing else. IPA SHA-256 `6b7dbe326551669de2d419c9a7423861ee40577bce3f47950c5ecc2909a56743` (16,549,717 bytes).
   - **`altool --validate-app`: `VERIFY SUCCEEDED with no errors`** (06:22:48 to 06:23:40 UTC); **`--upload-app`: `UPLOAD SUCCEEDED with no errors`** (06:23:47 to 06:24:41 UTC), **Delivery UUID `1c7b8d90-8313-4048-8e0d-bb6f1f3782ba`** (plus the routine `CDUploaderStateInfoResumeFilePath` line).
   - The stamp (`snowraven_iOS/Info.plist` 1.0.73 / 1.0.73.1, the widget extension's `CFBundleVersion` 1.0.73.1; `iosSceneManifest`, `iosWidgetManifest`, `iosAlertsManifest` 67 of 67) committed as **`ad2871bc`** `chore(ios): stamp iOS 1.0.73 build 1` and pushed at 06:24:56 UTC (`b73bc44b..ad2871bc`). Its Pipeline run, `43566222841`, is the run of record.
6. **TestFlight** (GET only, 06:35:51 UTC): build **1.0.73.1**, id **`1c7b8d90-8313-4048-8e0d-bb6f1f3782ba`**, on the new train 1.0.73 (`7305c35c`), **`VALID`**, uploaded 22:25:28 PST, min OS 16.0. Nothing was written to App Store Connect.
7. **CI on the tag's commit `23dc1dab`:** **Windows Build `43565659858` success** and **Android Build `43565659875` success** (06:36:59 UTC). Pipeline `43565677820` on `b73bc44b` was cancelled by the stamp push, as the skill expects.
8. **The run of record, Pipeline `43566222841` on the stamp `ad2871bc`** (finished 06:37:10 UTC), judged under D-12 as extended by G-03: Backend **green**; Frontend **red, 6 failed, 11,364 passed, 29 skipped (11,399); 1 file failed, 522 passed, 5 skipped**. `paletteLocationsLinearity.test.ts` passed (9 of 9) and nothing outside `lifeListsLinearity.test.ts` failed. Every failure is a `lifeListsLinearity.test.ts` timing row:

   | Row | Reading / limit | Times the limit |
   |---|---|---|
   | pass 1, every row its own species | 22.27 / 20 | 1.11 |
   | pass 1R, every row its own species and (state, county) | 29.87 / 25.55 | 1.17 |
   | **pass 2R, every row its own species and (state, county)** | **48.16 / 20** | **2.41** |
   | pass 2R, every row its own species, 20 counties in 4 states | 20.82 / 20 | 1.04 |
   | pass 1R, 200 species repeated, every row its own (state, county) | 27.25 / 25.55 | 1.07 |
   | pass 2R, 200 species repeated, every row its own (state, county) | 20.14 / 20 | 1.01 |

   **One row is over twice its limit, so the run of record is NOT accepted under the rule as answered: the release stops here, before `./release.sh`, and goes back to the Guide with these numbers.** The same row read 42.73 / 20 (2.14x) on `43552440645` (`2cef2329`, 1.0.72's closeout) and 44.88 / 20 (2.24x) on 1.0.71's run of record; this release touches no Life Lists file. Locally the full suite passed twice on this tree (section 3 and section 8 of part one).
9. **Android, the parts that publish nothing** (the build shell as the skill lists; `SNOWRAVEN_ANDROID_SIGNER_SHA256` set to the recorded digest):
   - `preflight.sh` **exit 0**, every check `ok`; its one warning (HEAD is not the tag's commit) is expected. Run `43565659875`'s artifact `SnowRaven_1.0.73_android_universal_unsigned.apk` (SHA-256 `d9768a524efe120a6145c486bbc032ae8d471f728a6f3192ee5445e484edddf5`), `com.dtgibson.snowraven` 1.0.73 / 1000073, not debuggable.
   - `sign.sh` **exit 0**: v2 and v3 (v1 off); signer equals the keystore's certificate and the recorded digest: **`Signer #1 certificate SHA-256 digest: 42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a`** (DN `CN=SnowRaven, O=Dave Gibson`). **Signed APK SHA-256 `548b8687ddb682854d25537c7d7ec4c17f6aa155b35dacc7045e4380fb530f99`**, kept at the path `sign.sh` printed and copied byte-identical to the session scratchpad (`deploy/apk/`). No password was printed or passed on a command line.
   - **Emulator check** on the local API 36 image only (`sr-api36-phone`, port 5554, headless, `-gpu host`, `-no-snapshot-save`; every `adb` call addressed to `emulator-5554` by serial; no device listing taken; SnowRaven not installed before). The exact signed bytes (hash re-read equal) installed: `versionName` 1.0.73, `versionCode` 1000073, minSdk 26, targetSdk 36; cold start `Status: ok`, `COLD`, 544 ms. It opened to the Welcome screen; "Explore the app first" drew Weather with both key notices; the More sheet listed Search and all nine destinations, Hotspot Reports among them, with Settings in its foot; **Search, opened from the More sheet with "pond" typed, drew the new "Species and locations" heading and the no-backup sentence for species and locations**; Hotspot Reports drew its eBird Backup Required state (`evidence/ship/api36-1.0.73-*.png`). The crash buffer held 40 lines from the emulator's boot before the install (cleared then, as on the 1.0.70 first boot) and **0 after** the screens; the main log held no `FATAL EXCEPTION`; the app was alive at the end. Nothing was sent to eBird or OpenWeather. The emulator was stopped.
   - **WebView:** `com.google.android.webview` 133.0.6943.137: **WebView 133, unchanged since the last measurement.**
   - **Not attached:** `attach.sh` needs the `v1.0.73` GitHub release, which `./release.sh` creates, and that is held by the stop above.

### State at this stop (2026-11-14, 06:41 UTC; 2026-11-13 22:41 PST)

| Leg | State |
|---|---|
| Tag | `v1.0.73` (tag object `37b316a2`) on `23dc1dab`, pushed |
| `main` | at `ad2871bc` (the stamp), plus this record once pushed |
| Website | live at 1.0.73 (Pages `43565677867`); its download links point at `releases/latest`, which still serves 1.0.72 |
| macOS, Windows, updater | **not released**: `./release.sh` not run; no `v1.0.73` GitHub release; `latest.json` still 1.0.72; the Windows installer exists only as the tag's CI artifact (`43565659858`) |
| Android | CI artifact signed (signer `42a3576e...996a`, SHA-256 `548b8687...0f99`), emulator check done; **not attached** |
| iOS TestFlight | 1.0.73.1 `1c7b8d90` **VALID**; the user's iPhone check passed (G-04) |
| App Store | nothing written; 1.0.72 (`e674c73b`) still `WAITING_FOR_REVIEW` (submission `b8a1dfc7`), read 06:40 UTC; no 1.0.73 record; 97 trains, 105 builds, every build `VALID`; 1.0.73 now has a train and, until phase 2, no record (the 26th such train, the other 25 accounted for in the ledger) |
| F-Droid | nothing sent; not re-read since part one |
| Ledger | not yet written for 1.0.73 |

### The CI stop and the re-run (the Guide's decision, 2026-11-14 06:41 UTC)

The Guide's decision on the stop: re-run the failed job of the run of record ONCE and judge the new reading by the user's rule exactly as written; the 2.41 reading is not accepted and the rule is not changed.

10. **`gh run rerun 43566222841 --failed`** at 06:41:38 UTC (attempt 2 of the same run, the same commit `ad2871bc`; only the Frontend job re-ran, Backend's attempt-1 success stands). **The second reading the Guide asked to note, Pipeline `43567511505` on the record-only commit `f7cd2877` (same app code), does not exist:** the workflow's concurrency group (`pipeline-${{ github.ref }}`, `cancel-in-progress: true`) cancelled it when the re-run was queued on the same ref.
11. **Attempt 2 finished 06:51:23 UTC, red at the test step: 4 failed, 11,366 passed, 29 skipped (11,399); every failure a `lifeListsLinearity.test.ts` timing row under twice its limit; `paletteLocationsLinearity.test.ts` 9 of 9 and `alphaCodes.test.ts` 15 of 15 passed; nothing else failed.** Build and the real-engine gate were skipped after the red test step, as on every run since 1.0.67.

   | Row | Attempt 1 (stopped) | Attempt 2 (accepted) |
   |---|---|---|
   | pass 1, every row its own species | 22.27 / 20 (1.11) | 21.43 / 20 (1.07) |
   | pass 1R, own species and own (state, county) | 29.87 / 25.55 (1.17) | passed |
   | **pass 2R, own species and own (state, county)** | **48.16 / 20 (2.41)** | **30.67 / 20 (1.53)** |
   | pass 2R, 20 counties in 4 states | 20.82 / 20 (1.04) | 22.07 / 20 (1.10) |
   | pass 1R, 200 species repeated | 27.25 / 25.55 (1.07) | passed |
   | pass 2R, 200 species repeated | 20.14 / 20 (1.01) | 20.71 / 20 (1.04) |

   The pass-2R own-species-and-pair row's history on GitHub's runner: 44.88 / 20 (2.24x) on 1.0.71's run of record, 42.73 / 20 (2.14x) on `43552440645` (`2cef2329`, 1.0.72's closeout), 48.16 / 20 (2.41x) on attempt 1 here, 30.67 / 20 (1.53x) on attempt 2. **The rule as answered (G-03) is met by attempt 2, and the accepted run is a re-run of the same commit, not a new commit's run.** Recorded beside D-12 as well. `./release.sh` started after this reading.
