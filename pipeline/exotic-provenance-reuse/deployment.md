# Deployment record: exotic-provenance-reuse (1.0.64)

## Phase A: release prep (2026-11-07 PST, 2026-11-08 UTC), stopped before the production sign-off

Run by The Deployer (Improve lane, Stage 5) as a prep-only invocation. Nothing was pushed, tagged, released, uploaded or submitted, and no published copy was written. The production sign-off is the next gate; Phase B runs on its recorded answer.

### Preconditions

- **The Tester PASSED** (`qa-report.md`: Tier 2, full suite 10,694 passed, 6 skipped, 0 failed; `npm run build` passed). **The Auditor PASSED WITH NOTES** (`security-report.md`: no Critical or High; L1 and I1 to I4 dispositioned in `decisions.md`, D-16).
- `deploymentTarget` is null in `pipeline.config.json`, as at every SnowRaven ship: the target is the project's own release machinery (the `snowraven-release` skill). There is no staging environment, so the production sign-off is the one gate. The fix needs no new key, environment variable, host or provider setting (no external-setup fork).

### Reconciliation and parallel ships (read 2026-11-08 00:37 UTC)

- `git fetch origin --tags`: `origin/main` is `1e24a50c`, an ancestor of `HEAD`. No `v1.0.64` tag locally or on `origin`; the newest GitHub release is `v1.0.63` (Latest, 2026-11-07 03:48:55 UTC). No `release.sh`, `notarytool`, `altool` or Tauri build process running. `~/.snowraven-build` is free.
- **Other work in progress:** the worktree `.claude/worktrees/life-list-filter-toggle-state` (branch `worktree-life-list-filter-toggle-state`, locked, at `1e24a50c` with no commits) is someone else's work. It was not entered or touched, and no `git stash` was run.

### Cargo for the production gate

`git log --oneline origin/main..HEAD` is one commit, and the release commit will make it two. Both are this build's own; no other build's app-behavior commit rides along.

| Commit | Kind |
|---|---|
| `a328fd25` fix(statistics): the escapee check settles instead of re-asking eBird on every load | This build's own (the fix, its tests, the run's Stage 1 and 2 records) |
| the 1.0.64 release commit (Phase B) | This build's own: the version bump, CHANGELOG, the approved F-Droid changelogs, the guard fix below, and this run's records (`deployment.md`, `held/`, `decisions.md` with the Orchestrator's D-16) |

### The version bump (the six-file set), made uncommitted in the working tree

| File | Change | State |
|---|---|---|
| `frontend/package.json` (+ `package-lock.json`, lines 3 and 9) | `1.0.63` to `1.0.64` | done |
| `src-tauri/tauri.conf.json` | `version` 1.0.64, `bundle.android.versionCode` 1000064 | done |
| `CHANGELOG.md` | a `## [1.0.64] - 2026-11-07` entry (Fixed, Internal), ASCII, no em dash | done (fix the date if the release commit lands on a later PST day) |
| `website/index.html` | the `version-pill` text and its `aria-label`, and the `footer-version` line, only | done |
| `pipeline/android-release/fdroid/com.dtgibson.snowraven.yml` | three `versionName` 1.0.64, codes 10000641, 10000642, 10000644, `CurrentVersion` 1.0.64, `CurrentVersionCode` 10000644 | done; the three `commit:` lines stay `3281ba8f...` until the tag exists (Phase B step 6, the 1.0.63 pattern) |
| `fastlane/metadata/android/en-US/changelogs/10000641.txt`, `10000642.txt`, `10000644.txt` | the approved text | **HELD** for the user's yes (`held/`) |

The iOS plist stamp is NOT part of the bump: `tauri ios build --build-number 1` writes it, and it is committed afterwards (`chore(ios): stamp iOS 1.0.64 build 1`). `iosSceneManifest.test.ts` only requires the stamped plist (now 1.0.63) never to lead `package.json`.

### A guard defect the bump exposed, fixed test-only

`frontend/src/lib/lifeListsPublishedClaims.test.ts` (added at 1.0.63) read the F-Droid changelog of the CURRENT version code from `tauri.conf.json` and asserted it begins "A new Life Lists tab, after Checklists, ...". At 1000064 it would read 1.0.64's files and go red on any honest What's New, at this bump and at every later one. It now pins `VERSION_CODE = 1000063`, the release whose text it guards (the three 1.0.63 files stay in the folder), with a comment saying why, and its `describe` names 1.0.63. `fastlaneMetadata.test.ts` stays the per-release guard. No other guard reads the current release's copy: `icloudKeysPublishedClaims.test.ts` needs only a `## [1.0.64]` heading in CHANGELOG, which is there. For the Chronicler: a `*PublishedClaims` guard over a per-release file names its release, never "the current one".

### Guards run in Phase A (without the F-Droid files)

- `androidVersionSource`, `fdroidRecipe`, `icloudKeysPublishedClaims` (the pill and footer), `iosSceneManifest`, `iosWidgetManifest`, `lifeListsPublishedClaims`: **6 files, 150 tests passed.**
- `fastlaneMetadata`: red as designed, exactly `changelogs/10000641.txt is missing`, `10000642`, `10000644` (and its guard-the-guard row seeing the same absence). Not worked around: nothing is written under `fastlane/` before the yes, not even temporarily.
- `npm run typecheck` exit 0; `eslint` on the edited guard exit 0.
- The held text checked directly against F-Droid's limits: 217 characters plus a newline (500 maximum), ASCII, no U+2014.

### Published copy (held)

`held/README.md` names the targets. The one text, for both stores (nothing in it is Apple-only):

> The Statistics tab's escapee check no longer asks eBird about the same checklists every time you open the app. When eBird's answers leave out some of your species, the check now says so, and those species still count.

Shorter option for the gate: the first sentence alone. No other published copy changes (D-05): no README, website copy, listing, review notes or privacy policy.

**Screenshots stay current.** No committed frame shows the sentence that changed. The App Store Statistics frame (`appstore/screenshots/iphone-6.9/02-statistics.png`, viewed) ends at Life List Totals, above the status line. Both capture scripts stub the escapee pass with the demo species and wait for the completed state ("Exotic status checked across ..."), which this release leaves unchanged whenever every species is answered.

### Release tooling readiness (read-only checks)

| Item | Finding |
|---|---|
| Login keychain | **unlocked** (`show-keychain-info`: `no-timeout`). Hephaestus was up 1 h 18 min at the check, so it was unlocked after the last reboot. Re-check at the start of Phase B. |
| Signing identities | Developer ID Application, Apple Development, Apple Distribution: 3 valid. Developer ID cert expires **2027-02-01** (renew before then); Apple Distribution 2027-07-05 |
| Updater key | `~/.tauri/snowraven-signing.key` present, 0600 |
| Mac iCloud profile | "SnowRaven Mac Developer ID 20260901", present, expires 2044 |
| iOS export | `~/.tauri/snowraven-ios-export-options.plist` maps the app to "SnowRaven iOS App Store iCloud AppGroup 20260924" and the widgets to "SnowRaven Widgets App Store", `iCloudContainerEnvironment` Production; both profiles installed, expiring 2027-07-05 |
| `APPLE_*` in the login shell | `APPLE_SIGNING_IDENTITY`, `APPLE_API_KEY_PATH` (readable), `APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID` all set (values not printed) |
| ASC keys | `AuthKey_BVVLBRRVL6.p8` (upload) and `AuthKey_QJA25M7XHM.p8` (metadata) in `~/.appstoreconnect/private_keys/` |
| Node, Rust, gh | Node 24.18.0, cargo 1.96.1, `gh` signed in as dtgibson (repo, workflow) |
| Xcode | 27.1 (27A9275), iPhoneOS SDK 27.1 |
| `/tmp/xcshim` | **gone** (macOS cleared `/tmp`): recreate all three shims at Phase B step 7 |
| Stale archive | `src-tauri/gen/apple/build/snowraven_iOS.xcarchive` is **1.0.63.1**: move it aside at Phase B step 7 |
| Android | keystore `~/.tauri/snowraven-android.p12` and its properties file (both 0600), NDK 27.2.12479018 (the only one), build-tools 36.0.0, JDK 17, Gradle 8.14.3 at `~/.tauri/gradle-8.14.3`, cargo-tauri 2.11.2, AVD `sr-api36-phone` present |

### App Store Connect (read with the metadata key, GET only, 2026-11-08 00:37 UTC)

- 30 version records, **none open**: **1.0.63 is `READY_FOR_SALE`** on record `e48a104b-0542-4c8c-b304-26059fa3bc61` (build 1.0.63.1 `52b1e76d`, `VALID`), and submission `690b9ad5-b152-4fe9-8508-c2694704ad5c` is `COMPLETE`. Apple approved and released it after the 1.0.63 ship, so the ledger's 1.0.63 entry ("`WAITING_FOR_REVIEW`") is owed a RESOLVED line in the 1.0.64 entry, the way the 1.0.62 entry resolved 1.0.61.
- No 1.0.64 record and no 1.0.64 build; the newest build is 1.0.63.1. en-US localization of the live record `6e149a48-0c8c-4116-8739-e0ead744a69c`; screenshot sets `1aceebe5` (iPhone 6.9), `ff4f2cb2` (iPad 13), `7391c27c` (iPhone Duo), six each.
- **Submission plan:** with nothing in review, there is no rollup or deferral to choose. 1.0.64 gets a **new record of its own** on build 1.0.64.1 (`POST /v1/appStoreVersions`), as at 1.0.62, submitted after the user's iPhone check, `AFTER_APPROVAL`, no phased release. Expect the What's New and promotional text to arrive empty (thirteen of the last records); restore the promotional text from `appstore/LISTING.md`.

### F-Droid (public reads, 2026-11-08 00:38 UTC)

- fdroiddata `master`: `Builds` for 1.0.53, 1.0.55, 1.0.56, 1.0.60, 1.0.61 and **1.0.63** (commit `3281ba8f...`), `CurrentVersion` 1.0.63, `CurrentVersionCode` 10000634. Newest recipe commit **`69401fd9`** ("bot: Update SnowRaven to 10000634", 2026-11-07 09:03 UTC), and before it `754c9f1f` (1.0.61). **No 1.0.62 entry: the bot took the newest tag and skipped it.**
- Build logs for 10000621, 10000622, 10000624, 10000631, 10000632, 10000634: all HTTP 404 (not attempted).
- f-droid.org publishes 1.0.61, 1.0.60, 1.0.59 (`suggestedVersionCode` 10000614).
- States: **1.0.62 superseded on F-Droid by 1.0.63**; **1.0.63 included and this tag not yet built**. 1.0.64 will be read after its tag. This release changes no `scripts/android/toolchain.env` pin and no recipe build step, so nothing goes to fdroiddata.

### CI on `main`

- Pipeline `42337915525` (`226475fb`) and `42339044403` (`1e24a50c`) are red, each with exactly 1 failed file of 495 (489 passed, 5 skipped), each a different CPU-timing ratio on GitHub's shared runners: `alphaCodes.test.ts` (per-doubling quotient 15.82 against 15.625) and `lifeListsLinearity.test.ts` (21.93 against 20). Backend green in both. The last green run is `42334891588` on `38cb0c2f`.
- **Windows Build and Android Build trigger only on `v*` tags** (`windows-build.yml`, `android-build.yml`), so they are judged on their own runs, pinned to the tag's commit. Pipeline triggers on pushes to `main` with `cancel-in-progress`. Pages triggers on `website/**`, so the release commit's pill change publishes the website.

## The user's sign-off (2026-11-07)

The user answered the production sign-off gate themselves: **"Approve the text and ship 1.0.64"**, with the What's New exactly as drafted in `held/whats-new.txt` (217 characters), relayed by the coordinator. That answer authorizes the whole ship and the writing of the held copy. The ship runs in two parts at the coordinator's direction, because another session holds 1.0.65: **B1** is plan steps 1 to 5, 8 and 10 (through a finished `release.sh`, with the recipe-hash and iOS-stamp commits not yet made); **B2** is the rest (Android, iOS and TestFlight, the user's iPhone check, the App Store record and submission, the recipe follow-up, the ledger).

## Phase B plan (runs only on the user's recorded "confirm" at the sign-off)

Every step is the Deployer's own except the two user steps marked **USER**. Every `adb` command is addressed to `emulator-5554`; no physical device is touched; no other worktree is entered; no `git stash`.

**One change from the 1.0.63 order, on purpose:** after the tag, the recipe-hash and iOS-stamp commits are made locally but **pushed only after Pipeline has finished on the tagged commit**, so the run that judges the shipped tree runs to the end instead of being cancelled by the next push (at 1.0.63 it was cancelled twice). `release.sh` does not need HEAD pushed (it reports HEAD against the tag and requires only a clean tree), and Android preflight checks the tag, not `main`.

1. **Start-of-ship checks.** `security show-keychain-info ~/Library/Keychains/login.keychain-db` (if it says "User interaction is not allowed", stop: **USER** runs `security unlock-keychain ~/Library/Keychains/login.keychain-db` in their own terminal). `git fetch origin --tags`; `origin/main` still `1e24a50c` (if not, rebase onto it and re-run step 3). `git ls-remote --tags origin 'v1.0.64*'` empty. `node asc-read.mjs` (from `pipeline/app-store-listing-polish/asc/`, in `zsh -lc`): no 1.0.64 record, nothing open. `pgrep -fl 'release.sh|notarytool|altool|tauri'`: nothing.
2. **The approved copy.** On the yes, with the text as approved (if the user changed it, rewrite `held/fdroid-changelog.txt` and `held/whats-new.txt` first and re-take the hash):
   `for c in 10000641 10000642 10000644; do cp pipeline/exotic-provenance-reuse/held/fdroid-changelog.txt fastlane/metadata/android/en-US/changelogs/$c.txt; done`, then `shasum -a 256` on the three (all equal to the held file), `grep -c $'\u2014'` 0, and `ls fastlane/metadata/android/en-US/changelogs/1000064.txt` absent. Mark `held/README.md` APPROVED with the date and the exact text.
3. **Guards, the full suite, the build** (each alone, nothing else compiling): `cd frontend && npx vitest run src/lib/fastlaneMetadata.test.ts src/lib/androidVersionSource.test.ts src/lib/fdroidRecipe.test.ts src/lib/icloudKeysPublishedClaims.test.ts src/lib/iosSceneManifest.test.ts src/lib/iosWidgetManifest.test.ts src/lib/lifeListsPublishedClaims.test.ts` (all green), then `npx vitest run` (the full suite: the commit edits a guard), then `npm run build`. A timing-ratio failure under full-suite load is re-run alone before it is judged (the QA report's `parseBarChart` precedent).
4. **The release commit**, files named explicitly: `git add CHANGELOG.md frontend/package.json frontend/package-lock.json src-tauri/tauri.conf.json website/index.html pipeline/android-release/fdroid/com.dtgibson.snowraven.yml fastlane/metadata/android/en-US/changelogs/10000641.txt fastlane/metadata/android/en-US/changelogs/10000642.txt fastlane/metadata/android/en-US/changelogs/10000644.txt frontend/src/lib/lifeListsPublishedClaims.test.ts pipeline/exotic-provenance-reuse/deployment.md pipeline/exotic-provenance-reuse/held pipeline/exotic-provenance-reuse/decisions.md`; `git commit` as `chore(release): 1.0.64, the escapee check settles` (body: the six-file set, the approved F-Droid text, the guard pinned to 1.0.63, the records; the attribution line).
5. **Push `main`, then the tag.** `git -c credential.helper='!gh auth git-credential' push origin main` (fast-forward `1e24a50c..<release>`). `git tag -a v1.0.64 -m "SnowRaven 1.0.64: the escapee check settles" <release sha>`; `git -c credential.helper='!gh auth git-credential' push origin v1.0.64`. Verify: `git ls-remote --tags origin v1.0.64 'v1.0.64^{}'` peels to the release commit; `git show v1.0.64:src-tauri/tauri.conf.json` reads 1.0.64 / 1000064; `git ls-tree --name-only v1.0.64 fastlane/metadata/android/en-US/changelogs/` lists the three. This starts Pipeline and Pages on the release commit and Windows Build and Android Build on the tag.
6. **Recipe hash, committed locally, NOT pushed yet.** `SHA=$(git rev-parse 'v1.0.64^{commit}')`; replace the three `    commit: 3281ba8ff4348a07df3f5f3ae30f7c01912ca044` lines with `    commit: $SHA` (count exactly 3 after); `git diff v1.0.63 v1.0.64 -- scripts/android/toolchain.env` empty and the recipe's `sudo:`/`prebuild`/`build` unchanged (nothing to fdroiddata); `fdroidRecipe`, `fastlaneMetadata`, `androidVersionSource` green; commit `fix(fdroid): the recipe names v1.0.64's commit`.
7. **iOS, during the CI wait** (the skill's iOS section, every step):
   - `mv src-tauri/gen/apple/build/snowraven_iOS.xcarchive src-tauri/gen/apple/build/snowraven_iOS-1.0.63.1-stale-before-1.0.64.xcarchive`.
   - Recreate the shims unconditionally: `mkdir -p /tmp/xcshim`; the `xcodebuild` and `xcrun` shims (`#!/bin/sh`, `export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`, `exec /usr/bin/<tool> "$@"`) and the `swift` shim verbatim from the skill; `chmod +x` all three. `xcrun --sdk iphoneos --show-sdk-version` prints 27.1.
   - Widget Swift tests on a shut-down iOS 17+ iPhone simulator (leave any booted one alone): `cd src-tauri/gen/apple && PATH=/tmp/xcshim:$PATH xcodebuild test -project snowraven.xcodeproj -scheme snowraven_widgetsTests -destination 'platform=iOS Simulator,id=<udid>' -test-timeouts-enabled YES`; all pass.
   - Outside the Bash sandbox: `zsh -lc 'export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer LANG=en_US.UTF-8; export APPLE_API_KEY="$APPLE_API_KEY_ID" APPLE_API_ISSUER="$APPLE_API_ISSUER_ID" APPLE_API_KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_$APPLE_API_KEY_ID.p8"; cd /Users/developer/devwork/snowraven && PATH=/tmp/xcshim:$PATH npx tauri ios build --export-method app-store-connect --build-number 1'`. `** BUILD SUCCEEDED **`; Tauri's own export refusal (any of its three wordings) is expected.
   - Confirm the fresh archive by its stamp: `ApplicationProperties:CFBundleVersion` 1.0.64.1, short version 1.0.64; `xcrun vtool -show-build` on `Products/Applications/SnowRaven.app/SnowRaven` reports `platform IOS`, sdk 27.1; every swift-rs `lib*.a` reports `LC_BUILD_VERSION` platform 2. Restore any no-op `project.pbxproj` change Tauri made.
   - `codesign -f -s - --generate-entitlement-der --entitlements src-tauri/gen/apple/snowraven_widgets/snowraven_widgets.entitlements src-tauri/gen/apple/build/snowraven_iOS.xcarchive/Products/Applications/SnowRaven.app/PlugIns/snowraven_widgets.appex`, then `codesign -d --entitlements - --xml <appex>` lists the App Group.
   - `xcodebuild -exportArchive -archivePath src-tauri/gen/apple/build/snowraven_iOS.xcarchive -exportPath src-tauri/gen/apple/build/export-1.0.64.1 -exportOptionsPlist ~/.tauri/snowraven-ios-export-options.plist`. `DistributionSummary.plist`: both bundle ids, the appex with the App Group alone, the app with the App Group, the three iCloud keys and `Production`. Every iOS icon PNG `hasAlpha: no`.
   - In `zsh -lc` with `DEVELOPER_DIR` exported: `xcrun altool --validate-app -f <ipa> -t ios --apiKey "$APPLE_API_KEY_ID" --apiIssuer "$APPLE_API_ISSUER_ID"` (`VERIFY SUCCEEDED`), then `--upload-app` with the same flags; record the Delivery UUID.
   - Stamp commit, locally, NOT pushed yet: `iosSceneManifest`, `iosWidgetManifest` green; `git add src-tauri/gen/apple/snowraven_iOS/Info.plist src-tauri/gen/apple/snowraven_widgets/Info.plist`; commit `chore(ios): stamp iOS 1.0.64 build 1`.
8. **CI on the tagged commit.** `gh run list --workflow windows-build.yml --commit $SHA`, the same for `android-build.yml` and `pipeline.yml`; watch each to completion (`gh run watch <id> --exit-status`). Windows and Android must succeed (a failure is a Type 2 stop). **Pipeline timing rule:** if it fails, read `gh run view <id> --log-failed`. If the only failures are CPU-timing quotient assertions (the `alphaCodes`, `lifeListsLinearity`, `parseBarChart` class), run `gh run rerun <id> --failed` once and judge the rerun; record both attempts and the quotients. If the rerun is green, proceed. If it is red again on timing only, run that file alone locally, record it, and report it to the Orchestrator as a flag before the App Store submission (the desktop and Android legs may proceed, since the local full suite at step 3 is green). Any non-timing failure: stop, Type 2, nothing further is published.
9. **Push the two held commits** once Pipeline on the tag has finished: `git -c credential.helper='!gh auth git-credential' push origin main` (`<release>..<stamp>`). Its Pipeline run on the stamp commit is judged the same way, and the ledger commit (step 14) is not pushed until it has finished, so it is not cancelled.
10. **Desktop.** No SnowRaven dev watcher running, nothing else using `~/.snowraven-build`: `CI=true zsh -lc ./release.sh` (with `ALLOW_DIRTY=1` only if `git status --porcelain` holds nothing but this record). Expect `Releasing v1.0.64: tag=<release> HEAD=<stamp>`, notarization Accepted, the Windows installer fetched from the run pinned to the tag. Then download the DMG from the release and require `codesign --verify --verbose=2`, `xcrun stapler validate`, `spctl -a -t open --context context:primary-signature -vv` (accepted, Notarized Developer ID) and `hdiutil verify`; `latest.json` with `darwin-aarch64` and `darwin-x86_64` on one updater bundle and `windows-x86_64` on `SnowRaven_1.0.64_x64-setup.exe`, all URLs 200; the installer byte-identical to the pinned run's artifact.
11. **Android** (preflight and sign may run during `release.sh`; attach after it has published), in the build shell (`JAVA_HOME`, `ANDROID_HOME`, `NDK_HOME`, `PATH` per the skill, `~/.tauri/gradle-8.14.3/bin` first): `scripts/android/preflight.sh` (all `ok`; its HEAD-is-not-the-tag warning is expected); `SNOWRAVEN_ANDROID_SIGNER_SHA256=42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a scripts/android/sign.sh <UNSIGNED_APK>` (signer digest equal). Emulator opening check of those exact bytes on `sr-api36-phone` only (`-gpu host -no-snapshot-save`, headless): fresh install, `versionName` 1.0.64 / `versionCode` 1000064, Welcome drawn, Statistics drawn, one process, empty crash buffer, screenshots to `evidence/ship/`; WebView `versionName` read (133 means "unchanged since the last measurement"); uninstall, stop the emulator. Then `ANDROID_DEVICE_CHECK=partial ANDROID_CHECKED_SHA256=<signed sha> SNOWRAVEN_ANDROID_SIGNER_SHA256=42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a scripts/android/attach.sh <SIGNED_APK>` (Partial on emulator evidence, the standing decision: the user owns no Android device).
12. **TestFlight, then the USER's iPhone check.** `node asc-read.mjs`: build 1.0.64.1 `VALID`. Hand back to the Orchestrator as a registered wait for **USER**, with these steps: (1) on your iPhone, open TestFlight and install SnowRaven 1.0.64 (1); (2) open it and confirm it launches to your usual tab; (3) open Statistics and read the line under the Species figure; (4) quit SnowRaven fully, open it again, open Statistics, and confirm the line does not start a progress bar again (if some of your species are unresolved it reads "eBird's answers did not include N of your species, so they still count."). Record only what the user reports, with its time, before step 13.
13. **The App Store record** (metadata key `QJA25M7XHM`, from a scratchpad script on `asc-lib.mjs`; values extracted from `appstore/LISTING.md` and `appstore/REVIEW_NOTES.md` as committed; review contact compared, never printed):
    - Re-read: no open record or submission. `POST /v1/appStoreVersions` (IOS, `versionString` 1.0.64, `releaseType` AFTER_APPROVAL, `copyright` from LISTING, the app and build 1.0.64.1 relationships). Note the new en-US localization id and the editable app info.
    - One `PATCH` of the localization: `whatsNew` = the approved text without its trailing newline; `promotionalText` from LISTING if it arrived empty. Nothing else unless a field differs.
    - Read back every field against the committed files (description, keywords, promotional text, both URLs, copyright, What's New, review notes byte-identical, contact present, no demo account; name, subtitle, privacy URL, both categories on both app infos; the age rating on both, answered). Must end ALL SAME.
    - `npm ci` in `website/tools` if `node_modules` is missing; `node asc-screens.mjs readback --loc <new en-US id>` must end **ALL MATCH 18/18** (a new record carried all three sets at 1.0.62); re-run `replace` for any set that did not arrive.
    - Submit: `POST /v1/reviewSubmissions` (IOS, the app), `POST /v1/reviewSubmissionItems` (the record), `PATCH submitted: true`. Read back the submission `WAITING_FOR_REVIEW`, the record `WAITING_FOR_REVIEW`, and the fields once more. Reconcile all version records and TestFlight trains: no unaccounted gap from 1.0.13 to 1.0.64.
14. **F-Droid and the ledger.** The three public reads again (recipe on `master` and its commit history, logs for 10000631/2/4 and 10000641/2/4, the published list). `RELEASE_LEDGER.md`, new entries at the end of each section: App Store `### 1.0.64 SHIP`: 1.0.63 RESOLVED (`e48a104b` `READY_FOR_SALE` on 1.0.63.1, `690b9ad5` `COMPLETE`), the 1.0.64 record, build, delivery, submission, What's New, restored and carried fields, the read-backs, the reconciliation. Android `### 1.0.64 SHIP`: the APK and its SHA-256, the signer `42a3576e...996a`, Partial on emulator evidence, the WebView version, and the F-Droid sentences: **1.0.62 superseded on F-Droid by 1.0.63** (bot commit `69401fd9` added 1.0.63 only), 1.0.63's and 1.0.64's states as read. Append the ship steps to this record. Commit `docs(release): 1.0.64 ledger entries`; push only after the stamp commit's Pipeline run has finished.
15. **Website.** Pages run on the release commit green; `https://snowraven.dtgibson.com/` answers with `aria-label="Version 1.0.64"`, `v1.0.64` in the pill and `SnowRaven v1.0.64` in the footer.

**Rollback** (if the post-ship health checks fail): desktop and Android fix forward as 1.0.65, because the updater only moves forward and a published GitHub asset is replaced only by a decision, never by `--clobber`; a crash found by the iPhone check stops the App Store leg before submission (build 1.0.64.2 or 1.0.65); a submission still `WAITING_FOR_REVIEW` can be withdrawn (`DELETE /v1/appStoreVersionSubmissions/{versionId}`, to `DEVELOPER_REJECTED`); F-Droid builds from the tag on its own and cannot be recalled from here, so a fix rides the next tag. Any rollback is written into `decisions.md`.
