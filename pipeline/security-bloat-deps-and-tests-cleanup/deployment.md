# Deployment record: security-bloat-deps-and-tests-cleanup (1.0.75)

Run by The Deployer from the main checkout, on branch `improve/security-bloat-deps-and-tests-cleanup` at `321dd8066744d0dab191b96b8b85be30c14ec0ff` (draft PR #3 against `main` at `18977177`). This part is the pre-deploy preparation only: nothing was pushed, merged, tagged, released, uploaded or written to App Store Connect, F-Droid or any published-copy file, and no worktree was created or entered. The only device used was the local API 36 phone emulator (`emulator-5554`, every `adb` call addressed by serial). No key, token, password or issuer value was printed or written. Scratch evidence is in the session scratchpad under `predeploy/`.

## Part one: preparation (2026-11-20 PST 21:30 to 21:56; 2026-11-21 UTC 05:30 to 05:56)

### Reports
- QA PASSED (Full weave), one criterion Partial (a release-build screenshot is not possible for an agent on this Mac; the launch, HTTPS and link legs passed).
- Security PASSED WITH NOTES: no Critical, High or Medium; D-08 (the held `zip` advisories) accepted; two Lows go to the idea inbox.

### GitHub (read 2026-11-21 05:3x UTC)
- `Pipeline` `44867503482` on `321dd806` (pull_request, attempt 1): success, every step run in all three jobs. Backend (ruff, pytest); Frontend (lint, typecheck, build, vitest, tooling, Chromium and WebKit, Inter, the real-engine gate); Native (Rust 1.96.1 read from `toolchain.env`, `cargo test --locked`).
- `Windows Build` `44867499154` on `321dd806` (workflow_dispatch): success, every step.
- The two earlier green runs QA counts are `44858914135` on `c7fe63b7` and `44864890871` on `5798aff8`.
- PR #3: OPEN, draft, `MERGEABLE`, `CLEAN`, 43 commits, head `321dd806`. `main` has no branch protection and no rulesets; merge commits, squash and rebase are all allowed; branches are not deleted on merge.

### Parallel ship check
- `origin/main` = `18977177`, which is the branch's merge base (43 ahead, 0 behind).
- Newest tag and release: `v1.0.74` (on `0a9dd9a3`, published 2026-11-20 01:44 UTC, Latest).
- No workflow run in progress; nothing on `main` since the 1.0.74 ship.
- The other worktree, `.claude/worktrees/life-list-filter-toggle-state`, sits at `481b9ee3` (the 1.0.65 closeout). That commit is an ancestor of `origin/main`, with 0 commits off it. It was read with `git worktree list` and `git log` only, and was not entered.
- The other agent process on this Mac (`codex`) works in `~/devwork/birdsizer`, a different project. No release, iOS build or emulator process was running.
- App Store Connect (GET only, metadata key, 05:37 UTC):
  - 37 version records, all `READY_FOR_SALE`;
  - 10 review submissions, all `COMPLETE`;
  - 98 TestFlight trains and 106 builds, every one `VALID`;
  - no 1.0.75 train or build.
- From 1.0.13 on, 26 trains have no record of their own: the 26 the 1.0.74 entry accounts for.

### App Store state of 1.0.74
- Record `15cda5e1` is `READY_FOR_SALE` (`READY_FOR_DISTRIBUTION`) on build 1.0.74.1 (`656d5349`, `VALID`).
- Submission `580ba358` is `COMPLETE`, with its one item `APPROVED`.
- It released on approval, so its train is closed and nothing is in review. 1.0.75 therefore takes a new record of its own, and no rollup or deferral is available.
- Ledger sentences owed at the ship:
  - 1.0.74 is corrected in place to RESOLVED.
  - 1.0.75 gets its own record and submission.

### F-Droid (read 05:37 UTC, three public reads)
- **fdroiddata `master`:** `CurrentVersion` 1.0.74, `CurrentVersionCode` 10000744. The bot added 1.0.74's three entries on `0a9dd9a36a49a8bb788ba46e4f396c89c9eabdfe` (`ffb0c1bd`, 2026-11-20 08:23 UTC).
- **Build logs:** 10000731/2/4 each end `Successfully built ... from 23dc1dab...`. 10000741/2/4 answer 404 (not attempted).
- **Published:** f-droid.org publishes 1.0.73, 1.0.72 and 1.0.70, with `suggestedVersionCode` 10000734.
- **So:** 1.0.73 has moved to **included and this tag picked up**, and 1.0.74 stays **included and this tag not yet built**.
- **Nothing goes to fdroiddata:** this release does not change `scripts/android/toolchain.env`, `scripts/android/build-apk.sh`, the recipe's build steps or `src-tauri/gen/android` (no diff against `main`). `android-build.yml` changes one comment.

### The release Mac
- **Keychain:** the login keychain is unlocked (`show-keychain-info` reads `no-timeout`).
- **Node and npm:** Node v24.18.0 against `.nvmrc` 24; npm 11.16.0.
- **Rust:** stable 1.96.1 as default, with targets `aarch64-apple-darwin`, `x86_64-apple-darwin`, `aarch64-apple-ios` and the three Android targets.
- **`gh`:** authenticated, scopes `repo` and `workflow`.
- **Apple credentials:** the four `APPLE_*` variables are set (checked by length); the API key file, the minisign key (0600) and the metadata key (0600) are present.
- **Signing identities:**
  - Developer ID Application, team `8QKC3L2FKP`, until 2027-02-01;
  - Apple Distribution, SHA-1 `1861F7A4...`, until 2027-07-05.
- **Developer ID profile:** "SnowRaven Mac Developer ID 20260901", app id `<TEAM>.com.snowraven`, container `iCloud.com.dtgibson.snowraven`, valid until 2044.
- **iOS App Store profiles:** "SnowRaven iOS App Store iCloud AppGroup 20260924" and "SnowRaven Widgets App Store", both installed in both profile folders and valid until 2027-07-05. `~/.tauri/snowraven-ios-export-options.plist` maps both bundle ids to them, with manual signing and `iCloudContainerEnvironment` Production.
- **Xcode:** 27.2 (27B52). `xcodebuild -checkFirstLaunchStatus` exits 0. The iPhone SDK is 27.2, and Swift 6.4.2 still needs the `swift` shim. `/tmp/xcshim` is gone, as expected.
- **Android:**
  - JDK 17.0.21;
  - build-tools 36.0.0 `apksigner`, `zipalign` and `aapt2`;
  - one NDK, 27.2.12479018;
  - `cargo tauri` 2.11.2;
  - Gradle 8.14.3 at `~/.tauri/gradle-8.14.3/bin`, which is not on the login PATH, so the ship shell adds it;
  - the keystore and its properties file are present at 0600 (contents not read).
- **`CHECK_ONLY=1 zsh -lc ./release.sh`** on a clean tree: rc 0. It read `Releasing v1.0.74: tag=0a9dd9a3 HEAD=321dd806`, passed the network reachability check, and both `npm ci` installs found 0 vulnerabilities.
  - It proves the portable half: Node, the tools, the network, a clean tree and the lockfiles installing.
  - It skips the Apple credentials, the minisign key, the Rust targets and the iCloud profile check, which were read by hand above. It proves nothing about the 1.0.75 version or tag.
- **WebView:** the API 36 Google APIs image (`sr-api36-phone`, `-gpu host`, Play Store off) reads WebView 133 (133.0.6943.137), unchanged since the last measurement, so the published Google wording needs no re-measure. The emulator was stopped by serial afterwards.

### The held release commit
- **The patch:** `release-1.0.75.patch` in this folder, SHA-256 `496d6d0be30a9737641b056dccd610e349d30eded0038f7180a232bf670ac806`.
  - It was built in a temporary index on `321dd806`; no ref, index or working-tree file was changed.
  - It holds nine files, the same set as 1.0.74's `bfbf4245`:
    - `frontend/package.json` and its lockfile's two top-level fields;
    - `tauri.conf.json` (1.0.75, `versionCode` 1000075);
    - `CHANGELOG.md`, with the held entry dated `YYYY-MM-DD`;
    - the website pill, its `aria-label` and the footer line, and nothing else in `website/`;
    - `10000751.txt`, `10000752.txt` and `10000754.txt`, each the sentence and a newline;
    - the recipe's three `versionName` and `versionCode` lines, `CurrentVersion` and `CurrentVersionCode`.
  - The recipe's `commit:` lines keep `0a9dd9a3...`, because a commit cannot carry its own hash. A separate commit after the tag writes the full `git rev-parse v1.0.75^{commit}`.
- **The proof:**
  - `git apply --check` passes against the working tree.
  - In a scratch copy made with `git archive 321dd806`, the patch applied as a commit with `git am --ignore-date`, the date substituted to a real one, and 0 placeholders were left.
  - In that copy, the five version guards (`androidVersionSource`, `fastlaneMetadata`, `fdroidRecipe`, `icloudKeysPublishedClaims` with its pill row, and `iosSceneManifest`) passed 118 of 118.
  - Four negative controls each went red, and the restored tree read 118 of 118 again:
    - the pill and footer left at 1.0.74;
    - `10000754.txt` missing;
    - the recipe left at 1.0.74;
    - `versionCode` left at 1000074.
  - A fresh `npm run build` and `npm run typecheck` gave rc 0. The full vitest suite passed: 524 files, 5 skipped; 11,576 passed, 9 skipped. The difference from QA's 11,578 and 8 is two rows that read gitignored files an archive does not carry: the per-run document row is absent and the stored-backup row skips.

### Published copy (held, for the sign-off)
- **The sentence:** "Security and reliability fixes, including safer handling of unusual eBird data and hand-edited backups."
  - 103 characters, SHA-256 `68c5dfca18e97bc238d5cccc198aa5fcab25b7e2f015cce2dd6f8a87a6c3a9f2` without its newline.
  - It is the App Store What's New and, with a newline, the three F-Droid changelogs.
- **Register:** one sentence, the gist; American spelling; no em dash; no mid-sentence capital; no figure; no library or platform named.
- **Alternative offered:** "Security and reliability fixes." (31 characters).

### Published pictures
- No retake is owed:
  - the diff touches no stylesheet, `index.html` or asset;
  - QA measured both CSS files byte-identical to `main`'s.
- The one visible-path change is Statistics' State/Province link gate. The demo dataset's 2 State/Province values and 10 location ids all pass the new gates, so every App Store, website and F-Droid frame that draws Statistics still draws links where it did.

### External setup
- None needed: no new key, portal step, profile, capability, entitlement, environment variable or GitHub secret.
- The capability change narrows existing grants and needs no portal action.

### iPhone check
- The request is drafted in the hand-back. Its widget steps are owed:
  - 1.0.75 is the first build since 1.0.71's skipped widget pass that changes native code in the iPhone app: the Rust core's three unconditional keychain commands are gone, `keyring` is out of the iOS link, and the iOS graph now reads rustls 0.23.46, h2 0.4.20, tokio 1.54.1, webpki-roots 1.0.12 and plist 1.10.4;
  - it touches no widget source, `src-tauri/vendor/tao`, `src-tauri/gen/apple`, `widgets.rs` or alerts module.

## Open for the sign-off
- The user's yes on the sentence, or the alternative.
- The deploy decision.
- Whether the widget steps are checked, or recorded as not checked by the user's decision.

## Part two: the release (2026-11-20 PST from 23:10; 2026-11-21 UTC from 07:10)

- **Sign-off (D-11):** "Ship with the shorter sentence". The App Store What's New and the three F-Droid changelogs read exactly `Security and reliability fixes.` (31 characters). The App Store submission is not authorized by it; it waits for the user's iPhone check.
- **Re-check before any write (07:10 UTC):**
  - `origin/main` was still `18977177` and the newest tag and release still `v1.0.74`; nothing was running.
  - App Store Connect read the same as part one: 37 records all `READY_FOR_SALE`, no 1.0.75 train.
  - The keychain was unlocked.
- **The patch, rebuilt** with `SENTENCE='Security and reliability fixes.'` (SHA-256 `766bc8a78f8218d805ae1ea782404a16bab26c618a74ad3ac87f9d59b4e17741`). The CHANGELOG entry and its `### Security` heading are unchanged.
  - `git apply --check` passed.
  - In a fresh `git archive` copy with the date substituted, the five version guards passed 118 of 118.
- **Local `main`:** fast-forwarded from `18977177` to `321dd806` after an ancestry check. The ref was moved and switched to, the same commit, so the uncommitted D-11 edit carried over.
- **Release commit `71c5361a`**, applied with `git am --ignore-date`, dated 2026-11-20. No placeholder was left, and the applied patch file was deleted.
- **Docs commit `6f5310f7`:** D-11 and this record.
- **Local gates on `6f5310f7`:** lint, typecheck and a fresh build gave rc 0. The full vitest suite passed: 524 files, 5 skipped; 11,578 passed, 8 skipped. That is QA's local count exactly.
- **Tag `v1.0.75`:** annotated, tag object `72d31aee`, on `6f5310f72d1040bea0349cb4e4a936c508a48fc7`, pushed alone at 07:14:30 UTC. At the tag, `tauri.conf.json` reads 1.0.75 / 1000075, and `10000751/2/4.txt` are present.
- **Recipe commit `ecb258be`** `fix(fdroid): the recipe names v1.0.75's commit` (`fdroidRecipe` 36 of 36).
- **PR #3 and `main`:** PR #3 marked ready, then `main` pushed as a fast-forward `18977177..ecb258be` at 07:14:46 UTC. PR #3 reads MERGED at 07:14:47 UTC, with `321dd806` as its merge commit.
- **Website:** Pages `44879335847` succeeded on `ecb258be`. The live `index.html` on snowraven.dtgibson.com is byte-identical to the committed file, and its pill, `aria-label` and footer read 1.0.75.
- **iOS:**
  - **Before the build:** the stale archive (1.0.74 / 1.0.74.1) was kept under `build/` as `snowraven_iOS-1.0.74.1-stale-before-1.0.75.xcarchive`. The three shims were recreated, 36 of 36 icons are opaque, and the SDK is 27.2.
  - **Widget Swift tests:** run first on the iOS 26.4 iPhone 17 Pro simulator: 143 tests, 0 failures. The already-booted iOS 26.5 simulator, which belongs to the other agent, was left alone.
  - **Archive:** `tauri ios build --export-method app-store-connect --build-number 1`, run outside the sandbox, 07:16 to 07:18 UTC: `** BUILD SUCCEEDED **`. Tauri's own export then refused with the skill's third wording ("No Account for Team", "No profiles found"), as expected.
  - **Archive checks:** it reads 1.0.75 / 1.0.75.1, `platform IOS`, minos 16.0, sdk 27.2; 18 of 18 swift-rs libraries report `platform 2`. The re-quoted `PRODUCT_NAME` lines were restored to HEAD.
  - **Appex:** "not signed at all" before, then signed ad hoc with its entitlements; it now lists the App Group.
  - **Manual export:** `** EXPORT SUCCEEDED **`. `DistributionSummary.plist` lists both bundles at 1.0.75 (1.0.75.1) on their profiles. The app has the App Group, `icloud-container-environment` Production, the container, ubiquity and `CloudDocuments`; the appex has the App Group only.
  - **IPA:** SHA-256 `3bbcc31684e3544fa10102be352ec95e770af987d666b9a52d2f92cb39ce8e68`, 16,562,583 bytes.
  - **`altool`:** `--validate-app` returned `VERIFY SUCCEEDED with no errors` (07:19:34 to 07:20:31). `--upload-app` returned `UPLOAD SUCCEEDED with no errors` (07:20:38 to 07:21:37), Delivery UUID `243a7405-4193-47a9-a2f9-f1f48c2e38ac`, plus the routine `CDUploaderStateInfoResumeFilePath` line.
  - **Stamp:** `9e09c5b0` `chore(ios): stamp iOS 1.0.75 build 1` (both Info.plists), pushed at 07:21:46 UTC.
- **TestFlight:** build 1.0.75.1 (`243a7405`) read `VALID` by 07:25:16 UTC. It is the only build on the new 1.0.75 train. App Store Connect then read 37 records all `READY_FOR_SALE`, 10 submissions all `COMPLETE`, and 107 builds all `VALID`. No 1.0.75 version record was created, and nothing was submitted.
- **CI on the tag's commit:**
  - Windows Build `44879313500` succeeded (07:14:33 to 07:20:39 UTC), the only Windows run on `6f5310f7`.
  - Android Build `44879313585` succeeded.
  - Pipeline `44879335954` on `ecb258be` was cancelled by the stamp push, as expected.
- **The run of record: Pipeline `44879893516` on `9e09c5b0`, attempt 1, success.** Every step ran green in all three jobs:
  - Backend (ruff, pytest), 07:22:04 to 07:22:40.
  - Frontend (npm ci, lint, typecheck, build, vitest, tooling, Chromium and WebKit, Inter, the real-engine gate), 07:22:04 to 07:53:18.
  - Native (Rust read from `toolchain.env`, `cargo test --locked`), 07:22:05 to 07:23:56.
  - No re-run and no allowance. This is the first green push to `main` since 1.0.67.
- **Desktop:** `zsh -lc ./release.sh`, 07:53:49 to 07:58:54 UTC, exit 0.
  - **Build:** `Releasing v1.0.75: tag=6f5310f7 HEAD=9e09c5b0`; iCloud profile OK; bundle version verified 1.0.75; iCloud entitlements and embedded profile verified.
  - **DMG:** styled and signed. Notarization submission `39718548-f0cb-44d2-a4c4-1dd8e171c874` was `Accepted`, and the DMG was stapled.
  - **Windows and publish:** the Windows installer was fetched and signed, and the release published.
  - **Release:** `453532814`, https://github.com/dtgibson/snowraven/releases/tag/v1.0.75, published 2026-11-21 07:58:53 UTC, Latest, not a draft or pre-release. Assets and SHA-256:
    - `SnowRaven_1.0.75_universal.dmg` `564aea30...9623`;
    - `SnowRaven-updater.app.tar.gz` and `.sig`;
    - `SnowRaven_1.0.75_x64-setup.exe` `049bd2fc...2090` and `.sig`;
    - `latest.json`.
  - **Fresh download:** `codesign --verify` valid and satisfies its Designated Requirement; `stapler validate` worked; `spctl -a -t open --context context:primary-signature` accepted, `source=Notarized Developer ID`, team `8QKC3L2FKP`.
  - **Windows installer:** the published installer is byte-identical to run `44879313500`'s artifact.
  - **Updater:** `releases/latest/download/latest.json` serves 1.0.75 with `darwin-aarch64`, `darwin-x86_64` (both `SnowRaven-updater.app.tar.gz`) and `windows-x86_64` (`SnowRaven_1.0.75_x64-setup.exe`), each signed.
- **Android:**
  - **Preflight:** `preflight.sh` exit 0. It used run `44879313585`'s artifact: `com.dtgibson.snowraven` 1.0.75 / 1000075, not debuggable, with the three changelogs present at the tag. The unsigned APK's SHA-256 is `bcb0be7fa4254d390dcd91fc044bb2f5101bd9dce1b18b7b1ca5ab71dca0e3b0`.
  - **Signing:** `sign.sh` with the recorded signer, schemes v2 and v3, `Signer #1 certificate SHA-256 digest: 42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a`. Signed APK SHA-256 `eebe8ae3112a26505cd523560aa5c5d4b2fcb8b33de8efcce1d28a1b85d51a25`.
  - **Emulator check of those exact bytes:** `sr-api36-phone`, `-gpu host`, every call to `emulator-5554`, hash re-read equal.
    - It installed fresh (no earlier install): `versionName` 1.0.75, `versionCode` 1000075, minSdk 26, targetSdk 36.
    - Cold start `Status: ok`, `COLD`, 199 ms.
    - Welcome drew; "Explore the app first" drew Weather with both key notices.
    - Help's github.com/dtgibson/snowraven-mini link left the app and opened Chrome, as `topResumedActivity` `com.android.chrome`. It stopped at Chrome's first-run screen, which shows that the narrowed link permission still dispatches; Back returned to `MainActivity`.
    - The crash buffer read 0 lines before the install and 40 after, all one emulator-system abort (`com.google.android.bluetooth`, a hardware error event) and none naming SnowRaven. The main log held no `FATAL EXCEPTION`, no SnowRaven `AndroidRuntime` line and no ANR, and the app was alive at the end (pid 4386).
    - WebView 133.0.6943.137. Nothing was sent to eBird or OpenWeather. The emulator was stopped by serial.
    - Screens are in the scratchpad's `predeploy/emulator-check/`.
  - **Device check:** Partial on emulator evidence, under the standing decision (the user owns no Android device).
  - **Attach:** `attach.sh` with `ANDROID_DEVICE_CHECK=partial`, exit 0. Asset `774885528` `SnowRaven_1.0.75_android_universal.apk`, 79,505,026 bytes, downloaded back byte-identical (`eebe8ae3...1a25`). The release's own asset digest reads the same.
- **Stopped here, as directed:** the App Store version record and its submission wait for the user's iPhone check of TestFlight 1.0.75 (1).

## Part three: the App Store submission and the records (2026-11-21 UTC 17:09 to 17:20; PST 09:09 to 09:20)

- **The user's iPhone check (D-12)**, recorded as the user gave it, after the build read `VALID` and before any submission:
  - Unprompted: "testflight seems to work fine on the phone".
  - Asked once which build it was and whether the widgets were tried, they chose "1.0.75 (1), widgets fine too".
  - The drafted step list had not reached the user, so the individual steps (Weather, List Comparer, a Statistics region link, Targets) are not recorded as checked.
  - The widget pass owed since 1.0.71 is discharged.
- **Read-back tooling:** a read-back script in the scratchpad (`predeploy/asc/`, on the committed `asc-lib.mjs`). It parses `appstore/LISTING.md`, and its lengths matched the ledger's figures: name 9, subtitle 27, promotional text 137, description 3,733, keywords 97, copyright 16, review notes 3,898. It was proved first on the released 1.0.74 record: `ALL SAME` with 1.0.74's own What's New, and exactly one DIFF (What's New) against 1.0.75's.
- **The record:**
  - **Pre-read (17:10:16 UTC):** 37 records all `READY_FOR_SALE`, no 1.0.75 record, 10 submissions all `COMPLETE`, build 1.0.75.1 (`243a7405`) `VALID` and not expired.
  - **Created:** `POST /v1/appStoreVersions` 201, record **`3b2d00c7-f09d-41f1-8588-d0256b3ed943`**, 1.0.75, `PREPARE_FOR_SUBMISSION`, `AFTER_APPROVAL`, on build 1.0.75.1, copyright from `LISTING.md`.
  - **Fields:** en-US `3e737d37` arrived with the promotional text, description, keywords and both URLs equal to `LISTING.md`, and with 1.0.74's What's New. Only the What's New was written (`PATCH` 200, 17:10:21 UTC): `Security and reliability fixes.` (31). The review notes arrived equal to `REVIEW_NOTES.md`.
- **Listing read-back:** `READBACK 1.0.75: ALL SAME` at 17:10:29 UTC, covering:
  - version, release type, earliest date, phased release, copyright and build;
  - one localization, with every listing field and the What's New;
  - review notes, contact and demo account;
  - both app infos' name, subtitle, privacy policy URL and categories.
- **Age rating:** 32 fields on both app infos (`b35aa005` live, `afebc5b0` new and editable), none true, with the same five nulls as 1.0.74. Nothing was changed.
- **Screenshots:** `asc-screens.mjs readback --loc 3e737d37...` read **ALL MATCH, 21 of 21**. All three sets carried over (iPhone 6.9-inch `ee19d709`, iPad 13-inch `ca7fc938`, the iPhone Duo placements); nothing was re-placed.
- **Submitted (17:11:13 to 17:11:21 UTC):**
  - A re-read first found the record `PREPARE_FOR_SUBMISSION` on a `VALID` build, no phased release, and no open submission.
  - `POST /v1/reviewSubmissions` 201, `POST /v1/reviewSubmissionItems` 201, `PATCH` `submitted: true` 200.
  - **Submission `e0608e6e-0d01-4781-aa46-aaff56e36b36`, `WAITING_FOR_REVIEW`, submitted 2026-11-21 17:11:20 UTC (09:11 PST)**, its one item `READY_FOR_REVIEW`. The record reads `WAITING_FOR_REVIEW`.
- **After submitting:** the listing read `ALL SAME` (17:11:32 UTC) and the screenshots `ALL MATCH`, 21 of 21.
- **Reconciliation (17:11:39 UTC):** against the pre-deploy read there is one more of each, and no unaccounted gap:
  - 38 records (1.0.75 waiting, 37 `READY_FOR_SALE`);
  - 11 submissions (1 waiting, 10 `COMPLETE`);
  - 99 trains and 107 builds, all `VALID`;
  - the same 26 trains with no record of their own from 1.0.13 on.
- **F-Droid (17:11:57 UTC):**
  - 1.0.73 is **included and this tag picked up**: published, all three logs `Successfully built`.
  - 1.0.74 is still **included and this tag not yet built**: its entries are on `0a9dd9a3` (`ffb0c1bd`), and its logs answer 404.
  - 1.0.75 is **included and this tag not yet built**: no entry yet, and its logs answer 404.
  - Nothing went to fdroiddata.
- **`RELEASE_LEDGER.md`:**
  - 1.0.74 is corrected in place to RESOLVED;
  - the Android 1.0.73 and 1.0.74 entries are updated in place;
  - 1.0.75 gets its App Store and Android entries.

## Went differently from the plan

- **The published sentence** is the shorter one the user chose at the sign-off (D-11), so the patch was rebuilt with it. The builder's clean-tree check was narrowed to the version-set files, because the D-11 edit was uncommitted.
- **Local `main`** was fast-forwarded by moving the ref after an ancestry check, then switching to it, rather than `checkout main`. The uncommitted D-11 edit blocked a checkout, since `decisions.md` does not exist on the old `main`.
- **The widget tests** ran on the iOS 26.4 simulator, because an iOS 26.5 simulator booted by another agent was left alone.
- **The Android outbound-link leg** used Help's GitHub link. Settings links only to the eBird and OpenWeather key pages, and the acknowledgments carry no links. It stopped at Chrome's first-run screen, which shows that the link left the app, not that the page loaded.
- **The crash buffer** read 0 lines before the install and 40 after, the reverse of the 1.0.73 and 1.0.74 records. All 40 lines are one emulator Bluetooth abort.
- **The user checked the TestFlight build** before the step list reached them (D-12). The widget pass is recorded as passed and the individual steps as not reported.
- **The run of record needed no re-run**, the first time since 1.0.67.
- **Three read-back logs** were first written to the repository root by a relative `tee`, then moved to the scratchpad before anything was committed. They held record ids and lengths only.

## Open after this ship

- App Review of 1.0.75 (`e0608e6e`), released on approval; the next ship reads it.
- F-Droid's pickup of `v1.0.74` and `v1.0.75`.
- The age-rating declaration's two newer null fields (`datingAndRelationships`, `sharedLocation`), should Apple start requiring them.
- The Pipeline run on this record's push, the next of the green pushes on `main` this run's brief counts toward three (D-07's macOS job reads the same runs).
