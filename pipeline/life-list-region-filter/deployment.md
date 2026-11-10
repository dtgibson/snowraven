# Deployment record: life-list-region-filter (1.0.70)

## Part one: preparation (2026-11-10, about 16:20 to 17:00 UTC; 08:20 to 09:00 PST)

Run by The Deployer (Feature lane, the ship stage), on `main` in the main checkout. Two local commits were made (the feature, then the release); nothing was pushed, tagged, released, built for a store or uploaded. GitHub, App Store Connect (GET only, metadata key) and F-Droid were only read. Nothing was sent to eBird with anyone's key, and no device or emulator was touched (no `adb` or `simctl` call). The production sign-off is the next gate, and part two runs on its recorded answer.

### Preconditions

- **The Tester PASSED** (`qa-report.md`, gitignored, on disk): Tier 2 full weave, 32 Pass, 2 Partial, 0 Fail after three attempts. QA-30 (the version bump) closes here; QA-33's axe and screen-reader run stays the user's.
- **The Auditor PASSED WITH NOTES** (`security-report.md`, gitignored, on disk): 0 Critical, 0 High, 0 Medium. L1, L2 and I3 resolved; L3 and I2 accepted as follow-ups; I1 accepted (D-08). No finding open.
- **The user's approvals, recorded firsthand at a gate on 2026-11-10 (D-11):** the live look passed ("It looks right"); `held-copy.md` sections 1 and 2 approved as written; section 3 approved, with the new frame shown to the user before it goes live.
- No staging environment, as at every SnowRaven ship, so the production sign-off is the one gate. No key, environment variable, host or provider setting is needed, so there is no external setup to offer.

### Repository state (`git fetch origin`, 16:22 UTC)

- `origin/main` is `a767ce82`, equal to local `main` before this stage's commits: nothing behind. Only `origin/main` exists remotely.
- Newest tag `v1.0.69` (tag object `74bedc61`, peeled to `bdfef6a4`), locally and on origin; no `v1.0.70` anywhere. Release v1.0.69 is Latest; no draft releases.
- The other worktree (`.claude/worktrees/life-list-filter-toggle-state`, branch at `481b9ee3`) was read by `git worktree list` and `git log` only, never entered: no commit ahead of `main`. No ship is in flight there, and no 1.0.70 train or record exists in App Store Connect (below).

### App Store Connect (GET only, metadata key, 16:23:47 UTC; `evidence/ship/asc-read-1.0.70-prep.txt`)

- **1.0.69 is still `WAITING_FOR_REVIEW`**: record `ec491213-6cf7-4dd5-9d8b-51bdcfeb420c` (`AFTER_APPROVAL`, no phased release) on build 1.0.69.1 `f9d5df4a`, submission `25b4b840-9414-4633-87b4-16f4faf4a674` `WAITING_FOR_REVIEW` since 2026-11-09 20:12:44 UTC, its one item `READY_FOR_REVIEW`. Not in review, not approved. Its en-US localization `e06ffaab` holds the 369-character What's New and the 137-character promotional text.
- 33 version records: 1.0.69 waiting, 32 `READY_FOR_SALE` (1.0.68 on `280db18b` the live one). 11 review submissions: this one waiting, 10 `COMPLETE`.
- 93 TestFlight trains and 101 builds, every build `VALID`. No 1.0.70 train or record.
- From 1.0.13 on, 57 trains, 25 without a record of their own, the same 25 the 1.0.69 entry accounts for. **No unaccounted gap.**
- Two app infos: `285bfbfe` live and `76d4c9e7` (with the 1.0.69 record), each `FOUR_PLUS`.

**The disposition for 1.0.70, decided by 1.0.69's state when re-read at the App Store step** (after the user's iPhone check of TestFlight 1.0.70 (1)), the three branches of the 1.0.69 ship:
- **1.0.69 still `WAITING_FOR_REVIEW` (the case now): the house rollup, 1.0.69 into 1.0.70.** Withdraw it (`DELETE /v1/appStoreVersionSubmissions/ec491213...`, record to `DEVELOPER_REJECTED`), retarget the same record to `versionString` 1.0.70, repoint it at build 1.0.70.1, write the 591-character rollup What's New (`held/whats-new-1.0.70-rollup.txt`: 1.0.69's approved line, a blank line, 1.0.70's approved line; SHA-256 of the text `61102942...7820`), read every listing field back against `appstore/LISTING.md` (the description now changes: it is PATCHed to the new 3,471-character block and read back) and the review notes against `appstore/REVIEW_NOTES.md`, confirm the age rating on the editable app info, run `asc-screens.mjs readback` to `ALL MATCH`, then submit through `reviewSubmissions`. Ledger: 1.0.69 rolled up into 1.0.70 (VALID build 1.0.69.1, record `ec491213`, withdrawn submission `25b4b840`, the new submission id).
- **1.0.69 approved or released first:** 1.0.70 gets its own new record on build 1.0.70.1, What's New 1.0.70's line alone (`held/whats-new-1.0.70.txt`, 220 characters, SHA-256 `97e25fe1...f6d4`), and the description PATCHed to the new block.
- **1.0.69 in review (`IN_REVIEW`):** leave the review undisturbed; 1.0.70 ends on TestFlight as a deferral written in the ledger (the 1.0.25 precedent), carried by the next record.

Mac, Windows and the Android APK for 1.0.69 are already live; only the App Store leg rolls up.

### F-Droid (public reads, 16:24 UTC; `evidence/ship/fdroid-read-1.0.70-prep.txt`)

- f-droid.org publishes 1.0.61, 1.0.60 and 1.0.59 (`suggestedVersionCode` 10000614).
- fdroiddata `master`: `CurrentVersion` 1.0.69 / 10000694, `Builds` for 1.0.53, 1.0.55, 1.0.56, 1.0.60, 1.0.61, 1.0.68 and 1.0.69. Newest recipe commit `c0ad7c8f` "bot: Update SnowRaven to 10000694" (05:25 UTC today).
- Build logs: 10000681, 10000682 and 10000684 each end `Successfully built ... from 93c10733` (1.0.68's tag commit); 10000691/2/4 answer 404 (not attempted).
- **States now:** 1.0.68 **included and built, not yet published**; 1.0.69 **included and this tag not yet built**. Both corrections belong in the ledger at part two's read. A v1.0.70 tag pushed before the bot's next run most likely leaves 1.0.69 superseded on F-Droid by 1.0.70, which costs nothing.
- **Nothing goes to fdroiddata at 1.0.70:** `scripts/android/toolchain.env` is unchanged and the recipe diff moves only versions and codes.

### CI on `main`, and the timing row (`evidence/ship/timing-probe-1.0.70-prep.txt`)

- The latest Pipeline run on `main`, `42693053650` on `a767ce82`, failed on the one known timing row and nothing else: `lifeListsLinearity.test.ts` "pass 1 (first sightings), every row its own species", 22.40 against 20. Backend green. Every release since 1.0.64 has shipped under that acceptance (DECISIONS.md v1.0.64, D-17), whose reversal is "a failure in a test the release touches, or any non-timing failure".
- **This release touches that file and that pass.** It adds the region rows to `lifeListsLinearity.test.ts` and moves pass 1's record construction into `firstSightingRecord` (`lib/lifeLists.ts`). Measured here, interleaved through the file's own quotient procedure: pass 1 at HEAD read 10.42 to 12.20, pass 1 in this tree 10.93 to 12.35, so the refactor does not move pass 1.
- **The new region rows read 10.43 to 15.03 here against limits of 20 (pass 2R and the 20-county legs) and 25.5 (pass 1R on the every-row-a-pair legs).** CI reads pass 1 at about twice this Mac (22.4 to 26.1 against about 11), so pass 2R on all four legs and pass 1R on at least two would most likely read over their limits in the run of record. That would be a new failure in rows this release adds, which is D-17's reversal condition. This is a decision for the sign-off, not one this stage can settle.

### Rig readiness (read only, 16:45 UTC)

| Check | Result |
|---|---|
| Login keychain | `no-timeout`: unlocked (a reboot before part two would lock it; then the user runs `security unlock-keychain ~/Library/Keychains/login.keychain-db` in their own terminal) |
| `gh` | signed in as `dtgibson` (`repo`, `workflow`, `gist`, `read:org`) |
| Login shell | Node v24.18.0 (`.nvmrc` 24); rustc 1.96.1; `APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID`, `APPLE_API_KEY_PATH` and `APPLE_SIGNING_IDENTITY` set |
| Secrets (existence and mode only) | `~/.tauri/snowraven-signing.key`, the Android keystore and its properties file, all 600; the export options plist and the Developer ID profile present |
| Xcode | 27.2 (27B52), iOS SDK 27.2; `xcodebuild -checkFirstLaunchStatus` exit 0 |
| Leftover iOS archive | `src-tauri/gen/apple/build/snowraven_iOS.xcarchive` is **1.0.69.1**: part two moves it aside first |
| Android | `scripts/android/toolchain.env` unchanged against HEAD |

### The version set (six files, all written)

| File | Change |
|---|---|
| `frontend/package.json`, `frontend/package-lock.json` (two lines) | 1.0.69 to 1.0.70 |
| `src-tauri/tauri.conf.json` | `version` 1.0.70; `bundle.android.versionCode` 1000070 |
| `CHANGELOG.md` | `## [1.0.70] - 2026-11-10`: one Added bullet (the held draft, which says "remembered" and not "on this device") and six Internal bullets |
| `website/index.html` | the version pill text, its `aria-label`, and the footer line |
| `fastlane/metadata/android/en-US/changelogs/10000701.txt`, `10000702.txt`, `10000704.txt` | the approved 220-character line plus a newline, 221 bytes each (SHA-256 `3963121e...85ec`); nothing under the unsplit code |
| `pipeline/android-release/fdroid/com.dtgibson.snowraven.yml` | three `Builds` entries at 1.0.70 (10000701, 10000702, 10000704); `CurrentVersion` 1.0.70, `CurrentVersionCode` 10000704. The three `commit:` lines stay on 1.0.69's `bdfef6a424014dbfe34d55120f3880e7e5bf7d3e` and move to `v1.0.70^{commit}` after the tag, as at 1.0.69 (`bc5e9a93`). |

The iOS plists stay at 1.0.69 / 1.0.69.1 until `tauri ios build` stamps them in part two (`iosSceneManifest.test.ts`'s "never leads" rule).

### The approved copy (D-11)

- `README.md` `### Life Lists`, the website's Life Lists row (wrapped as the file wraps it) and the `appstore/LISTING.md` bullet (lowercase "lists" after the colon) now read "Lists every species you have recorded along with its first checklist and place, everywhere or in one country, state, or county you have birded, and turns into a photo, audio, or video life list, or any combination of them." The listing's description heading reads 3,471 / 4,000. `lifeListsSurfacesPublishedClaims.test.ts` pins the new sentence (a `REGION_CLAUSE` constant in its `LEAD`). Nothing else on those surfaces changed.
- **The website frame.** `website/assets/shots/life-lists.webp` is recaptured from the synthetic demo data (`gen-demo-data.mjs`, byte-identical to the tracked `website/demo/` files; 368 synthetic checklists, the demo-dataset guard passed) on a backend started for this on `127.0.0.1:1622` with `SR_DATA_DIR` on a scratch copy and stopped afterwards; the 1621 preview was left running. The committed tools have no Life Lists job, so a scratch script repeated the 1.0.63 one (`pipeline/life-lists-tab/held/capture-tools.diff`) through the committed `capture-lib.mjs`: Statistics first in the same page until "Exotic status checked across", then Life Lists, 1600x900 at scale 2, `assertMarksInFrame` passing, then `process-img.mjs`'s settings (1600px, WebP quality 84). The Region control reads Everywhere and Include Exotics is on (its default since 1.0.69, so ROADMAP's 1.0.69 note that the frame shows both switches off is closed by this frame). Against the committed frame, the header and the list rows match (no pixel differs by more than 22); only the control strip and the status line changed. The eBird and Birds of the World marks were checked in a magnified crop. Requests during the capture: the backend's own routes, the stubbed checklist lookups answered in the browser, and map tiles from `tiles.openfreemap.org`; the backend has no eBird key. The alt text is section 3's offered sentence. A copy of the frame is `held/life-lists-shot-preview.webp` (SHA-256 `0cc51ebd...9051`), for the user to see before it goes live.
- `held-copy.md`'s status line now records the approval and where each section landed.

### Verification (16:28 to 16:42 UTC, nothing else compiling, load 2.0)

- `npm run typecheck` and `npm run build`: clean (the existing over-1,100 kB chunk warnings only).
- The full frontend suite: **497 files passed, 5 skipped; 10,899 tests passed, 6 skipped, 0 failed** (84.5 s). The version-set and published-claims guards run alone, 7 files, all passing: `androidVersionSource`, `fastlaneMetadata`, `fdroidRecipe`, `icloudKeysPublishedClaims` (the pill and footer row), `lifeListsSurfacesPublishedClaims`, `lifeListsPublishedClaims`, `iosSceneManifest`.
- `website/tools`: `npm test` 15 of 15; `npm run verify` 8 of 8 harnesses green.
- Backend: `pytest tests/ -q`, 2,080 passed.
- No U+2014 in any added line or in the published files; no literal control character in any changed or new text file.

### What stays out of the commits

- `qa-report.md` and `security-report.md` (gitignored by the run rules).
- `evidence/qa-probe-region.mjs` and its two readings, now gitignored (`pipeline/.gitignore`): the probe ran against a scratch copy of the user's own backup and its expectations and readings name that backup's countries, a county and per-region species counts. Kept on disk, because this repo is public.

## Part two: 1.0.70 on every leg up to the user's iPhone check (2026-11-10, from 18:12 UTC; 10:12 PST)

Run by The Deployer on the user's firsthand answer at the production sign-off, relayed by the orchestrator: "Confirm, ship 1.0.70" (the gate named the website going live, the tag, the desktop release and updater, the signed APK and the TestFlight upload; the App Store submission after the user's iPhone check; the 1.0.69 rollup with the 591-character What's New). The CI timing acceptance is D-12. Held in this invocation, as directed: no App Store version record is created, changed or withdrawn, nothing is submitted, and `RELEASE_LEDGER.md` is not written (part three). No physical device is touched; simulators and the local emulator only.

### Steps

0. **Starting state** (18:12:12 UTC, 10:12 PST): keychain `no-timeout` (unlocked); three valid signing identities (Developer ID Application `17118E87...`, Apple Development, Apple Distribution `1861F7A4...`); `git fetch origin --tags`: `origin/main` still `a767ce82`, no `v1.0.70` locally or on origin; nothing of SnowRaven's running. The orchestrator's D-12 entry sat uncommitted in `decisions.md`.
1. **Tag.** Annotated **`v1.0.70`** (tag object `811367f08735b3d99bba79dd861ee666d8004956`, "SnowRaven 1.0.70: a Region control on Life Lists") on the release commit `849506a285d6e389849b3edbb2a23156856bbf84`; at the tag, `tauri.conf.json` reads 1.0.70 / 1000070 and `10000701/2/4.txt` are present. Pushed **alone** at 18:12:31 UTC; `git ls-remote`: `refs/tags/v1.0.70` `811367f0` peeled to `849506a2`.
2. **Commits after the tag:**

   | Commit | What |
   |---|---|
   | `20d5c250` | `fix(fdroid): the recipe names v1.0.70's commit`: the three `commit:` lines name `849506a2...`; `fdroidRecipe`, `fastlaneMetadata`, `androidVersionSource` 57 of 57 first |
   | `db582d9d` | `docs(pipeline): life-list-region-filter D-12, the CI timing acceptance for 1.0.70` (record-keeping; `release.sh` needs a clean tree) |

3. **`main` pushed** at 18:12:48 UTC as a fast-forward, `a767ce82..db582d9d` (the feature, the release, the recipe and the D-12 commits). This push published the website (Pages, below).
4. **CI started:** Windows Build `42872834267` and Android Build `42872834385` on `849506a2` (the tag), 18:12:35 UTC; Pipeline `42872886461` and Pages `42872886665` on `db582d9d`, 18:12:53 UTC.
5. **iOS** (during the CI wait):
   - The three `/tmp/xcshim` shims recreated (`xcodebuild`, `xcrun`, `swift`); `xcrun --sdk iphoneos --show-sdk-version` **27.2** (Xcode 27.2, 27B52).
   - **Widget Swift tests: 143 tests, 0 failures, `** TEST SUCCEEDED **`** on the iPhone 17 simulator (`OS=latest`, `-test-timeouts-enabled YES`); no simulator booted before, none left booted after.
   - The leftover archive (1.0.69 / 1.0.69.1) moved aside as `snowraven_iOS-1.0.69.1-stale-before-1.0.70.xcarchive`.
   - `tauri ios build --export-method app-store-connect --build-number 1`, outside the Bash sandbox through a login shell with the three signing variables mapped (18:15:06 to 18:17:14 UTC): **the archive `** BUILD SUCCEEDED **`**, and Tauri's own export refused with the skill's third wording ("No Account for Team "Tauri"", "No profiles for 'com.dtgibson.snowraven' / '...widgets' were found"), expected. The fresh archive reads **1.0.70 / 1.0.70.1**; `vtool -show-build` on its executable: `platform IOS`, minos 16.0, sdk 27.2.
   - The build again rewrote the two `PRODUCT_NAME = SnowRaven;` lines in `project.pbxproj` as `"SnowRaven"` (quoting only); restored to HEAD.
   - The archived `snowraven_widgets.appex` was not signed; signed ad hoc with `snowraven_widgets.entitlements`, it lists `group.com.dtgibson.snowraven`.
   - Manual `xcodebuild -exportArchive` with `~/.tauri/snowraven-ios-export-options.plist` into `src-tauri/gen/apple/build/export-1.0.70.1`: **`** EXPORT SUCCEEDED **`**. `DistributionSummary.plist`: both bundles at 1.0.70 (1.0.70.1), Apple Distribution `1861F7A4`, team `8QKC3L2FKP`; the app on "SnowRaven iOS App Store iCloud AppGroup 20260924" with `group.com.dtgibson.snowraven`, `icloud-container-environment` Production, the container and ubiquity identifiers `iCloud.com.dtgibson.snowraven` and `icloud-services` CloudDocuments; the appex on "SnowRaven Widgets App Store" with `application-groups` `group.com.dtgibson.snowraven` and nothing else. IPA SHA-256 `7108e26e18a1675bc18004f3f176ec81acf36a0c154b80eb5ca725be71c44a03` (16,522,124 bytes).
   - **`altool --validate-app`: `VERIFY SUCCEEDED with no errors`** (18:20:09 to 18:21:21 UTC); then **`--upload-app`** 18:21:26 to 18:22:36 UTC, `UPLOAD SUCCEEDED with no errors`, **Delivery UUID `7d4682f8-0c5d-47cf-8223-20b6178c834d`** (plus the routine `CDUploaderStateInfoResumeFilePath` log line).
   - The stamp: `snowraven_iOS/Info.plist` 1.0.70 / 1.0.70.1 and the widget extension's `CFBundleVersion` 1.0.70.1; `iosSceneManifest`, `iosWidgetManifest` and `iosAlertsManifest` 67 tests green; committed as **`ccc36a7e`** `chore(ios): stamp iOS 1.0.70 build 1` and pushed at 18:24:04 UTC (`db582d9d..ccc36a7e`).
6. **Website** (Pages `42872886665` success, 18:13:16 UTC): https://snowraven.dtgibson.com/ answers with last-modified 18:13:09 GMT, `aria-label="Version 1.0.70">v1.0.70`, `SnowRaven v1.0.70`, the approved Life Lists sentence, the alt text "below the Region control", and `assets/shots/life-lists.webp` at SHA-256 `0cc51ebd...9051`, the frame the user saw.
7. **CI, the tag's builds:** **Windows Build `42872834267` success** (18:21:47 UTC) and **Android Build `42872834385` success** (18:28:31 UTC), both on `849506a285d6e389849b3edbb2a23156856bbf84`.
8. **Android** (preflight, sign and the emulator check during the Pipeline wait, before `release.sh`; the attach after it). Build shell: JDK 17.0.21.0.3, `ANDROID_HOME`, `NDK_HOME` (27.2.12479018, the only NDK), Gradle 8.14.3 at `~/.tauri/gradle-8.14.3` first on `PATH`, `SNOWRAVEN_ANDROID_SIGNER_SHA256` set to the recorded digest.
   - `scripts/android/preflight.sh` **exit 0, every check `ok`**: the toolchain, the keystore (alias `snowraven`), the version pair 1.0.70 / 1000070, `v1.0.70` pushed at `849506a285d6` and carrying that pair, `10000701/2/4.txt` present at the tag, and run `42872834385`'s artifact `SnowRaven_1.0.70_android_universal_unsigned.apk` (`com.dtgibson.snowraven`, 1.0.70, 1000070, not debuggable; SHA-256 `01eb72e0351d9d33a751e701b8fff4dbf1ff678609960d2d2f1cf2d28c2bcfca`). Its one warning, HEAD is not the tag's commit, is expected (the recipe, D-12 and stamp commits follow the tag).
   - `scripts/android/sign.sh` **exit 0**: v2 and v3 (v1 off), `ok signer equals the keystore's certificate`, `ok signer equals the recorded digest`, **`Signer #1 certificate SHA-256 digest: 42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a`** (DN `CN=SnowRaven, O=Dave Gibson`). **Signed APK `SnowRaven_1.0.70_android_universal.apk`, SHA-256 `7f695587252035e4cb3619f7235bf55a38fdf1ee53ec79e6b2b5a1aaf31ffdb1`.** No password was printed or passed on a command line.
   - **Emulator check** on the local API 36 Google APIs image only (`sr-api36-phone`, port 5554, headless, `-gpu host`, `-no-snapshot-save`; every `adb` call addressed to `emulator-5554` by serial; no device listing taken). No SnowRaven was installed before. The exact signed bytes (hash re-read equal) installed: `versionName` 1.0.70, `versionCode` 1000070, minSdk 26, targetSdk 36. Cold start `Status: ok`, `LaunchState: COLD`, 461 ms. It opened to the Welcome screen; "Explore the app first" drew Weather with both key notices; More, then Life Lists drew its no-backup state ("eBird Backup Required"): `evidence/ship/api36-1.0.70-first-launch.png`, `api36-1.0.70-explore.png`, `api36-1.0.70-life-lists.png`. The Region control needs an imported backup and was not reached on the emulator (the user's iPhone check covers it); nothing was sent to eBird or OpenWeather. **The crash buffer:** the first boot's `logcat -b crash` held 40 lines that were not captured before that emulator stopped, and the app was alive at the end (pid 4804). So the check was repeated on a fresh boot with the same bytes: the crash buffer read 0 lines before the install and 0 after the same three screens, with no `AndroidRuntime` `FATAL` line in the main log and the app alive (pid 4490). The first boot's 40 lines are not attributable now; the repeat shows none from SnowRaven. The emulator was stopped.
   - **WebView:** `com.google.android.webview` `versionName` 133.0.6943.137: **WebView 133, unchanged since the last measurement.**
   - **Device check: Partial on API 36 emulator evidence, under the standing decision** (CLAUDE.md, Versioning: the user owns no Android device), as at 1.0.53 to 1.0.69.
9. **Pipeline, judged under D-12** (`evidence/ship/ci-read-1.0.70.txt`).
   - `42872886461` on `db582d9d` (the tag, recipe and D-12 commits) finished at 18:22:07 UTC, before the stamp was pushed, so it was not cancelled. It is not the run of record (the skill: the run on the iOS stamp commit is the run of record for the shipped tree), and it is recorded in full because one of its five failures is outside D-12: **`alphaCodes.test.ts` "linearity of the join plus one ranking pass ... published names, a code query", per-doubling quotient 3.92 against 3.2 at sub-millisecond CPU times.** This release touches no `alphaCodes*` file; the same row read 3.70 against 3.2 on `42668105703` (after 1.0.69 shipped), and DECISIONS.md records it as an intermittent CPU-ratio trip on GitHub's shared runner. Its other four were `lifeListsLinearity` rows: pass 1 21.67/20, pass 2R distinct-pairs 32.36/20, pass 1R repeated-pairs 28.95/25.55, pass 2R repeated-pairs 22.34/20. Backend green.
   - **The run of record, `42874813363` on `ccc36a7e`** (the stamp), finished at 18:35:29 UTC: **Backend green; Frontend 3 failed, 10,874 passed, 27 skipped, every failure a `lifeListsLinearity` row under twice its limit**: pass 1, every row its own species, 23.94/20 (1.20x); pass 1R, 200 species repeated, every row its own (state, county), 28.82/25.55 (1.13x); pass 1R, every row its own species and pair, 31.73/25.55 (1.24x). `alphaCodes` passed. Build and the real-engine gate were skipped after the red test step (both green locally on this tree). **Accepted under D-12**; `release.sh` started after this reading.
10. **Desktop.** `CI=true SKIP_NPM_INSTALL=1 zsh -lc ./release.sh` from the main checkout, alone on the machine on a clean tree (this part's untracked evidence was kept in the session scratchpad until it finished), **exit 0** (18:36:26 to 18:41:57 UTC), started once the run of record was judged: `Releasing v1.0.70: tag=849506a2 HEAD=ccc36a7e`; iCloud profile OK (to 2044-08-27); iCloud entitlements and the embedded profile verified in the built app; the final DMG signed, notarized and stapled; the Windows installer fetched from CI and signed locally (`evidence/ship/release-1.0.70.txt`).
    - **Release `440762302`**, https://github.com/dtgibson/snowraven/releases/tag/v1.0.70, published 2026-11-10 18:41:56 UTC, not a draft or pre-release, and **Latest**.

      | Asset | Bytes | SHA-256 |
      |---|---|---|
      | `latest.json` | 1,852 | `113eece80d44f7948718294cbb75b3b37f3a925201a4144bd3fcdb3ed0b9f086` |
      | `SnowRaven-updater.app.tar.gz` | 31,292,094 | `63387ed9912244a75523f8c2f579db373e23eee27b4b251b2e7fcea914005d55` |
      | `SnowRaven-updater.app.tar.gz.sig` | 408 | `8ebbb71edbcc0a27c15f4c9adcb4e7872b4e8cea959c854378a1c7dffec18271` |
      | `SnowRaven_1.0.70_universal.dmg` | 31,632,425 | `ed75592df04ecd71b7b76adec67415675fa9c3778f3aa2511207fffa5c6df4e6` |
      | `SnowRaven_1.0.70_x64-setup.exe` | 10,233,145 | `e82699d5a5fa46d0237983e8d2ae3c65f9b2809246fbc0eb1e9041ac92ffb762` |
      | `SnowRaven_1.0.70_x64-setup.exe.sig` | 420 | `64fcf7ad8cfcb68c972af5a6d3bc8dcf767120f60cb201c95b132de2b7aa0470` |
      | `SnowRaven_1.0.70_android_universal.apk` (step 11) | 79,292,034 | `7f695587252035e4cb3619f7235bf55a38fdf1ee53ec79e6b2b5a1aaf31ffdb1` |

    - **The DMG, downloaded back from the release:** `codesign --verify --verbose=2` valid on disk and satisfies its Designated Requirement; `xcrun stapler validate` worked; `spctl -a -t open --context context:primary-signature -vv` **accepted, source=Notarized Developer ID**, origin `Developer ID Application: DAVID THOMAS GIBSON (8QKC3L2FKP)`; `hdiutil verify` checksum VALID.
    - **`latest.json`:** version 1.0.70, `pub_date` 2026-11-10T18:41:52Z; `darwin-aarch64` and `darwin-x86_64` identical, on `.../v1.0.70/SnowRaven-updater.app.tar.gz`; `windows-x86_64` on `.../v1.0.70/SnowRaven_1.0.70_x64-setup.exe`; each signature equals its `.sig` asset, and **both verify VALID** (the file and the trusted comment) against the updater public key in `tauri.conf.json` (key id `f80c63fb3b636306`), with a scratch Node verifier (BLAKE2b-512 prehash, Ed25519; `minisign` is not installed on this Mac) that reads a one-byte-changed installer INVALID.
    - **The updater bundle** unpacks to `SnowRaven.app` with `CFBundleShortVersionString` 1.0.70, a universal executable (`x86_64 arm64`), and passes `codesign --verify --deep --strict`.
    - **The published installer is byte-identical** to run `42872834267`'s artifact (`cmp`).
11. **Android attach.** `ANDROID_DEVICE_CHECK=partial ANDROID_CHECKED_SHA256=7f695587...ffdb1 scripts/android/attach.sh <signed.apk>` **exit 0** (18:45 UTC): `ok signer equals the keystore's certificate`, `ok byte-identical to the checked file`, `ok com.dtgibson.snowraven 1.0.70 (1000070), signer 42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a`; uploaded to v1.0.70 as **`SnowRaven_1.0.70_android_universal.apk`** (asset `732546286`, 79,292,034 bytes, 18:45:42 UTC) and downloaded back byte-identical (`ASSET_SHA256=7f695587...ffdb1`); the public download URL hashes the same. Its warning (attaching without a device check) is the standing Partial decision, which part three writes in `RELEASE_LEDGER.md`'s Android section.
12. **TestFlight** (GET only, the metadata key, 18:32:54, 18:33:07 and 18:46:10 UTC): **train 1.0.70 `c88f2c1c-1244-4fa5-8d6d-72e9b7eb23f6`, build 1.0.70.1 `7d4682f8-0c5d-47cf-8223-20b6178c834d` `VALID`**, uploaded 10:25:49 PST, min OS 16.0, not expired; it already read VALID at the first look, about ten minutes after the upload (`evidence/ship/testflight-read-1.0.70.txt`). No App Store version record was created, changed or withdrawn, and nothing was submitted.
13. **App Store state changed since part one** (GET only, 18:46:29 UTC; `evidence/ship/asc-read-1.0.70-ship.txt`): **1.0.69 is `READY_FOR_SALE`** on record `ec491213-6cf7-4dd5-9d8b-51bdcfeb420c` (`READY_FOR_DISTRIBUTION`), its submission `25b4b840-9414-4633-87b4-16f4faf4a674` `COMPLETE` and its one item `APPROVED`: Apple approved it after 16:23 UTC and it released on approval. 33 version records, all `READY_FOR_SALE`; the 10 review submissions listed, all `COMPLETE`; 94 trains and 102 builds, every build `VALID`; from 1.0.13 on, 26 trains without a record of their own: the 25 the 1.0.69 entry accounts for, and 1.0.70, whose record part three creates. **So the rollup branch no longer applies: at the App Store step 1.0.70 gets its own new record** on build 1.0.70.1, `AFTER_APPROVAL`, no phased release, What's New the approved 220-character line alone (`held/whats-new-1.0.70.txt`, SHA-256 of the text `97e25fe1...f6d4`), the branch part one laid out for this state, with the description PATCHed to the new 3,471-character block. State is re-read immediately before that step.

### State at the hand-back (2026-11-10, about 18:50 UTC; 10:50 PST)

| Leg | State |
|---|---|
| Website | live at 1.0.70 (Pages `42872886665`) with the approved copy and frame |
| Tag | `v1.0.70` (tag object `811367f0`) on `849506a2`, pushed |
| macOS, Windows, updater | release `440762302`, Latest; DMG notarized and accepted; `latest.json` signatures VALID; installer byte-identical to CI |
| Android (GitHub APK) | attached, SHA-256 `7f695587...ffdb1`, signer `42a3576e...996a`; device check Partial (emulator evidence) |
| iOS TestFlight | 1.0.70.1 `7d4682f8` VALID; waits on the user's iPhone check |
| App Store | no 1.0.70 record yet; 1.0.69 released on approval, so 1.0.70 takes its own record (part three) |
| F-Droid | nothing sent (no pin or build-step change); read in part three |
| Ledger | not written (part three) |

### For part three (on the user's iPhone report)

- The user's check of TestFlight 1.0.70 (1): the four steps in the hand-back.
- The App Store record for 1.0.70 per step 13 (re-read the state first), with every listing field read back, the description PATCHed to the new block, the promotional text restored if it arrives empty, the review notes and age rating checked, `asc-screens.mjs readback` to `ALL MATCH`, then the submission.
- The F-Droid three-read, then `RELEASE_LEDGER.md`: the 1.0.69 App Store entry corrected in place (RESOLVED: `ec491213` `READY_FOR_SALE`, `25b4b840` `COMPLETE`, item `APPROVED`, first read so 2026-11-10 18:46 UTC); a 1.0.70 App Store entry; a 1.0.70 Android entry (release `440762302`, asset `732546286`, APK `7f695587...ffdb1`, signer `42a3576e...996a`, Partial, WebView 133); the F-Droid corrections (1.0.68 included and built, not yet published; 1.0.69 as read then). No rollup this time, so the rollup list is unchanged.

## Part three: the device check, the App Store record for 1.0.70 and the ledger (2026-11-10, about 19:30 to 19:40 UTC; 11:30 to 11:40 PST)

Run by The Deployer on the orchestrator's relay of the user's iPhone check (below) and the production sign-off recorded in part two. App Store Connect was driven with the metadata key `QJA25M7XHM` through `pipeline/app-store-listing-polish/asc/asc-lib.mjs`, from a script in the session scratchpad; no token, key, issuer or review-contact value was printed or written. Nothing was sent to fdroiddata, no device or worktree was touched, and no eBird or OpenWeather request was made. The only published copy written was the approved What's New and the approved description block.

### The user's iPhone check of TestFlight 1.0.70 (1)

Performed by the user on their own iPhone on 2026-11-10, before any 1.0.70 App Store record existed (the v1.0.31 rule), and relayed by the orchestrator; recorded as the user reported it, not observed: **"Passed"**, for the four steps given in part two's hand-back:

1. Install SnowRaven 1.0.70 (1) from TestFlight and open it: it opens normally, with no crash (the exact uploaded build, `7d4682f8`, launches).
2. Life Lists: the control strip starts with Region reading Everywhere, and the list and count sentence look as on 1.0.69.
3. Region, a home state or county: the list narrows, the count sentence names the place, and the dates are the first sightings there.
4. Force-quit, reopen, Life Lists: the chosen region is still selected, and Everywhere restores the full list.

### Steps

1. **Proving the read-back first** (19:30:34 UTC). The read-back compares every listing field with `appstore/LISTING.md` and the review notes with `appstore/REVIEW_NOTES.md`'s pasted section, and prints only lengths and presence, never a contact value. Against the released 1.0.69 record, with the listing as it stood at `a767ce82` and 1.0.69's What's New, it read **`READBACK 1.0.69: ALL SAME`**; against today's listing it read **`DIFF description`** (3,407 against 3,471) and exited 1 (the negative control).
2. **ASC re-read and the guarded create** (19:30:46 UTC): 33 version records, all `READY_FOR_SALE`, 1.0.69 `READY_FOR_SALE` on `ec491213`; 10 review submissions, all `COMPLETE`; no 1.0.70 record; build 1.0.70.1 `7d4682f8` `VALID` on train 1.0.70, not expired, `usesNonExemptEncryption` false. Every guard passed. `POST /v1/appStoreVersions` (201): platform IOS, `versionString` 1.0.70, copyright `2026 Dave Gibson` from `appstore/LISTING.md`, `releaseType` `AFTER_APPROVAL`, build `7d4682f8-0c5d-47cf-8223-20b6178c834d` attached in the same request. **New record `21fd36c0-c21b-4988-8b1b-7c43ba55dbb7`**, created 2026-11-10 19:30:55 UTC (11:30:55 PST), `PREPARE_FOR_SUBMISSION`; en-US localization `625ea1fc-4103-4c00-b775-998a00494002`; a new editable app info `01f24c09-089a-436e-b0f9-44b6cb56d982`.
3. **What's New, promotional text and description.** What's New and the promotional text arrived **null** (the promotional text a seventeenth time); the description arrived as 1.0.69's 3,407-character block. One localization `PATCH` (200) wrote the approved What's New (`held/whats-new-1.0.70.txt` without its newline, 220 characters, SHA-256 `97e25fe1d8eab7ceb10168e5eecde6bdd06717915ade55052116aabad52ef6d4`; the script refused any text not equal to `10000701.txt`), the promotional text from `LISTING.md` (137 characters) and the description from `LISTING.md`'s new block (3,471 characters).
4. **Age rating** (the step inside each release, ROADMAP item 1): on the new editable app info `01f24c09` and the live `76d4c9e7`, `socialMedia` false and `socialMediaAgeRestricted` false; 30 fields, 16 `NONE`, 11 false, 0 true, 3 null (`kidsAgeBand`, `gracRatingClassificationNumber`, `developerAgeRatingInfoUrl`, null on a non-Kids app). Already answered; nothing changed.
5. **Listing read-back before submitting** (19:31:22 UTC, `evidence/ship/listing-readback-1.0.70.txt`): **`READBACK 1.0.70: ALL SAME`**: version 1.0.70, `AFTER_APPROVAL`, no earliest release date, no phased release; copyright the same (16 characters); build 1.0.70.1 `VALID`; one localization, en-US; description (3,471), keywords (97), promotional text (137), marketing URL (30), support URL (37) and What's New (220) the same as their sources; the review notes the same as `REVIEW_NOTES.md`'s pasted section at 3,898 characters, all four contact fields present, no demo account; on both app infos, name (9), subtitle (27) and privacy policy URL (43) the same, categories `REFERENCE` and `WEATHER`.
6. **Screenshots** (`asc-screens.mjs readback --loc 625ea1fc...`, `evidence/ship/screenshots-readback-1.0.70.txt`): **`read-back: ALL MATCH`, 18 of 18.** iPhone 6.9-inch legacy set `a903fb81` and iPad 13-inch legacy set `b183012a` (new ids on the new record), six each with name, size, dimensions, md5, delivery and decoded pixels matching, in the order 01, 02, 04, 05, 03, 06; the iPhone Duo set as six `ACTIVE` placements in `IPHONE_DUO_PROFILE`, images `APPROVED`, pixel-identical. Nothing was re-uploaded.
7. **Submission** (only after both read-backs were clean). `POST /v1/reviewSubmissions` (201) gave **`a3be255f-96f0-4ecb-be38-47b280079833`**; `POST /v1/reviewSubmissionItems` (201); `PATCH` `submitted: true` (200). **`WAITING_FOR_REVIEW`, submitted 2026-11-10 19:31:54 UTC (11:31 PST)**, its item `READY_FOR_REVIEW`; the record `WAITING_FOR_REVIEW`, `AFTER_APPROVAL`, no phased release.
8. **After submitting.** The listing read-back again (19:32:09 UTC, `listing-readback-1.0.70-after-submit.txt`): `READBACK 1.0.70: ALL SAME`, no field different from the read-back before submitting. The full re-query (19:32:11 UTC, `asc-read-1.0.70-after-submit.txt`): 34 version records, 1.0.70 `WAITING_FOR_REVIEW` and 33 `READY_FOR_SALE`; 11 review submissions, this one waiting and 10 `COMPLETE`; 94 trains, 102 builds, every build `VALID`. **Gap accounting:** from 1.0.13 on, 58 trains, 25 with no record of their own, the 25 the 1.0.69 entry accounts for. No other gap. Every request and status: `evidence/ship/asc-1.0.70.txt`.
9. **F-Droid three-read** (19:32 UTC, `evidence/ship/fdroid-read-1.0.70-ship.txt`), unchanged since 16:24 UTC: f-droid.org publishes 1.0.61, 1.0.60 and 1.0.59 (`suggestedVersionCode` 10000614); fdroiddata `master` `CurrentVersion` 1.0.69 / 10000694, `Builds` for 1.0.53, 1.0.55, 1.0.56, 1.0.60, 1.0.61, 1.0.68 and 1.0.69 (1.0.69's on `bdfef6a4`); newest recipe commit `c0ad7c8f` (the bot, "Update SnowRaven to 10000694", 05:25 UTC); the logs for 10000681/2/4 end `Successfully built ... from 93c10733`, and those for 10000691/2/4 and 10000701/2/4 answer 404. **States:** 1.0.68 included and built, not yet published; 1.0.69 included and this tag not yet built; 1.0.70 included and this tag not yet built (the bot has not added it yet).
10. **`RELEASE_LEDGER.md`**, in the house form, ASCII only, the file's em-dash count unchanged (2), and every changed line keeping its old text as a prefix (append-only, three lines extended):
    - App Store: the 1.0.69 entry corrected in place (RESOLVED: `ec491213` `READY_FOR_SALE`, `25b4b840` `COMPLETE`, item `APPROVED`, first read so 2026-11-10 18:46:10 UTC, no rollup); a **1.0.70 SHIP** entry (steps 1 to 8 and the user's answer). No rollup, so the rollup list is unchanged.
    - Android: the 1.0.68 entry updated in place (included and built, not yet published); the 1.0.69 entry updated in place (still included and this tag not yet built, its entries added by `c0ad7c8f`); a **1.0.70 SHIP** entry (release `440762302`, asset `732546286`, APK `7f695587...ffdb1`, signer `42a3576e...996a`, Partial on API 36 emulator evidence by the standing decision, F-Droid included and this tag not yet built, WebView 133).

### State at the hand-back (2026-11-10, about 19:40 UTC; 11:40 PST)

| Leg | State |
|---|---|
| App Store | 1.0.70 on new record `21fd36c0-c21b-4988-8b1b-7c43ba55dbb7`, build 1.0.70.1 `7d4682f8`, submission `a3be255f-96f0-4ecb-be38-47b280079833` `WAITING_FOR_REVIEW` (19:31:54 UTC), `AFTER_APPROVAL`, no phased release |
| 1.0.69 on the store | `READY_FOR_SALE` on `ec491213`, submission `25b4b840` `COMPLETE` |
| TestFlight | 1.0.70.1 `7d4682f8` `VALID`; the user's iPhone check passed |
| Mac, Windows, `latest.json` | live at 1.0.70 (release `440762302`, Latest) |
| Android GitHub APK | 1.0.70 attached, signer `42a3576e...996a`; Partial (emulator) |
| F-Droid | 1.0.68 included and built, not yet published; 1.0.69 and 1.0.70 included and this tag not yet built; nothing sent |
| Website | live at 1.0.70 with the approved Life Lists sentence and the recaptured frame |
| Ledger | every entry above written |

### Still open

- **App Review of 1.0.70.** The next ship re-reads its state and writes the outcome into the 1.0.70 entry; a rejection stalls only the App Store leg.
- **F-Droid.** The bot's next run most likely adds 1.0.70; a keep-latest sweep may then leave 1.0.69 superseded by 1.0.70. The next ship's three-read records it.
- **For the Chronicler:**
  - The region linearity legs need CI-sized legs, plus the standing question of timing-ratio guards on shared runners (D-12, idea `f79a03a9`). `alphaCodes.test.ts`'s CPU-ratio row tripped again on `42872886461` (3.92 against 3.2), a run that was not the run of record.
  - The committed capture tools still have no Life Lists job; this ship's frame came from a scratch script reusing the 1.0.63 job.
  - The ROADMAP's 1.0.69 note that `life-lists.webp` shows both switches off is closed by the new frame.
  - The QA probe for this run stays on disk, gitignored, because it names the user's own places.
