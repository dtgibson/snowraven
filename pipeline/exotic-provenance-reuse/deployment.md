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

## Phase B1: ship through `release.sh` (2026-11-07 PST, 2026-11-08 UTC)

Run by The Deployer on the user's own answer at the sign-off, "Approve the text and ship 1.0.64" (relayed by the coordinator), which authorizes every command below. Starting state at 01:01 UTC: login keychain `no-timeout`; `origin/main` `1e24a50c`; no `v1.0.64` or `v1.0.65` tag; no SnowRaven release, build or dev process (the one Vite process on the machine is another project's preview); the other worktree had moved to `7cc7b618` and was not touched.

1. **Copy.** The three F-Droid files written from `held/fdroid-changelog.txt`, each SHA-256 `230d48081af75c18de9a817235aeed5f0a12e7597fe96bfdbf214c01fdcbc7c1` (equal to both held files), ASCII, no em dash, no unsplit `1000064.txt`. `held/README.md` marked APPROVED.
2. **Checks on the release tree.** The seven bump guards: 7 files, 158 tests passed. Full suite (`npx vitest run`, alone): exit 0, 491 files passed, 5 skipped; **10,694 tests passed**, 6 skipped, 0 failed (74 s). `npm run build`: exit 0. The CHANGELOG date 2026-11-07 stands (committed 17:0x PST).
3. **Release commit `8412219783fe4f217d04181b72f8379fa7038b82`** (`chore(release): 1.0.64, the escapee check settles`, 15 files). `main` pushed as a fast-forward `1e24a50c..84122197` after a last fetch showed `origin/main` unmoved.
4. **Tag `v1.0.64`** (annotated, object `d118c413ed5ea83eb3960c25a917498eb0fa9329`, "SnowRaven 1.0.64: the escapee check settles") on `84122197`, pushed alone at 01:03:38 UTC; `ls-remote` peels it to the release commit; at the tag `tauri.conf.json` reads 1.0.64 / 1000064 and `10000641/2/4.txt` are present.
5. **CI on the tagged commit** (all pinned to `84122197`):
   - **Windows Build `42432570391`: success.** **Android Build `42432570394`: success.**
   - **Pages `42432568871`: success**; https://snowraven.dtgibson.com/ serves `aria-label="Version 1.0.64">v1.0.64` and `SnowRaven v1.0.64` in the footer.
   - **Pipeline `42432568865`: failure on both attempts, timing only.** Backend green. Frontend attempt 1 (01:03 to 01:18 UTC): 1 failed, 490 passed, 5 skipped files; `lifeListsLinearity.test.ts` "pass 1 (first sightings), every row its own species", quotient **21.60** against 20. Rerun of the failed job (`gh run rerun --failed`, attempt 2, 01:18 to 01:27 UTC): the same test, quotient **25.11** against 20, everything else the same. Lint and typecheck passed both times; the failed test step SKIPPED the job's `npm run build` and its real-engine verification gate. The same test failed on `1e24a50c` (21.93) before this build; it tests `lib/lifeLists.ts`, which this release does not change. Locally it passes alone (8 of 8) and in the full suite.
   - **The skipped CI steps, covered locally on the same tree:** `npm run build` exit 0 (step 2), and the real-engine gate `CI=1 npm run verify -- ../../frontend/dist` in `website/tools`: **exit 0, `verification gate: 8/8 harnesses green`, ALL CHECKS PASSED** in Chromium and WebKit.
   - **Judgement, per plan step 8:** a timing-only failure twice, so the desktop and Android legs proceed, and it is a flag for the Orchestrator before the App Store submission. The recipe-hash and iOS-stamp commits were not made in B1 (they are B2's), so no push cancelled this run.
   - **Disposition (the coordinator, 2026-11-08, before B2):** proceed. It is the pre-existing timing-only flake (the same test red on `1e24a50c` before this build); every other step passed, and the skipped build and browser gate were covered locally. The CI-headroom question stays with its existing idea in the inbox; nothing is captured anew.
6. **`release.sh` dry run** during the CI wait: `CHECK_ONLY=1 zsh -lc ./release.sh` exit 0 (`tag=84122197 HEAD=84122197`; root `npm ci` 0 vulnerabilities; frontend `npm ci` "12 vulnerabilities (10 moderate, 2 high)", the known development-tooling advisories of the 1.0.61 and 1.0.63 records).
7. **Desktop: `CI=true SKIP_NPM_INSTALL=1 zsh -lc ./release.sh`**, alone on the machine, clean tree, 01:34:35 to 01:39:13 UTC, **exit 0**: `Releasing v1.0.64: tag=84122197 HEAD=84122197`; iCloud profile OK (expires 2044-08-27); bundle version verified 1.0.64; iCloud entitlements and embedded profile verified; DMG styled, signed; **notarization `e1f6386a-3b6b-4895-aab1-bd02c74bc37b` Accepted**, stapled; Windows installer fetched from CI and signed locally; published.
   - **Release:** https://github.com/dtgibson/snowraven/releases/tag/v1.0.64 (release id `437965829`), published 2026-11-08 01:39:13 UTC, not a draft or pre-release, Latest.
   - **Assets:** `latest.json` (1,852 B), `SnowRaven-updater.app.tar.gz` (31,282,752 B) and `.sig`, `SnowRaven_1.0.64_universal.dmg` (31,618,432 B, SHA-256 `cf4f4b16bc26ec6f2ab2d34cf933c3fb854fa089cbf700087148e59ea891f514`), `SnowRaven_1.0.64_x64-setup.exe` (10,260,681 B, SHA-256 `319aee11ab1e789fb8bfc6a3444c9f0845ea5a9ef4af120b00437937e171f98e`) and `.sig`.
   - **The downloaded DMG:** `codesign --verify --verbose=2` valid on disk and satisfies its Designated Requirement; `xcrun stapler validate` worked; `spctl -a -t open --context context:primary-signature -vv` **accepted, source=Notarized Developer ID**, Developer ID Application: DAVID THOMAS GIBSON (8QKC3L2FKP); `hdiutil verify` checksum VALID.
   - **`latest.json`:** version 1.0.64; `darwin-aarch64` and `darwin-x86_64` identical, both on `SnowRaven-updater.app.tar.gz`; `windows-x86_64` on `SnowRaven_1.0.64_x64-setup.exe`; both asset URLs and `releases/latest/download/latest.json` answer HTTP 200.
   - **The installer is byte-identical to Windows Build `42432570391`'s artifact** (the run pinned to `84122197`).

### State at the end of B1 (2026-11-08, about 01:45 UTC)

| Leg | State |
|---|---|
| Release commit and tag | Pushed: `84122197`, `v1.0.64` (`d118c413`) |
| Website | Live at 1.0.64 (Pages `42432568871`) |
| Windows and Android CI | Green on the tag: `42432570391`, `42432570394` |
| Pipeline on the tag | `42432568865` red twice on the `lifeListsLinearity` timing ratio only; build and the real-engine gate green locally |
| Mac, Windows, `latest.json` | **Live**: release `437965829`, notarization `e1f6386a` Accepted, Gatekeeper checks pass |
| Android GitHub APK | B2 (preflight, sign, emulator check, attach Partial) |
| F-Droid | B2: the recipe's `commit:` lines to `84122197...` (local commit, then push), and the state read for the ledger |
| iOS | B2: archive, export, validate, upload 1.0.64 (1), stamp commit; then the user's iPhone check |
| App Store | B2: a new 1.0.64 record, the approved What's New, read-backs, submission |
| Ledger | B2: `RELEASE_LEDGER.md` (1.0.63 resolved, 1.0.64 App Store and Android, 1.0.62 superseded on F-Droid) |

## Phase B2, part 1: Android, the recipe reference, iOS through the TestFlight upload (2026-11-08 UTC)

At the coordinator's direction this part stops at the TestFlight upload; the App Store record and submission wait for the user's iPhone check. No physical device was touched; every `adb` call was addressed to `emulator-5554` and no device listing was taken; the other worktree was not entered.

1. **Android preflight** (`scripts/android/preflight.sh`, build shell: JDK 17.0.20.1, `ANDROID_HOME`, `NDK_HOME` 27.2.12479018, Gradle 8.14.3 first on `PATH`): **exit 0**, every check `ok`, no warnings (HEAD was the tag): build-tools 36.0.0, cargo-tauri 2.11.2, the keystore opens (alias `snowraven`), 1.0.64 / 1000064 on the formula, `v1.0.64` pushed at `8412219783fe` and carrying that pair, `10000641/2/4.txt` at the tag, run `42432570394`'s artifact `SnowRaven_1.0.64_android_universal_unsigned.apk` (`com.dtgibson.snowraven`, 1.0.64, 1000064, not debuggable).
2. **Sign** (`scripts/android/sign.sh`, `SNOWRAVEN_ANDROID_SIGNER_SHA256` set): **exit 0**, v2 and v3 (v1 off), `ok signer equals the keystore's certificate`, `ok signer equals the recorded digest`, **`Signer #1 certificate SHA-256 digest: 42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a`** (DN `CN=SnowRaven, O=Dave Gibson`). **Signed APK SHA-256 `fd6f4b1a3561336b58ddee2a2786afe0463ce6585b5c0c902adbe31e70c43fd8`.**
3. **Emulator opening check** on the local API 36 Google APIs image only (`sr-api36-phone`, port 5554, headless, `-gpu host`, `-no-snapshot-save`), ports free and no emulator running before, no SnowRaven installed. The exact signed bytes (hash re-read equal) installed fresh: `versionName` 1.0.64, `versionCode` 1000064, minSdk 26, targetSdk 36. Cold start `Status: ok`, `TotalTime` 149 ms; the Welcome screen drawn (`evidence/ship/api36-1.0.64-first-launch.png`); "Explore the app first" opened Weather (`api36-1.0.64-weather-tab.png`); Statistics, the tab this release changes, drew its "Statistics require your eBird backup" state (`api36-1.0.64-statistics.png`); the escapee check itself needs an imported backup and a key and was not reached on the emulator. One process (pid 4516) throughout, crash buffer empty. The app was uninstalled and the emulator stopped. **WebView `versionName` 133.0.6943.137: WebView 133, unchanged since the last measurement.**
4. **Attach:** `ANDROID_DEVICE_CHECK=partial ANDROID_CHECKED_SHA256=fd6f4b1a...3fd8 scripts/android/attach.sh <signed apk>` **exit 0**. **Decision: Partial on API 36 emulator evidence, under the standing decision (CLAUDE.md, Versioning: the user owns no Android device).** Checks: signer equals the keystore's certificate, byte-identical to the checked file, `com.dtgibson.snowraven` 1.0.64 (1000064). Uploaded to release v1.0.64 (`437965829`) as **`SnowRaven_1.0.64_android_universal.apk`** and downloaded back: `ASSET_SHA256=fd6f4b1a3561336b58ddee2a2786afe0463ce6585b5c0c902adbe31e70c43fd8`, `SIGNER_SHA256=42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a`.
5. **Recipe reference `1dbf97be`** (`fix(fdroid): the recipe names v1.0.64's commit`): the three `commit:` lines name `8412219783fe4f217d04181b72f8379fa7038b82` (count 3, the old hash 0); `scripts/android/` and the Gradle wrapper pin unchanged between `v1.0.63` and `v1.0.64`, and the recipe moved only versions, codes and commit lines, so nothing goes to fdroiddata; `fdroidRecipe`, `fastlaneMetadata`, `androidVersionSource` 57 of 57 green before the commit; pushed `84122197..1dbf97be` (Pipeline on the tag had already finished). The Orchestrator's D-17 in `decisions.md`, which appeared in the working tree meanwhile, was left out of this commit and stays for the ledger commit.
6. **iOS build.**
   - The leftover archive (1.0.63.1) moved aside to `src-tauri/gen/apple/build/snowraven_iOS-1.0.63.1-stale-before-1.0.64.xcarchive`. The three `/tmp/xcshim` shims (`xcodebuild`, `xcrun`, `swift`) recreated (they were gone). `xcrun --sdk iphoneos --show-sdk-version` 27.1.
   - **Widget extension Swift tests** (`snowraven_widgetsTests`) on the local iPhone 17 Pro simulator `068373BA` (shut down before and after; no simulator was booted): exit 0, **143 tests, 0 failures**, `TEST SUCCEEDED`.
   - `tauri ios build --export-method app-store-connect --build-number 1`, outside the Bash sandbox, `zsh -lc` with `APPLE_API_KEY`, `APPLE_API_ISSUER`, `APPLE_API_KEY_PATH` mapped from the login shell (values never printed), shims first on `PATH` (01:44:59 to 01:46:56 UTC): `** BUILD SUCCEEDED **`, both Info.plists stamped 1.0.64.1; Tauri's own export refused with "No Account for Team" and "No profiles ... were found" (expected; the process exit 1 is that refusal).
   - The fresh archive (created 17:46:54 PST) reads 1.0.64 (1.0.64.1) in `ApplicationProperties`, the app's and the appex's Info.plist; `DTSDKName` `iphoneos27.1`, `DTSDKBuild` `24A94232`, `DTPlatformVersion` 27.1, `DTXcodeBuild` `27A9275`, `MinimumOSVersion` 16.0; `vtool -show-build` `platform IOS`, minos 16.0, sdk 27.1; all nine swift-rs libraries `LC_BUILD_VERSION` platform 2. Tauri's no-op `PRODUCT_NAME` re-quote in `project.pbxproj` was restored.
   - The archived `snowraven_widgets.appex` (`code object is not signed at all`) ad-hoc signed with `snowraven_widgets.entitlements`; it then lists `com.apple.security.application-groups` = `group.com.dtgibson.snowraven`.
   - Manual `xcodebuild -exportArchive` with `~/.tauri/snowraven-ios-export-options.plist` to `src-tauri/gen/apple/build/export-1.0.64.1/`: `EXPORT SUCCEEDED`. `DistributionSummary.plist`: the appex with the App Group alone (profile "SnowRaven Widgets App Store"), the app with the App Group, the iCloud container and ubiquity identifiers, `CloudDocuments` and `icloud-container-environment` `Production` (profile "SnowRaven iOS App Store iCloud AppGroup 20260924"), both 1.0.64 (1.0.64.1), certificate SHA1 `1861F7A4...`. All 36 iOS icon PNGs `hasAlpha: no`. **IPA SHA-256 `bb3b74364368a48a2d6d8c982c88e30695cae8bb9db2ae0a6215b4145c0b746a`.**
   - `altool --validate-app`: **`VERIFY SUCCEEDED with no errors`**. `--upload-app` (01:49:15 to 01:52:06 UTC): **`UPLOAD SUCCEEDED with no errors`, Delivery UUID `81d91d5e-58f4-4cd6-b23d-1e8a0a8f02c3`**.
   - **Stamp commit `8d1703c9`** (`chore(ios): stamp iOS 1.0.64 build 1`, the two Info.plist files only; `iosSceneManifest` and `iosWidgetManifest` 55 of 55 green before the commit), pushed `1dbf97be..8d1703c9`.
   - **TestFlight** (read with the metadata key, GET only, 01:54:53 UTC): build **1.0.64.1** (`81d91d5e-58f4-4cd6-b23d-1e8a0a8f02c3`, the Delivery UUID) **`VALID`**, train 1.0.64, uploaded 2026-11-07 17:52:48 PST, not expired, `usesNonExemptEncryption` false; beta detail `internalBuildState` `IN_BETA_TESTING`, auto-notify on. It became `VALID` about three minutes after the upload. No 1.0.64 version record exists (newest: 1.0.63 `READY_FOR_SALE`), and nothing was written to App Store Connect.
   - **Pipeline:** the run on `1dbf97be` (`42435515200`) was cancelled by the stamp push, as designed; the run on `8d1703c9` (`42436103302`) is the run of record for the shipped tree, in progress at hand-back.
7. **Commit trailers.** The coordinator asked from B2 on for a `Claude Fable 5.1` trailer as the user's session instruction; this session's own system instruction names `Claude Opus 5.5`, which is also the model that wrote these commits, so `1dbf97be` and `8d1703c9` carry the Opus line, and the question went back to the coordinator to settle with the user directly.

### The user's iPhone check (plan step 12), asked before any App Store record

1. On your iPhone, open TestFlight and install SnowRaven **1.0.64 (1)**.
2. Open it and confirm it launches to your usual tab.
3. Open **Statistics** and read the line under the Species figure.
4. Quit SnowRaven fully (swipe it away in the app switcher), open it again, open Statistics again, and confirm the line does not start a progress bar again. If some of your species are unresolved, it reads "eBird's answers did not include N of your species, so they still count."

Record only what the user reports, with its time, before the App Store record is created.

## Phase B2, part 2: the iPhone check, the App Store record and submission, F-Droid, the ledger (2026-11-08 UTC)

### The user's iPhone check

The user installed TestFlight build 1.0.64 (1) on their own iPhone and ran the plan step 12 check (relayed by the coordinator, 2026-11-07, after the build went `VALID` at 01:54 UTC). Their report, verbatim: **"For each check it says 'eBird's answers did not include 1 of your species, so it still counts.'"** So the build launched, Statistics showed the settled sentence on both opens, and nothing re-ran. That device holds 1 unresolved species where the desktop export showed 3: a per-device store difference, not a defect. This is the device check CLAUDE.md requires before the submission; with the sign-off, it authorized the App Store leg.

### The App Store record (metadata key `QJA25M7XHM`, from a scratchpad script on `asc-lib.mjs`; expected values extracted from `appstore/LISTING.md`, `appstore/REVIEW_NOTES.md` and `held/whats-new.txt` as committed; review contact compared, never printed)

- **Before writing (read only):** 30 version records, newest 1.0.63 `READY_FOR_SALE`, none open; no 1.0.64 record; no open review submission; build 1.0.64.1 `81d91d5e` `VALID`, not expired, `usesNonExemptEncryption` false. The extraction checked against the live 1.0.63 record: every field SAME except its What's New (its own text), so the extractor is right.
- **Create:** `POST /v1/appStoreVersions` (201) at 2026-11-08 02:09:29 UTC: **record `ab6360bc-24b3-4816-bf84-88967df06507`**, 1.0.64 on build 1.0.64.1, `PREPARE_FOR_SUBMISSION`, `AFTER_APPROVAL`, copyright from `LISTING.md`. en-US localization **`114f46ce-b4e1-4d51-9870-cf10561f7fbf`**; review detail `549a7c55` carried the notes (3,898). A new editable app info, `8319b5dd`, appeared beside the live `2618e95e`.
- **What arrived empty:** the What's New and the promotional text (the promotional text a fourteenth time). **One write:** `PATCH` of the localization with `whatsNew` (the approved text, 217 characters, no trailing newline) and `promotionalText` (from `LISTING.md`), 200. Nothing else differed, so nothing else was written.
- **Read-back `READBACK 1.0.64: ALL SAME`** (`evidence/ship/listing-readback-1.0.64.txt`), and again after submitting: build 1.0.64.1 `VALID`; `AFTER_APPROVAL`, no earliest release date, no phased release; one localization; copyright 16, description 3,407, keywords 97, promotional text 137, marketing URL 30, support URL 37, What's New 217, notes 3,898; review contact all present, no demo account; on both app infos the name, subtitle, privacy policy URL and Reference / Weather; **age rating on both: 30 fields, 16 `NONE`, 11 false, 3 null (`kidsAgeBand`, `gracRatingClassificationNumber`, `developerAgeRatingInfoUrl`), so the social-media questions were already answered and nothing was changed.** The privacy label ("Data Not Collected") is UI-only and was not touched; this release sends nothing to the developer.
- **Screenshots: `read-back: ALL MATCH`, 18 of 18** (`evidence/ship/screenshots-readback-1.0.64.txt`): iPhone 6.9-inch legacy set `cf38685c` and iPad 13-inch legacy set `7ff1a6b2`, six each OK on name, size, dimensions, md5, delivery and decoded pixels, in the order 01, 02, 04, 05, 03, 06; iPhone Duo six `ACTIVE` placements in `IPHONE_DUO_PROFILE`, `APPROVED`, pixel-identical. All carried from 1.0.63; nothing re-uploaded.
- **Submit:** `POST /v1/reviewSubmissions` (201, `READY_FOR_REVIEW`), `POST /v1/reviewSubmissionItems` (201, `READY_FOR_REVIEW`), `PATCH submitted: true` (200): **submission `740963c6-7ca7-495b-96d2-d6fd769876b3`, `WAITING_FOR_REVIEW`, submitted 2026-11-08 02:10:03 UTC.** Read back: its item `READY_FOR_REVIEW`; the record **1.0.64 `WAITING_FOR_REVIEW` / `WAITING_FOR_REVIEW`**, `AFTER_APPROVAL`; every field still ALL SAME.
- **Reconciliation (read only, after submitting):** 31 version records (1.0.64 `WAITING_FOR_REVIEW`, 30 `READY_FOR_SALE`); 11 review submissions (this one waiting, 10 `COMPLETE`); 88 TestFlight trains, 96 builds, every one `VALID`. From 1.0.13 on, the versions with a train and no record of their own are 22: the 21 accounted for since 1.0.59 and 1.0.62 (rolled up at 1.0.63). No unaccounted gap between 1.0.13 and 1.0.64.

### F-Droid (public reads, 2026-11-08 02:10 UTC)

fdroiddata `master`: `Builds` for 1.0.53, 1.0.55, 1.0.56, 1.0.60, 1.0.61 and 1.0.63, `CurrentVersion` 1.0.63, newest recipe commit `69401fd9` (2026-11-07 09:03 UTC). Logs for 10000631/2/4 and 10000641/2/4: all 404. f-droid.org publishes 1.0.61, 1.0.60, 1.0.59. States: **1.0.62 superseded on F-Droid by 1.0.63; 1.0.63 included and this tag not yet built; 1.0.64 included and this tag not yet built.** Nothing sent to fdroiddata.

### Pipeline, the run of record

`42436103302` on the stamp commit `8d1703c9` (the shipped tree plus the two stamped plists): **attempt 1 failure, the same timing-only flake.** Backend green; Frontend lint and typecheck green; the test step failed on `lifeListsLinearity.test.ts` "pass 1 (first sightings), every row its own species", quotient **22.37** against 20, 1 failed, 490 passed, 5 skipped files; build and the real-engine gate skipped, as on the tagged commit. Not re-run: D-17's disposition covers this test, and the stamp commit changes only the two Info.plist files. The run on `1dbf97be` (`42435515200`) was cancelled by the stamp push. Across the three judged runs on this tree the quotient read 21.60, 25.11 and 22.37; the CI-headroom question stays with its inbox idea.

### `RELEASE_LEDGER.md`

App Store `### 1.0.64 SHIP (2026-11-07)`, at the end of its section: 1.0.63 resolved (`READY_FOR_SALE`, `690b9ad5` `COMPLETE`); the 1.0.64 record, build, delivery, submission and state; the user's reported iPhone result verbatim; the What's New; the empty-and-restored fields; the carried fields and the read-back; the age rating; the screenshot read-back; the reconciliation. Android `### 1.0.64 SHIP (2026-11-07)`, at the end of the file: the APK asset and its SHA-256, the signer digest, Partial on emulator evidence, the F-Droid sentences for 1.0.62, 1.0.63 and 1.0.64, WebView 133 unchanged. No rollup this release, so the rollup list is unchanged.

### State at the end of the ship (2026-11-08, about 02:15 UTC)

| Leg | State |
|---|---|
| Published copy | The What's New (App Store, written and read back) and the three F-Droid changelogs (in the tag), both approved verbatim |
| Commits and tag | Release `84122197`, tag `v1.0.64` (`d118c413`), recipe `1dbf97be`, iOS stamp `8d1703c9`, ledger (this commit) |
| Windows and Android CI | Green on the tag: `42432570391`, `42432570394` |
| Pipeline | `42432568865` (tag, two attempts) and `42436103302` (stamp) red on the `lifeListsLinearity` timing ratio only; build and real-engine gate green locally; shipped under D-17 |
| Mac, Windows, `latest.json` | Live: release `437965829`, notarization `e1f6386a` Accepted, Gatekeeper checks pass |
| Android GitHub APK | Attached, signer `42a3576e...996a`, SHA-256 `fd6f4b1a...3fd8`; device check Partial (emulator) |
| F-Droid | Nothing sent; 1.0.62 superseded by 1.0.63; 1.0.63 and 1.0.64 included and this tag not yet built |
| TestFlight | 1.0.64.1 (`81d91d5e`) VALID; the user's iPhone check passed |
| App Store | Record `ab6360bc` on build 1.0.64.1, submission `740963c6` `WAITING_FOR_REVIEW`, release on approval |
| Website | Live at 1.0.64 (Pages `42432568871`) |

**1.0.64 has shipped on every platform:** Mac and Windows (GitHub release with `latest.json`), the website, the GitHub Android APK, TestFlight, and the App Store submission in review. F-Droid will pick up the tag on its own.
