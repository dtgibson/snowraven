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
- **Guard:** `describe.skipIf(!LANDED)` and the `LANDED` constant removed from `hotspotSharePublishedClaims.test.ts`, and its header reworded to say the copy has landed. **8 of 8 rows pass, 0 skipped.** The `—` escape in its em-dash row is intact (no literal U+2014 in the file).
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
