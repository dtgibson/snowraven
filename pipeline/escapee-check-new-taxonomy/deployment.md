# Deployment record: escapee-check-new-taxonomy (1.0.67)

## Part one: preparation (2026-11-08, about 23:00 to 23:25 UTC, 15:00 to 15:25 PST), hands-off

Run by The Deployer (Fix lane, the ship stage) as a prep-only invocation, on `main` in the main checkout. Nothing was committed, tagged, pushed, released, built for a store or uploaded, and no held copy was written into a live file. GitHub, App Store Connect and F-Droid were only read. Nothing was sent to eBird. The production sign-off is the next gate, and part two runs on its recorded answer.

### Preconditions

- **The Tester PASSED** (`qa-report.md`, gitignored, on disk): full weave, 14 of 14 criteria after one retry (D-01, the comma at a line start).
- **The Auditor PASSED WITH NOTES** (`security-report.md`, gitignored, on disk): nothing above Low. L-1 applied as a `paths` line in `.claude/rules/security.md`; I-1, I-2 and I-3 accepted (D-02).
- `pipeline.config.json`: no staging environment, as at every SnowRaven ship. The target is the project's own release machinery (the `snowraven-release` skill), so the production sign-off is the one gate. This release needs no key, environment variable, host or provider setting, so there is no external setup to offer.

### Repository state (`git fetch origin --tags`, about 23:05 and 23:20 UTC)

- `origin/main` is `8054a676` (`chore: context update after ebird-request-economy`), equal to local `main`: nothing ahead, nothing behind. Only `origin/main` exists remotely.
- No `v1.0.67` tag locally or on origin; `gh release list` shows v1.0.66 as Latest (2026-11-08 16:20:17 UTC).
- The other worktree (`.claude/worktrees/life-list-filter-toggle-state`), read by `git log` on its branch only, never entered: at `481b9ee3`, 0 commits ahead of `main`. No in-flight ship there.

### The version set (five of six written; the sixth held)

| File | Change |
|---|---|
| `frontend/package.json`, `frontend/package-lock.json` (two lines) | 1.0.66 to 1.0.67 |
| `src-tauri/tauri.conf.json` | `version` 1.0.67, `bundle.android.versionCode` 1000067 (the updater endpoint is `releases/latest/download/latest.json`, which carries no version) |
| `CHANGELOG.md` | `## [1.0.67] - 2026-11-08`: one Fixed bullet, five Internal bullets; no em dash, no non-ASCII character, American spelling |
| `website/index.html` | the version pill text, its `aria-label`, and the footer line; nothing else (a version stamp, no approval needed) |
| `pipeline/android-release/fdroid/com.dtgibson.snowraven.yml` | three `Builds` entries at 1.0.67 (10000671, 10000672, 10000674), `CurrentVersion` 1.0.67, `CurrentVersionCode` 10000674; the three `commit:` lines stay on 1.0.66's `d2901167...` and move to `v1.0.67^{commit}` after the tag |
| **Held:** `fastlane/metadata/android/en-US/changelogs/10000671.txt`, `10000672.txt`, `10000674.txt` | not written. The text is `held/whats-new.txt` (353 characters, 354 bytes with the newline, SHA-256 `6f50598046bdcacd2166eaa2c93047e58507f1ad6f3ffc56f721a7e504ed25dd`); `bump-1.0.67.sh held` writes all three on the yes |

The iOS plists stay at 1.0.66 / 1.0.66.1 until `tauri ios build` stamps them (`iosSceneManifest.test.ts`'s "never leads" rule).

`bash pipeline/escapee-check-new-taxonomy/bump-1.0.67.sh` (check mode) exit 0: the stamped set is consistently at 1.0.67, the three changelog files are absent, and the CHANGELOG heading equals today's date. Run as `held` against a scratch copy of the repository (`BUMP_ROOT`), it wrote the three files byte-equal to `held/whats-new.txt`, and the five version-set guards passed there, 5 files and 119 tests.

### Gates on the live tree (nothing else of SnowRaven's running)

- `npx vitest run src/lib/fastlaneMetadata.test.ts src/lib/fdroidRecipe.test.ts src/lib/androidVersionSource.test.ts src/lib/icloudKeysPublishedClaims.test.ts src/lib/iosSceneManifest.test.ts`: 117 passed, 2 failed, the two `fastlaneMetadata.test.ts` rows that wait for the held changelogs ("has the same changelog under each per-processor code..." and its guard-the-guard row). They turn green on the yes, as at 1.0.66.
- `npm run typecheck`, `npm run lint`, `npm run build`: exit 0.
- **Full frontend suite, `npx vitest run`, alone: 494 files passed, 1 failed, 5 skipped; 10,783 tests passed, 2 failed, 6 skipped (74.2 s).** The two failures are the held-changelog rows above and nothing else. No timing-ratio row failed locally; `lifeListsLinearity` and `alphaCodes` passed in the full run. `lifeListsPublishedClaims.test.ts`, the other reader of the changelogs folder, is pinned to 1.0.63's code, so the held text meets only `fastlaneMetadata`.
- **The real-engine gate,** `CI=true npm run verify -- ../../frontend/dist` in `website/tools`: **8/8 harnesses green**, 253 PASS lines, 0 FAIL (Chromium and WebKit, the built `dist` served from loopback with no backend and no key).
- **Backend pytest could not run:** `backend/.venv/bin/python` points at `/opt/homebrew/opt/python@3.11/bin/python3.11`, which no longer exists. A Homebrew upgrade at 14:49 to 14:53 PST today replaced `python@3.11` with `python@3.15` (it also moved `openjdk@17`, `node@24`, `cocoapods` and others). This release changes no file under `backend/`, and CI's Backend job runs on its own runner, so nothing here depends on it. Rebuilding the venv is the user's call (see the hand-back).
- Em dashes and non-ASCII over every added line and new file (1,490 lines): none in shipped text. The website footer keeps its existing middot; `exoticProvenance.ts` gains one more box-drawing section rule in a comment, the file's existing style (6 at HEAD); two Weft record headings carry em dashes, as 646 committed pipeline files do. The bump script's middot and em dash, which the editing tool turned into literal characters, were rewritten as escapes.

### CI on `main`

Pipeline has failed on every completed run since `1e24a50c` (2026-11-07 04:34 UTC): 9 of 9, the last green run being `42334891588` on `38cb0c2f`. Each failure is `lifeListsLinearity.test.ts` "pass 1 (first sightings), every row its own species", CPU-time ratio 21.1 to 25.1 against 20, plus `alphaCodes.test.ts`'s per-doubling quotient on two of the nine runs (3.24 against 3.2, 16.53 against 15.625); Backend, lint and typecheck green every time. The latest is `42503993218` on `8054a676` (22.72). A rerun has never come back green, so this is a steady red on GitHub's shared runners rather than an occasional flake. 1.0.64 (D-17), 1.0.65 (D-8) and 1.0.66 shipped under the rule "a failure in a test this release touches, or any non-timing failure, reverses it". **1.0.67 touches nothing either ratio measures**: `lifeListsLinearity` imports `lifeLists.ts` (which imports only `types`, `parseMLExport` and `speciesUtils`), `alphaCodes.test.ts` imports `alphaCodes`, `speciesIndex`, `speciesMatch` and `speciesUtils`, and none of them is in the diff (`lifeListsProvenance.ts`, which is, is a different module). The two steps CI skips after the red test step, the build and the real-engine gate, passed locally above.

### Rig readiness (read only, about 23:12 to 23:17 UTC)

| Check | Result |
|---|---|
| Login keychain | `no-timeout`: unlocked |
| `gh` | signed in as `dtgibson` |
| Login shell | Node v24.18.0 (nvm); cargo 1.96.1; Rust targets for both Mac slices, iOS device and simulator, and the Android ABIs; `APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID`, `APPLE_API_KEY_PATH` (exists) and `APPLE_SIGNING_IDENTITY` (matches one identity) set |
| Secrets (existence and mode only) | `~/.tauri/snowraven-signing.key` 600; ASC keys `QJA25M7XHM` and `BVVLBRRVL6` 600; the Android keystore and its properties file 600 |
| Signing identities | Developer ID Application, Apple Distribution (`1861F7A4...`) and Apple Development, team `8QKC3L2FKP` |
| Profiles | Developer ID "SnowRaven Mac Developer ID 20260901" to 2044; the export plist maps the app to "SnowRaven iOS App Store iCloud AppGroup 20260924" and the widgets to "SnowRaven Widgets App Store", both installed under both profile directories, to 2027-07-05; manual signing, `iCloudContainerEnvironment` Production |
| Xcode | 27.2 (27B52), iOS SDK 27.2, Swift 6.4.2 (the swift shim still applies); `xcodebuild -checkFirstLaunchStatus` exit 0. No `simctl` call was made |
| Leftover iOS archive | `src-tauri/gen/apple/build/snowraven_iOS.xcarchive` is 1.0.66.1: moved aside first in part two |
| Android | JDK 17.0.21.0.3 (Homebrew moved it from 17.0.20.1 today; still major 17, the pin); `apksigner`, `zipalign`, `aapt2` under build-tools 36.0.0; one NDK, 27.2.12479018; Gradle 8.14.3 at `~/.tauri/gradle-8.14.3` runs on that JDK; `cargo tauri` 2.11.2; `toolchain.env` unchanged against HEAD; AVDs `sr-api24/26/30/36-phone`, `sr-api36-aosp`, `sr-api36-tablet` |
| CocoaPods | upgraded today, not used: `gen/apple/Podfile` names no pods and was never installed |

### App Store Connect (read only, metadata key, GET only, 23:17:16 UTC; `evidence/ship/asc-read-1.0.67-prep.txt`)

- **1.0.66 is `READY_FOR_SALE`**: record `ab6360bc-24b3-4816-bf84-88967df06507` (`READY_FOR_DISTRIBUTION`, `AFTER_APPROVAL`) on build 1.0.66.1 (`32038a0c`). Its submission `51af3019-9ba7-4db1-a4df-d390a7ce7901` is `COMPLETE`: Apple approved it after the 16:43:57 UTC submission and it released on approval. The `RELEASE_LEDGER.md` 1.0.66 entry, which says `WAITING_FOR_REVIEW`, is updated at part two's ledger step.
- 31 version records, all `READY_FOR_SALE`; 10 review submissions listed, all `COMPLETE`; **nothing open**. 90 TestFlight trains and 98 builds, every build `VALID`; the newest train is 1.0.66; no 1.0.67 train or record.
- From 1.0.13 on, 54 trains, of which 24 have no record of their own: the 21 the 1.0.59 ship accounted for, 1.0.62, 1.0.64 and 1.0.65 (each rolled up). **No unaccounted gap.**

**The disposition for 1.0.67:** neither a rollup nor a deferral is possible, because nothing is in review. **1.0.67 gets its own new record** on build 1.0.67.1, `AFTER_APPROVAL`, no phased release, with What's New as the held note alone (353 characters): store users are on 1.0.66, whose record carried the 1.0.64 to 1.0.66 notes. A new record has arrived with the promotional text empty fourteen times, so it is restored from `appstore/LISTING.md` and every field is read back; the age rating is answered on the editable app info; the screenshot `readback` must end `ALL MATCH` before submitting. The state is read again immediately before the App Store step.

### F-Droid (public reads, 23:18:06 UTC; `evidence/ship/fdroid-read-1.0.67-prep.txt`)

- fdroiddata `master`: `CurrentVersion` 1.0.65 / 10000654; `Builds` entries for 1.0.53, 1.0.55, 1.0.56, 1.0.60, 1.0.61 and 1.0.65. **Newest recipe commit `8970b26d` "keep latest", 2026-11-08 19:02 UTC**, a maintainer's sweep that removed the 1.0.63 entries.
- f-droid.org publishes 1.0.61, 1.0.60 and 1.0.59 (`suggestedVersionCode` 10000614). The build logs for 10000631/4, 10000651/4 and 10000661/2/4 all answer 404.
- **States:** **1.0.63 superseded on F-Droid by 1.0.65** (corrects the 1.0.63 Android ledger entry's "included and this tag not yet built" at part two's ledger step); 1.0.65 included and this tag not yet built; 1.0.66 included and this tag not yet built (no entries yet). The bot has run at about 09:00 to 10:00 UTC on each of the last two days, so a v1.0.67 tag pushed before its next run most likely means 1.0.66 is skipped there and superseded by 1.0.67, which costs nothing.
- **Nothing goes to fdroiddata at 1.0.67**: `toolchain.env` is unchanged and the recipe diff moves only versions and codes.

### Cargo for the production gate

`git log origin/main..main`: none. The release carries this run's working tree and nothing else:

| Group | Files | Whose |
|---|---|---|
| App behavior | `lib/exoticTaxonomyJoin.ts` (new), `exoticProvenance.ts`, `exoticProvenanceCache.ts`, `useExoticProvenance.ts`, `lifeListsProvenance.ts`, `exoticCopy.ts`, `components/BirdingStats.tsx`, `ExoticProvenanceAccount.tsx`, `BirdName.tsx`, `globals.css` | this build |
| Tests | `exoticTaxonomyJoin.test.ts` (new) and the touched suites (`exoticProvenance`, `exoticProvenanceCache`, `exoticProvenanceConvergence`, `useExoticProvenance`, `lifeListsProvenance`, `ExoticProvenanceAccount`, `entryChunk`, `settingsRouteBudget`) | this build |
| Rule file | `.claude/rules/security.md` (one `paths` line, D-02) | this build |
| Version set, five of six | above | this build |
| Record-keeping | `pipeline/escapee-check-new-taxonomy/` (brief, decisions, how-to-see, PR description, `held/`, `bump-1.0.67.sh`, this record, `evidence/ship/`); `qa-report.md` and `security-report.md` are gitignored and stay out | pre-approved cargo |
| Held, written only on the yes by `bump-1.0.67.sh held` | the three F-Droid changelogs | this build |

No commit from another build or from manual work rides along.

## Part two A: every leg but the App Store record (2026-11-08 23:31 to 2026-11-09 00:30 UTC, 15:31 to 16:30 PST), hands-off

Run by The Deployer on the user's firsthand answer at the production sign-off gate, "Confirm: deploy 1.0.67 now.", given in the orchestrator's session. That answer authorizes every command below and approves the held copy word for word (`held/whats-new.txt`, SHA-256 `6f505980...e504ed25dd`, for F-Droid and the App Store What's New). Held in this invocation, as directed: no App Store version record or submission was created or changed (App Store Connect was read only), and `RELEASE_LEDGER.md` was not written.

**Attribution.** The orchestrator asked for the trailer `Co-Authored-By: Claude Fable 5.1`. The commits below were written by Claude Opus 5.5 and carry `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, the session's own attribution line, as at 1.0.65 and 1.0.66; history carries each model's own name.

### Steps

0. **Starting state** (23:31:45 UTC): keychain `no-timeout`; `git fetch origin --tags`: `origin/main` still `8054a676`, no `v1.0.67` tag locally or on origin, v1.0.66 the Latest release; no SnowRaven build, release, dev watcher or emulator running, nothing holding `~/.snowraven-build`; the other worktree (`life-list-filter-toggle-state`, read by `git log` only) at `481b9ee3`, 0 commits ahead of `main`. `xcodebuild -checkFirstLaunchStatus` exit 0.
1. **The held copy.** `bash pipeline/escapee-check-new-taxonomy/bump-1.0.67.sh held` (no `RELEASE_DATE`: the ship stayed on 2026-11-08 PST, the CHANGELOG heading's date) exit 0: `10000671.txt`, `10000672.txt`, `10000674.txt`, 354 bytes each, SHA-256 `6f50598046bdcacd2166eaa2c93047e58507f1ad6f3ffc56f721a7e504ed25dd`, equal to `held/whats-new.txt`; no `1000067.txt`.
2. **Gates on the release tree** (load 2.9 at the start, nothing else of SnowRaven's running): the five version-set guards, **5 files, 119 tests passed**; the **full vitest suite, 495 files passed, 5 skipped; 10,785 tests passed, 6 skipped, 0 failed** (74.3 s; the two held-changelog rows now green); `npm run lint`, `npm run typecheck`, `npm run build` exit 0; the real-engine gate, `CI=true npm run verify -- ../../frontend/dist` in `website/tools`, **8/8 harnesses green, 253 PASS lines, 0 FAIL**. Em dashes over 1,630 added or new lines: none in shipped text (the two are the Weft record headings of `bug-brief.md` and `decisions.md`); the other non-ASCII characters are the website footer's existing middot, one box-drawing comment rule in `exoticProvenance.ts` (the file's existing style) and vitest's output captured in the prep evidence. Backend pytest was not run: `backend/.venv` still points at the removed `python@3.11` (part one), and this release changes nothing under `backend/`; CI's Backend job passed on both runs below.
3. **Commits:**

   | Commit | What |
   |---|---|
   | `761bfeda0e905133bb04f68a8ea437cb9f8ae328` | `fix(statistics): the escapee check joins answers across the 2026 taxonomy update`: the code, tests, the rule file's `paths` line and this run folder's durable files (29 files) |
   | `7ea29a64b7fd5d2cfde3189f70dc3f040d48aaf4` | `chore(release): 1.0.67, the escapee check under the new taxonomy`: the version set and the three F-Droid changelogs (9 files) |
   | `786c12ad78a302051ec8890ebb63a75bc1076228` | `fix(fdroid): the recipe names v1.0.67's commit`: the three `commit:` lines name `7ea29a64...`; `fdroidRecipe`, `fastlaneMetadata`, `androidVersionSource` 57 of 57 first |
   | `b98884b15683d99c2170cbcf74843559b4f4be13` | `chore(ios): stamp iOS 1.0.67 build 1`: the two Info.plists (step 8) |

   `qa-report.md`, `security-report.md` and `how-to-see.md` stay out (gitignored per-run files).
4. **Tag.** Annotated **`v1.0.67`** (tag object `d112bd01160092d098d6020bdacf5c7c9eff93f4`, "SnowRaven 1.0.67: the escapee check under the new taxonomy") on the release commit `7ea29a64`; at the tag, `tauri.conf.json` reads 1.0.67 / 1000067 and the three changelogs are present. Pushed **alone** at 23:42:53 UTC; `git ls-remote`: `refs/tags/v1.0.67` `d112bd01` peeled to `7ea29a64`, `main` still `8054a676`.
5. **The recipe commit** `786c12ad` (above).
6. **`main` pushed** at 23:43:15 UTC as a fast-forward, `8054a676..786c12ad`; the stamp `b98884b1` followed at 00:00:15 UTC (`786c12ad..b98884b1`).
7. **CI**, looked up pinned to the tag's commit: **Windows Build `42536492718` success** (23:52:14 UTC) and **Android Build `42536492717` success** (23:58:49 UTC), both on `7ea29a64b7fd5d2cfde3189f70dc3f040d48aaf4`. **Pages `42536521975` success**: the live site (`snowraven.dtgibson.com`) shows `aria-label="Version 1.0.67">v1.0.67` and the footer `SnowRaven v1.0.67`.
   - **Pipeline, judged under D-17.** **`42536522005` on `786c12ad` failed, and not on the known timing rows**: `lifeListsLinearity` and `alphaCodes` both passed there; the one failure (10,762 passed, 1 failed) was `AlertsInboxSheet.test.tsx` "Clear (design-spec 8; QA-39) > asks first; Escape closes only the confirmation; ...", line 172: after Escape, the `waitFor` for the confirmation to unmount ran out at its default 1,000 ms (the test took 1,038 ms). Because the D-17 rule says a non-timing failure reverses the ship-on-red acceptance, the desktop release and the APK attach were held until it was explained. What was found: nothing on that test's path changed in this release (`ModalDialog`, `AlertsInboxSheet`, `useFocusTrap` and `lib/alerts/` are untouched; `BirdName`'s new `trailing` prop renders nothing when absent, so the inbox row's DOM is byte-identical); the row had not failed in the previous 40 Pipeline runs (13 failed runs there: 11 on timing-ratio rows, one `AddressSearch` UI test on 2026-11-03, and one with no failed test listed); locally it passed 12 of 12 alone and 6 of 6 with all 8 cores saturated, and in the full local suite; and the test presses Escape as soon as `findByRole` sees the confirmation, without waiting for focus inside it, the race CLAUDE.md's testing rule names ("a key pressed into a `ModalDialog` waits for focus inside the dialog"). The fresh sample was the stamp push: **Pipeline `42537848526` on `b98884b1` succeeded, every job and step green** (test step, build and the real-engine gate included; 00:00:16 to 00:17 UTC), the first green test step on `main` since 2026-11-07, and it is the run of record for the shipped tree (the stamp changes only the two iOS plists). Ship continued. The test's missing focus wait is a follow-up (below), not part of this release.
8. **iOS** (during the CI wait):
   - The three `/tmp/xcshim` shims recreated; `xcrun --sdk iphoneos --show-sdk-version` **27.2** (Xcode 27.2, 27B52).
   - **Widget Swift tests: 143 tests, 0 failures, `** TEST SUCCEEDED **`** on the iPhone 17 simulator (`-test-timeouts-enabled YES`); no simulator left booted.
   - The leftover archive `snowraven_iOS.xcarchive` (1.0.66 / 1.0.66.1, from 08:11 PST today) moved aside as `snowraven_iOS-1.0.66.1-stale-before-1.0.67.xcarchive`, the sixth ship running to find one.
   - `tauri ios build --export-method app-store-connect --build-number 1`, outside the Bash sandbox with the three signing variables mapped from the login shell (23:44:54 to 23:46:51 UTC): **the archive `** BUILD SUCCEEDED **`**, and Tauri's own export refused with the skill's third wording ("No Account for Team", "No profiles for 'com.dtgibson.snowraven' / '...widgets' were found"), expected. The fresh archive reads **1.0.67 (1.0.67.1)**, created 15:46:48 PST; its executable is `platform IOS`, `sdk 27.2`, `minos 16.0`; all 9 `swift-rs` libraries are `platform 2` (iOS).
   - The build again rewrote two `PRODUCT_NAME = SnowRaven;` lines in `project.pbxproj` as `"SnowRaven"` (quoting only); restored to HEAD after the archive, as at 1.0.66.
   - The archived `snowraven_widgets.appex` was `not signed at all`, as expected; signed ad hoc with `snowraven_widgets.entitlements`, it lists `group.com.dtgibson.snowraven`.
   - Manual `xcodebuild -exportArchive` with `~/.tauri/snowraven-ios-export-options.plist` into `src-tauri/gen/apple/build/export-1.0.67.1`: **`** EXPORT SUCCEEDED **`**. `DistributionSummary.plist`: both bundles at 1.0.67 / 1.0.67.1, Apple Distribution `1861F7A4...` to 2027-07-05, team `8QKC3L2FKP`; the appex with `application-groups` `group.com.dtgibson.snowraven` and nothing else, on "SnowRaven Widgets App Store"; the app with that group, `icloud-container-identifiers`, `icloud-services` (CloudDocuments), `ubiquity-container-identifiers` and `icloud-container-environment` Production, on "SnowRaven iOS App Store iCloud AppGroup 20260924". All 36 iOS icon PNGs (the committed `AppIcon.appiconset` and `src-tauri/icons/ios`) and both in the IPA have no alpha channel. IPA SHA-256 `0c776cdf868a3fb672d94dac5faa72f23aed91545839b32dbc7bdcccf28e4fb5`.
   - **`altool --validate-app`: `VERIFY SUCCEEDED with no errors`** (23:49 UTC); then **`--upload-app`** 23:49:13 to 23:50:33 UTC, `UPLOAD SUCCEEDED with no errors`, **Delivery UUID `6614dec9-8b21-4165-b870-d94ff330d05f`** (plus the routine `CDUploaderStateInfoResumeFilePath` log line).
   - The stamp: `snowraven_iOS/Info.plist` 1.0.67 / 1.0.67.1 and the widget extension's `CFBundleVersion` 1.0.67.1; `iosSceneManifest`, `iosWidgetManifest` and `iosAlertsManifest` 3 files, 67 tests green; committed as `b98884b1`.
9. **Desktop.** `CI=true SKIP_NPM_INSTALL=1 zsh -lc ./release.sh` from the main checkout, alone on the machine, **exit 0** (00:17:43 to 00:22:21 UTC), started only after Pipeline `42537848526` came back green: `Releasing v1.0.67: tag=7ea29a64 HEAD=b98884b1`; iCloud profile OK; bundle version verified 1.0.67; iCloud entitlements and embedded profile verified; DMG styled, signed and verified; **notarization `9903a925-3d0f-43ba-ad77-250994c4a8b3` `Accepted`**, stapled; the Windows installer fetched from CI (pinned to the tag's commit, the tag being local) and signed locally; published.
   - **Release `438621031`**, https://github.com/dtgibson/snowraven/releases/tag/v1.0.67, published 2026-11-09 00:22:20 UTC, not a draft or pre-release, and **Latest**.

     | Asset | Bytes | SHA-256 |
     |---|---|---|
     | `latest.json` | 1,852 | `b5ab3fd86248c171c65c7bfb6fe0c8c6c8d6eb8cc5b6974e1e77fa90c69aba81` |
     | `SnowRaven-updater.app.tar.gz` | 31,288,324 | `5530c0f68b67803e1d71392693f888dfa2595b453b05cca0516daf41775ab8a2` |
     | `SnowRaven-updater.app.tar.gz.sig` | 408 | `8c88b31b801ad7b91ffb3e7837bb4a6c3b2c6d4f07427b49145957aea1e1c04a` |
     | `SnowRaven_1.0.67_universal.dmg` | 31,623,101 | `c8231b75c2acbe6931b3144a05b5fc44d1a82d39b5f36562306e90102f48eb2e` |
     | `SnowRaven_1.0.67_x64-setup.exe` | 10,241,166 | `375820eda350d5b1a1c9177454d760f88521ada653a00d9c4629c04cdf0d9406` |
     | `SnowRaven_1.0.67_x64-setup.exe.sig` | 420 | `bfecb3a3356a4662fb8eab60955e5420bba31500a3fb939621dc569e858686e5` |
     | `SnowRaven_1.0.67_android_universal.apk` (step 10) | 79,287,938 | `c234b0579904db9cc571fbbb4bfee41f967c94d088d051ab4dc9f9fed7c346c1` |

   - **The DMG, downloaded back from the release:** `codesign --verify --verbose=2` valid on disk and satisfies its Designated Requirement; `xcrun stapler validate` worked; `spctl -a -t open --context context:primary-signature -vv` **accepted, source=Notarized Developer ID**, origin `Developer ID Application: DAVID THOMAS GIBSON (8QKC3L2FKP)`; `hdiutil verify` checksum VALID.
   - **`latest.json`:** version 1.0.67, `pub_date` 2026-11-09T00:22:16Z; `darwin-aarch64` and `darwin-x86_64` identical, on `.../v1.0.67/SnowRaven-updater.app.tar.gz`; `windows-x86_64` on `.../v1.0.67/SnowRaven_1.0.67_x64-setup.exe`; each signature equals its `.sig` asset, and **both verify VALID** against the updater public key in `tauri.conf.json` (minisign prehashed Ed25519, key id `f80c63fb3b636306`, file and trusted-comment signatures both good). No `minisign` binary is installed, so the check is a short Node script in the session scratchpad; its negative control (a different file against the bundle's signature) reads INVALID, exit 1. `releases/latest/download/` answers 200 for `latest.json` (the same bytes), the DMG, the updater bundle, the installer and the APK.
   - **The updater bundle** unpacks to `SnowRaven.app` with `CFBundleShortVersionString` 1.0.67, a universal executable (`x86_64 arm64`), and passes `codesign --verify --deep --strict`.
   - **The published installer is byte-identical** to run `42536492718`'s artifact (SHA-256 `375820ed...9406`).
10. **Android.** Build shell: JDK 17.0.21.0.3, `ANDROID_HOME`, `NDK_HOME` (27.2.12479018, the only NDK), Gradle 8.14.3 first on `PATH`, `SNOWRAVEN_ANDROID_SIGNER_SHA256` set to the recorded digest.
   - `scripts/android/preflight.sh` **exit 0, every check `ok`**: JDK 17, keytool, apksigner, zipalign and aapt2 from build-tools 36.0.0, Gradle 8.14.3, cargo-tauri 2.11.2, the keystore opens (alias `snowraven`), the version pair 1.0.67 / 1000067, `v1.0.67` pushed at `7ea29a64b7fd` and carrying that pair, `10000671/2/4.txt` present at the tag, and run `42536492717`'s artifact `SnowRaven_1.0.67_android_universal_unsigned.apk` (`com.dtgibson.snowraven`, 1.0.67, 1000067, not debuggable). Its one warning, HEAD is not the tag's commit, is the recipe and stamp commits after the tag, as at every ship.
   - `scripts/android/sign.sh` **exit 0**: v2 and v3 (v1 off), `ok signer equals the keystore's certificate`, `ok signer equals the recorded digest`, **`Signer #1 certificate SHA-256 digest: 42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a`** (DN `CN=SnowRaven, O=Dave Gibson`). **Signed APK SHA-256 `c234b0579904db9cc571fbbb4bfee41f967c94d088d051ab4dc9f9fed7c346c1`.** No password was printed or passed on a command line.
   - **Emulator check** on the local API 36 Google APIs image only (`sr-api36-phone`, port 5554, headless, `-gpu host`, `-no-snapshot-save`; every `adb` call addressed to `emulator-5554` by serial; no device listing taken). No SnowRaven was installed before. The exact signed bytes (hash re-read equal) installed fresh: `versionName` 1.0.67, `versionCode` 1000067, minSdk 26, targetSdk 36. Cold start `Status: ok`, `LaunchState: COLD`, `TotalTime` 192 ms, and the Welcome screen drew (`evidence/ship/api36-1.0.67-first-launch.png`); "Explore the app first" drew Weather with both key notices (`api36-1.0.67-explore.png`); Statistics drew its no-backup state (`api36-1.0.67-statistics.png`). No backup was imported and no key entered, so nothing was sent to eBird or OpenWeather. One SnowRaven process throughout (pid 4561), 0 `FATAL EXCEPTION` or ANR lines, nothing from SnowRaven in the crash buffer. Afterwards the app was uninstalled and the emulator stopped (`emu kill`).
     - **WebView:** `com.google.android.webview` `versionName` 133.0.6943.137: **WebView 133, unchanged since the last measurement.**
   - **Attach:** `ANDROID_DEVICE_CHECK=partial ANDROID_CHECKED_SHA256=c234b057...46c1 SNOWRAVEN_ANDROID_SIGNER_SHA256=42a3576e...996a scripts/android/attach.sh <signed apk>` **exit 0** at 00:23:51 UTC. **Decision: Partial on API 36 emulator evidence, under the standing decision (CLAUDE.md, Versioning: the user owns no Android device).** Checks: signer equals the keystore's certificate, byte-identical to the checked file, `com.dtgibson.snowraven` 1.0.67 (1000067). Uploaded to v1.0.67 as **`SnowRaven_1.0.67_android_universal.apk`** and downloaded back: `ASSET_SHA256=c234b0579904db9cc571fbbb4bfee41f967c94d088d051ab4dc9f9fed7c346c1`, `SIGNER_SHA256=42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a`.
11. **TestFlight** (GET only, the metadata key, 00:24:00 UTC): **train 1.0.67 `fce1e625-3dcf-4cbf-ab18-0a4f3b2a1e62`, build 1.0.67.1 `6614dec9-8b21-4165-b870-d94ff330d05f` `VALID`**, uploaded 15:51:11 PST, min OS 16.0; it read VALID already at 00:00:25 UTC, about ten minutes after the upload. No App Store version record was created and nothing was submitted.

Readouts: `evidence/ship/ship-1.0.67-part-two-a.txt`.

### State at the hand-back (2026-11-09, about 00:30 UTC)

| Leg | State |
|---|---|
| Commits on `origin/main` | `761bfeda`, `7ea29a64` (release), `786c12ad` (recipe), `b98884b1` (stamp); this record follows in one more push |
| Tag | `v1.0.67` (tag object `d112bd01`) on `7ea29a64`, pushed |
| Windows and Android CI | green on the tag: `42536492718`, `42536492717` |
| Pipeline on `main` | green on the shipped tree (`42537848526`, `b98884b1`); the earlier `42536522005` on `786c12ad` failed once on the `AlertsInboxSheet` Escape race, explained above |
| Mac, Windows, `latest.json` | live: release `438621031`, Latest; notarization `9903a925` Accepted; Gatekeeper checks pass; both updater signatures verify |
| Android GitHub APK | attached, signer `42a3576e...996a`, SHA-256 `c234b057...46c1`; device check Partial (emulator) |
| F-Droid | nothing sent (no pin or build-step change); the bot is expected to add 1.0.67 on its own (not re-read in this phase) |
| Website | live with the 1.0.67 pill and footer (Pages `42536521975`) |
| iOS | TestFlight 1.0.67.1 `VALID` (build `6614dec9-8b21-4165-b870-d94ff330d05f`); waits on the user's iPhone check |
| App Store | untouched; per part one, 1.0.67 gets its own new record on build 1.0.67.1 after the iPhone check (phase 3) |

### For phase 3

- **The user's iPhone check of TestFlight 1.0.67 (1)**, in four steps: (1) install SnowRaven 1.0.67 (1) from TestFlight and open it; (2) open Statistics and let the line under the Species figure settle: it should name the species still open, for example "eBird's answers did not include Eurasian Skylark, so it still counts."; (3) tap the name and confirm Species Detail opens on that bird; (4) quit SnowRaven, reopen it, open Statistics again, and confirm the check does not run again (the line settles straight to the same sentence with no progress count).
- Then App Store Connect per part one (re-read the state first): a new 1.0.67 record on build 1.0.67.1, `AFTER_APPROVAL`, no phased release, What's New `held/whats-new.txt`; the promotional text restored from `appstore/LISTING.md` and every field read back; review notes byte-identical to `appstore/REVIEW_NOTES.md`; the age rating on the editable app info; `asc-screens.mjs readback` ending `ALL MATCH`; submit and read back.
- F-Droid three-read state, and **`RELEASE_LEDGER.md`**: the 1.0.67 App Store and Android entries; the 1.0.66 App Store entry corrected (`READY_FOR_SALE`, submission `51af3019` `COMPLETE`); the 1.0.63 Android correction (superseded on F-Droid by 1.0.65); and 1.0.66's F-Droid state as read then (likely superseded by 1.0.67).
- **Follow-up for the Chronicler (not this release):** `frontend/src/components/AlertsInboxSheet.test.tsx:171` presses Escape as soon as `findByRole` sees the Clear confirmation, without first waiting for focus inside it, the race CLAUDE.md's testing rule names; it failed once on CI (`42536522005`) and passed on the rerun of the tree. The fix is a `waitFor` on `dialog.contains(document.activeElement)` before each key press into the confirmation. Also still open from part one: `backend/.venv` needs rebuilding on `python@3.15` (the user's call).

## Part three: preparation for 1.0.68 (2026-11-09, about 02:12 to 02:40 UTC; 2026-11-08, 18:12 to 18:40 PST), hands-off

The Deployer ran this phase as a prep-only invocation, on `main` in the main checkout, after the re-entry (D-03). Nothing was committed, tagged, pushed, released, built for a store or uploaded, and no held copy was written into a live file. GitHub, App Store Connect (GET only, metadata key) and F-Droid were only read. Nothing was sent to eBird, and no device or emulator was touched. The production sign-off is the next gate, and part four runs on its recorded answer.

### Preconditions

- **The Tester PASSED the re-entry** on the first attempt (`qa-report.md` re-entry section, gitignored, on disk): 16 of 16 criteria; the full suite 10,795 passed, 0 failed; 512 rendered configurations in Chromium and WebKit.
- **The Auditor PASSED WITH NOTES** (`security-report.md` re-entry section): nothing above Informational. I-4 was accepted with its comment corrected, and I-5 was applied as a `paths` line in `.claude/rules/security.md`, both under D-04.
- No staging environment, as at every SnowRaven ship, so the production sign-off is the one gate. No key, environment variable, host or provider setting is needed, so there is no external setup to offer.
- `PRIVACY_POLICY.md:33` and its `website/privacy.html` twin still hold. Check again on the settled line is a re-ask the user presses, the same control the `unmatched` line has carried since 1.0.64. The tab's own re-ask is unchanged at 30 days. No held policy sentence is owed.

### Repository state (`git fetch origin --tags`, 02:12:59 UTC)

- `origin/main` is `a554bce9` (`docs(pipeline): 1.0.67 deployment record, part two A`), equal to local `main`: nothing ahead, nothing behind.
- Tags `v1.0.67` (tag object `d112bd01`, peeled to `7ea29a64`) exist locally and on origin. There is no `v1.0.68`. Release v1.0.67 is Latest (2026-11-09 00:22:20 UTC).
- The other worktree (`.claude/worktrees/life-list-filter-toggle-state`) was read by `git worktree list` and `git log` only, never entered. It is at `481b9ee3`, 0 commits ahead of `main` and 13 behind, so no ship is in flight there.
- Nothing of SnowRaven's was running: no `release.sh`, cargo, tauri, xcodebuild, vitest or emulator, and nothing held `~/.snowraven-build`. The one dev server running belongs to another project (`birdsim`'s Vite).
- Keychain `no-timeout`, so it is unlocked; it was not touched. `gh` is signed in as `dtgibson`.

### The version set (five of six written; the sixth held)

| File | Change |
|---|---|
| `frontend/package.json`, `frontend/package-lock.json` (two lines) | 1.0.67 to 1.0.68 |
| `src-tauri/tauri.conf.json` | `version` 1.0.68; `bundle.android.versionCode` 1000068 |
| `CHANGELOG.md` | `## [1.0.68] - 2026-11-08` (PST, the 1.0.67 rule): one Fixed bullet and five Internal bullets. No em dash, ASCII only, American spelling. |
| `website/index.html` | the version pill text, its `aria-label`, and the footer line; nothing else (a version stamp, no approval needed) |
| `pipeline/android-release/fdroid/com.dtgibson.snowraven.yml` | three `Builds` entries at 1.0.68 (10000681, 10000682, 10000684); `CurrentVersion` 1.0.68, `CurrentVersionCode` 10000684. The three `commit:` lines stay on 1.0.67's `7ea29a64...` and move to `v1.0.68^{commit}` after the tag. |
| **Held:** `fastlane/metadata/android/en-US/changelogs/10000681.txt`, `10000682.txt`, `10000684.txt` | Not written. The text is `held/whats-new-1.0.68.txt`: 216 characters, 217 bytes with the newline, SHA-256 `358bc780...8e142a`. `bump-1.0.68.sh held` writes all three on the yes. |

The iOS plists stay at 1.0.67 / 1.0.67.1 until `tauri ios build` stamps them, under `iosSceneManifest.test.ts`'s "never leads" rule.

`bump-1.0.68.sh` is `bump-1.0.67.sh` with the version constants and the held file's name changed (`diff` shows nothing else; ASCII only).
- Check mode on the live tree: exit 0. The stamped set is consistently at 1.0.68, the recipe names one full commit, the three changelog files are absent, and the heading carries today's PST date.
- Held mode against a scratch copy (`BUMP_ROOT`, an `rsync` of the tree with `frontend/node_modules` linked): it wrote the three files byte-equal to the held note, and none under 1000068. The five version-set guards then passed there, 5 files and 119 tests. A second `held` run refused with exit 3.

### Gates on the live tree (nothing else of SnowRaven's running; `evidence/ship/gates-1.0.68-prep.txt`)

- **The five version-set guards: 117 passed, 2 failed.** The two failures are the `fastlaneMetadata.test.ts` rows that wait for the held changelogs, and they turn green on the yes, as at 1.0.67.
- **Full frontend suite, `npx vitest run`, alone:** 494 files passed, 1 failed, 5 skipped. 10,793 tests passed, 2 failed (the same two rows) and 6 skipped, of 10,801 (75.2 s). With the held files present that is QA's 10,795. No timing-ratio row failed locally.
- `npm run lint`, `npm run typecheck` and `npm run build`: exit 0. The entry is `index-Cd8mL4ho.js`, and the large-chunk notice is pre-existing.
- **The real-engine gate,** `CI=true npm run verify -- ../../frontend/dist` in `website/tools`: **8/8 harnesses green**, 253 PASS lines, 0 FAIL.
- **Backend pytest cannot run:** `backend/.venv/bin/python3.11` points at `/opt/homebrew/opt/python@3.11`, which is gone (only `python@3.15` is installed). This release changes no file under `backend/`, and CI's Backend job runs on its own runner. Rebuilding the venv is the user's call.
- **Em dashes and non-ASCII over every added line and new file (1,816 lines):** no em dash in shipped text. The two that appear are inside the verify harness's own log, captured in evidence before it was folded into the gates file. The other non-ASCII characters are:
  - the website footer's existing middot;
  - one box-drawing comment rule in `exoticProvenance.test.ts`, that file's existing style;
  - an ellipsis in `pr-description.md`;
  - tool output captured in evidence.

### CI on `main`

- **Pipeline `42537848526` on `b98884b1` succeeded** (1.0.67's stamp, the run of record for the shipped 1.0.67 tree).
- **Pipeline `42540147018` on `a554bce9` failed**, and only on the known steady red: `lifeListsLinearity.test.ts` "pass 1 (first sightings), every row its own species", CPU-time ratio 26.11 against 20. The rest of the run was 10,762 passed, 1 failed; Backend, lint and typecheck were green. 1.0.67's record judged this row under D-17: ship on it, because a failure in a test this release touches, or any non-timing failure, reverses the acceptance. **1.0.68 touches nothing either timing row measures.** `lifeListsLinearity` imports `lifeLists.ts`, which imports only `types`, `parseMLExport` and `speciesUtils`. `alphaCodes.test.ts` imports `alphaCodes`, `speciesIndex`, `speciesMatch` and `speciesUtils`. None of them is in the diff. The `AlertsInboxSheet` Escape race (`42536522005`) did not recur here; its fix is still a follow-up.
- The tree's first Pipeline run comes with the release push. The steps CI skips after the red test step, the build and the real-engine gate, passed locally above.

### Rig readiness (read only)

| Check | Result |
|---|---|
| Login keychain | `no-timeout`: unlocked |
| `gh` | signed in as `dtgibson` (scopes `repo`, `workflow`) |
| Login shell | Node v24.18.0; cargo 1.96.1; Rust targets for both Mac slices, iOS device and simulator, and the three Android ABIs; `APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID`, `APPLE_API_KEY_PATH`, `APPLE_SIGNING_IDENTITY` set |
| Secrets (existence and mode only) | `~/.tauri/snowraven-signing.key` 600; ASC keys `QJA25M7XHM` and `BVVLBRRVL6` 600; the Android keystore and its properties file 600 |
| Signing identities | Developer ID Application, Apple Distribution (`1861F7A4...`) and Apple Development, team `8QKC3L2FKP`: 3 valid |
| Profiles | Developer ID "SnowRaven Mac Developer ID 20260901" to 2044. The export plist maps the app to "SnowRaven iOS App Store iCloud AppGroup 20260924" and the widgets to "SnowRaven Widgets App Store", both to 2027-07-05, with `iCloudContainerEnvironment` Production. |
| Xcode | 27.2 (27B52), iOS SDK 27.2, Swift 6.4.2, so the swift shim still applies. `xcodebuild -checkFirstLaunchStatus` exits 0. No `simctl` call was made. `/tmp/xcshim` exists but is recreated anyway. |
| Leftover iOS archive | `src-tauri/gen/apple/build/snowraven_iOS.xcarchive` is **1.0.67 (1.0.67.1)**, from 15:46 PST. Part four moves it aside first, as `...-1.0.67.1-stale-before-1.0.68.xcarchive`. |
| Android | JDK 17.0.21.0.3; build-tools 36.0.0 (and 35.0.0); one NDK, 27.2.12479018; Gradle 8.14.3 at `~/.tauri/gradle-8.14.3`; `cargo tauri` 2.11.2; `toolchain.env` unchanged against HEAD. AVDs `sr-api24/26/30/36-phone`, `sr-api36-aosp` and `sr-api36-tablet` are listed by `emulator -list-avds`. No `adb` call was made. |

### App Store Connect (read only, metadata key, GET only, 02:23:12 UTC; `evidence/ship/asc-read-1.0.68-prep.txt`)

- **31 version records, all `READY_FOR_SALE`; nothing open.** The newest is **1.0.66 on record `ab6360bc-24b3-4816-bf84-88967df06507`** (`READY_FOR_DISTRIBUTION`, `AFTER_APPROVAL`), on build 1.0.66.1 (`32038a0c`). Its en-US What's New, localization `114f46ce`, is the 882-character 1.0.64 + 1.0.65 + 1.0.66 rollup, and its promotional text is 137 characters.
- 10 review submissions, all `COMPLETE`.
- 91 TestFlight trains and 99 builds, every build `VALID`. **Train 1.0.67 `fce1e625`, build 1.0.67.1 `6614dec9-8b21-4165-b870-d94ff330d05f` `VALID`**, not expired, min OS 16.0. There is no 1.0.67 record, and no 1.0.68 train or record.
- From 1.0.13 on there are 55 trains, 25 without a record of their own. Those are the 24 accounted for through the 1.0.66 entry, plus **1.0.67, which rolls up into 1.0.68 at this ship** (D-03). There is no other gap.
- **One app info now**, `8319b5dd` (`READY_FOR_DISTRIBUTION`, age rating `FOUR_PLUS`), where 1.0.66 saw two. Its declaration is answered: 30 fields, 16 `NONE`, 11 false, 3 null (`kidsAgeBand`, `gracRatingClassificationNumber`, `developerAgeRatingInfoUrl`, null on a non-Kids app). It is read-only until a version is in preparation. The new record's editable app info is read again then.

**The disposition for 1.0.68.** No rollup into an existing record is possible: 1.0.66 is released, nothing is in review, and a released train takes no new build. So **1.0.68 gets a new record** on build 1.0.68.1, `AFTER_APPROVAL`, no phased release, and it carries 1.0.67 by rollup. Its What's New is the 571-character rollup in `held/gate-copy-1.0.68.md`: 1.0.67's approved text, a blank line, then 1.0.68's text. Store users on 1.0.66 never received 1.0.67's note.

Before submitting:
- Restore the promotional text from `appstore/LISTING.md` if it arrives empty, as it has on fourteen new records. Read every listing field back against `LISTING.md`.
- Check the review notes byte for byte against `appstore/REVIEW_NOTES.md`.
- Answer or confirm the age rating on the editable app info.
- `asc-screens.mjs readback` on the new localization must end `ALL MATCH`. A new record has carried all three sets over since 1.0.62.

The state is read again immediately before the App Store step.

**Screenshots need no recapture.** The photographed UI does not change. `website/tools/capture-appstore.mjs:224` waits up to 120 s for "Exotic status checked across", which the settled line does not contain, but the capture stub answers every species, so the wait is never reached in this ship (QA probe (c)). It stays a note for the next capture.

### F-Droid (public reads, 02:23 UTC; `evidence/ship/fdroid-read-1.0.68-prep.txt`)

- f-droid.org publishes 1.0.61, 1.0.60 and 1.0.59 (`suggestedVersionCode` 10000614).
- fdroiddata `master` has `CurrentVersion` 1.0.65 / 10000654, with `Builds` entries for 1.0.53, 1.0.55, 1.0.56, 1.0.60, 1.0.61 and 1.0.65. **There are none for 1.0.66 or 1.0.67.** The newest recipe commit is still `8970b26d` "keep latest" (2026-11-08 19:02 UTC); the bot's last run was `3302f014`, 09:54 UTC.
- The build logs for 10000651/2/4, 10000661/2/4 and **10000671/2/4** all answer 404, meaning not attempted.
- **States:** 1.0.65, 1.0.66 and 1.0.67 are each "included and this tag not yet built". The bot adds only the newest tag it finds, so a `v1.0.68` tag pushed before its next run (about 09:00 to 10:00 UTC) most likely leaves **1.0.66 and 1.0.67 superseded on F-Droid by 1.0.68**, which costs nothing.
- **Nothing goes to fdroiddata at 1.0.68:** `toolchain.env` is unchanged, and the recipe diff moves only versions and codes.

### Cargo for the production gate

`git log origin/main..main` shows nothing. The release carries this run's working tree and nothing else:

| Group | Files | Whose |
|---|---|---|
| App behavior | `lib/exoticProvenance.ts`, `exoticProvenanceCache.ts`, `useExoticProvenance.ts`, `lifeListsProvenance.ts`, `exoticCopy.ts`, `components/ExoticProvenanceAccount.tsx`; `docs/HELP.md` (bundled Help, one sentence) | this build (the re-entry) |
| Tests | `exoticProvenance`, `exoticProvenanceCache`, `exoticProvenanceConvergence`, `exoticTaxonomyJoin`, `lifeListsProvenance`, `useExoticProvenance`, `ExoticProvenanceAccount` suites | this build |
| Rule file | `.claude/rules/security.md` (one `paths` line, D-04 I-5) | this build |
| Version set, five of six | above | this build |
| Record-keeping | `pipeline/escapee-check-new-taxonomy/` (brief, decisions, PR description, `held/` including `bird-names-rule-amendment.md` for the Chronicler and `gate-copy-1.0.68.md`, `bump-1.0.68.sh`, this record, `evidence/ship/`). `qa-report.md`, `security-report.md` and `how-to-see.md` are gitignored and stay out. | pre-approved cargo |
| Held, written only on the yes by `bump-1.0.68.sh held` | the three F-Droid changelogs | this build |

No commit from another build or from manual work rides along.

### Held copy for the gate (`held/gate-copy-1.0.68.md`)

- (a) **F-Droid, 1.0.68's own text only** (the 1.0.65 precedent): `held/whats-new-1.0.68.txt`, 216 characters. **Not yet approved.**
- (b) **App Store What's New on the new 1.0.68 record:** 1.0.67's approved text (353), a blank line, then 1.0.68's text (216). That is 571 characters, SHA-256 `c885c3f1...e593b`.
- Wording check: no em dash, ASCII only, American spelling, and tab names from `TAB_LABELS`. There is no change I would make.

### For part four (the ship, on the gate's answer)

The order is the 1.0.67 part two sequence:

1. `bump-1.0.68.sh held`, with `RELEASE_DATE=2026-11-09` if the ship runs past midnight PST.
2. The gates again on the release tree.
3. Commit the fix and the run folder, then the release commit, then the annotated `v1.0.68` tag, pushed alone.
4. The recipe `commit:` lines go to `v1.0.68^{commit}`, then push `main`.
5. Windows and Android CI pinned to the tag's commit, and Pages.
6. iOS during the CI wait:
   - recreate the three shims;
   - move the 1.0.67.1 archive aside;
   - run the widget Swift tests;
   - `tauri ios build --build-number 1`, outside the sandbox;
   - restore the `project.pbxproj` quoting;
   - sign the appex ad hoc with its entitlements;
   - manual export, then check `DistributionSummary.plist`;
   - `--validate-app`, then `--upload-app`;
   - commit the stamp.
7. `release.sh`, alone, once Pipeline on the stamp is green or judged under D-17.
8. Android:
   - run `preflight.sh`, then `sign.sh`, with `SNOWRAVEN_ANDROID_SIGNER_SHA256` = `42a3576e...996a`;
   - check the signed bytes on the API 36 emulator;
   - read the WebView version;
   - run `attach.sh` with `ANDROID_DEVICE_CHECK=partial` (the standing decision).
9. TestFlight 1.0.68.1 `VALID`.
10. **The user's iPhone check of TestFlight 1.0.68 (1) before any App Store record** (the v1.0.31 rule; the device boundary means they perform it). Then the App Store step above.
11. **`RELEASE_LEDGER.md`, all owed at this ship.** Part two A held these, so they are written here:
    - the 1.0.67 App Store sentence: **rolled up into 1.0.68**, naming VALID build 1.0.67.1 `6614dec9` and the new 1.0.68 record and submission ids;
    - the 1.0.68 App Store entry;
    - the 1.0.66 App Store entry corrected to `READY_FOR_SALE`, with submission `51af3019` `COMPLETE`;
    - the 1.0.67 Android entry: APK `c234b057...46c1` attached, signer `42a3576e...996a`, Partial, plus its F-Droid state;
    - the 1.0.68 Android entry;
    - the 1.0.63 Android correction: superseded on F-Droid by 1.0.65 (`8970b26d` keep-latest);
    - 1.0.66's and 1.0.67's F-Droid states as read then.
