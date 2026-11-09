# Deployment record: ebird-store-hygiene (1.0.69)

## Part one: preparation (2026-11-09, about 07:40 to 07:55 UTC; 2026-11-08, 23:40 to 23:55 PST), hands-off

Run by The Deployer (Improve lane, the ship stage) as a prep-only invocation, on `main` in the main checkout. Nothing was committed, tagged, pushed, released, built for a store or uploaded, and no held copy was written into a live file. GitHub, App Store Connect (GET only, metadata key) and F-Droid were only read. Nothing was sent to eBird, and no device or emulator was touched (no `adb` or `simctl` call). The production sign-off is the next gate, and part two runs on its recorded answer.

### Preconditions

- **The Tester PASSED** (`qa-report.md`, gitignored, on disk): Tier 2 full weave, 14 of 14 criteria after one needs-fix round (criterion 5, the TTL mutation isolation), plus a round-3 delta after the security notes. Full frontend suite 10,803 passed, 2 failed, 6 skipped; the two failures are the `fastlaneMetadata.test.ts` rows that wait for the held F-Droid changelogs, and they pass with the held patch applied in a scratch copy. Backend 2,080 passed, ruff clean; build, lint and typecheck exit 0.
- **The Auditor PASSED WITH NOTES** (`security-report.md`, gitignored, on disk): nothing above Low. L1, I1 and I3 resolved; I2's code fix and L2 in the idea inbox (`c5fa8455`, `3eb8682b`); I4 is the Chronicler's (CLAUDE.md's "not yet windowed" sentence, D-09); I5 is the user's choice of privacy wording at this gate.
- No staging environment, as at every SnowRaven ship, so the production sign-off is the one gate. No key, environment variable, host or provider setting is needed, so there is no external setup to offer.

### Repository state (`git fetch origin --tags`, 07:43:45 UTC)

- `origin/main` is `4bd29f97` (`chore: context update after escapee-check-new-taxonomy`), equal to local `main`: nothing ahead, nothing behind. Only `origin/main` exists remotely.
- Newest tag `v1.0.68` (tag object `f17124f4`, peeled to `93c10733`), locally and on origin. No `v1.0.69` anywhere. Release v1.0.68 (`438701895`) is Latest; no draft releases.
- The other worktree (`.claude/worktrees/life-list-filter-toggle-state`) was read by `git worktree list` and `git rev-list` only, never entered: at `481b9ee3`, 0 commits ahead of `main` and 20 behind. No ship is in flight there.
- Nothing of SnowRaven's running: no `release.sh`, cargo, tauri, xcodebuild, vitest, gradle or emulator; nothing holds `~/.snowraven-build`. The one dev server is another project's (`birdsim`'s Vite preview). **One leftover:** pid 41276, `/usr/bin/log stream --predicate process contains "altool" ...`, started 2026-11-08 18:46:49 PST (the 1.0.68 upload) and orphaned to launchd. It is read-only logging and blocks nothing; it was left alone.
- No 1.0.69 train or record in App Store Connect (below), so no other session has shipped this version.

### The version set (five of six written; the sixth held)

| File | Change |
|---|---|
| `frontend/package.json`, `frontend/package-lock.json` (two lines) | 1.0.68 to 1.0.69 |
| `src-tauri/tauri.conf.json` | `version` 1.0.69; `bundle.android.versionCode` 1000069 |
| `CHANGELOG.md` | `## [1.0.69] - 2026-11-08`: one Changed, two Fixed and five Internal bullets. The ship runs after midnight PST, so part two re-dates the heading to 2026-11-09 (the 1.0.67 rule: the heading carries the ship's PST date). |
| `website/index.html` | the version pill text, its `aria-label`, and the footer line; nothing else (a version stamp, no approval needed) |
| `pipeline/android-release/fdroid/com.dtgibson.snowraven.yml` | three `Builds` entries at 1.0.69 (10000691, 10000692, 10000694); `CurrentVersion` 1.0.69, `CurrentVersionCode` 10000694. The three `commit:` lines stay on 1.0.68's `93c107334316ac04228e336cdf62cda51b95244f` and move to `v1.0.69^{commit}` after the tag (D-08). |
| **Held:** the three F-Droid changelogs | in `held/held.patch`; `git apply --check` clean at this prep |

The iOS plists stay at 1.0.68 / 1.0.68.1 until `tauri ios build` stamps them (`iosSceneManifest.test.ts`'s "never leads" rule).

### CI on `main` (`evidence/ship/ci-read-1.0.69-prep.txt`)

- The last four completed Pipeline runs failed, each on the one known timing row and nothing else: `lifeListsLinearity.test.ts` "pass 1 (first sightings), every row its own species", CPU-time ratio against 20 of **23.80** (`42557718544` on `4bd29f97`), **22.46** (`42555006962` on `5f0a27b4`), **24.00** (`42552886222` on `ae9260d8`, 1.0.68's run of record) and **26.11** (`42540147018` on `a554bce9`). The latest: 1 failed, 10,772 passed, 27 skipped. Backend, lint and typecheck green in all four; build and the real-engine gate skipped after the red test step. Two runs in between were cancelled by the next push (`cancel-in-progress`).
- **1.0.69 touches nothing that row measures.** `lifeListsLinearity.test.ts` imports `../types`, `parseMLExport` (type only), `../test/cpuTiming`, `speciesUtils` and `lifeLists.ts`, which imports only `types`, `parseMLExport` and `speciesUtils`; none is in the diff (`LifeListsTab.tsx` and `lifeListsCopy.ts`, which are, are different modules).
- **Proposed handling, the rule 1.0.64 to 1.0.68 shipped under (D-17 of the 1.0.64 run):** judge the run of record, the Pipeline run on the iOS stamp commit (the stamp push cancels the tag commit's run), and continue only if its sole failure is that timing row. Any non-timing failure, or a failure in a test this release touches, stops the ship. **This release changes `backend/`, so the Backend job is a live check this time and must be green.** A re-run of the failed job is the alternative; at 1.0.67's prep no re-run of this row had ever come back green, so it costs a CI cycle for a likely-identical answer. Whether to re-run is the user's call at the gate.

### Rig readiness (read only, 07:44 to 07:50 UTC)

| Check | Result |
|---|---|
| Login keychain | `no-timeout`: unlocked (a reboot before part two would lock it again; then the user runs `security unlock-keychain ~/Library/Keychains/login.keychain-db` in their own terminal) |
| `gh` | signed in as `dtgibson` (scopes `repo`, `workflow`, `gist`, `read:org`) |
| Login shell | Node v24.18.0 (`.nvmrc` 24); cargo and rustc 1.96.1; Rust targets for both Mac slices, iOS device and simulator, and the Android ABIs; `APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID`, `APPLE_API_KEY_PATH` (file exists) and `APPLE_SIGNING_IDENTITY` (matches one identity) set. `release.sh` loads the updater key from `~/.tauri/snowraven-signing.key` itself and notarizes with the API key, so no `APPLE_ID` or `TAURI_SIGNING_PRIVATE_KEY` is needed in the environment. |
| Secrets (existence and mode only) | `~/.tauri/snowraven-signing.key` 600; ASC keys `QJA25M7XHM` and `BVVLBRRVL6` 600; Android keystore `~/.tauri/snowraven-android.p12` 600 and its properties file 600 (four keys present, alias `snowraven`, `storeFile` pointing at that keystore) |
| Signing identities | Developer ID Application, Apple Development and Apple Distribution (`1861F7A4...`), team `8QKC3L2FKP`: 3 valid |
| Profiles | Developer ID "SnowRaven Mac Developer ID 20260901" to 2044-08-27. The export plist (`~/.tauri/snowraven-ios-export-options.plist`: app-store-connect, manual, Apple Distribution, team `8QKC3L2FKP`, `iCloudContainerEnvironment` Production, `uploadSymbols` true) maps the app to "SnowRaven iOS App Store iCloud AppGroup 20260924" (`870fe004`) and the widgets to "SnowRaven Widgets App Store" (`50691228`), both installed under both profile directories, to 2027-07-05 |
| Xcode | 27.2 (27B52), iOS SDK 27.2, Swift 6.4.2 (the swift shim still applies); `xcodebuild -checkFirstLaunchStatus` exit 0. `/tmp/xcshim` holds all three shims but is recreated anyway |
| Leftover iOS archive | `src-tauri/gen/apple/build/snowraven_iOS.xcarchive` is **1.0.68 (1.0.68.1)**, from 18:44 PST: part two moves it aside first |
| Android | JDK 17.0.21.0.3; `apksigner` (0.9), `zipalign`, `aapt2` under build-tools 36.0.0; one NDK, 27.2.12479018; Gradle 8.14.3 at `~/.tauri/gradle-8.14.3`; `cargo tauri` 2.11.2; `toolchain.env` unchanged against HEAD; AVDs `sr-api24/26/30/36-phone`, `sr-api36-aosp`, `sr-api36-tablet` listed. Expected signer `42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a`, checked by `sign.sh` and `attach.sh` |
| Backend venv | rebuilt on Python 3.15.2 at 22:03 PST (`backend/.venv/pyvenv.cfg`), so backend pytest runs again (QA ran 2,080). The ROADMAP item "`backend/.venv` no longer starts on this Mac" is stale, for the Chronicler |

### App Store Connect (read only, metadata key, GET only, 07:45:45 UTC; `evidence/ship/asc-read-1.0.69-prep.txt`)

- **1.0.68 is still `WAITING_FOR_REVIEW`**: record `280db18b-3dfa-4a8b-b8af-4b8332586bd5` (`AFTER_APPROVAL`, no phased release) on build 1.0.68.1 `fcb30cde`, submission `a22d8c52-386e-46ab-9ac7-85fe40e88174` `WAITING_FOR_REVIEW` since 03:23:53 UTC, its one item `READY_FOR_REVIEW`. Not in review, not approved. Its en-US What's New (localization `e43cde44`) is the approved 571-character 1.0.67 + 1.0.68 rollup, byte-equal (SHA-256 `c885c3f1...e593b`); promotional text 137 characters.
- 32 version records: 1.0.68 waiting, 31 `READY_FOR_SALE` (1.0.66 on `ab6360bc` the live one). 11 review submissions: this one waiting, 10 `COMPLETE`.
- 92 TestFlight trains and 100 builds, every build `VALID`. No 1.0.69 train or record.
- From 1.0.13 on, 56 trains, 25 without a record of their own: the 24 accounted for through the 1.0.66 entry and 1.0.67 (rolled up into 1.0.68). **No unaccounted gap.**
- Two app infos: `8319b5dd` live and `285bfbfe` (with the 1.0.68 record, now `WAITING_FOR_REVIEW`), each age rating `FOUR_PLUS` with the declaration answered (30 fields: 16 `NONE`, 11 false, 3 null).

**The disposition for 1.0.69, proposed for the sign-off: the house rollup, 1.0.68 into 1.0.69**, decided by the state at the App Store step, which comes after the user's iPhone check of TestFlight 1.0.69 (1):
- **1.0.68 still `WAITING_FOR_REVIEW` (the case now):** withdraw it (`DELETE /v1/appStoreVersionSubmissions/280db18b...`, record to `DEVELOPER_REJECTED`), retarget the same record to `versionString` 1.0.69, repoint it at build 1.0.69.1, write the 942-character rollup What's New (`held/gate-copy-1.0.69.md` (b)), read every listing field back against `appstore/LISTING.md` and the review notes against `appstore/REVIEW_NOTES.md`, confirm the age rating on the editable app info, run `asc-screens.mjs readback` to `ALL MATCH`, then submit through `reviewSubmissions`. Ledger: 1.0.68 rolled up into 1.0.69 (VALID build 1.0.68.1, record `280db18b`, withdrawn submission `a22d8c52`, the new submission id), the precedent of 1.0.64 to 1.0.66.
- **1.0.68 approved or released first:** 1.0.69 gets a new record on build 1.0.69.1 with What's New = 1.0.69's note alone (369 characters).
- **1.0.68 in review:** leave the review undisturbed; 1.0.69 ends on TestFlight as a deferral written in the ledger (the 1.0.25 precedent), carried by the next record.

Mac, Windows and the Android APK for 1.0.68 are already live; only the App Store leg rolls up.

### F-Droid (public reads, 07:46 UTC; `evidence/ship/fdroid-read-1.0.69-prep.txt`)

- f-droid.org publishes 1.0.61, 1.0.60 and 1.0.59 (`suggestedVersionCode` 10000614).
- fdroiddata `master`: `CurrentVersion` 1.0.65 / 10000654; `Builds` for 1.0.53, 1.0.55, 1.0.56, 1.0.60, 1.0.61 and 1.0.65 (recipe SHA-256 `e85ab522...ed1d`, unchanged since the 1.0.68 ship's read). Newest recipe commit still `8970b26d` "keep latest" (2026-11-08 19:02 UTC); the bot's last run `3302f014` (09:54 UTC).
- Build logs for 10000651/2/4, 10000661/2/4, 10000671/2/4 and 10000681/2/4: all 404 (not attempted).
- **States, unchanged since 03:24 UTC:** 1.0.63 and 1.0.64 superseded on F-Droid by 1.0.65 (already in the ledger); 1.0.65, 1.0.66, 1.0.67 and 1.0.68 each included and this tag not yet built. The bot has run at about 09:00 to 10:00 UTC daily; a v1.0.69 tag pushed before its next run most likely leaves 1.0.66, 1.0.67 and 1.0.68 superseded on F-Droid by 1.0.69, which costs nothing.
- **Nothing goes to fdroiddata at 1.0.69:** `toolchain.env` is unchanged and the recipe diff moves only versions and codes.

### Cargo for the production gate

`git log origin/main..main`: none. The release carries this run's working tree and nothing else:

| Group | Files | Whose |
|---|---|---|
| App behavior | `lib/checklistProjectsCache.ts`, `checklistProjects.ts`, `hotspotActivityCache.ts`, `useHotspotActivity.ts`, `useExoticProvenance.ts`, `tauri/checklistService.ts`, `lifeListsCopy.ts`, `components/lifeLists/LifeListsTab.tsx`; `backend/services/ebird.py`, `backend/routers/checklists.py` (comment only); `docs/HELP.md` (bundled Help) | this build |
| Tests and fixture | the touched frontend suites, `checklistProvenance.fixture.json`, and three backend suites | this build |
| Rule files | `.claude/rules/security.md`, `.claude/rules/bird-names.md` | this build |
| Version set, five of six | above | this build |
| Record-keeping | `pipeline/ebird-store-hygiene/` (brief, decisions, PR description, `held/`, this record, `evidence/`); `qa-report.md` and `security-report.md` are gitignored and stay out | pre-approved cargo |
| Held, written only on the yes | the three F-Droid changelogs; the privacy sentence in `PRIVACY_POLICY.md` and `website/privacy.html` with its guard in `projectsPublishedClaims.test.ts` (the patch, or the stricter wording) | this build |

No commit from another build or from manual work rides along. After the tag: the recipe `commit:` move, the iOS stamp, and the record and ledger commits.

### Held copy for the gate (`held/gate-copy-1.0.69.md`)

- (a) F-Droid, 1.0.69's own text, 369 characters (SHA-256 of the file `ec1f42d5...7e6a`).
- (b) App Store What's New: the 942-character rollup (SHA-256 `5ac12277...a509`), or 1.0.69's note alone if 1.0.68 is approved first.
- (c) The privacy sentence: the held wording or the stricter alternative. Leaving it unchanged is not an option that stays true once 1.0.69 ships.

## Part two: 1.0.69 on every leg but the App Store record (2026-11-09, 17:03 to about 17:50 UTC; 09:03 to 09:50 PST), hands-off

Run by The Deployer on the user's answer at the production sign-off, relayed by the orchestrator: "Confirm, deploy to production now", with the held copy "All three, held privacy wording". The orchestrator applied `held/held.patch` to the live tree before this part (verified here: `git apply --check -R` clean, the three changelogs at SHA-256 `ec1f42d5...7e6a`). Decisions recorded with the answer: ship on the known Life Lists timing-only red; the App Store branch is taken from 1.0.68's state when re-read at the App Store step; What's New is the 942-character rollup on a rollup record, the 369-character line alone on an own record. Held in this invocation, as directed: no App Store version record was created or withdrawn (App Store Connect was read only, GET with the metadata key), and `RELEASE_LEDGER.md` was not written. No physical device was touched.

**Attribution.** The orchestrator asked for the trailer `Co-Authored-By: Claude Fable 5.1`. The commits below were written by Claude Opus 5.5 and carry `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, the line this session's own instructions give, as at 1.0.65 to 1.0.68: history carries the name of the model that wrote each commit.

### Steps

0. **Starting state** (17:03:27 UTC, 09:03 PST): keychain `no-timeout`; `git fetch origin --tags`: `origin/main` still `4bd29f97`, no `v1.0.69` locally or on origin, v1.0.68 the Latest release; nothing of SnowRaven's running. The held patch fully applied (`git apply --check -R` clean; `10000691/2/4.txt` each SHA-256 `ec1f42d5...7e6a`; no `1000069.txt`).
1. **CHANGELOG heading re-dated** to `## [1.0.69] - 2026-11-09` (the ship's PST date).
2. **Gates on the release tree** (nothing else of SnowRaven's running):
   - `npm run lint`, `npm run typecheck`, `npm run build`: exit 0 (entry `index-D-6oUVIg.js`; the large-chunk notice is pre-existing).
   - **Full vitest suite, alone: 495 files passed, 5 skipped; 10,807 tests passed, 6 skipped, 0 failed** (75.7 s). QA's 10,803 plus the two held-changelog rows, now green, plus the two rows the held patch adds to `projectsPublishedClaims.test.ts`.
   - **The real-engine gate**, `CI=true npm run verify -- ../../frontend/dist` in `website/tools`: **8/8 harnesses green, 253 PASS lines, 0 FAIL** (Chromium and WebKit).
   - **Backend: `pytest tests/ -q` 2,080 passed** (`backend/.venv` on Python 3.15.2); `ruff check .` all checks passed.
   - No em dash in shipped text over the 2,151 added lines and new files: the two that appear are in the unchanged half of an edited `.claude/rules/bird-names.md` line and the change brief's Weft heading; the other non-ASCII characters are box-drawing comment rules in `ebird.py` and `checklistService.ts`, the website footer's existing middot and an ellipsis in `decisions.md`.
3. **Commits:**

   | Commit | What |
   |---|---|
   | `8096b33a6062df2fef3416b75b459ee24dfdbcb0` | `fix(ebird): the last two eBird stores read the plausibility window; one verdict for an unreadable checklist`: the code, tests, fixture, `docs/HELP.md`, the two rule files and this run folder's durable files (39 files) |
   | `bdfef6a424014dbfe34d55120f3880e7e5bf7d3e` | `chore(release): 1.0.69, eBird store hygiene and Include Exotics on`: the version set, the three F-Droid changelogs, `PRIVACY_POLICY.md`, `website/privacy.html` and `projectsPublishedClaims.test.ts` (12 files) |
   | `bc5e9a934a0f403af081986b59c5a143119b18f9` | `fix(fdroid): the recipe names v1.0.69's commit`: the three `commit:` lines name `bdfef6a4...`; `fdroidRecipe`, `fastlaneMetadata`, `androidVersionSource` 57 of 57 first |
   | `2dac7cc7d93d8e7fe535ab984835d5c6df7a7101` | `chore(ios): stamp iOS 1.0.69 build 1`: the two Info.plists (step 7) |

   `qa-report.md` and `security-report.md` stay out (gitignored per-run files).
4. **Tag.** Annotated **`v1.0.69`** (tag object `74bedc61adc61ae618c2c41480b0ec7653ab6538`, "SnowRaven 1.0.69: eBird store hygiene, and Include Exotics starts on") on the release commit `bdfef6a4`; at the tag, `tauri.conf.json` and `package.json` read 1.0.69 / 1000069 and the three changelogs are present. Pushed **alone** at 17:12:29 UTC; `git ls-remote`: `refs/tags/v1.0.69` `74bedc61` peeled to `bdfef6a4`, `main` still `4bd29f97`.
5. **`main` pushed** at 17:12:46 UTC as a fast-forward, `4bd29f97..bc5e9a93`; the stamp `2dac7cc7` followed at 17:19:26 UTC (`bc5e9a93..2dac7cc7`).
6. **CI**, looked up pinned to the tag's commit: **Windows Build `42662342778` success** (17:22:45 UTC) and **Android Build `42662342775` success** (17:26:41 UTC), both on `bdfef6a424014dbfe34d55120f3880e7e5bf7d3e`. **Pages `42662388472` success** (17:13:13 UTC): the live site shows `aria-label="Version 1.0.69">v1.0.69` and `SnowRaven v1.0.69` (last-modified 17:13:05 GMT), and `privacy.html` carries the approved Projects sentence (1 match for "re-checked for a year unless it is dated more than a day ahead of your device's clock or you press Check again").
   - **Pipeline, judged under the recorded decision.** `42662388330` on `bc5e9a93` was cancelled by the stamp push, as expected under `cancel-in-progress`. **The run of record, `42663480494` on `2dac7cc7`, failed only on the known timing row**: `lifeListsLinearity.test.ts` "pass 1 (first sightings), every row its own species", CPU-time ratio 22.40 against 20 (1 failed, 10,784 passed, 27 skipped); **Backend green** (a live check this time: the release changes `backend/`), lint and typecheck green; build and the real-engine gate skipped after the test step and green locally (step 2). `git diff 4bd29f97 2dac7cc7` touches none of `lifeLists.ts`, `parseMLExport`, `speciesUtils`, `types.ts`, `cpuTiming` or the test. Ship continued.
7. **iOS** (during the CI wait):
   - The three `/tmp/xcshim` shims recreated; `xcrun --sdk iphoneos --show-sdk-version` **27.2** (Xcode 27.2, 27B52).
   - **Widget Swift tests: 143 tests, 0 failures, `** TEST SUCCEEDED **`** on the iPhone 17 simulator (`OS=latest`, `-test-timeouts-enabled YES`); no simulator left booted.
   - The leftover archive (1.0.68 / 1.0.68.1, 18:44 PST yesterday) moved aside as `snowraven_iOS-1.0.68.1-stale-before-1.0.69.xcarchive`, the eighth ship running to find one.
   - `tauri ios build --export-method app-store-connect --build-number 1`, outside the Bash sandbox with the three signing variables mapped from the login shell (17:14:15 to 17:16:12 UTC): **the archive `** BUILD SUCCEEDED **`**, and Tauri's own export refused with the skill's third wording ("No Account for Team "Tauri"", "No profiles for 'com.dtgibson.snowraven' / '...widgets' were found"), expected. The fresh archive reads **1.0.69 (1.0.69.1)**, created 17:16:10 UTC; its executable is `platform IOS`, `sdk 27.2`, `minos 16.0`; all 9 `swift-rs` libraries are `platform 2` (iOS).
   - The build again rewrote the two `PRODUCT_NAME = SnowRaven;` lines in `project.pbxproj` as `"SnowRaven"` (quoting only); restored to HEAD after the archive.
   - The archived `snowraven_widgets.appex` was `not signed at all`, as expected; signed ad hoc with `snowraven_widgets.entitlements`, it lists `group.com.dtgibson.snowraven`.
   - Manual `xcodebuild -exportArchive` with `~/.tauri/snowraven-ios-export-options.plist` into `src-tauri/gen/apple/build/export-1.0.69.1`: **`** EXPORT SUCCEEDED **`**. `DistributionSummary.plist`: both bundles at 1.0.69 / 1.0.69.1, Apple Distribution `1861F7A4...` to 2027-07-05, team `8QKC3L2FKP`; the appex with `application-groups` `group.com.dtgibson.snowraven` and nothing else, on "SnowRaven Widgets App Store"; the app with that group, `icloud-container-identifiers`, `icloud-services` (CloudDocuments), `ubiquity-container-identifiers` and `icloud-container-environment` Production, on "SnowRaven iOS App Store iCloud AppGroup 20260924". All 36 iOS icon PNGs in the repo and both in the IPA have no alpha channel. IPA 16,519,631 bytes, SHA-256 `810a681f7f30f11d7ce8ff33aec912652e9eb81d6202dea303eb46874ec2879f`; its Info.plist 1.0.69 / 1.0.69.1.
   - **`altool --validate-app`: `VERIFY SUCCEEDED with no errors`** (17:16:55 to 17:17:59 UTC); then **`--upload-app`** 17:18:05 to 17:19:12 UTC, `UPLOAD SUCCEEDED with no errors`, **Delivery UUID `f9d5df4a-a8ca-4f4d-bc53-7cba08686821`** (plus the routine `CDUploaderStateInfoResumeFilePath` log line).
   - The stamp: `snowraven_iOS/Info.plist` 1.0.69 / 1.0.69.1 and the widget extension's `CFBundleVersion` 1.0.69.1; `iosSceneManifest`, `iosWidgetManifest` and `iosAlertsManifest` 67 tests green; committed as `2dac7cc7`.
8. **Desktop.** `CI=true SKIP_NPM_INSTALL=1 zsh -lc ./release.sh` from the main checkout, alone on the machine on a clean tree (this part's evidence was kept in the session scratchpad until it finished), **exit 0** (17:34:53 to 17:39:38 UTC), started once Pipeline `42663480494` was judged: `Releasing v1.0.69: tag=bdfef6a4 HEAD=2dac7cc7`; iCloud profile OK; bundle version verified 1.0.69; iCloud entitlements and embedded profile verified; DMG styled, signed and verified; **notarization `740e9045-0946-450f-bd9c-61aeefe321fe` `Accepted`**, stapled; the Windows installer fetched from CI and signed locally; published. (Tauri's own "skipping app notarization" warning is its build step; `release.sh` notarizes the final DMG itself, as at every ship.)
   - **Release `439446738`**, https://github.com/dtgibson/snowraven/releases/tag/v1.0.69, published 2026-11-09 17:39:37 UTC, not a draft or pre-release, and **Latest**.

     | Asset | Bytes | SHA-256 |
     |---|---|---|
     | `latest.json` | 1,852 | `d3d092e629226e2ef8818b9d2bc845a83cefa2ec2622680db1f848f89a341af6` |
     | `SnowRaven-updater.app.tar.gz` | 31,288,666 | `221e0a38bd0fecb83df4c5a4a51302c5f4d31d7ae3f1bbb6e84fbff59a980a05` |
     | `SnowRaven-updater.app.tar.gz.sig` | 408 | `9d25062e3ff0da1f15f21a10248e7bf07795f2f32df1c1586bf228f62c5924d0` |
     | `SnowRaven_1.0.69_universal.dmg` | 31,624,535 | `72aa348c3bd095776758f4c608b3c11fb252a639db27d0d3f6f647a113b15c27` |
     | `SnowRaven_1.0.69_x64-setup.exe` | 10,241,984 | `9c20ec6079c2c54b2123398ff47c68d04e4b5280637845a8fe5afc20b044e5e3` |
     | `SnowRaven_1.0.69_x64-setup.exe.sig` | 420 | `12ad448045ea7cd5b61356870e8f3d6a9e5664d40994117f73c2aef9ef617be2` |
     | `SnowRaven_1.0.69_android_universal.apk` (step 9) | 79,287,938 | `b5efcbaef50c98801a082f51f59f59a3123b0c8bf9ba3e9509115a9c95ee7cd4` |

   - **The DMG, downloaded back from the release:** `codesign --verify --verbose=2` valid on disk and satisfies its Designated Requirement; `xcrun stapler validate` worked; `spctl -a -t open --context context:primary-signature -vv` **accepted, source=Notarized Developer ID**, origin `Developer ID Application: DAVID THOMAS GIBSON (8QKC3L2FKP)`; `hdiutil verify` checksum VALID.
   - **`latest.json`:** version 1.0.69, `pub_date` 2026-11-09T17:39:33Z; `darwin-aarch64` and `darwin-x86_64` identical, on `.../v1.0.69/SnowRaven-updater.app.tar.gz`; `windows-x86_64` on `.../v1.0.69/SnowRaven_1.0.69_x64-setup.exe`; each signature equals its `.sig` asset, and **both verify VALID** against the updater public key in `tauri.conf.json` (minisign prehashed Ed25519, key id `f80c63fb3b636306`, file and trusted-comment signatures both good), with a Node checker written for this ship and first proved on v1.0.68's published installer; its negative control (`latest.json` against the bundle's signature) reads INVALID, exit 1. `releases/latest/download/` answers 200 for `latest.json` (the same bytes), the DMG, the updater bundle, the installer and the APK.
   - **The updater bundle** unpacks to `SnowRaven.app` with `CFBundleShortVersionString` 1.0.69, a universal executable (`x86_64 arm64`), and passes `codesign --verify --deep --strict`.
   - **The published installer is byte-identical** to run `42662342778`'s artifact (`cmp`; SHA-256 `9c20ec60...44e5e3`).
9. **Android.** Build shell: JDK 17.0.21.0.3, `ANDROID_HOME`, `NDK_HOME` (27.2.12479018, the only NDK), Gradle 8.14.3 first on `PATH`, `SNOWRAVEN_ANDROID_SIGNER_SHA256` set to the recorded digest. Preflight, sign and the emulator check ran during the Pipeline wait, before `release.sh`; the attach after it.
   - `scripts/android/preflight.sh` **exit 0, every check `ok`**: the toolchain, the keystore (alias `snowraven`), the version pair 1.0.69 / 1000069, `v1.0.69` pushed at `bdfef6a42401` and carrying that pair, `10000691/2/4.txt` present at the tag, and run `42662342775`'s artifact `SnowRaven_1.0.69_android_universal_unsigned.apk` (`com.dtgibson.snowraven`, 1.0.69, 1000069, not debuggable). Its one warning, HEAD is not the tag's commit, is the recipe and stamp commits after the tag.
   - `scripts/android/sign.sh` **exit 0**: v2 and v3 (v1 off), `ok signer equals the keystore's certificate`, `ok signer equals the recorded digest`, **`Signer #1 certificate SHA-256 digest: 42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a`** (DN `CN=SnowRaven, O=Dave Gibson`). **Signed APK SHA-256 `b5efcbaef50c98801a082f51f59f59a3123b0c8bf9ba3e9509115a9c95ee7cd4`.** No password was printed or passed on a command line.
   - **Emulator check** on the local API 36 Google APIs image only (`sr-api36-phone`, port 5554, headless, `-gpu host`, `-no-snapshot-save`; booted 17:21 UTC; every `adb` call addressed to `emulator-5554` by serial; no device listing taken). No SnowRaven was installed before. The exact signed bytes (hash re-read equal) installed: `versionName` 1.0.69, `versionCode` 1000069, minSdk 26, targetSdk 36. Cold start `Status: ok`, `LaunchState: COLD`, `TotalTime` 348 ms, and the Welcome screen drew (`evidence/ship/api36-1.0.69-first-launch.png`); "Explore the app first" drew Weather with both key notices (`api36-1.0.69-explore.png`); More, then Life Lists drew its "eBird Backup Required" state (`api36-1.0.69-life-lists.png`). The Include Exotics switch appears only with a backup, which was not imported, so this release's visible change is checked by the tab's test row, QA's live look on the web build, and the user's iPhone check. No key was entered, so nothing was sent to eBird or OpenWeather. One SnowRaven process throughout (pid 4747), 0 `FATAL EXCEPTION` or ANR lines, nothing from SnowRaven in the crash buffer. Afterwards the app was uninstalled and the emulator stopped (`emu kill`, 17:29:06 UTC).
     - **WebView:** `com.google.android.webview` `versionName` 133.0.6943.137: **WebView 133, unchanged since the last measurement.**
   - **Attach:** `ANDROID_DEVICE_CHECK=partial ANDROID_CHECKED_SHA256=b5efcbae...7cd4 SNOWRAVEN_ANDROID_SIGNER_SHA256=42a3576e...996a scripts/android/attach.sh <signed apk>` **exit 0** (17:45:45 to 17:45:55 UTC). **Decision: Partial on API 36 emulator evidence, under the standing decision (CLAUDE.md, Versioning: the user owns no Android device);** the ledger sentence the script names is owed at the ledger step. Checks: signer equals the keystore's certificate, byte-identical to the checked file, `com.dtgibson.snowraven` 1.0.69 (1000069). Uploaded to v1.0.69 as **`SnowRaven_1.0.69_android_universal.apk`** and downloaded back: `ASSET_SHA256=b5efcbaef50c98801a082f51f59f59a3123b0c8bf9ba3e9509115a9c95ee7cd4`, `SIGNER_SHA256=42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a`.
10. **TestFlight** (GET only, the metadata key, 17:24:35, 17:32:24 and 17:46:05 UTC): **train 1.0.69 `aa4abcc0-aabf-4cf4-acf7-85a8428c5533`, build 1.0.69.1 `f9d5df4a-a8ca-4f4d-bc53-7cba08686821` `VALID`**, uploaded 09:20:18 PST, min OS 16.0, not expired; it read VALID about 13 minutes after the upload. No App Store version record was created, changed or withdrawn, and nothing was submitted.
11. **App Store state changed since part one** (GET only, 17:19:43 and 17:20:03 UTC; `evidence/ship/asc-read-1.0.69-ship.txt`): **1.0.68 is `READY_FOR_SALE`** on record `280db18b-3dfa-4a8b-b8af-4b8332586bd5` (`READY_FOR_DISTRIBUTION`), its submission `a22d8c52-386e-46ab-9ac7-85fe40e88174` `COMPLETE` and its one item `APPROVED`: Apple approved it after 07:45 UTC and it released on approval. 32 version records, all `READY_FOR_SALE`; 10 review submissions listed, all `COMPLETE`; 92 trains and 100 builds at 17:20 UTC (before 1.0.69.1 appeared), every build `VALID`; from 1.0.13 on, 25 trains without a record of their own, all accounted for. **So the rollup branch no longer applies: at the App Store step, 1.0.69 gets its own new record** on build 1.0.69.1, `AFTER_APPROVAL`, no phased release, with What's New the 369-character line alone (`held/gate-copy-1.0.69.md` (b), SHA-256 `b91d5062...7646`), the user-approved branch for this state. State is re-read immediately before that step.
12. **F-Droid** (public reads, 17:20 UTC; `evidence/ship/fdroid-read-1.0.69-ship.txt`): the bot ran at 08:20 UTC (`5c48e123`, "bot: Update SnowRaven to 10000684") and added **1.0.68** (10000681/2/4 on `93c10733`, `CurrentVersion` 1.0.68 / 10000684); then linsui's "keep latest" (`34866f26`, 09:18 UTC) removed exactly the three **1.0.65** entries. f-droid.org still publishes 1.0.61, 1.0.60 and 1.0.59 (`suggestedVersionCode` 10000614); the logs for 10000651/2/4 to 10000691/2/4 all answer 404. **States:** 1.0.65 superseded on F-Droid by 1.0.68 (pruned by `34866f26`); 1.0.66 and 1.0.67 superseded on F-Droid by 1.0.68 (the bot took the newest tag); 1.0.68 included and this tag not yet built; 1.0.69 included and this tag not yet built (tagged at 17:12 UTC, after the bot's run; its next run, about 08:00 to 10:00 UTC tomorrow, most likely adds it, and a keep-latest sweep may then leave 1.0.68 superseded by 1.0.69). Nothing was sent to fdroiddata: `toolchain.env` is unchanged and the recipe diff moves only versions, codes and commits.

Raw tool output: `evidence/ship/ship-1.0.69-part-two.txt`.

**Leftover, recorded:** altool's own read-only `log stream --predicate process contains "altool" ...` was orphaned again by this upload (pid 22902, started 09:18:15 PST); the 1.0.68 one (pid 41276) is gone. Harmless; left alone.

### State at the hand-back (2026-11-09, about 17:50 UTC)

| Leg | State |
|---|---|
| Commits on `origin/main` | `8096b33a` (fix), `bdfef6a4` (release), `bc5e9a93` (recipe), `2dac7cc7` (stamp); this record follows in one more push |
| Tag | `v1.0.69` (tag object `74bedc61`) on `bdfef6a4`, pushed |
| Windows and Android CI | green on the tag: `42662342778`, `42662342775` |
| Pipeline on `main` | `42663480494` on the shipped tree (`2dac7cc7`): red only on the known `lifeListsLinearity` timing row (22.40 against 20); Backend, lint and typecheck green; `42662388330` cancelled by the stamp push |
| Mac, Windows, `latest.json` | live: release `439446738`, Latest; notarization `740e9045` Accepted; Gatekeeper checks pass; both updater signatures verify |
| Android GitHub APK | attached, signer `42a3576e...996a`, SHA-256 `b5efcbae...7cd4`; device check Partial (emulator) |
| F-Droid | nothing sent; 1.0.68 in the recipe and not yet built; 1.0.69 waits for the bot; the changelogs are in the tag |
| Website | live with the 1.0.69 pill and footer and the approved privacy sentence (Pages `42662388472`) |
| iOS | TestFlight 1.0.69.1 `VALID` (build `f9d5df4a-a8ca-4f4d-bc53-7cba08686821`); waits on the user's iPhone check |
| App Store | untouched; 1.0.68 released, so 1.0.69 gets its own new record after the iPhone check |

### For the next phase (steps 11 and 12 of the plan, on the user's iPhone report)

- **The user's iPhone check of TestFlight 1.0.69 (1)**, four steps: (1) install SnowRaven 1.0.69 (1) from TestFlight and open it; (2) open Life Lists and confirm Include Exotics is switched on and Include Escapees is off, with the naturalized and provisional birds in the list, and the line under the switches reading "Escapee and exotic status comes from the exotic status check on Statistics, so with Include Exotics off this list can be shorter than the Statistics species figure."; (3) switch Include Exotics off and confirm those birds leave the list, then quit SnowRaven completely, reopen it, open Life Lists, and confirm Include Exotics is on again; (4) open Statistics and let the line under the Species figure settle: it should settle as it did on 1.0.68 ("Exotic status checked. eBird's public data has no answer for Eurasian Skylark, so it counts."), with no error.
- Then App Store Connect: re-read the state first; on 1.0.68 still `READY_FOR_SALE` and nothing open, a new 1.0.69 record on build 1.0.69.1, `AFTER_APPROVAL`, no phased release, What's New the approved 369-character line; the promotional text restored from `appstore/LISTING.md` if it arrives empty and every field read back; review notes byte-identical to `appstore/REVIEW_NOTES.md`; the age rating on the editable app info; `asc-screens.mjs readback` ending `ALL MATCH`; submit and read back.
- F-Droid three-read, then **`RELEASE_LEDGER.md`**: the 1.0.68 App Store entry corrected in place (RESOLVED: `280db18b` `READY_FOR_SALE`, `a22d8c52` `COMPLETE`, first read so 2026-11-09 17:19 UTC); the 1.0.69 App Store entry; the 1.0.69 Android entry (release `439446738`, APK `b5efcbae...7cd4`, signer `42a3576e...996a`, Partial, WebView 133); F-Droid corrections in place: 1.0.65, 1.0.66 and 1.0.67 superseded on F-Droid by 1.0.68, and 1.0.68's state as read then. No rollup this time, so the rollup list is unchanged.
- For the Chronicler: CLAUDE.md's "not yet windowed" sentence (security I4, D-09); the ROADMAP's "Open after the 1.0.68 ship" and "`backend/.venv` no longer starts" items are stale; the website's `life-lists.webp` still shows both switches off (a separate held decision).

## Part three: the device check, the App Store record for 1.0.69 and the ledger (2026-11-09, about 20:09 to 20:20 UTC; 12:09 to 12:20 PST), hands-off

Run by The Deployer on the orchestrator's relay of the user's iPhone check (below) and the production sign-off recorded in part two. App Store Connect was driven with the metadata key `QJA25M7XHM` through `pipeline/app-store-listing-polish/asc/asc-lib.mjs`, from scripts in the session scratchpad; no token, key or issuer value was printed or written. Nothing was sent to fdroiddata, no device or worktree was touched, and no eBird or OpenWeather request was made. The only published copy written was the approved What's New.

**Attribution.** The orchestrator asked again for the trailer `Co-Authored-By: Claude Fable 5.1`. This part's commit was written by Claude Opus 5.5 and carries `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, the line this session's own instructions give, as in part two and at 1.0.65 to 1.0.68.

### The user's iPhone check of TestFlight 1.0.69 (1)

Performed by the user on their own iPhone on 2026-11-09, before any App Store record existed (the v1.0.31 rule), and relayed by the orchestrator with the gate `device-check-1.0.69` cleared. In their words, one answer per step:

1. Install and open: "Done, it opens fine" (the exact uploaded build, `f9d5df4a`, launches).
2. Life Lists defaults and status line: "Yes, Include Exotics is on and the line reads right".
3. The switch is session-only: "Exotics left the list and came back on after relaunch".
4. Statistics unchanged: "Settled as it did on 1.0.68, no error".

All four passed.

### Steps

1. **ASC re-read first** (GET only, 20:09:18 UTC, `evidence/ship/asc-1.0.69.txt` section 1): 32 version records, all `READY_FOR_SALE`; **1.0.68 on `280db18b` `READY_FOR_SALE`** on build 1.0.68.1, its submission `a22d8c52` `COMPLETE` with its item `APPROVED`; 10 review submissions, all `COMPLETE`; **no 1.0.69 record**; 93 trains and 101 builds, every build `VALID`, train 1.0.69 `aa4abcc0` with **build 1.0.69.1 `f9d5df4a` `VALID`**. Nothing was in review, so the own-record branch applied, as part two found.
2. **Proving the read-back first.** The read-back script compares every field with `appstore/LISTING.md` and the review notes with `REVIEW_NOTES.md`'s pasted section, which the stored notes equal byte for byte (3,898 characters; an unwrapped variant would be 3,867 and does not match). Run against the released 1.0.68 record it read `ALL SAME`; run there with 1.0.69's What's New as the expected text it read `DIFF whatsNew` and exited 1 (the negative control).
3. **The What's New text.** The approved 369-character line, taken from `fastlane/metadata/android/en-US/changelogs/10000691.txt` without its newline (SHA-256 `b91d5062ae3ee8b25f250086bd89b2d6d37f3cabe71af3b8b88552736c7a7646`; the create script refused any other text). Note: `held/whats-new-1.0.69-rollup.txt` holds the 942-character rollup prepared for the branch that did not apply, not this line.
4. **The record.** `POST /v1/appStoreVersions` (201, 20:11:00 UTC), guarded on no open record, no 1.0.69 record, 1.0.68 `READY_FOR_SALE` and the build `VALID`: platform IOS, `versionString` 1.0.69, copyright `2026 Dave Gibson` from `appstore/LISTING.md`, `releaseType` `AFTER_APPROVAL`, build `f9d5df4a-a8ca-4f4d-bc53-7cba08686821` attached in the same request. **New record `ec491213-6cf7-4dd5-9d8b-51bdcfeb420c`**, created 20:10:56 UTC (12:10:56 PST), `PREPARE_FOR_SUBMISSION`; en-US localization `e06ffaab-9494-42cb-9cf4-cf0a2b04e79c`; a new editable app info `76d4c9e7-00f9-4346-bc4e-808004ade94d`.
5. **What's New and promotional text.** Both arrived **null** (the promotional text a sixteenth time). One localization `PATCH` (200, 20:11:01 UTC) wrote the approved What's New and the promotional text from `LISTING.md` (137 characters). Read back: What's New byte-equal (369), promotional text equal.
6. **Listing read-back before submitting** (20:11:10 UTC, `evidence/ship/listing-readback-1.0.69.txt`): **`READBACK 1.0.69: ALL SAME`**:
   - version 1.0.69, `AFTER_APPROVAL`, no earliest release date, no phased release; copyright the same (16 characters); build 1.0.69.1 `VALID`, not expired, `usesNonExemptEncryption` false;
   - one localization, en-US; description (3,407), keywords (97), promotional text (137), marketing URL (30), support URL (37) and What's New (369) the same as their sources;
   - the review notes the same as `appstore/REVIEW_NOTES.md`'s pasted section at 3,898 characters, all four contact fields present, no demo account;
   - on both app infos (`285bfbfe` live, `76d4c9e7` editable): name (9), subtitle (27) and privacy policy URL (43) the same; categories `REFERENCE` and `WEATHER`; **the age rating answered: 30 fields, 16 `NONE`, 11 false, 0 true, 3 null** (`kidsAgeBand`, `gracRatingClassificationNumber`, `developerAgeRatingInfoUrl`, null on a non-Kids app). Nothing needed changing.
7. **Screenshots** (`asc-screens.mjs readback --loc e06ffaab...`, `evidence/ship/screenshots-readback-1.0.69.txt`): **`read-back: ALL MATCH`, 18 of 18.** iPhone 6.9-inch legacy set `0e5b4d19` and iPad 13-inch legacy set `c56eebca` (new ids on the new record), six each with name, size, dimensions, md5, delivery and decoded pixels matching, in the order 01, 02, 04, 05, 03, 06; the iPhone Duo set as six `ACTIVE` placements in `IPHONE_DUO_PROFILE`, images `APPROVED`, pixel-identical. Nothing was re-uploaded.
8. **Submission** (submitted only after both read-backs were clean). `POST /v1/reviewSubmissions` (201) gave **`25b4b840-9414-4633-87b4-16f4faf4a674`**; `POST /v1/reviewSubmissionItems` (201); `PATCH` `submitted: true` (200). **`WAITING_FOR_REVIEW`, submitted 2026-11-09 20:12:44 UTC (12:12 PST)**; the record `WAITING_FOR_REVIEW`, `AFTER_APPROVAL`, no phased release.
9. **After submitting.** The listing read-back again (`listing-readback-1.0.69-after-submit.txt`): `READBACK 1.0.69: ALL SAME`, no field different from the read-back before submitting. The full re-query (20:13:00 UTC): 33 version records, 1.0.69 `WAITING_FOR_REVIEW` and 32 `READY_FOR_SALE`; 11 review submissions, this one waiting and 10 `COMPLETE`; 93 trains, 101 builds, every build `VALID`. **Gap accounting:** from 1.0.13 on, 57 trains, 25 with no record of their own: the 21 the 1.0.59 ship accounted for, 1.0.62 (rolled up at 1.0.63), 1.0.64 (at 1.0.65), 1.0.65 (at 1.0.66) and 1.0.67 (at 1.0.68). No other gap. Every request and status: `evidence/ship/asc-1.0.69.txt`.
10. **F-Droid three-read** (20:13 UTC, `evidence/ship/fdroid-read-1.0.69.txt`), unchanged since 17:20 UTC: f-droid.org publishes 1.0.61, 1.0.60 and 1.0.59 (`suggestedVersionCode` 10000614); fdroiddata `master` `CurrentVersion` 1.0.68 / 10000684, `Builds` for 1.0.53, 1.0.55, 1.0.56, 1.0.60, 1.0.61 and 1.0.68; newest recipe commit `34866f26` (linsui, "keep latest", 09:18 UTC), the bot's last run `5c48e123` (08:20 UTC); the logs for 10000651/2/4 to 10000691/2/4 all 404. **States:** 1.0.65, 1.0.66 and 1.0.67 superseded on F-Droid by 1.0.68; 1.0.68 and 1.0.69 included and this tag not yet built.
11. **`RELEASE_LEDGER.md`**, in the house form, ASCII only, the file's em-dash count unchanged, and every changed line keeping its old text as a prefix (append-only):
    - App Store: the 1.0.68 entry corrected in place (RESOLVED: `280db18b` `READY_FOR_SALE`, `a22d8c52` `COMPLETE`, item `APPROVED`, first read so 2026-11-09 17:19:43 UTC); a **1.0.69 SHIP** entry (steps 1 to 9 and the user's four answers). No rollup, so the rollup list is unchanged.
    - Android: the 1.0.65, 1.0.66 and 1.0.67 entries corrected in place (each superseded on F-Droid by 1.0.68: 1.0.65 pruned by `34866f26`, 1.0.66 and 1.0.67 skipped by the bot's newest-tag run `5c48e123`); the 1.0.68 entry updated in place (still included and this tag not yet built); a **1.0.69 SHIP** entry (release `439446738`, APK `b5efcbae...7cd4`, signer `42a3576e...996a`, Partial on API 36 emulator evidence by the standing decision, F-Droid included and this tag not yet built, WebView 133).
12. **Checks.** The only file outside this run folder that names `RELEASE_LEDGER.md` is `scripts/android/attach.sh` (a reminder), and no shipped file changed in this part.

### State at the hand-back (2026-11-09, about 20:20 UTC)

| Leg | State |
|---|---|
| App Store | 1.0.69 on new record `ec491213-6cf7-4dd5-9d8b-51bdcfeb420c`, build 1.0.69.1 `f9d5df4a`, submission `25b4b840-9414-4633-87b4-16f4faf4a674` `WAITING_FOR_REVIEW` (20:12:44 UTC), `AFTER_APPROVAL`, no phased release |
| 1.0.68 on the store | `READY_FOR_SALE` on `280db18b`, submission `a22d8c52` `COMPLETE` |
| TestFlight | 1.0.69.1 `f9d5df4a` `VALID`; the user's iPhone check passed on all four steps |
| Mac, Windows, `latest.json` | live at 1.0.69 (release `439446738`, Latest) |
| Android GitHub APK | 1.0.69 attached, signer `42a3576e...996a`; Partial (emulator) |
| F-Droid | 1.0.65 to 1.0.67 superseded by 1.0.68; 1.0.68 and 1.0.69 included and this tag not yet built; nothing sent |
| Website | live at 1.0.69 with the approved privacy sentence |
| Ledger | every entry above written |

### Still open

- **App Review of 1.0.69.** The next ship re-reads its state and writes the outcome into the 1.0.69 entry; a rejection stalls only the App Store leg.
- **F-Droid.** The bot's next run most likely adds 1.0.69; a keep-latest sweep may then leave 1.0.68 superseded by 1.0.69. The next ship's three-read records it.
- For the Chronicler: CLAUDE.md's "not yet windowed" sentence (security I4, D-09); the ROADMAP's "Open after the 1.0.68 ship" paragraph (now resolved: 1.0.68 released, its F-Droid states written) and "`backend/.venv` no longer starts" item (rebuilt on Python 3.15.2) are stale; `website/assets/shots/life-lists.webp` still shows both switches off (a separate held decision); altool's orphaned `log stream` (pid 22902) is harmless.
