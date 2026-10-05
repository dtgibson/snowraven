# Ship plan: 1.0.51, the first Android release (full rhythm)

Written by The Deployer at part 1 (2026-10-04), for part 2. Every leg of the all-platforms rhythm is here in order, with its exact commands and preconditions. **User-performed** steps are marked; everything else is the Deployer's (or the Orchestrator's, where the release skill's weft-hosting split does not apply: this target is the user's own stack, so the Deployer runs it after the sign-off gate). The release skill (`.claude/skills/snowraven-release/SKILL.md`) is the authority for every mechanic named here; this file orders them for this release.

All commands run from the worktree `/Users/developer/devwork/snowraven/.claude/worktrees/android-release`, never the main checkout or another worktree. Never a bare `git stash`.

## State at the end of part 1

| | |
|---|---|
| Branch | `worktree-android-release`, HEAD at the part-1 hand-back, 35+ commits ahead of `origin/main` (`2f204d8`), which it contains (merged as `ce5c1a7`) |
| Version | 1.0.51, `bundle.android.versionCode` 1000051 (`701ffaf`); provisional, see "Version contention" |
| Suites on that HEAD | typecheck, lint, build (2,699 modules) exit 0; vitest 446 files, 9,602 passed, 0 failed, 7 skipped; backend 2,061 passed; `website/tools` 13 of 13; macOS `cargo check --locked --release` exit 0 |
| Android | local CI-shaped unsigned universal APK `1a05f066...e3f6c9`; preflight (dry run) and `sign.sh` with the THROWAWAY key passed (`4f878955...69fb`); launched on API 36 (first usable screen, Statistics, Map Explorer tiles, Species Detail) and on API 26 (the WebView floor message), with the 1.0.49 content security policy read from the served page and zero violations |
| Held copy | the Google wording is the user's two sentences in the listing and d5 (listing 3,858 characters); the `NonFreeNet` reason without its WebView clause |
| F-Droid recipe | 1.0.51 / 1000051 / `v1.0.51`; `fdroid lint -f --force-yamllint` no finding and `rewritemeta -l` lists nothing on its exact bytes (`fcae1ca9...4ede`); `NonFreeNet` still the schema's original sentence and `Categories` the default until the user's yes |
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
3. **Version contention.** `worktree-species-first-of-year` holds an unpushed `chore(release): 1.0.51` (`f514240`); the Spool spin in the main checkout (`weft-spool/20261004-031125`) has three builds and no bump yet. If `v1.0.51` exists on `origin` at the moment of the push, re-bump this branch to the next free patch first: `frontend/package.json` and its lockfile (two `version` lines), `src-tauri/tauri.conf.json` (`version` and `bundle.android.versionCode` by `major*1000000 + minor*1000 + patch`), the CHANGELOG heading and date, `website/index.html`'s pill text, `aria-label` and footer, the recipe's `versionName`, `versionCode`, `commit`, `CurrentVersion`, `CurrentVersionCode`, and `git mv` of `changelogs/1000051.txt` (staged, or at the root after the yes); amend `decisions.md`'s version entry. Then run `npx vitest run src/lib/androidVersionSource.test.ts src/lib/fdroidRecipe.test.ts src/lib/icloudKeysPublishedClaims.test.ts` (and `fastlaneMetadata.test.ts` once it exists).
4. **If `origin/main` moved,** merge it in again (`git merge --no-ff origin/main`), resolve only mechanical conflicts, and re-run the regression basics (typecheck, lint, build, full vitest, backend). Two incoming changes need an Android look if they land first: the Spool's `http-permit-narrowed` (it narrows `capabilities/default.json`'s `http:allow-fetch` scope, which Android's provider requests use; re-run `androidReachableCalls`, `androidProjectPins`, `tauriCsp`, and one keyed Weather lookup on the API 36 emulator), and `species-first-of-year` (Species Detail; any new `invoke` or plugin literal turns `androidReachableCalls` red until listed).
5. **The untracked QA evidence** (`pipeline/android-release/qa-screenshots/`, 35 MB, referenced by `qa-report.md` as uncommitted) would fail `release.sh`'s clean-tree preflight. Move it, do not delete it, before step L1: `mv pipeline/android-release/qa-screenshots <session scratchpad>/android-release-qa-screenshots-kept` (or commit a chosen subset if the user wants it in the repository). Never run `release.sh` with `ALLOW_DIRTY=1`.
6. **Keychain** (memory; after any reboot): `security show-keychain-info ~/Library/Keychains/login.keychain-db`. If it says "User interaction is not allowed", the **user** runs `security unlock-keychain ~/Library/Keychains/login.keychain-db` in their own terminal. Never ask for the password in chat.
7. **Nothing else building into `~/.snowraven-build`:** no other worktree's `release.sh` running (`ps -Ao command | grep -E 'release.sh|tauri build'`), and no `desktop:dev` watcher in this worktree.

## Cargo check (what the landing push carries)

`git log origin/main..HEAD` is this build's own commits plus the merge commit `ce5c1a7`, whose content is already on `origin/main`. Two commits do not name Android in their subject and are still this build's: `95b3b12` (the AGPL-3.0-only license field in the manifests) and `5ecbda7` (two guards following the iOS-only geolocation plugin). **No app-behavior commit from another build or from manual work rides this push** as of part 1. The record-keeping commits (pipeline, CHANGELOG, CLAUDE.md, decisions) are pre-approved cargo. Re-run `git log --oneline origin/main..HEAD` immediately before the push; any commit not on this list that is not this build's or record-keeping is named at the gate.

## P. Before the tag: the approved published copy (on the user's yes only)

F-Droid reads the tagged commit, so these land on the branch before L2. Each is written exactly as approved; if the user changed a word, the approval page's text is not what is written, their wording is.

- **P1. The Fastlane folder.** `git mv pipeline/android-release/fdroid/fastlane-proposal/en-US fastlane/metadata/android/en-US` (title, short and full description with the user's two Google sentences, `changelogs/1000051.txt`, `images/icon.png`, the six phone and six ten-inch screenshots, or the recaptured set if the user asked for a Weather shot), **in the same commit** as a new `frontend/src/lib/fastlaneMetadata.test.ts` per schema 6.4 (short description at most 80, every changelog at most 500, `changelogs/<current versionCode>.txt` exists, `title.txt` reads `SnowRaven`, `images/icon.png` passes the `androidIcons` icon rows, no em dash; guard-the-guard: removing the current changelog in a scratch copy goes red). Point `androidIcons.test.ts`'s staged-icon row at the new path if it reads the proposal path. Not written yet: it needs the folder at its root.
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
- **L2. The tag** (lightweight, like `v1.0.49` and `v1.0.50`), on the landed commit:
  ```sh
  git tag v1.0.51 HEAD
  git -c credential.helper='!gh auth git-credential' push origin v1.0.51
  ```
  The tag starts `windows-build.yml` and `android-build.yml`, and it is the commit F-Droid will build.
- **L3. Wait for both, pinned to the tag's commit** (never an unpinned `--limit 1`):
  ```sh
  T=$(git rev-parse v1.0.51^{commit})
  gh run list --workflow windows-build.yml --commit $T
  gh run list --workflow android-build.yml --commit $T
  gh run watch <run id>
  ```
  This is the first tagged run of `android-build.yml` (QA-34, QA-01's Linux half, QA-71). If it fails on the Linux toolchain, that is a Type 2: the fix is a new commit and a re-bump route, not a moved tag. Build the iOS archive (I1 to I8) during this wait.

## D. Desktop: `release.sh` (macOS, Windows, `latest.json`)

- **D1. Preconditions:** keychain unlocked (precondition 6), clean tree (precondition 5; the iOS stamp committed and pushed, I9), Windows CI green on the tag's commit, nothing else using `~/.snowraven-build`.
- **D2.** `CI=true zsh -lc ./release.sh` (exit 0; it pins the Windows artifact to the tag's commit, notarizes and staples, signs the final DMG, publishes the GitHub release `v1.0.51` and `latest.json`).
- **D3. Verify:** download the DMG back from the release and require `codesign --verify --verbose=2`, `xcrun stapler validate` and `spctl -a -t open --context context:primary-signature -vv` reporting `accepted` / `Notarized Developer ID`; `latest.json` from `releases/latest/download` says 1.0.51 with `darwin-aarch64` and `darwin-x86_64` on the one universal bundle and `windows-x86_64` on the setup exe; the Pages run on the landed commit succeeded and the live site shows `v1.0.51` in the pill, its `aria-label` and the footer.

## A. Android: the signed GitHub APK

Build shell for every step (the release skill's exports, not yet in `~/.zprofile`):

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME="$HOME/Library/Android/sdk"
export NDK_HOME="$ANDROID_HOME/ndk/27.2.12479018"
export PATH="$HOME/.tauri/gradle-8.14.3/bin:$HOME/.cargo/bin:/opt/homebrew/opt/openjdk@17/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
```

- **A0. Precondition (user-performed):** the keystore and its 0600 properties file at `~/.tauri/` (`ship/keystore-steps.md`). The release stops here until the user says "keystore in place".
- **A1. Preflight, real, no toggles:** `sh scripts/android/preflight.sh` (tag present locally and on `origin` at the same commit with the 1.0.51 pair, the `android-build` artifact from the run pinned to the tag's commit holding exactly `SnowRaven_1.0.51_android_universal_unsigned.apk`, its badging, the keystore). Keep the output; its last line is `UNSIGNED_APK=<path>`.
- **A2. Sign:** `sh scripts/android/sign.sh "$UNSIGNED_APK"`. First release, so `SNOWRAVEN_ANDROID_SIGNER_SHA256` is unset and the script binds the signer to the keystore's own certificate. Record `Signer #1 certificate SHA-256 digest`, `SIGNED_APK=` and `SIGNED_APK_SHA256=`; the digest becomes `SNOWRAVEN_ANDROID_SIGNER_SHA256` for every later release.
- **A3. Emulator opening check of those exact bytes** (FR-42, QA-41): start `sr-api36-phone` with `-gpu host`, `adb -s emulator-5554 install -r "$SIGNED_APK"`, open it, screenshot the first usable screen, record `shasum -a 256 "$SIGNED_APK"` beside the screenshot. Address `adb` by serial only.
- **A4. Hand-over (the user's device check, `ship/device-check.md` part A):** copy the signed file into a fresh folder, serve it on loopback (`python3 -m http.server <port> --bind 127.0.0.1`), map it with `/Applications/Tailscale.app/Contents/MacOS/Tailscale serve --https=<fresh port> --bg http://127.0.0.1:<port>` after `serve status` (never touch the existing mappings, 443 included), `curl -sk` the URL, and send it. If the phone has no Tailscale, a separate DRAFT GitHub release asset instead, never the published `v1.0.51`.
- **A5. User-performed:** the ten steps; record each result and the time before A6. No device: Partial, and the attach decision is the user's in writing (`decisions.md`) before `ANDROID_DEVICE_CHECK=partial` is used.
- **A6. Attach**, after `release.sh` created the release:
  ```sh
  ANDROID_DEVICE_CHECK=passed ANDROID_CHECKED_SHA256=<sha256 of the file the user checked> SNOWRAVEN_ANDROID_SIGNER_SHA256=<digest from A2> sh scripts/android/attach.sh "$SIGNED_APK"
  ```
  It downloads the asset back and compares SHA-256. Then take down the A4 tailnet mapping (`tailscale serve --https=<port> off`) and stop the loopback server.
- **A7. After the tag:** `fdroid checkupdates --allow-dirty --auto com.dtgibson.snowraven` in the scratch fdroiddata reports 1.0.51 (1000051) (QA-67).

## I. iOS: TestFlight, the user's check, then the App Store record

- **I0. Live ASC query first (metadata key `QJA25M7XHM`):** `GET /v1/apps/6787719977/appStoreVersions` (state of record `99e3f9ff`, 1.0.50 carrying 1.0.48 and 1.0.49, submitted as `7118f6a7`) and `GET /v1/builds?filter[app]=6787719977&sort=-uploadedDate`. Read against CLAUDE.md's version-record list. This decides the route: 1.0.50 still `WAITING_FOR_REVIEW` means the user chooses at the gate between **rolling 1.0.50 into 1.0.51** (withdraw `99e3f9ff` from its submission, retarget to 1.0.51, repoint at build 1.0.51.1, What's New = 1.0.50's approved four paragraphs then the 1.0.51 line) and **deferring 1.0.51 behind it** (no 1.0.51 record yet, written as a deferral); `READY_FOR_SALE` means a new 1.0.51 record. The train for 1.0.51 is open (unreleased), so the build-number route is available.
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
- **I4. Archive, outside the Bash sandbox,** with Tauri's three signing names mapped from the login shell (`APPLE_API_KEY="$APPLE_API_KEY_ID"`, `APPLE_API_ISSUER="$APPLE_API_ISSUER_ID"`, `APPLE_API_KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_$APPLE_API_KEY_ID.p8"`), `DEVELOPER_DIR` exported, `/tmp/xcshim` first on `PATH`: `npm run tauri -- ios build --export-method app-store-connect --build-number 1` (the npm CLI, not `cargo tauri`, for iOS). Expect the archive to succeed and Tauri's own export to refuse (either cloud-signing wording, or "No Account for Team"). Confirm the fresh archive by its stamped `CFBundleShortVersionString` 1.0.51 and `CFBundleVersion` for app and widget, `vtool -show-build` reporting `platform IOS`, and every swift-rs `lib*.a` reporting platform 2.
- **I5. Sign the archived widget extension with its entitlements:** `codesign -f -s - --generate-entitlement-der --entitlements src-tauri/gen/apple/snowraven_widgets/snowraven_widgets.entitlements src-tauri/gen/apple/build/snowraven_iOS.xcarchive/Products/Applications/SnowRaven.app/PlugIns/snowraven_widgets.appex`, then confirm the App Group with `codesign -d --entitlements - --xml`.
- **I6. Export:** `xcodebuild -exportArchive -archivePath src-tauri/gen/apple/build/snowraven_iOS.xcarchive -exportPath <dir> -exportOptionsPlist ~/.tauri/snowraven-ios-export-options.plist`; `DistributionSummary.plist` lists both bundle ids, the extension with the App Group only, the app with the App Group and its three iCloud keys (environment Production).
- **I7. Validate, then upload,** with `DEVELOPER_DIR` exported in that shell: `xcrun altool --validate-app -f <ipa> -t ios --apiKey $APPLE_API_KEY_ID --apiIssuer $APPLE_API_ISSUER_ID` (VERIFY SUCCEEDED), then `--upload-app` with the same flags; record the Delivery UUID; poll `GET /v1/builds` until 1.0.51.1 is `VALID`.
- **I8. Stamp commit:** `chore(ios): stamp iOS 1.0.51 build 1` with `gen/apple/snowraven_iOS/Info.plist` (and `snowraven_widgets/Info.plist` if stamped); restore any `project.pbxproj` requoting rather than committing it; `npx vitest run src/lib/iosSceneManifest.test.ts src/lib/iosWidgetManifest.test.ts` green.
- **I9. Push the stamp** (`git -c credential.helper='!gh auth git-credential' push origin HEAD:main`) before D2. It cancels the tag commit's `Pipeline` run, expected; the stamp commit's run is the run of record. A single failure of `AlertsInboxSheet.test.tsx`'s Escape row there was judged a scheduling flake at 1.0.50 and re-run once; judge any repeat the same way only with the same evidence.
- **I10. User-performed:** the TestFlight check, `ship/device-check.md` part B, including the location step (this build moved the iOS geolocation grants into `capabilities/ios.json`; nothing automated runs that on an iPhone). A failure is build 1.0.51 (2), I2 to I9 again, before any record.
- **I11. The App Store record,** by the route the user chose at I0 (skill: withdraw is `DELETE /v1/appStoreVersionSubmissions/{versionId}`; submit is `POST /v1/reviewSubmissions`, `POST /v1/reviewSubmissionItems`, `PATCH .../reviewSubmissions/{id}` `submitted: true`). What's New written by script from the approved text and read back byte for byte; every listing field read back against `appstore/LISTING.md` (promotional text has arrived EMPTY on four new records); review notes byte-identical to `appstore/REVIEW_NOTES.md`; the age-rating declaration answered if the editable app-info record asks; `releaseType` `AFTER_APPROVAL`, no phased release. Screenshots: unchanged (nothing photographed changed on iPhone or iPad in 1.0.51); say so with the twelve checksums against `appstore/screenshots/`. The privacy label stays "Data Not Collected" (UI-only; confirm). **Flag carried to the gate:** the in-app Help bundled into the iOS app now names Android, which Guideline 2.3.10 could draw a review question on.
- **A8. WebView version:** read the API 36 image's WebView major version (`adb -s emulator-5554 shell dumpsys package com.google.android.webview | grep versionName`). 133 was measured; if it is newer, re-run `measurements/safe-browsing/` and `measurements/emoji-initializer/measure-emoji.sh` before the copy is reused (release skill, Android section), else write "WebView 133, unchanged since the last measurement" in the Android record.
- **I12. The CLAUDE.md record line, written in this ship:** the 1.0.51 entry, and the written disposition of 1.0.49 (rolled into 1.0.50, already recorded) and 1.0.50 (resolved `READY_FOR_SALE`, rolled into 1.0.51, or 1.0.51 deferred behind it), with record and submission ids; a version with no record and no sentence is a skip.

## F. F-Droid: the merge request (first Android release only)

- **F1. Preconditions** (`fdroid/merge-request.md`, "Before you open it"): P1 and P2 at the tag, the tag's Android CI green, the local `fdroid lint -f --force-yamllint`, `rewritemeta -l`, `scanner -e` and `build -v -l` on the tagged recipe (`build` logs `Successfully built version 1.0.51 of com.dtgibson.snowraven`; its exit code is not evidence; `sudo:` is skipped locally, say so).
- **F2. User-performed, or the Deployer on the user's explicit word:** fork `fdroid/fdroiddata`, branch `com.dtgibson.snowraven`, `metadata/com.dtgibson.snowraven.yml` byte-identical to the recipe at `v1.0.51`, commit and title `New app: SnowRaven (com.dtgibson.snowraven)`, the description text from `merge-request.md`. Its pipeline is the first run of the `sudo:` block; a failure there is a recipe edit in the request (mirrored into the repository), never a release blocker.
- **F3. Or deferred, in writing, in exactly this form,** in CLAUDE.md's Android record line and `decisions.md`:
  `fdroiddata merge request deferred at 1.0.51 (<date>): <reason>; opens when <condition>.`
  A silence is not a deferral.

## W. After the APK is attached: website and README (on the user's yes)

- **W1.** The approved day-one forms (or nothing, if the user chose to hold until F-Droid lists the app): the `website/index.html` platforms sentence, the README Installation bullet, and each of C1 to C7 the user said yes to, exactly as approved; nothing else in either file.
- **W2.** Commit, push to `main` (Pages redeploys `website/**`), then fetch the live site and confirm the sentence and the pill.
- **W3.** When the F-Droid listing goes live (weeks later), the F-Droid forms are shown to the user again before they are written.

## R. The record (part 2's close, before The Chronicler)

- CLAUDE.md's Android record line for 1.0.51 (FR-40): the GitHub APK published after the device check (with the signer SHA-256) or deferred in writing; the F-Droid state in one of the five words (**merge request open** if F2 happened, else **deferred**, with the F3 sentence).
- `pipeline/android-release/decisions.md`: the deployment record (each leg, its ids, checksums, run ids and times; the user's device-check results with times), QA-52 closed as Pass as amended on the user's NFR-01 decision (already in `decisions.md` with its re-measure trigger, which is also in the release skill's Android section), and the A8 WebView reading.
- QA Partial rows closed by the ship, each with its evidence: QA-01, 34, 35, 36, 38, 39, 40, 41, 43, 60, 64, 66, 71; QA-42 and QA-54 stay Partial (no Google-signed WebView APK for the at-or-above half; no x86_64 runner).
- `security-report.md` N1: resolved by the user's two-sentence form ("no crash reporter" for what the app contains; "may contact Google on its own" for the WebView), recorded in `decisions.md`; the Auditor's report is not edited.
