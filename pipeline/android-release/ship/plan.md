# Ship plan: 1.0.53, the first Android release (full rhythm)

Written by The Deployer at part 1 (2026-10-04), for part 2. Every leg of the all-platforms rhythm is here in order, with its exact commands and preconditions. **User-performed** steps are marked; everything else is the Deployer's (or the Orchestrator's, where the release skill's weft-hosting split does not apply: this target is the user's own stack, so the Deployer runs it after the sign-off gate). The release skill (`.claude/skills/snowraven-release/SKILL.md`) is the authority for every mechanic named here; this file orders them for this release.

All commands run from the worktree `/Users/developer/devwork/snowraven/.claude/worktrees/android-release`, never the main checkout or another worktree. Never a bare `git stash`.

## State at the end of part 1

| | |
|---|---|
| Branch | `worktree-android-release`, ahead of `origin/main` (`6c27741d`), which it contains (merged twice: `ce5c1a7` for 1.0.49 and 1.0.50, `7f546606` for 1.0.51 and 1.0.52) |
| Version | 1.0.53, `bundle.android.versionCode` 1000053 (`0b13d745`); the next patch after `v1.0.52` |
| Suites on that HEAD | typecheck, lint, build (2,703 modules) exit 0; vitest 453 files, 9,795 passed, 0 failed, 7 skipped; backend 2,061 passed |
| Android | the 1.0.53 CI-shaped unsigned APK built locally, THROWAWAY-signed, opened on API 36 with main's code-built window, the narrowed http permit and the worker policy (results in `decisions.md`, part 1b) |
| Keystore | created 2026-10-04 by the Orchestrator at the user's direction (`~/.tauri/snowraven-android.p12`, certificate SHA-256 `42:A3:57:6E:...:99:6A`); the backup is the user's and pending |
| Android device | none; the user chose in writing to publish the APK and open the merge request on emulator evidence (FR-44 Partial, `decisions.md`) |
| Held copy | the Google wording is the user's two sentences in the listing and d5 (listing 3,858 characters); the `NonFreeNet` reason without its WebView clause |
| F-Droid recipe | 1.0.53 / 1000053 / `v1.0.53`; `fdroid lint -f --force-yamllint` no finding and `rewritemeta -l` lists nothing on its exact bytes (`adc632d0...a61d`); `NonFreeNet` still the schema's original sentence and `Categories` the default until the user's yes |
| Held | everything on the approval page (`approval/index.html`); nothing published |

## Preconditions before the first push (all must hold)

1. **The user's answers at the human beats:** the copy approval (every item on the approval page), the keystore in place (`ship/keystore-steps.md`), whether an Android device exists, who opens the fdroiddata merge request, and the production sign-off gate. **NFR-01 is decided** (the user accepted the WebView carve-out on 2026-10-04, with the published Google wording cut to their two sentences; `decisions.md`), so QA-52 closes as Pass as amended at R.
2. **Parallel-ship check (memory: check parallel ships before shipping):**
   ```sh
   git fetch origin --tags
   git log --oneline -3 origin/main
   git ls-remote --tags origin 'v1.0.5*'
   gh release list --limit 3
   gh run list --limit 6
   ```
   plus the ASC records (iOS leg, step 1). Read-only checks of the other worktrees' refs are allowed (`git log --oneline -3 worktree-species-first-of-year`, `git log --oneline -3 'weft-spool/*'`); touching them is not.
3. **Version.** 1.0.53 is the next patch after `v1.0.52`. If `v1.0.53` exists on `origin` at the moment of the push, re-bump to the next free patch first: `frontend/package.json` and its lockfile (two `version` lines), `src-tauri/tauri.conf.json` (`version` and `bundle.android.versionCode` by `major*1000000 + minor*1000 + patch`), the CHANGELOG heading and date, `website/index.html`'s pill text, `aria-label` and footer, the recipe's `versionName`, `versionCode`, `commit`, `CurrentVersion`, `CurrentVersionCode`, and `git mv` of `changelogs/1000053.txt` (staged, or at the root after the yes); amend `decisions.md`'s version entry. Then run `npx vitest run src/lib/androidVersionSource.test.ts src/lib/fdroidRecipe.test.ts src/lib/icloudKeysPublishedClaims.test.ts` (and `fastlaneMetadata.test.ts` once it exists).
4. **If `origin/main` moved,** merge it in again (`git merge --no-ff origin/main`), resolve only mechanical conflicts (an app-code or guard conflict is handed back, as at part 1b), and re-run the regression basics (typecheck, lint, build, full vitest, backend). Any change under `src-tauri/`, `capabilities/` or the platform files also re-runs the API 36 emulator check (first launch, one keyed Weather lookup, a hotspot load, a Statistics render, logcat for policy violations).
5. **The untracked QA evidence** (`pipeline/android-release/qa-screenshots/`, 35 MB, referenced by `qa-report.md` as uncommitted) would fail `release.sh`'s clean-tree preflight. Move it, do not delete it, before step L1: `mv pipeline/android-release/qa-screenshots <session scratchpad>/android-release-qa-screenshots-kept` (or commit a chosen subset if the user wants it in the repository). Never run `release.sh` with `ALLOW_DIRTY=1`.
6. **Keychain** (memory; after any reboot): `security show-keychain-info ~/Library/Keychains/login.keychain-db`. If it says "User interaction is not allowed", the **user** runs `security unlock-keychain ~/Library/Keychains/login.keychain-db` in their own terminal. Never ask for the password in chat.
7. **Nothing else building into `~/.snowraven-build`:** no other worktree's `release.sh` running (`ps -Ao command | grep -E 'release.sh|tauri build'`), and no `desktop:dev` watcher in this worktree.

## Cargo check (what the landing push carries)

`git log origin/main..HEAD` is this build's own commits plus the two merge commits `ce5c1a7` and `7f546606`, whose incoming content is already on `origin/main`; `7f546606` also carries this build's resolution of the `lib.rs` and `widgetPaths.parity.test.ts` overlap (geolocation kept at the head of the iOS-only line inside main's shared setup closure), which is this build's own change. Two commits do not name Android in their subject and are still this build's: `95b3b12` (the AGPL-3.0-only license field in the manifests) and `5ecbda7` (two guards following the iOS-only geolocation plugin). **No app-behavior commit from another build or from manual work rides this push** as of part 1. The record-keeping commits (pipeline, CHANGELOG, CLAUDE.md, decisions) are pre-approved cargo. Re-run `git log --oneline origin/main..HEAD` immediately before the push; any commit not on this list that is not this build's or record-keeping is named at the gate.

## P. Before the tag: the approved published copy (on the user's yes only)

F-Droid reads the tagged commit, so these land on the branch before L2. Each is written exactly as approved; if the user changed a word, the approval page's text is not what is written, their wording is.

- **P1. The Fastlane folder.** `git mv pipeline/android-release/fdroid/fastlane-proposal/en-US fastlane/metadata/android/en-US` (title, short and full description with the user's two Google sentences, `changelogs/1000053.txt`, `images/icon.png`, the six phone and six ten-inch screenshots, or the recaptured set if the user asked for a Weather shot), **in the same commit** as a new `frontend/src/lib/fastlaneMetadata.test.ts` per schema 6.4 (short description at most 80, every changelog at most 500, `changelogs/<current versionCode>.txt` exists, `title.txt` reads `SnowRaven`, `images/icon.png` passes the `androidIcons` icon rows, no em dash; guard-the-guard: removing the current changelog in a scratch copy goes red). Point `androidIcons.test.ts`'s staged-icon row at the new path if it reads the proposal path. Not written yet: it needs the folder at its root.
- **P2. The recipe.** `Categories:` and `AntiFeatures: NonFreeNet: en-US:` in `pipeline/android-release/fdroid/com.dtgibson.snowraven.yml` set to the approved values; then re-run the canonical-form check (`bash <scratchpad>/fdroid-recheck.sh`: `fdroid lint -f --force-yamllint` no finding, `rewritemeta -l` lists nothing; a long sentence folds onto continuation lines, so take rewritemeta's layout) and `npx vitest run src/lib/fdroidRecipe.test.ts`.
- **P3. The privacy policy, both copies at once.** `PRIVACY_POLICY.md` and `website/privacy.html`: d1 (effective date: the day it is published), d2, d3, d4 (branch B), d5 (with the user's two Google sentences) after `## iCloud Sync`, d6, exactly as approved; the website heading `<h2 id="android-app">Android App</h2>` and the `pp-date` line. Same commit: `privacyPageParity.test.ts`'s section count row 13 to 14 with an order row placing Android App after iCloud Sync, and the published-claims guard `.claude/rules/docs-and-website.md` requires for added policy sentences (the Android App section's claims held to the code: no geolocation plugin outside the iOS cfg, the manifest's permission set and the two WebView meta-data entries the published sentence names (`EnableSafeBrowsing=false`, `MetricsOptOut=true`), `showUpdaterFooter()` false on Android, and parity with `website/privacy.html`). Neither guard is written yet. The policy goes out with the release, so it is true on the day the APK appears.
- **P4. `ACCESSIBILITY.md`:** already in the branch; if the user said take it out, revert the clause and adjust the guard that required it, in one commit.
- **P5. Run** `npm run typecheck && npm run build && npx vitest run` and the backend suite once more, then commit P1 to P4 (one commit per surface is fine; messages end with the session's attribution line).

## L. The landing and the tag

- **L1. Land on main:** a fast-forward of this branch onto `origin/main` (the last two ships' route):
  ```sh
  git -c credential.helper='!gh auth git-credential' push origin HEAD:main
  ```
  A rejected push means `main` moved: back to precondition 4. On a git-integration target the push is the deploy, but here nothing user-visible deploys from `main` except the website (Pages runs on `website/**`), which at this point carries only the version pill and footer (and the privacy page, per P3).
- **L2. The tag** (lightweight, like `v1.0.50` to `v1.0.52`), on the landed commit:
  ```sh
  git tag v1.0.53 HEAD
  git -c credential.helper='!gh auth git-credential' push origin v1.0.53
  ```
  The tag starts `windows-build.yml` and `android-build.yml`, and it is the commit F-Droid will build.
- **L3. Wait for both, pinned to the tag's commit** (never an unpinned `--limit 1`):
  ```sh
  T=$(git rev-parse v1.0.53^{commit})
  gh run list --workflow windows-build.yml --commit $T
  gh run list --workflow android-build.yml --commit $T
  gh run watch <run id>
  ```
  This is the first tagged run of `android-build.yml` (QA-34, QA-01's Linux half, QA-71). If it fails on the Linux toolchain, that is a Type 2: the fix is a new commit and a re-bump route, not a moved tag. Build the iOS archive (I1 to I8) during this wait.

## D. Desktop: `release.sh` (macOS, Windows, `latest.json`)

- **D1. Preconditions:** keychain unlocked (precondition 6), clean tree (precondition 5; the iOS stamp committed and pushed, I9), Windows CI green on the tag's commit, nothing else using `~/.snowraven-build`.
- **D2.** `CI=true zsh -lc ./release.sh` (exit 0; it pins the Windows artifact to the tag's commit, notarizes and staples, signs the final DMG, publishes the GitHub release `v1.0.53` and `latest.json`).
- **D3. Verify:** download the DMG back from the release and require `codesign --verify --verbose=2`, `xcrun stapler validate` and `spctl -a -t open --context context:primary-signature -vv` reporting `accepted` / `Notarized Developer ID`; `latest.json` from `releases/latest/download` says 1.0.53 with `darwin-aarch64` and `darwin-x86_64` on the one universal bundle and `windows-x86_64` on the setup exe; the Pages run on the landed commit succeeded and the live site shows `v1.0.53` in the pill, its `aria-label` and the footer.

## A. Android: the signed GitHub APK

Build shell for every step (the release skill's exports, not yet in `~/.zprofile`):

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME="$HOME/Library/Android/sdk"
export NDK_HOME="$ANDROID_HOME/ndk/27.2.12479018"
export PATH="$HOME/.tauri/gradle-8.14.3/bin:$HOME/.cargo/bin:/opt/homebrew/opt/openjdk@17/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
```

- **A0. Precondition:** the keystore and its 0600 properties file at `~/.tauri/` exist (created 2026-10-04 at the user's direction; `ship/keystore-steps.md`). Preflight opens it. Remind the user once that the backup (steps 12 and 13 there) is still theirs.
- **A1. Preflight, real, no toggles:** `sh scripts/android/preflight.sh` (tag present locally and on `origin` at the same commit with the 1.0.53 pair, the `android-build` artifact from the run pinned to the tag's commit holding exactly `SnowRaven_1.0.53_android_universal_unsigned.apk`, its badging, the keystore). Keep the output; its last line is `UNSIGNED_APK=<path>`.
- **A2. Sign:** `sh scripts/android/sign.sh "$UNSIGNED_APK"`. First release, so `SNOWRAVEN_ANDROID_SIGNER_SHA256` is unset and the script binds the signer to the keystore's own certificate; the digest it prints must equal the keystore record's `42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a`. Record `Signer #1 certificate SHA-256 digest`, `SIGNED_APK=` and `SIGNED_APK_SHA256=`; the digest becomes `SNOWRAVEN_ANDROID_SIGNER_SHA256` for every later release.
- **A3. Emulator opening check of those exact bytes** (FR-42, QA-41): start `sr-api36-phone` with `-gpu host`, `adb -s emulator-5554 install -r "$SIGNED_APK"`, open it, screenshot the first usable screen, record `shasum -a 256 "$SIGNED_APK"` beside the screenshot. Address `adb` by serial only.
- **A4 and A5. No device check (the user's written decision, `decisions.md`, part 1b):** the user owns no Android device and chose to publish on emulator evidence. A3's screenshot and checksum of the exact signed bytes are that evidence; FR-44 / QA-43 is Partial. `ship/device-check.md` part A is kept for a future device and is not run.
- **A6. Attach**, after `release.sh` created the release:
  ```sh
  ANDROID_DEVICE_CHECK=partial ANDROID_CHECKED_SHA256=<sha256 of the file A3 opened> SNOWRAVEN_ANDROID_SIGNER_SHA256=<digest from A2> sh scripts/android/attach.sh "$SIGNED_APK"
  ```
  `partial` is allowed only because the written decision exists. It downloads the asset back and compares SHA-256.
- **A7. After the tag:** `fdroid checkupdates --allow-dirty --auto com.dtgibson.snowraven` in the scratch fdroiddata reports 1.0.53 (1000053) (QA-67).

## I. iOS: TestFlight, the user's check, then the App Store record

- **I0. Live ASC query first (metadata key `QJA25M7XHM`):** `GET /v1/apps/6787719977/appStoreVersions` and `GET /v1/builds?filter[app]=6787719977&sort=-uploadedDate`, read against CLAUDE.md's version-record list. **This ship must dispose of 1.0.51 and 1.0.52 as well as 1.0.53.** State at the 1.0.52 ship: 1.0.51 on its own record `c98d6dc5` (`WAITING_FOR_REVIEW`, submission `ba562487`, build 1.0.51.1); 1.0.52 DEFERRED behind it, VALID build 1.0.52.1 (`b3410c78`), no record, its iPad 05 recapture (`eca0be1`, First of Year) not yet uploaded. The routes, for the user at the gate:
  - **`c98d6dc5` still in review:** (a) roll 1.0.51 and 1.0.52 into 1.0.53: withdraw `c98d6dc5` from `ba562487` (`DELETE /v1/appStoreVersionSubmissions/c98d6dc5...`), retarget its `versionString` to 1.0.53, repoint it at build 1.0.53.1, What's New = 1.0.51's approved three paragraphs (`pipeline/spool-bundle-20261004/whats-new.md`, text (a)), then 1.0.52's approved sentence (`pipeline/species-first-of-year/whats-new.md`), then the 1.0.53 line, and replace the iPad set whole and in order (05 shows First of Year); or (b) defer 1.0.53 behind it too, written as a deferral, with 1.0.52 still waiting.
  - **`c98d6dc5` `READY_FOR_SALE`:** 1.0.51 is resolved; then (c) roll the deferred 1.0.52 into 1.0.53 on one new record (decided before any 1.0.52 record exists, so nothing is withdrawn; What's New = 1.0.52's sentence then the 1.0.53 line; iPad set replaced whole with 05), or (d) give 1.0.52 its own record first as its deferral planned and defer 1.0.53 behind it.
  The 1.0.53 train is unreleased, so the build-number route is available either way.
- **I1. Shims, unconditionally** (macOS clears `/tmp`):
  ```sh
  mkdir -p /tmp/xcshim
  printf '%s\n' '#!/bin/sh' 'export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer' 'exec /usr/bin/xcodebuild "$@"' > /tmp/xcshim/xcodebuild
  printf '%s\n' '#!/bin/sh' 'export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer' 'exec /usr/bin/xcrun "$@"' > /tmp/xcshim/xcrun
  printf '%s\n' '#!/bin/sh' 'export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer' 'if [ "$1" = "build" ]; then' '  shift' '  exec /usr/bin/swift build --build-system native "$@"' 'fi' 'exec /usr/bin/swift "$@"' > /tmp/xcshim/swift
  chmod +x /tmp/xcshim/xcodebuild /tmp/xcshim/xcrun /tmp/xcshim/swift
  ```
  This worktree has never built iOS, so `src-tauri/target/aarch64-apple-ios` is cold and the swift shim is required.
- **I2. Move any existing `src-tauri/gen/apple/build/snowraven_iOS.xcarchive` aside**, unconditionally.
- **I3. Widget Swift tests:** `cd src-tauri/gen/apple && PATH=/tmp/xcshim:$PATH xcodebuild test -project snowraven.xcodeproj -scheme snowraven_widgetsTests -destination 'platform=iOS Simulator,name=<an iOS 17+ iPhone>' -test-timeouts-enabled YES`, all pass.
- **I4. Archive, outside the Bash sandbox,** with Tauri's three signing names mapped from the login shell (`APPLE_API_KEY="$APPLE_API_KEY_ID"`, `APPLE_API_ISSUER="$APPLE_API_ISSUER_ID"`, `APPLE_API_KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_$APPLE_API_KEY_ID.p8"`), `DEVELOPER_DIR` exported, `/tmp/xcshim` first on `PATH`: `npm run tauri -- ios build --export-method app-store-connect --build-number 1` (the npm CLI, not `cargo tauri`, for iOS). Expect the archive to succeed and Tauri's own export to refuse (either cloud-signing wording, or "No Account for Team"). Confirm the fresh archive by its stamped `CFBundleShortVersionString` 1.0.53 and `CFBundleVersion` for app and widget, `vtool -show-build` reporting `platform IOS`, and every swift-rs `lib*.a` reporting platform 2.
- **I5. Sign the archived widget extension with its entitlements:** `codesign -f -s - --generate-entitlement-der --entitlements src-tauri/gen/apple/snowraven_widgets/snowraven_widgets.entitlements src-tauri/gen/apple/build/snowraven_iOS.xcarchive/Products/Applications/SnowRaven.app/PlugIns/snowraven_widgets.appex`, then confirm the App Group with `codesign -d --entitlements - --xml`.
- **I6. Export:** `xcodebuild -exportArchive -archivePath src-tauri/gen/apple/build/snowraven_iOS.xcarchive -exportPath <dir> -exportOptionsPlist ~/.tauri/snowraven-ios-export-options.plist`; `DistributionSummary.plist` lists both bundle ids, the extension with the App Group only, the app with the App Group and its three iCloud keys (environment Production).
- **I7. Validate, then upload,** with `DEVELOPER_DIR` exported in that shell: `xcrun altool --validate-app -f <ipa> -t ios --apiKey $APPLE_API_KEY_ID --apiIssuer $APPLE_API_ISSUER_ID` (VERIFY SUCCEEDED), then `--upload-app` with the same flags; record the Delivery UUID; poll `GET /v1/builds` until 1.0.53.1 is `VALID`.
- **I8. Stamp commit:** `chore(ios): stamp iOS 1.0.53 build 1` with `gen/apple/snowraven_iOS/Info.plist` (and `snowraven_widgets/Info.plist` if stamped); restore any `project.pbxproj` requoting rather than committing it; `npx vitest run src/lib/iosSceneManifest.test.ts src/lib/iosWidgetManifest.test.ts` green.
- **I9. Push the stamp** (`git -c credential.helper='!gh auth git-credential' push origin HEAD:main`) before D2. It cancels the tag commit's `Pipeline` run, expected; the stamp commit's run is the run of record. A single failure of `AlertsInboxSheet.test.tsx`'s Escape row there was judged a scheduling flake at 1.0.50 and re-run once; judge any repeat the same way only with the same evidence.
- **I10. User-performed:** the TestFlight check, `ship/device-check.md` part B, including the location step (this build moved the iOS geolocation grants into `capabilities/ios.json`; nothing automated runs that on an iPhone). A failure is build 1.0.53 (2), I2 to I9 again, before any record.
- **I11. The App Store record,** by the route the user chose at I0 (skill: withdraw is `DELETE /v1/appStoreVersionSubmissions/{versionId}`; submit is `POST /v1/reviewSubmissions`, `POST /v1/reviewSubmissionItems`, `PATCH .../reviewSubmissions/{id}` `submitted: true`). What's New written by script from the approved text and read back byte for byte; every listing field read back against `appstore/LISTING.md` (promotional text has arrived EMPTY on four new records); review notes byte-identical to `appstore/REVIEW_NOTES.md`; the age-rating declaration answered if the editable app-info record asks; `releaseType` `AFTER_APPROVAL`, no phased release. Screenshots: nothing photographed changes in 1.0.53 itself, but a record that carries 1.0.52 replaces the iPad set whole and in order for 05's First of Year recapture (`eca0be1`); verify all twelve checksums against `appstore/screenshots/` after the upload. The privacy label stays "Data Not Collected" (UI-only; confirm). **Flag carried to the gate:** the in-app Help bundled into the iOS app now names Android, which Guideline 2.3.10 could draw a review question on.
- **A8. WebView version:** read the API 36 image's WebView major version (`adb -s emulator-5554 shell dumpsys package com.google.android.webview | grep versionName`). 133 was measured; if it is newer, re-run `measurements/safe-browsing/` and `measurements/emoji-initializer/measure-emoji.sh` before the copy is reused (release skill, Android section), else write "WebView 133, unchanged since the last measurement" in the Android record.
- **I12. The CLAUDE.md record line, written in this ship:** the 1.0.53 entry, and the written disposition of 1.0.51 (resolved `READY_FOR_SALE`, or rolled into 1.0.53 with the resubmitted record id) and 1.0.52 (rolled into 1.0.53, given its own record, or still deferred, each with ids), added to the rollup list when a rollup happens; a version with no record and no sentence is a skip.

## F. F-Droid: the merge request (first Android release only)

- **F1. Preconditions** (`fdroid/merge-request.md`, "Before you open it"): P1 and P2 at the tag, the tag's Android CI green, the local `fdroid lint -f --force-yamllint`, `rewritemeta -l`, `scanner -e` and `build -v -l` on the tagged recipe (`build` logs `Successfully built version 1.0.53 of com.dtgibson.snowraven`; its exit code is not evidence; `sudo:` is skipped locally, say so).
- **F2. Opened at this ship (the user's written decision, `decisions.md`, part 1b), by the user or by the Deployer on the user's explicit word:** fork `fdroid/fdroiddata`, branch `com.dtgibson.snowraven`, `metadata/com.dtgibson.snowraven.yml` byte-identical to the recipe at `v1.0.53`, commit and title `New app: SnowRaven (com.dtgibson.snowraven)`, the description text from `merge-request.md`. Its pipeline is the first run of the `sudo:` block; a failure there is a recipe edit in the request (mirrored into the repository), never a release blocker.
- **F3. Or deferred, in writing, in exactly this form,** in CLAUDE.md's Android record line and `decisions.md`:
  `fdroiddata merge request deferred at 1.0.53 (<date>): <reason>; opens when <condition>.`
  A silence is not a deferral.

## W. After the APK is attached: website and README (on the user's yes)

- **W1.** The approved day-one forms of `held-copy.md` section (c), exactly as approved: in `website/index.html` the platforms paragraph's Android clause (c1), the platform-list item (c2), the Android install card after iPhone / iPad (c3), the hero line (c4) and the meta description (c5); in `README.md` line 3 (c7), the Android install bullet after iPhone / iPad (c8) and the Updating clause (c9). Nothing else in either file. The website's markup for c2 and c3 copies the neighboring item and card exactly (icon, classes, button).
- **W2.** Commit, push to `main` (Pages redeploys `website/**`), then fetch the live site and confirm the sentence and the pill.
- **W3.** When `https://f-droid.org/packages/com.dtgibson.snowraven/` is live (weeks later), the after-inclusion swap of c1, c2, c3, c8 and c9, plus the footer's F-Droid link (c6), is shown to the user again and written as one small follow-up commit.

## R. The record (part 2's close, before The Chronicler)

- CLAUDE.md's Android record line for 1.0.53 (FR-40): the GitHub APK published with no device check by the user's written decision (emulator evidence; signer SHA-256 `42a3576e...996a`); the F-Droid state in one of the five words (**merge request open** if F2 happened, else **deferred**, with the F3 sentence).
- `pipeline/android-release/decisions.md`: the deployment record (each leg, its ids, checksums, run ids and times; the user's device-check results with times), QA-52 closed as Pass as amended on the user's NFR-01 decision (already in `decisions.md` with its re-measure trigger, which is also in the release skill's Android section), and the A8 WebView reading.
- QA Partial rows closed by the ship, each with its evidence: QA-01, 34, 35, 36, 38, 39, 40, 41, 60, 64, 66, 71; QA-43 stays Partial by the user's no-device decision, and QA-63's keyed surfaces rest on the emulator's keyed run; QA-42 and QA-54 stay Partial (no Google-signed WebView APK for the at-or-above half; no x86_64 runner).
- `security-report.md` N1: resolved by the user's two-sentence form ("no crash reporter" for what the app contains; "may contact Google on its own" for the WebView), recorded in `decisions.md`; the Auditor's report is not edited.
