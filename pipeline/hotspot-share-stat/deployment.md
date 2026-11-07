# Deployment record: hotspot-share-stat (1.0.62)

## Part one: prepared up to the production sign-off (2026-11-06, about 22:00 UTC)

Run by The Deployer, hands-off, in the worktree `.claude/worktrees/hotspot-share-stat` on branch `worktree-hotspot-share-stat`. **Nothing was pushed, tagged, built for release, uploaded or published in this part.** The release set is staged and not committed. No physical device was touched, no other worktree or checkout was entered, and no stash was used.

### Gates

| Gate | Result |
|---|---|
| The Tester | **PASSED**, Tier 2 (Full weave), attempt 1 (`qa-report.md`, gitignored). Quiet full run: 10,493 passed, 0 failed. |
| The Auditor | **PASSED WITH NOTES** (`security-report.md`, gitignored). No Critical, High or Medium. L2, I1 and I2 closed in `84317fa6`. L1 is the held privacy-policy copy below, waiting for the user's yes. |

### Pre-deploy reconciliation

`git fetch origin`: `origin/main` is still `3a1ee236` and is an ancestor of this branch's HEAD `84317fa6`. Nothing to merge, so no re-verification was owed. It was run anyway once the version set was staged (below).

### Cargo (the six commits the push carries, `origin/main..HEAD`)

All six are this build's own. None is from another build or manual work.

| Commit | Kind | What |
|---|---|---|
| `a4d1704a` | this build | feat(hotspots): persist each region's hotspot answer (`hotspot-regions-v1`) |
| `f3bc9b8b` | this build | feat(stats): Checklists at hotspots share bar in Geographic Stats |
| `693fec8a` | this build | test(hotspots): the persisted store, the snapshot and the share block |
| `868594df` | this build | docs(hotspots): Help's Geographic Stats sentences and the three rule edits |
| `99f680b7` | record-keeping | chore(pipeline): the build's artifacts |
| `84317fa6` | this build | test(hotspots): audit fixes L1, L2, I1, I2 |

The release commit (staged, below) and part two's recipe-hash and iOS-stamp commits follow them.

### The release set, staged and not committed

Six files, the same shape as the 1.0.61 release commit `3be27652` minus its three Fastlane files:

- `frontend/package.json` and its lockfile's two root version lines: 1.0.62.
- `src-tauri/tauri.conf.json`: version 1.0.62, `bundle.android.versionCode` 1000062.
- `CHANGELOG.md`: `## [1.0.62] - 2026-11-06`, inserted above 1.0.61 by script from `held-copy.md`, byte for byte, ASCII only.
- `website/index.html`: the version pill's text and `aria-label`, plus the footer line. Checked by bytes: the file equals HEAD with exactly its three `1.0.61` strings changed.
- `pipeline/android-release/fdroid/com.dtgibson.snowraven.yml`: three `versionName` 1.0.62 entries with codes 10000621, 10000622 and 10000624, `CurrentVersion` 1.0.62, `CurrentVersionCode` 10000624. The three `commit:` lines still name `3be276520c41697ed95eed672f0b7c6fb0095ca5` and move to the 1.0.62 tag's full hash after the tag. Checked by bytes against HEAD.

**Left unwritten until the user's yes:** the three Fastlane changelogs `fastlane/metadata/android/en-US/changelogs/10000621.txt`, `10000622.txt` and `10000624.txt`, and both privacy-policy insertions in `PRIVACY_POLICY.md` and `website/privacy.html`. Each anchor still occurs exactly once in each file, and neither insertion is present yet. The App Store What's New also waits for the yes; it goes onto the 1.0.62 record in part two.

Pre-computed for part two: the F-Droid text is 367 characters, ASCII, with no em dash. Each file holds that text plus one newline (the 1.0.61 files' form): 368 bytes, SHA-256 `91477738a9ede9acd9178177d3c42938cea0dd5e53f442555abe52456f96b9cb`. The held App Store What's New is the same 367 characters.

**Guards over the set** (`npx vitest run` on `androidVersionSource`, `icloudKeysPublishedClaims`, `fdroidRecipe`, `fastlaneMetadata`, `iosSceneManifest`): 4 of 5 files green, 116 of 118 tests passing. The only red is `fastlaneMetadata.test.ts`, and both of its failing rows fail only because the three held files are missing:
- the per-processor row names `changelogs/10000621.txt`, `10000622.txt` and `10000624.txt is missing`;
- the guard-the-guard row's scratch copy is missing the same three files.

**Full frontend suite with the set staged** (load average about 6.6 on 8 cores, no orphan spinners): 486 files, 10,494 passed, 2 failed, 14 skipped. The 2 failures are the two `fastlaneMetadata` rows above. The 14 skips are the 7 pre-existing ones plus the 7 rows of `hotspotSharePublishedClaims.test.ts`, which stay skipped until a privacy sentence lands. `AddressSearch.test.tsx` passed. `npm run typecheck` (`tsc -b`) exit 0.

### Parallel-ship readout

- **App Store Connect** (GET only, metadata key, about 21:50 UTC): 29 version records, every one `READY_FOR_SALE`.
  - **1.0.61 (`1ff37081`) is `READY_FOR_SALE` / `READY_FOR_DISTRIBUTION`**, and submission `c956722b` is `COMPLETE`. It has left review and is live, which supersedes the ledger's `WAITING_FOR_REVIEW`.
  - 10 review submissions are listed, all `COMPLETE`, with none open. (The 1.0.61 ship's count read 11; the listing returns 10 today, `c956722b` among them.)
  - 85 TestFlight trains. The newest build is 1.0.61.1 (`c488b8e2`), `VALID`, not expired.
  - No 1.0.62 record and no 1.0.62 train exist.
  - **Route: a new 1.0.62 record of its own on build 1.0.62.1.** Nothing is in review, so neither a deferral nor a withdraw-and-resubmit applies. The 1.0.61 train is closed (`READY_FOR_SALE`), so 1.0.62 needs its own record and its own train in any case.
- **GitHub:** the newest release is v1.0.61 (`Latest`). No `v1.0.62` tag exists locally or on `origin`.
- **CI on `main`:** the last run, `41720828404` on `3a1ee236`, failed on one test only: `AddressSearch.test.tsx > shows the hint until a miss replaces it`, `expected '' to be 'No location found...'`. That is the known timing race; it passed in this part's full local run. If a run on the 1.0.62 commits goes red on that test alone, re-run it once; it does not block.
- **F-Droid** (public reads): f-droid.org publishes **1.0.61** (10000614, 10000612, 10000611; `suggestedVersionCode` 10000614), plus 1.0.60 and 1.0.59. fdroiddata `master` has `CurrentVersion` 1.0.61, added by the bot as `754c9f1f` (2026-11-04 06:32 UTC). The logs for 10000611, 10000612 and 10000614 each end `Successfully built ... from 3be276520c41697ed95eed672f0b7c6fb0095ca5`, and 10000621 answers 404. **1.0.61 is therefore "included and this tag picked up".** The ledger's 1.0.61 Android entry still reads "not yet built" and gets a "Corrected 2026-11-06" note at this ship. Nothing goes to fdroiddata, because nothing since the 1.0.61 tag touches `scripts/android/toolchain.env`, `src-tauri/gen/android` or the recipe's build steps (only its commit lines moved, in `d1df12dc`).
- **A parallel build is in flight: `life-lists-tab`, on local `main` in the main checkout.**
  - It has seven unpushed commits (`5452574e` to `b61e9ef6`, 12:24 to 13:15 PST today), based on `a1823622`, one commit behind `origin/main`.
  - It is still at version 1.0.61, and its `held-copy.md` names "1.0.62 unless another ship lands first".
  - It shares nine files with this build: `.claude/rules/security.md`, `.claude/rules/ui.md`, `docs/HELP.md`, `frontend/src/globals.css`, `honestLoadFailures.test.tsx`, `TabLoadErrorAlert.test.tsx`, `clearDerived.test.ts`, `entryChunk.test.ts` and `settingsRouteBudget.test.ts`.
  - It was read through refs only (`git log`, `git show main:...`). Its checkout was not entered.
  - **Recommendation:** ship this build as 1.0.62 now, because it is through QA and audit and gate-ready. `life-lists-tab` then merges `origin/main` and ships as 1.0.63, with a full suite after the merge because of the nine shared files. The Guide should tell that session the order before part two pushes.
  - **Part two pushes with `git push origin HEAD:main` and never updates the local `main` ref**, which is that session's working branch.

### Other pre-gate determinations

- **External setup:** none. The feature uses the eBird API key the user already has. No provider setting, environment variable, DNS record or OAuth app is involved, so there is no ship-dark fork.
- **Staging:** none exists (`stack.environments.staging` is null), so the production sign-off is the only gate.
- **Screenshots:** none owed. Geographic Stats is the fifth section of Statistics, after Life List Totals, Top Species, Firsts & Milestones and Temporal Stats, and the share block sits inside it below the map. The App Store Statistics frame (`capture-appstore.mjs`, `shotStats`) and the website Statistics shots (`capture.mjs`, top 900 px and the phone frame) all photograph the top of the tab, so no committed shot shows the new block. `appstore/` and `website/` are unchanged since 1.0.61 except for the version stamp.
- **README and website copy:** none proposed (`held-copy.md`).

### Release-machine readiness (checked, nothing changed; no secret printed)

| Leg | Check | State |
|---|---|---|
| Desktop | `release.sh` present and executable; `CARGO_TARGET_DIR` `~/.snowraven-build` is shared across checkouts | Ready |
| Desktop | Node v24.18.0 equals `.nvmrc` 24; `gh` authenticated | Ready |
| Desktop | `APPLE_SIGNING_IDENTITY`, `APPLE_API_KEY_PATH` (the file exists), `APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID` all set | Ready |
| Desktop | Keychain identities: Developer ID Application, Apple Distribution and Apple Development (8QKC3L2FKP), 3 valid; `APPLE_SIGNING_IDENTITY` names a valid one | Ready |
| Desktop | Login keychain unlocked (`no-timeout`) | Ready |
| Desktop | Minisign updater key `~/.tauri/snowraven-signing.key` present (not read) | Ready |
| Desktop | Rust targets `aarch64-apple-darwin` and `x86_64-apple-darwin` | Ready |
| Desktop | Developer ID iCloud profile "SnowRaven Mac Developer ID 20260901": `8QKC3L2FKP.com.snowraven`, container `iCloud.com.dtgibson.snowraven`, expires 2044-08-27 | Ready |
| Desktop | Running processes: no `release.sh`, `tauri build`, `xcodebuild` or `notarytool`. The matches were idle `xcodebuildmcp` tool servers. | Ready |
| iOS | Xcode 27.1 (27A9275); `iphoneos` SDK 27.1; `altool` found with `DEVELOPER_DIR` | Ready |
| iOS | `~/.tauri/snowraven-ios-export-options.plist`: app-store-connect, manual signing, team 8QKC3L2FKP, `iCloudContainerEnvironment` Production, both bundle ids mapped | Ready |
| iOS | Profiles "SnowRaven iOS App Store iCloud AppGroup 20260924" (`870fe004`) and "SnowRaven Widgets App Store" (`50691228`) installed in both profile folders, App Group present, expiring 2027-07-05 | Ready |
| iOS | ASC key files for the metadata key and the upload key both present; `aarch64-apple-ios` target installed | Ready |
| iOS | **First iOS build in this worktree.** It has no `src-tauri/target` and no `gen/apple/build`, so the build compiles cold and the swift shim is mandatory. The iOS plist still reads 1.0.61 (1.0.61.1). | Ready, with a long first build |
| iOS | Local simulators for the widget Swift tests: iOS 26.4 to 27.0 iPhones. iPhone 18 Pro `54B95BBD` is already booted, possibly by another session; address the one used by udid. | Ready |
| Android | JDK 17.0.20.1; exactly one NDK (27.2.12479018); build-tools 36.0.0 `apksigner`, `zipalign`, `aapt2`; Gradle 8.14.3 at `~/.tauri/gradle-8.14.3`; `cargo tauri` 2.11.2; Rust Android targets | Ready |
| Android | Keystore `~/.tauri/snowraven-android.p12` and its properties file, both mode 0600 (not opened) | Ready |
| Android | `scripts/android/preflight.sh`, `sign.sh`, `attach.sh` executable; AVDs `sr-api24-phone`, `sr-api26-phone`, `sr-api30-phone`, `sr-api36-aosp`, `sr-api36-phone`, `sr-api36-tablet` | Ready |
| Dependencies | This worktree has no root `node_modules` (`release.sh` runs both installs itself, but the iOS build runs earlier) and no `website/tools/node_modules` (needed for the screenshot read-back's `sharp`) | `npm ci` owed in part two at the two steps below |

### Part two: the ordered leg list (from the `snowraven-release` runbook)

Part two runs only on the user's Confirm. Each step is its own beat, and it stops on any failure.

1. **Write the approved copy.**
   - The three Fastlane files, from the approved text. Each must be 368 bytes with SHA-256 `91477738...b9cb`, and no `1000062.txt` may exist.
   - If approved, both privacy insertions in `PRIVACY_POLICY.md` and `website/privacy.html`, identically. If declined, record it as a follow-up with the reason.
   - Then run `fastlaneMetadata`, `hotspotSharePublishedClaims` (its rows run once a sentence lands), the full `vitest` suite, `npm run build` and `eslint`.
2. **Release commit** `chore(release): 1.0.62, ...`: the six staged files, the three Fastlane files and any approved privacy files. This record stays out of the commit for the Chronicler, as at 1.0.61, which is why `release.sh` runs with `ALLOW_DIRTY=1`.
3. **Push** `git push origin HEAD:main` (a fast-forward from `3a1ee236`). Never update the local `main` ref. If the keychain helper fails, use `git -c credential.helper='!gh auth git-credential'`.
4. **Annotated tag `v1.0.62`** ("SnowRaven 1.0.62") on the release commit, pushed alone. It starts Windows Build and Android Build on the tag. The push to `main` starts Pages and Pipeline.
5. **Recipe hash commit:** the three `commit:` lines take the tag's full 40-character hash. Run `fdroidRecipe`, `fastlaneMetadata` and `androidVersionSource`, then push. Nothing goes to fdroiddata.
6. **iOS, during the CI wait.**
   1. Run the root `npm ci`.
   2. Recreate the three `/tmp/xcshim` shims (`xcodebuild`, `xcrun`, `swift`) unconditionally, and confirm SDK 27.1.
   3. Move aside any `snowraven_iOS.xcarchive` (none exists here).
   4. Run the widget Swift tests (`snowraven_widgetsTests`) on a local iOS 17+ simulator, addressed by udid.
   5. Run `tauri ios build --export-method app-store-connect --build-number 1` outside the Bash sandbox, with `APPLE_API_KEY`, `APPLE_API_ISSUER` and `APPLE_API_KEY_PATH` mapped. Tauri's own export refusal is expected.
   6. Confirm the fresh archive by its stamped `CFBundleVersion` 1.0.62.1. Confirm swift-rs libraries at `platform 2` and the app at `platform IOS`, sdk 27.1.
   7. Ad-hoc sign the archived `snowraven_widgets.appex` with its entitlements.
   8. Do the manual `xcodebuild -exportArchive` with the export options plist. In `DistributionSummary.plist`, check both bundle ids, the App Group and the iCloud keys, and that all iOS icons are opaque.
   9. Run `altool --validate-app` (it must say `VERIFY SUCCEEDED`), then `--upload-app`.
   10. Stamp commit `chore(ios): stamp iOS 1.0.62 build 1`, then push.
7. **CI green on the tag commit.** Make every lookup pinned (`gh run list --workflow <wf> --commit <tag sha>`). Re-run once a red run caused only by `AddressSearch`. The Pipeline run of record is the last one on `main`, because `cancel-in-progress` cancels the earlier ones.
8. **Android preflight and sign** in the build shell, with `SNOWRAVEN_ANDROID_SIGNER_SHA256=42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a`.
   - Do the emulator opening check of the exact signed bytes on `sr-api36-phone`: `-gpu host`, every `adb` call addressed by serial, a screenshot rather than a process check.
   - Read the WebView version. If it is still 133, write "WebView 133, unchanged since the last measurement"; if it is newer, re-measure before reusing the published Google copy.
9. **Desktop:** run `CI=true ALLOW_DIRTY=1 zsh -lc ./release.sh` alone on the machine, with no other desktop release and no dev watcher running.
   - Download the DMG back and require `codesign --verify`, `stapler validate`, `spctl` (Notarized Developer ID) and `hdiutil verify`.
   - In `latest.json`, both darwin keys must point at the universal bundle and `windows-x86_64` at the setup exe.
   - The installer must be byte-identical to the tag run's artifact.
10. **Android attach**, with `ANDROID_DEVICE_CHECK=partial` (the standing decision: the user owns no Android device), `ANDROID_CHECKED_SHA256` set and the signer digest above. Then the download-back.
11. **Website:** the Pages run succeeds, and the live site shows `v1.0.62` in the pill, its `aria-label` and the footer, plus `privacy.html` if it changed.
12. **TestFlight:** confirm 1.0.62.1 `VALID`. **Then stop for the user's own iPhone check of that exact build.** The device boundary means the user performs it and the result is recorded as they report it.
13. **App Store**, after the check passes.
    1. Create a new 1.0.62 record on build 1.0.62.1.
    2. Write the approved What's New and restore the promotional text from `appstore/LISTING.md`. It has arrived empty on twelve new records.
    3. Read every field back against `LISTING.md` and the review notes against `REVIEW_NOTES.md`, and check the age rating on the editable app info.
    4. Screenshots: this is the first record after the Duo set, and whether a new record carries its Duo placements has never been measured. So run `npm ci` in `website/tools`, then `node asc-screens.mjs readback --loc <en-US id>` from `pipeline/app-store-listing-polish/asc/`. Re-run `replace` for any set that did not arrive. The read-back must end `ALL MATCH` before submitting.
    5. Submit: `POST /v1/reviewSubmissions`, then `POST /v1/reviewSubmissionItems`, then `PATCH submitted: true`. Read the result back.
14. **`RELEASE_LEDGER.md`:**
    - the 1.0.62 App Store entry, which also records 1.0.61 as RESOLVED (`READY_FOR_SALE`, `c956722b` `COMPLETE`);
    - the 1.0.62 Android entry, with the APK, its signer, Partial on emulator evidence, the F-Droid state read live, and the WebView line;
    - "Corrected 2026-11-06" on the 1.0.61 Android entry: included and this tag picked up (`754c9f1f`, built from `3be27652`, published).

## Part two: shipping 1.0.62 (2026-11-06, from about 22:05 UTC)

Run by The Deployer, hands-off, on the user's production sign-off (`decisions.md`, section 3). Same worktree and branch; pushes go to `origin` with `git push origin HEAD:main`, so the local `main` ref (the `life-lists-tab` session's working branch) is never moved. No physical device touched, no other worktree entered, no stash used.

### 1. The approved copy, written

- **F-Droid changelogs:** `10000621.txt`, `10000622.txt` and `10000624.txt`, each the one approved sentence plus a newline (174 bytes, ASCII, SHA-256 `ea174eb0e250214e41224b6b7fb53afde5b0faf84f2eb1b43c35c84fe13137a0`, identical). No `1000062.txt`. Part one's pre-computed 368-byte hash was for the full three-sentence proposal and no longer applies, because the user approved the first sentence only.
- **Privacy policy:** both insertions from `held-copy.md`, applied by script to `PRIVACY_POLICY.md` and `website/privacy.html` with each anchor required to occur exactly once. The HTML's two target lines use literal apostrophes, as the whole file does (no `&#39;` or `&rsquo;` anywhere), so the inserted "region's" is literal too. A word diff shows exactly the two insertions in each file. U+2014: 0 in both.
- **Guard:** `describe.skipIf(!LANDED)` and the `LANDED` constant removed from `hotspotSharePublishedClaims.test.ts`, and its header reworded to say the copy has landed. **8 of 8 rows pass, 0 skipped.** The `\u2014` escape in its em-dash row is intact (no literal U+2014 in the file).
- **`held-copy.md`** opens with the approved text and the user's words; the proposals stay below as the record.
- **`RELEASE_LEDGER.md`**, two corrections re-read live before writing: 1.0.61 App Store RESOLVED (record `1ff37081` `READY_FOR_SALE` / `READY_FOR_DISTRIBUTION`, submission `c956722b` `COMPLETE`; 29 records all `READY_FOR_SALE`, 10 submissions all `COMPLETE`, no 1.0.62 record or build); 1.0.61 Android included and this tag picked up (`754c9f1f` on 2026-11-04 06:32 UTC; all three logs end `Successfully built ... from 3be276520c41697ed95eed672f0b7c6fb0095ca5`; f-droid.org publishes 10000611, 10000612 and 10000614, suggested 10000614).

### 2. Gates on the release tree

| Gate | Result |
|---|---|
| Version set (staged diff) | 1.0.62 in `package.json` and both lockfile root lines; `tauri.conf.json` 1.0.62 and versionCode 1000062; CHANGELOG `## [1.0.62] - 2026-11-06`; website pill text, `aria-label` and footer 1.0.62; recipe codes 10000621, 10000622, 10000624 and `CurrentVersionCode` 10000624 |
| Version-set guards (`hotspotSharePublishedClaims`, `fastlaneMetadata`, `androidVersionSource`, `icloudKeysPublishedClaims`, `fdroidRecipe`, `iosSceneManifest`) | 6 files, 126 passed |
| Full frontend suite (load 4.8 on 8 cores, no orphans) | **481 files passed, 5 skipped; 10,503 passed, 7 skipped, 0 failed** (the 7 pre-existing skips; part one's 2 Fastlane failures and 7 held rows now pass) |
| `npm run typecheck` (`tsc -b`) | exit 0 |
| `npm run build` | exit 0 |
| `eslint` on the edited guard | exit 0 |
| Built stylesheet after the guard edit | `index-C-rfbzc4.css`, SHA-256 `c74f8b9e...34f6`, byte-identical to the build before the edit |
| Backend `pytest tests/ -q` | **2,076 passed** |

### 3. Commits, push and tag

- **Release commit `c16526a7baf1e8435032f8daafd4d8022df32324`** (`chore(release): 1.0.62, Checklists at hotspots`, 16 files: the six-file set, the three Fastlane changelogs, both privacy files, the guard, `held-copy.md`, `decisions.md`, this record and `RELEASE_LEDGER.md`). `origin/main` re-fetched just before the push: still `3a1ee236`, an ancestor. Pushed `3a1ee236..c16526a7` with `git push origin HEAD:main`.
- **Annotated tag `v1.0.62`** (tag object `582c0d0e1ed304abf9ca5587c454d928c5950dbf`, message "SnowRaven 1.0.62") on `c16526a7`, created locally first so the recipe could name its hash.
- **Recipe hash `368569b4`** (`fix(fdroid): the recipe names v1.0.62's commit`, `d1df12dc`'s shape): the three `commit:` lines name `c16526a7baf1e8435032f8daafd4d8022df32324`; `fdroidRecipe`, `fastlaneMetadata`, `androidVersionSource` 57 of 57 green before the commit. Nothing goes to fdroiddata: no toolchain pin or recipe build step changed.
- **iOS stamp `1e4d824a735b6570225a59daffc2f5dd31dbb622`** (`chore(ios): stamp iOS 1.0.62 build 1`, `193b7643`'s shape, the two Info.plist files only): `snowraven_iOS/Info.plist` 1.0.62 / 1.0.62.1 and `snowraven_widgets/Info.plist` `CFBundleVersion` 1.0.62.1. **Stamped by script ahead of the archive build, not by it**, so that `origin/main` settled once (release, recipe hash, stamp) before the tag push and the parallel session's rebase, as the brief orders; the values are exactly what `tauri ios build --build-number 1` writes, and the build afterwards is checked to leave both files unchanged. `iosSceneManifest`, `iosWidgetManifest` and `iosAlertsManifest` 67 of 67 green before the commit. The iOS plist equals `frontend/package.json` (1.0.62) and does not lead it.
- Pushed `c16526a7..1e4d824a` (`origin/main` re-fetched first: `c16526a7`), then the tag alone: `git ls-remote` shows `v1.0.62` `582c0d0e` peeling to `c16526a7`.
- **One line sent to the `snowraven-2b` session** (the `life-lists-tab` build) after the tag push, as the brief words it: the tag is on origin and `origin/main` carries the release commit, the recipe hash and the iOS stamp; release.sh, TestFlight and the App Store steps still running, another line to follow. Delivered to its inbox (msg `63765411`).

### 4. CI and the website

- Started on the tag `c16526a7`: **Windows Build `42304086204`** and **Android Build `42304086122`**. On `main`: Pages `42303874704` (on `c16526a7`) **succeeded**; Pipeline `42303874791` (on `c16526a7`) **cancelled** by the next push (`cancel-in-progress`, expected); the run of record is **Pipeline `42304071292` on the stamp commit `1e4d824a`**.
- **Website live (about 22:23 UTC):** https://snowraven.dtgibson.com/ serves `aria-label="Version 1.0.62"`, pill `v1.0.62` and footer `SnowRaven v1.0.62 · Free &amp; open source`; `/privacy.html` is **byte-identical to the committed `website/privacy.html`** and carries both new sentences once each.

### 5. iOS build and TestFlight upload (during the CI wait)

- Root `npm ci` (Node 24.18.0): `found 0 vulnerabilities`; `node_modules/.bin/tauri` present. The three `/tmp/xcshim` shims recreated unconditionally (SHA-256 `fb229810...`, `9cb02667...`, `d1089cec...`); `swift` resolves to the shim; `xcrun --sdk iphoneos --show-sdk-version` **27.1**; Xcode 27.1 (27A9275).
- **No archive to move aside:** this worktree had no `src-tauri/gen/apple/build/` at all (its first iOS build).
- **Widget extension Swift tests** (`snowraven_widgetsTests`) on the local iPhone 18 Pro Max simulator, iOS 27.0, addressed by udid `2550EC7B-8328-42F6-B7F9-8FB2E6128163` (shut down before and after; the already-booted iPhone 18 Pro `54B95BBD` was left alone): **143 tests, 0 failures, `TEST SUCCEEDED`**.
- `tauri ios build --export-method app-store-connect --build-number 1`, outside the Bash sandbox in a `zsh -l` shell with `APPLE_API_KEY`, `APPLE_API_ISSUER` and `APPLE_API_KEY_PATH` mapped from the login shell (values never printed) and the shims first on `PATH`, 22:24:49 to 22:28:51 UTC: **`** BUILD SUCCEEDED **`**; Tauri's own export refused with "No Account for Team" and "No profiles for 'com.dtgibson.snowraven' / '...widgets'" (expected; exit 1 from that step only).
- **The fresh archive** (created 14:28:46 PST) reads 1.0.62 (1.0.62.1) in its `ApplicationProperties`, the app's and the appex's Info.plist; the app's `DTSDKName` `iphoneos27.1`, `DTSDKBuild` `24A94232`, `DTXcodeBuild` `27A9275`, `MinimumOSVersion` 16.0. `vtool -show-build`: the app `platform IOS`, minos 16.0, sdk 27.1; the appex `platform IOS`, minos 17.0, sdk 27.1. All nine swift-rs libraries report `LC_BUILD_VERSION` platform 2.
- **The build left both Info.plist files unchanged**, so the pre-stamped `1e4d824a` holds exactly what the build writes. Its one tree change, Tauri's no-op `PRODUCT_NAME = "SnowRaven"` re-quote at two lines of `project.pbxproj`, was read and restored.
- The archived `snowraven_widgets.appex` was `not signed at all`; ad-hoc signed with `snowraven_widgets.entitlements`, it then lists `com.apple.security.application-groups` = `group.com.dtgibson.snowraven`.
- Manual `xcodebuild -exportArchive` with `~/.tauri/snowraven-ios-export-options.plist` to `src-tauri/gen/apple/build/export-1.0.62.1/`: **`EXPORT SUCCEEDED`**. `DistributionSummary.plist`: the appex with the App Group alone (profile "SnowRaven Widgets App Store", `50691228`), the app with the App Group, the three iCloud keys and `icloud-container-environment` `Production` (profile "SnowRaven iOS App Store iCloud AppGroup 20260924", `870fe004`), both 1.0.62 (1.0.62.1), certificate Apple Distribution SHA1 `1861F7A4...7697B`, expiring 2027-07-05. All 36 iOS icon PNGs (`src-tauri/icons/ios/` and the committed `AppIcon.appiconset/`) report `hasAlpha: no`. **IPA SHA-256 `e6ee355fd4cc257738d591dc25a9f242c56098f947a55f669f4f81181c979d7f`**.
- `altool --validate-app` (22:31 UTC): **`VERIFY SUCCEEDED with no errors`**. `--upload-app` (22:32 to 22:33 UTC): **`UPLOAD SUCCEEDED with no errors`, Delivery UUID `8c02a421-b312-4c5c-ad4d-511b307690e5`**.
- **Windows Build `42304086204` succeeded** on `c16526a7` (22:32:45 UTC); `gh run list --workflow windows-build.yml --status success --commit c16526a7...` returns exactly that run.
- **TestFlight (read with the metadata key `QJA25M7XHM`, GET only, about 22:41 UTC):** build **1.0.62.1** (`8c02a421-b312-4c5c-ad4d-511b307690e5`, the Delivery UUID) **`VALID`**, uploaded 2026-11-06 14:34:30 PST, train 1.0.62, `minOsVersion` 16.0, not expired, **`usesNonExemptEncryption` false** (the export compliance answer, from `ITSAppUsesNonExemptEncryption` false in the plist, so the build needs no manual compliance step), beta detail `internalBuildState` **`IN_BETA_TESTING`** (testable by the internal group, as 1.0.61.1). **No 1.0.62 version record exists; it waits for the user's iPhone check (part three).**

### 6. CI on the tag: all green, no re-run

| Run | Commit | Result |
|---|---|---|
| Windows Build `42304086204` | tag `c16526a7` | **success** (22:32:45 UTC); the pinned lookup returns exactly this run |
| Android Build `42304086122` | tag `c16526a7` | **success** (22:40:33 UTC); the pinned lookup returns exactly this run |
| Pages `42303874704` | `c16526a7` | **success** |
| Pipeline `42303874791` | `c16526a7` | cancelled by the next push (`cancel-in-progress`, expected) |
| **Pipeline `42304071292` (run of record)** | stamp `1e4d824a` | **success** (22:45:51 UTC): Backend and Frontend (lint, test, build) both green; `AddressSearch.test.tsx` did not flake, so nothing was re-run |

### 7. Android: preflight, sign, emulator check

Build shell per the runbook: JDK 17.0.20.1, `ANDROID_HOME`, `NDK_HOME` (27.2.12479018), `~/.tauri/gradle-8.14.3/bin` first on `PATH`, `SNOWRAVEN_ANDROID_SIGNER_SHA256` set to the recorded digest. Both scripts write only to private temp directories.

- `scripts/android/preflight.sh` **exit 0**, every check `ok`: JDK 17, keytool, apksigner/zipalign/aapt2 from build-tools 36.0.0, Gradle 8.14.3, cargo-tauri 2.11.2, the keystore opens (alias `snowraven`), the version pair 1.0.62 / 1000062, `v1.0.62` pushed at `c16526a7baf1` and carrying that pair, the three changelogs `10000621.txt`, `10000622.txt` and `10000624.txt` present at the tag, run `42304086122`'s artifact `SnowRaven_1.0.62_android_universal_unsigned.apk` (`com.dtgibson.snowraven`, 1.0.62, 1000062, not debuggable). Its one warning (HEAD is not the tag's commit) is the recipe-hash and stamp commits after the tag, as at every ship.
- `scripts/android/sign.sh` **exit 0**: v2 and v3 (v1 off), signer `CN=SnowRaven, O=Dave Gibson`, **`Signer #1 certificate SHA-256 digest: 42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a`**, `ok signer equals the keystore's certificate`, `ok signer equals the recorded digest`. **Signed APK SHA-256 `81c9040613bb058c1a92351091492a290ead0a0af0296f629ddda6ef09fd51e8`**.
- **Emulator opening check** on the local API 36 Google APIs image only (`sr-api36-phone`, `sdk_gphone64_arm64`, 1080x2400 at 420 dpi, port 5554, headless, `-gpu host`, `-no-snapshot-save`; every `adb` call addressed to `emulator-5554` by serial, no device listing taken; port 5554 and the process list checked free first). No SnowRaven installed before. The exact signed bytes (hash re-read equal, `81c90406...51e8`) installed fresh: `versionName` 1.0.62, `versionCode` 1000062, minSdk 26, targetSdk 36. Cold start `Status: ok`, `LaunchState: COLD`, `TotalTime` 445 ms, the app's `MainActivity` window focused, the Welcome screen drawn (`evidence/ship/api36-1.0.62-first-launch.png`); "Explore the app first" opened Weather (`...-weather-tab.png`), and the bottom bar opened **Statistics**, the tab this release changes, at its "Statistics require your eBird backup" state (`...-statistics-empty.png`). One process (pid 4721) throughout, crash buffer empty. The share block itself needs an imported backup and an eBird key and was not reached on the emulator; it is covered by the suite (QA). The app was uninstalled and the emulator stopped. (A first boot probe ran every `adb` call as one command name, zsh's no-word-splitting trap, and was stopped and rewritten with a function; nothing it ran reached the emulator.)
- **WebView:** `com.google.android.webview` `versionName` 133.0.6943.137: **WebView 133, unchanged since the last measurement.**
- The device check is **Partial on API 36 emulator evidence, under the standing decision** (CLAUDE.md, Versioning: the user owns no Android device), as at 1.0.53 to 1.0.61. The attach waits for `release.sh` to create the `v1.0.62` release.

### 8. Desktop: `release.sh`

- Before it: the dirty set was this record (modified) and `evidence/` (the emulator screenshots, untracked), both pipeline records no build step reads; no other SnowRaven release, `tauri build` or dev watcher running (one unrelated `vite preview` for another project); login keychain unlocked (`no-timeout`).
- `CI=true ALLOW_DIRTY=1 zsh -lc ./release.sh`, **exit 0**: `Releasing v1.0.62: tag=c16526a7 HEAD=1e4d824a`; iCloud profile OK (`8QKC3L2FKP.com.snowraven`, expires 2044-08-27); root `npm ci` 0 vulnerabilities; bundle version verified 1.0.62; iCloud entitlements and embedded profile verified; DMG styled, signed and verified; **notarization submission `f088e1fc-d4b2-4cc5-80f1-4d1332e7ac75` `Accepted`**, stapled; Windows installer fetched from CI and signed locally; **release published 2026-11-06 22:53:00 UTC, not a draft or pre-release, now `Latest`: https://github.com/dtgibson/snowraven/releases/tag/v1.0.62 (release id `437142018`)**.
- Assets: `latest.json`, `SnowRaven-updater.app.tar.gz` and `.sig`, `SnowRaven_1.0.62_universal.dmg`, `SnowRaven_1.0.62_x64-setup.exe` and `.sig` (and, after step 9, the Android APK).
- **Download-back:** the DMG (SHA-256 `4963c8ac7dce448e1e98000cd50f137ca307bd037832acf49b44a9f829c13b37`) passes `codesign --verify --verbose=2` (valid on disk, satisfies its Designated Requirement), `xcrun stapler validate` (worked), `spctl -a -t open --context context:primary-signature -vv` (**accepted, source=Notarized Developer ID**, `DAVID THOMAS GIBSON (8QKC3L2FKP)`) and `hdiutil verify` (checksum VALID), and mounts read-only to SnowRaven.app 1.0.62 (x86_64 and arm64).
- `latest.json` (SHA-256 `3977378d...104a`; also through `releases/latest/download`): version 1.0.62; `darwin-aarch64` and `darwin-x86_64` identical, both on `SnowRaven-updater.app.tar.gz`; `windows-x86_64` on `SnowRaven_1.0.62_x64-setup.exe`; both URLs answer HTTP 200. **The published installer is byte-identical to run `42304086204`'s artifact** (SHA-256 `52ffacb05478bc03a8f7f8559f39a00493bc3cce5b5f17312c9a5b73101a9066`).
- **Follow-up, not a blocker (unchanged from 1.0.61):** `release.sh`'s frontend `npm ci` reports "12 vulnerabilities (10 moderate, 2 high)" (1.0.61 read 14). `npm audit --omit=dev` with network reads **0**; the full tree's 12 are all development tooling (`eslint`, `@eslint/js`, `@eslint/config-array`, `typescript-eslint` and its five `@typescript-eslint/*` packages, `minimatch`, and the two highs `undici` and `zod`). The 1.0.61 ship's dev-only audit refresh is still open.

### 9. Android attach

- `ANDROID_DEVICE_CHECK=partial ANDROID_CHECKED_SHA256=81c90406...51e8 SNOWRAVEN_ANDROID_SIGNER_SHA256=42a3576e...996a scripts/android/attach.sh <signed apk>` **exit 0** (Partial on emulator evidence by standing decision: the user owns no Android device, CLAUDE.md Versioning). Checks: signer equals the keystore's certificate, byte-identical to the checked file, `com.dtgibson.snowraven` 1.0.62 (1000062). Uploaded to v1.0.62 as **`SnowRaven_1.0.62_android_universal.apk`** and downloaded back: `ASSET_SHA256=81c9040613bb058c1a92351091492a290ead0a0af0296f629ddda6ef09fd51e8`, `SIGNER_SHA256=42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a`.
- **F-Droid readout (public reads, 22:54 UTC):** fdroiddata `master` still has `CurrentVersion` 1.0.61 (`CurrentVersionCode` 10000614) and no 1.0.62 entry; the logs for 10000621, 10000622 and 10000624 answer 404. So 1.0.62 is **included and this tag not yet built**, the expected state half an hour after a tag (the bot adds the newest tag within a day or two). Nothing was sent to fdroiddata. Part three re-reads this for the ledger.

### 10. Where part two stops (2026-11-06, about 22:55 UTC)

**Live:** the website (pill 1.0.62, both privacy sentences); the GitHub release v1.0.62 (`Latest`) with the notarized universal Mac DMG, the Windows installer, `latest.json` (the in-app updater now offers 1.0.62 on Mac and Windows) and the signed Android APK; TestFlight build 1.0.62.1 `VALID` and testable. F-Droid takes the tag on its own schedule.

**Not done, by design (part three, after the user's iPhone check):** no 1.0.62 App Store version record, no What's New written, no screenshot read-back, no submission, and no 1.0.62 sentence in `RELEASE_LEDGER.md` (App Store or Android). The second line to the `snowraven-2b` session ("another line follows when they are done") is owed when the App Store steps finish. This record and `evidence/ship/` (three PNGs) are uncommitted in the worktree for part three or the Chronicler to commit.

**The user's check (device boundary: the user performs it, the result is recorded as they report it):** install TestFlight build **1.0.62 (1.0.62.1)** on their own iPhone, open it, and confirm it launches; then, with their eBird backup and eBird key already in the app, open Statistics, scroll to Geographic Stats, and confirm the "Checklists at hotspots" share bar renders above the top-location lists with a hotspot and a personal-location percentage and the counts behind them.

## Part three: the App Store record, submission and ledger (2026-11-07, from about 00:15 UTC; 2026-11-06 PST)

Run by The Deployer, hands-off, after the user's own iPhone check of TestFlight build 1.0.62.1 passed (`decisions.md`, section 4: it launches, and the "Checklists at hotspots" bar shows in Statistics, Geographic Stats, with both percentages and the counts). The production sign-off is section 3. Same worktree and branch; the push goes to `origin` with `git push origin HEAD:main`, so the local `main` ref is never moved. No physical device touched, no other worktree entered, no stash used.

Driven through the App Store Connect API with the metadata key `QJA25M7XHM` (token minted in-process by `pipeline/app-store-listing-polish/asc/asc-lib.mjs`, never printed), from a script in the session scratchpad. Every expected value was extracted by script from `appstore/LISTING.md` and `appstore/REVIEW_NOTES.md` as committed; neither file was edited. Review contact details were compared, never printed.

### 1. Before writing

- **Live state (read only):** 29 version records, all `READY_FOR_SALE` (1.0.61 `1ff37081` `READY_FOR_DISTRIBUTION`); 10 review submissions, all `COMPLETE`; no 1.0.62 record and no record from the parallel session; build **1.0.62.1 `8c02a421` `VALID`**, not expired, `usesNonExemptEncryption` false; one app info, `8c34f889`.
- **The extraction against the live 1.0.61 record: `ALL SAME`.** Description 3,234 characters, keywords 97, promotional text 137, marketing and support URLs, copyright `2026 Dave Gibson`, review notes 3,898; name, subtitle, privacy policy URL, Reference and Weather on the app info; age rating 30 fields (16 `NONE`, 11 false, 3 null). None of the extracted values contains U+2014.
- **The What's New** checked equal to the approved sentence in `held-copy.md` and to the three F-Droid changelogs: 173 characters, ASCII, no em dash.

### 2. The record

- `POST /v1/appStoreVersions` (201) at 2026-11-07 00:17:17 UTC: **`e48a104b-0542-4c8c-b304-26059fa3bc61`**, 1.0.62 on build 1.0.62.1, `PREPARE_FOR_SUBMISSION`, `AFTER_APPROVAL`, copyright from `LISTING.md`. en-US localization **`6e149a48-0c8c-4116-8739-e0ead744a69c`**. A new editable app info, `2618e95e`, appeared beside the live `8c34f889`.
- **What it carried:** the description, keywords, both URLs, the review notes (byte-identical, 3,898) and the contact details; the name, subtitle, privacy policy URL, both categories and the age rating on both app infos. **The promotional text and the What's New arrived EMPTY**, the promotional text for the thirteenth time on a new record.
- **One write:** `PATCH` of the en-US localization with `whatsNew` (the approved sentence) and `promotionalText` (from `LISTING.md`), 200. Nothing else was written, because nothing else differed.

### 3. Listing read-back: `READBACK 1.0.62: ALL SAME`

Read after the write (`evidence/ship/listing-readback-1.0.62.txt`) and again after submitting, both times every field identical to the committed files:

| Field | Result |
|---|---|
| Build | `8c02a421` 1.0.62.1 `VALID` attached |
| Release | `AFTER_APPROVAL`, no earliest release date, no phased release; one localization, en-US |
| What's New | 173, the approved sentence (restored) |
| Promotional text | 137, from `LISTING.md` (restored) |
| Description, keywords | 3,234 and 97 (carried) |
| Marketing URL, support URL | `https://snowraven.dtgibson.com`, `https://github.com/dtgibson/snowraven` (carried) |
| Copyright | `2026 Dave Gibson` (set at creation) |
| App Review notes | byte-identical to `REVIEW_NOTES.md`, 3,898 (carried) |
| Review contact | first and last name, phone and email present and equal to 1.0.61's (not printed); demo account not required |
| Name, subtitle, privacy policy URL, categories | `SnowRaven`, `Your birding data, explored`, `https://snowraven.dtgibson.com/privacy.html`, Reference and Weather, on both app infos (carried) |
| Age rating | on both app infos: 30 fields, 16 `NONE`, 11 false, 3 null (`kidsAgeBand`, `gracRatingClassificationNumber`, `developerAgeRatingInfoUrl`, null on a non-Kids app), identical across the two; consistent with `LISTING.md` (4+); nothing changed |

The privacy label ("Data Not Collected") can be checked only in the App Store Connect UI and was not touched; this release sends nothing to the developer, so it stands.

### 4. Screenshot read-back: `ALL MATCH`, 18 of 18

- `npm ci` in `website/tools` (9 packages, `sharp` 0.35.4; `node_modules` is gitignored and the lockfile is unchanged).
- `node asc-screens.mjs readback --loc 6e149a48-0c8c-4116-8739-e0ead744a69c` from `pipeline/app-store-listing-polish/asc/`, before submitting: **`read-back: ALL MATCH`** (`evidence/ship/screenshots-readback-1.0.62.txt`).
  - iPhone 6.9-inch, `IPHONE_DYNAMIC_ISLAND_LARGE_PROFILE` / legacy `APP_IPHONE_67` set `1aceebe5`: six OK (name, size, dimensions, md5, delivery `COMPLETE`, decoded pixels).
  - iPad 13-inch, `IPAD_13_PROFILE` / legacy `APP_IPAD_PRO_3GEN_129` set `ff4f2cb2`: six OK, the same checks.
  - **iPhone Duo, `IPHONE_DUO_PROFILE`: six `ACTIVE` placements, images `APPROVED`, name, size, dimensions and decoded pixels OK.**
- **Second view** (`asc-library-read.mjs --loc ...` and `asc-read.mjs --version 1.0.62`): 18 placements, all `ACTIVE` and `APPROVED`, each group in the order 01, 02, 04, 05, 03, 06 on its spec (`bd402f1a`, `1751a63a`, `5d458eef`); the legacy API also lists the Duo as `APP_IPHONE_DUO` set `7391c27c`, six `COMPLETE` with md5s equal to `appstore/screenshots/iphone-duo/` in upload order.
- **Measured for the first time: a new record DOES carry the iPhone Duo placements from the previous record**, as it carries the two legacy sets. Nothing was re-uploaded. `appstore/screenshots/` is unchanged since 1.0.61, and no committed shot shows the new block (part one).

### 5. Submission

- Re-checked first: the record `PREPARE_FOR_SUBMISSION`, no open review submission.
- `POST /v1/reviewSubmissions` (201, `READY_FOR_REVIEW`), `POST /v1/reviewSubmissionItems` with the record (201, `READY_FOR_REVIEW`), `PATCH submitted: true` (200): **submission `feeb4e41-91fe-41ba-b665-247e8d225feb`, `WAITING_FOR_REVIEW`, submitted 2026-11-07 00:18:34 UTC.**
- **Read back:** the submission `WAITING_FOR_REVIEW` (platform IOS), its one item `READY_FOR_REVIEW`; the record **1.0.62 `WAITING_FOR_REVIEW` / `WAITING_FOR_REVIEW`**, `AFTER_APPROVAL`, no phased release, build `8c02a421`; every listing field still `ALL SAME`.
- **Reconciliation (read only, after submitting):** 30 version records (1.0.62 `WAITING_FOR_REVIEW`, the other 29 `READY_FOR_SALE`); 11 review submissions (this one waiting, 10 `COMPLETE`); 86 TestFlight trains, 94 builds, every build `VALID`. The versions from 1.0.13 on with a train and no record of their own are the same 21 as at 1.0.59 to 1.0.61 (1.0.15, 1.0.16, 1.0.18, 1.0.20, 1.0.22, 1.0.25, 1.0.26, 1.0.29, 1.0.33, 1.0.37, 1.0.39, 1.0.41, 1.0.42, 1.0.43, 1.0.44, 1.0.46, 1.0.48, 1.0.49, 1.0.52, 1.0.54, 1.0.58), each with its written disposition. **No unaccounted gap between 1.0.13 and 1.0.62.**

### 6. F-Droid, re-read for the ledger (public reads, 2026-11-07 00:19 UTC)

- fdroiddata `master`: `CurrentVersion` 1.0.61, `CurrentVersionCode` 10000614, newest recipe commit still `754c9f1f` (2026-11-04 06:32 UTC, "bot: Update SnowRaven to 10000614"); no 1.0.62 entry.
- Build logs for 10000621, 10000622 and 10000624: all **404** (not attempted).
- f-droid.org publishes 1.0.61 (10000614, 10000612, 10000611), 1.0.60 and 1.0.59; `suggestedVersionCode` 10000614.
- **State: 1.0.62 included and this tag not yet built**, the expected state about 90 minutes after the tag. Nothing is owed to fdroiddata (no toolchain pin or recipe build step changed).
- GitHub APK re-read from the release's asset digest: `SnowRaven_1.0.62_android_universal.apk` `sha256:81c9040613bb058c1a92351091492a290ead0a0af0296f629ddda6ef09fd51e8`, equal to the signed and checked file (part two, section 9).

### 7. `RELEASE_LEDGER.md`

- **App Store, `### 1.0.62 SHIP (2026-11-06)`:** 1.0.61 resolved; the record `e48a104b`, submission `feeb4e41`, build 1.0.62.1, `WAITING_FOR_REVIEW`; What's New and promotional text restored; the carried fields; the age rating; the screenshot read-back with the first Duo carry-over measurement; the reconciliation.
- **Android, `### 1.0.62 SHIP (2026-11-06)`:** APK attached with its SHA-256 and signer, Partial on emulator evidence by standing decision, F-Droid included and this tag not yet built (both reads), WebView 133 unchanged.

### 8. Where 1.0.62 stands

**Shipped on every platform:** Mac and Windows (GitHub release v1.0.62 with `latest.json`, the in-app updater offering it), the website (pill 1.0.62, both privacy sentences), the signed GitHub Android APK, TestFlight 1.0.62.1, and the App Store submission in review (`WAITING_FOR_REVIEW`, released automatically on approval). F-Droid will pick up the tag on its own. The 1.0.62 App Store disposition still reads `WAITING_FOR_REVIEW` in the ledger; the next ship's live query records its outcome.
