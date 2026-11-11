# Deployment record: hotspot-reports (1.0.71)

## Part one: preparation, applied, bumped, verified, committed locally (2026-11-11 PST)

Run by The Deployer (feature lane, the ship stage) on `main` in the main checkout. Six local commits; nothing was pushed, tagged, released, built for a store or uploaded. GitHub, App Store Connect (GET only, metadata key) and F-Droid were only read.

### Preconditions

- **The Tester passed with notes** (`qa-report.md`, gitignored, on disk). QA-59 (the version set) and QA-60 (the screenshots) were deferred to this stage and close here.
- **The Auditor passed with notes** (`security-report.md`, gitignored, on disk): no Critical, High or Medium. Dispositions are in `decisions.md` D-26.
- No staging environment and no new key, environment variable, host or provider setting, so the production sign-off is the one gate and there is no external setup to offer.

### The user's decisions (2026-11-11, recorded by the Guide at the gates)

- Copy, live app and screenshots: "Yes to the app, the copy, and the screenshots". Approved verbatim as held: the one sentence (README section, website row, App Store bullet with its first letter lowercased), the What's New text (also the F-Droid changelog text), the caption `Hotspot Reports | Your own record at any one place`, and the website alt text.
- Screenshots per the table shown: website replace eleven, add `hotspot-reports.webp`, keep `weather.webp`; the iPhone, iPad and iPhone Duo App Store sets each replaced whole with seven frames.
- Release gate: "Confirm: release 1.0.71 now".
- CI basis: the Pipeline frontend job has been red on `main` since 1.0.70 on `lifeListsLinearity.test.ts` timing rows only (life-list-region-filter D-12). The run of record for this ship is judged the same way: timing-ratio rows failing only on the CI runner are recorded; any other red stops the ship.

### Screenshots and how they were taken

- All from the synthetic demo dataset, which the held `website-tools.patch` extends with weather blocks on every third Jamaica Bay Wildlife Refuge checklist (14 blocks; only `Checklist Comments` changes, on 302 rows; the ML export is byte-identical). Both capture scripts' demo-dataset guards passed (368 synthetic checklists).
- First pass: a scratch backend (repository code, `SR_DATA_DIR` on a copy of the demo data only, no eBird key) with every outbound request it tried refused at a local logging proxy. 63 eBird-backed requests reached that backend (34 hotspot lookups answered 401 by the keyless backend, 29 taxonomy-code lookups served from the bundled taxonomy); 113 more were answered inside the browser by the committed stubs. **None reached eBird.**
- The iPad and iPhone Duo Weather frames were recaptured live, once each, on the Guide's scratch backend that reads the keys from its own scratch-only env file, with every other eBird-backed path answered or blocked in the browser and a cap of one `/weather` and one `/tide` request per capture. Outbound, logged by host and path only: **eBird 8, OpenWeather 4, NOAA 6**, all 200. Each lookup route fetches the checklist itself (checklist view plus region info), so one Weather capture costs four eBird requests.
- Kept as committed: the website `weather.webp` and the iPhone `03-weather-tide.png` (neither shows anything this release changes). Recomposing changed only the two recaptured frames among the existing ones.
- Found on the way: the committed iPhone Species Detail frame read "Splits and lumps 10 species" where the app reads 11; the regenerated frame replaces it.
- Applied frames match their recorded SHA-256 (57 files). `pipeline/app-store-listing-polish/asc/` now uploads seven frames per family (`asc-screens.mjs` ORDER), and `composed-frames-checksums.{txt,json}` record the 21 committed frames.

### Commits (local, on `main`, in order)

1. `test(weather)`: the markup golden, captured before the extraction.
2. `refactor(weather)`: the distribution row moved to `WeatherDistRow.tsx`.
3. `refactor(life-lists)`: `compareDisplay`'s type-only widening.
4. `feat(hotspot-reports)`: the tab, Help, the rules and these pipeline records.
5. `docs(hotspot-reports)`: the approved README, website and listing copy, the screenshots, the demo data, the capture tools (the held patch plus the approved scratch edits: the key-presence mock, the Life Lists job and its `process-img.mjs` row, Wood Thrush, the seventh `FRAMES` and `APPROVED` rows) and `verify-hotspot-reports.mjs` with its `ORDER` entry and a 900,000 ms budget.
6. `chore(release): 1.0.71`: the version set and this record.

Commits 1 and 2 were checked on their own trees (exported to scratch): the weather suites pass, 3 files and 76 tests at the golden commit, 4 files and 80 tests at the extraction commit.

### The version set at 1.0.71

`frontend/package.json` and its lockfile; `src-tauri/tauri.conf.json` (`versionCode` 1000071); `CHANGELOG.md` (from `held/changelog-entry.md`, dated, with the More sheet line the draft asked for, scoped to the measured 393 by 852 screen); the website version pill, its `aria-label` and the footer; `fastlane/metadata/android/en-US/changelogs/10000711.txt`, `10000712.txt` and `10000714.txt` (the approved text and one newline, 377 bytes each, identical); the in-repo F-Droid recipe (versions, codes, `CurrentVersion` 1.0.71, `CurrentVersionCode` 10000714; its commit lines move after the tag). The iOS plist is stamped later by `tauri ios build`.

### Verification on the final tree

- `npm run typecheck` rc 0; `npx eslint .` rc 0; `npm run build` rc 0.
- Full vitest: 513 files passed, 1 failed, 5 skipped; 11,170 tests passed, 2 failed, 8 skipped. The two failures were `lifeListsLinearity.test.ts` timing ratios (20.6 and 21.1 against 20) while the suite drove the load average to 617. Re-run alone on the settled machine: 20 of 20, twice. Nothing else was red.
- Backend: 2,080 passed. `website/tools` `npm test`: 15 of 15, the composer's committed-frame check included.
- Real-engine gate (`npm run verify`): 9 of 9 harnesses green in about 9 minutes, `verify-hotspot-reports.mjs` with 344 of 344 window configurations measured and none failing.
- Nothing committed under `website/` carries a local path, hostname, tailnet name, key value or real user data (scanned: every added line and every new text file).

### Read-only checks for part two

- `origin/main` is `ed279be9`, no `v1.0.71` tag, no newer release. The other worktree's branch (`life-list-filter-toggle-state`, 1.0.65) has no commits beyond `main`, so no other ship is in flight.
- App Store Connect: 34 version records, all `READY_FOR_SALE`; 1.0.70 (`21fd36c0`, build 1.0.70.1) is live and its submission `a3be255f` is `COMPLETE`. 94 TestFlight trains, 102 builds, all `VALID`, none for 1.0.71. The 25 trains from 1.0.13 on with no record of their own are the ones `RELEASE_LEDGER.md` already accounts for. **Route for 1.0.71: its own new record.** 1.0.70 is released, so its train is closed and there is nothing in review to roll into, and nothing is deferred.
- F-Droid: 1.0.68 included and this tag picked up (all three codes built and published); 1.0.69 superseded on F-Droid by 1.0.70 (the bot added it on 2026-11-10 and a maintainer's "keep latest" sweep removed it on 2026-11-11); 1.0.70 included and this tag not yet built (in the recipe since 2026-11-11, the three build logs 404, not published).
- Xcode 27.2 (27B52), first launch done (`-checkFirstLaunchStatus` rc 0), iOS SDK 27.2; the login keychain is unlocked.

## Part two: 1.0.71 on every leg up to the user's iPhone check (2026-11-11, 19:22 to 19:58 UTC; 11:22 to 11:58 PST)

Run by The Deployer on the user's own answer at the release gate, relayed by the Guide: "Confirm: release 1.0.71 now", which covers the push, the tag, `release.sh`, the Android attach, the TestFlight upload and the App Store Connect writes that prepare the record. Held, as directed: **no review submission** (`POST /v1/reviewSubmissions` was not called); it waits for the user's own install and launch of TestFlight 1.0.71 (1). No physical device was touched; the local simulator and emulator only. Evidence is in `evidence/ship/`.

### Steps

0. **Starting state** (19:22 UTC): keychain `no-timeout` (unlocked); three valid signing identities (Developer ID Application `17118E87...`, Apple Development, Apple Distribution `1861F7A4...`); `git fetch origin --tags`: `origin/main` still `ed279be9`, no `v1.0.71`; nothing of SnowRaven's running.
1. **Tag.** Annotated **`v1.0.71`** (tag object `39f154871260e0d0548a88233601be21e1d564d1`, "SnowRaven 1.0.71: Hotspot Reports") on the release commit `2ac51b1ca1ba2b644ed0e90346f6c23dac5f7a52`; at the tag `tauri.conf.json` reads 1.0.71 / 1000071 and `10000711/2/4.txt` are present. Pushed alone at 19:22:35 UTC.
2. **`101564e2`** `fix(fdroid): the recipe names v1.0.71's commit` (`fdroidRecipe`, `fastlaneMetadata`, `androidVersionSource` 57 of 57), then **`main` pushed** as a fast-forward, `ed279be9..101564e2`, at 19:23:05 UTC.
3. **Website** (Pages `43086696359` success): https://snowraven.dtgibson.com/ answers with last-modified 19:23:25 GMT, its `index.html` byte-identical to the committed file (`aria-label="Version 1.0.71">v1.0.71`, `SnowRaven v1.0.71`, the Hotspot Reports row), and `assets/shots/hotspot-reports.webp` (SHA-256 `c9078338...`), `statistics.webp`, `map.webp` and `weather.webp` byte-identical to the committed files.
4. **iOS** (during the CI wait):
   - The three `/tmp/xcshim` shims recreated; Xcode first launch done (rc 0); iOS SDK 27.2.
   - **Widget Swift tests: 143 tests, 0 failures, `** TEST SUCCEEDED **`** on the iPhone 17 simulator (`OS=latest`, `-test-timeouts-enabled YES`); no simulator left booted.
   - The leftover archive (1.0.70 / 1.0.70.1) moved aside as `snowraven_iOS-1.0.70.1-stale-before-1.0.71.xcarchive`.
   - `tauri ios build --export-method app-store-connect --build-number 1`, outside the Bash sandbox through a login shell with the three signing variables mapped (19:25:33 to 19:27:59 UTC): **the archive `** BUILD SUCCEEDED **`**, and Tauri's own export refused with the skill's third wording ("No Account for Team "Tauri"", "No profiles for ... were found"), expected. The fresh archive reads **1.0.71 / 1.0.71.1**; `vtool -show-build`: `platform IOS`, minos 16.0, sdk 27.2. The build re-quoted the two `PRODUCT_NAME` lines in `project.pbxproj`; restored to HEAD.
   - The archived `snowraven_widgets.appex` was not signed; signed ad hoc with its entitlements, it lists `group.com.dtgibson.snowraven`.
   - Manual `xcodebuild -exportArchive` with `~/.tauri/snowraven-ios-export-options.plist`: **`** EXPORT SUCCEEDED **`**. `DistributionSummary.plist`: both bundles at 1.0.71 (1.0.71.1), Apple Distribution `1861F7A4`, team `8QKC3L2FKP`; the app on "SnowRaven iOS App Store iCloud AppGroup 20260924" with the App Group, `icloud-container-environment` Production, the container and ubiquity identifiers and `CloudDocuments`; the appex on "SnowRaven Widgets App Store" with the App Group and nothing else. IPA SHA-256 `32e1af690e85c5237463b2a6629be63b83479952292bbc123c471d7795ba0b7f` (16,547,009 bytes).
   - **`altool --validate-app`: `VERIFY SUCCEEDED with no errors`** (19:29:31 to 19:30:33 UTC); **`--upload-app`: `UPLOAD SUCCEEDED with no errors`** (19:30:47 to 19:31:48 UTC), **Delivery UUID `22d9d6f4-2280-448c-9f04-56ad18916e0f`** (plus the routine `CDUploaderStateInfoResumeFilePath` line).
   - The stamp (`snowraven_iOS/Info.plist` 1.0.71 / 1.0.71.1, the widget extension's `CFBundleVersion` 1.0.71.1; `iosSceneManifest`, `iosWidgetManifest`, `iosAlertsManifest` 67 of 67) committed as **`9936b4fc`** `chore(ios): stamp iOS 1.0.71 build 1` and pushed at 19:32:11 UTC.
   - **TestFlight:** build 1.0.71.1 `22d9d6f4` **`VALID`** on train 1.0.71 `1f03f878-fc74-473a-989e-e1c26d20a6ae`, min OS 16.0, not expired, uploaded 11:32:29 PST; it already read `VALID` at 19:46 UTC.
5. **CI on the tag's commit:** **Windows Build `43086622917` success** (19:32:41 UTC) and **Android Build `43086622915` success** (19:39:13 UTC), both looked up pinned to `2ac51b1c`.
6. **Pipeline, judged on the basis the user was told at the gate** (`evidence/ship/ci-read-1.0.71.txt`). `43086696374` on `101564e2` was cancelled by the stamp push, as the skill expects. **The run of record, `43088109516` on `9936b4fc`** (19:44:28 UTC): Backend green; Frontend lint and typecheck green; **tests 5 failed, 11,145 passed, 29 skipped, every failure a `lifeListsLinearity.test.ts` timing ratio**: pass 1 23.16/20; pass 1R distinct pairs 25.99/25.55; pass 2R distinct pairs 44.88/20; pass 2R 20 counties 21.56/20; pass 2R repeated species 40.29/20 (the same row read 38.50/20 on `main`'s 1.0.70 baseline run `42888360241`). This build's `hotspotReportsLinearity.test.ts` passed 14 of 14. Build and the real-engine gate were skipped after the red test step; both are green locally on this tree (part one). Nothing else was red. Accepted and recorded; `release.sh` started after this reading.
7. **Android** (build shell as the skill lists; `SNOWRAVEN_ANDROID_SIGNER_SHA256` set to the recorded digest; `evidence/ship/android-1.0.71.txt`):
   - `preflight.sh` **exit 0**, every check `ok`; its one warning (HEAD is not the tag's commit) is expected. Run `43086622915`'s artifact `SnowRaven_1.0.71_android_universal_unsigned.apk` (`com.dtgibson.snowraven`, 1.0.71, 1000071, not debuggable; SHA-256 `05c1d3e20a8b1d12167e0d6c82cbc8571b542661aad7f5f2172c20ec539b2482`).
   - `sign.sh` **exit 0**: v2 and v3 (v1 off); signer equals the keystore's certificate and the recorded digest, **`42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a`** (DN `CN=SnowRaven, O=Dave Gibson`). **Signed APK SHA-256 `45c3f5c77fb514ff14f9ea243db44a0fdf099b22beabed9bd2ef8ad6de1f72ba`.** No password was printed or passed on a command line.
   - **Emulator check** on the local API 36 image only (`sr-api36-phone`, port 5554, headless, `-gpu host`, `-no-snapshot-save`; every `adb` call addressed to `emulator-5554`; no device listing taken; nothing installed before). The exact signed bytes (hash re-read equal) installed: 1.0.71, 1000071, minSdk 26, targetSdk 36; cold start `Status: ok`, `COLD`, 501 ms. Welcome; "Explore the app first" drew Weather with both key notices; More listed all nine destinations, Hotspot Reports among them, with Settings in view; Hotspot Reports drew its no-backup state (`evidence/ship/api36-1.0.71-*.png`). The crash buffer read 0 lines before and after, no `AndroidRuntime` `FATAL` line, app alive. Nothing was sent to eBird or OpenWeather. The emulator was stopped.
   - **WebView:** `com.google.android.webview` 133.0.6943.137: **WebView 133, unchanged since the last measurement.**
   - **Device check: Partial on API 36 emulator evidence, under the standing decision** (the user owns no Android device).
8. **Desktop.** `zsh -lc ./release.sh` from the main checkout, alone on the machine on a clean tree, **exit 0** (19:45:49 to 19:51:31 UTC): `Releasing v1.0.71: tag=2ac51b1c HEAD=9936b4fc`; iCloud profile OK (to 2044-08-27); the bundle version, iCloud entitlements and embedded profile verified; the final DMG signed, notarized and stapled; the Windows installer fetched from CI and signed locally (`evidence/ship/release-1.0.71.txt`).
   - **Release `442144590`**, https://github.com/dtgibson/snowraven/releases/tag/v1.0.71, published 2026-11-11 19:51:30 UTC, not a draft or pre-release, **Latest**.

     | Asset | Bytes | SHA-256 |
     |---|---|---|
     | `latest.json` | 1,852 | `c639849f4e03d8dabfab160c5d10b682a88730fbd645a2988a917d667f9b2942` |
     | `SnowRaven-updater.app.tar.gz` | 31,343,950 | `3040e2d7952ebe3030d5e8eccf2ca8458bf43d38cb7972b925e43ce4df7a9ac8` |
     | `SnowRaven-updater.app.tar.gz.sig` | 408 | `1bfb9c3d2f8c5f942dfd1eac368442c55a08e86b78bbf5abf24b1970d219fbf7` |
     | `SnowRaven_1.0.71_universal.dmg` | 31,679,744 | `90ab104450848199aedd47f1dcff5ee3de7e7d0493936c73cdadc65886e5bf56` |
     | `SnowRaven_1.0.71_x64-setup.exe` | 10,281,503 | `c9f73355c9c3325e5112a08e42698ab00bd1a100d2944eb9867b3b7a24d38fa8` |
     | `SnowRaven_1.0.71_x64-setup.exe.sig` | 420 | `ca17ed1946a0a23f3c8b6ba7fa51402276aae966ae73af253bb96032ec99bcf0` |
     | `SnowRaven_1.0.71_android_universal.apk` (step 9) | 79,382,146 | `45c3f5c77fb514ff14f9ea243db44a0fdf099b22beabed9bd2ef8ad6de1f72ba` |

   - **The DMG, downloaded back from the release:** `codesign --verify --verbose=2` valid on disk and satisfies its Designated Requirement; `xcrun stapler validate` worked; `spctl -a -t open --context context:primary-signature -vv` **accepted, source=Notarized Developer ID**, origin `Developer ID Application: DAVID THOMAS GIBSON (8QKC3L2FKP)`; `hdiutil verify` checksum VALID.
   - **`latest.json`:** version 1.0.71, `pub_date` 2026-11-11T19:51:26Z; `darwin-aarch64` and `darwin-x86_64` identical, on `.../v1.0.71/SnowRaven-updater.app.tar.gz`; `windows-x86_64` on `.../v1.0.71/SnowRaven_1.0.71_x64-setup.exe`; each signature equals its `.sig` asset, and **both verify VALID** (the file and the trusted comment) against the updater public key in `tauri.conf.json` (key id `f80c63fb3b636306`) with a scratch Node verifier (BLAKE2b-512 prehash, Ed25519), which reads a one-byte-changed installer INVALID.
   - **The updater bundle** unpacks to `SnowRaven.app` 1.0.71, a universal executable (`x86_64 arm64`), and passes `codesign --verify --deep --strict`.
   - **The published installer is byte-identical** to run `43086622917`'s artifact (`cmp`), the tag's own run.
9. **Android attach.** `ANDROID_DEVICE_CHECK=partial ANDROID_CHECKED_SHA256=45c3f5c7...72ba scripts/android/attach.sh <signed.apk>` **exit 0**: signer equals the keystore's certificate, byte-identical to the checked file, `com.dtgibson.snowraven 1.0.71 (1000071)`; uploaded as **`SnowRaven_1.0.71_android_universal.apk`** (asset `736764829`, 79,382,146 bytes, 19:53:03 UTC), downloaded back byte-identical, and the release's own asset digest reads `sha256:45c3f5c7...72ba`.
10. **App Store record, prepared and not submitted** (metadata key `QJA25M7XHM` through `asc-lib.mjs`, from a script in the session scratchpad; no token, key, issuer or contact value printed or written; `evidence/ship/asc-1.0.71.txt`):
    - The read-back proved first on the released 1.0.70 record: `ALL SAME` against the listing at `ed279be9` and 1.0.70's What's New; `DIFF description` (3,471 against 3,733) against today's listing.
    - Guards (19:46 UTC): no open record, no 1.0.71 record, 1.0.70 `READY_FOR_SALE`, build 1.0.71.1 `VALID` on train 1.0.71, no review submission open. `POST /v1/appStoreVersions` (201): IOS, 1.0.71, copyright `2026 Dave Gibson`, `AFTER_APPROVAL`, build `22d9d6f4` attached. **New record `c4244b1b-938e-4ab3-a801-7f5b8f74e35c`**, created 19:46:34 UTC, `PREPARE_FOR_SUBMISSION`; en-US localization `d376d394-e264-4f49-af19-ca68e91acaff`; a new editable app info `767116c7-8b09-4c11-a52a-ab77bdb197fe`.
    - Arrived: description 3,471 (1.0.70's), keywords 97 same, promotional text NULL, marketing URL 30 same, support URL 37 same, What's New NULL. One localization `PATCH` (200) wrote the description (3,733, `appstore/LISTING.md`), the promotional text (137, `LISTING.md`) and the What's New (376, the approved text, SHA-256 `bdca8541...5719`; the script refused any text not equal to all three F-Droid files).
    - Age rating, on the live `01f24c09` and the new `767116c7`: 30 fields, 16 `NONE`, 11 false, 0 true, 3 null (`kidsAgeBand`, `gracRatingClassificationNumber`, `developerAgeRatingInfoUrl`); `socialMedia` and `socialMediaAgeRestricted` false. Already answered; nothing changed.
    - **Listing read-back (19:47:36 UTC and again at 19:57:09 UTC, after the screenshots): `READBACK 1.0.71: ALL SAME`**: version 1.0.71, `AFTER_APPROVAL`, no earliest release date, no phased release; copyright (16); build 1.0.71.1 `VALID`, `usesNonExemptEncryption` false; one localization, en-US; description (3,733), keywords (97), promotional text (137), marketing URL (30), support URL (37), What's New (376); review notes the same as `REVIEW_NOTES.md`'s pasted section (3,898), all four contact fields present, no demo account; on both app infos name (9), subtitle (27), privacy policy URL (43), categories `REFERENCE` and `WEATHER`.
    - **Screenshots** (`pipeline/app-store-listing-polish/asc/`, `plan` then `replace --execute` per family, 19:48 to 19:56 UTC): iPhone 6.9-inch legacy set `521738e1` and iPad 13-inch legacy set `422e436f` each had six deleted and seven uploaded, every one `COMPLETE`; the iPhone Duo `IPHONE_DUO_PROFILE` had six placements removed and seven placed. **`readback`: ALL MATCH, 21 of 21** (`evidence/ship/screenshots-readback-1.0.71.txt`).
    - **Reconciliation** (19:57 UTC): 35 version records (1.0.71 `PREPARE_FOR_SUBMISSION`, 34 `READY_FOR_SALE`); 10 review submissions, all `COMPLETE`; 95 trains, 103 builds, every build `VALID`; from 1.0.13 on, 25 trains without a record of their own, the 25 the ledger already accounts for.
11. **F-Droid three-read** (19:48 UTC, `evidence/ship/fdroid-read-1.0.71-ship.txt`): f-droid.org publishes 1.0.68, 1.0.61 and 1.0.60 (`suggestedVersionCode` 10000684); fdroiddata `master` `CurrentVersion` 1.0.70 / 10000704, `Builds` for 1.0.53, 1.0.55, 1.0.56, 1.0.60, 1.0.61, 1.0.68 and 1.0.70; newest recipe commit `08a40a3d` (keep latest, 08:53 UTC); logs for 10000681/2/4 `Successfully built`, those for 10000691/2/4, 10000701/2/4 and 10000711/2/4 answer 404. **States:** 1.0.68 included and this tag picked up; 1.0.69 superseded on F-Droid by 1.0.70; 1.0.70 included and this tag not yet built; 1.0.71 included and this tag not yet built. Nothing was sent to fdroiddata.
12. **`RELEASE_LEDGER.md`**, ASCII only, the file's em-dash count unchanged (2), append-only (every old line kept as a prefix, in order): the 1.0.70 App Store entry extended (RESOLVED); a **1.0.71 SHIP** App Store entry (the record prepared, not submitted); the 1.0.68, 1.0.69 and 1.0.70 Android entries extended with the states above; a **1.0.71 SHIP** Android entry.

### State at the hand-back (2026-11-11, about 19:58 UTC; 11:58 PST)

| Leg | State |
|---|---|
| Website | live at 1.0.71 (Pages `43086696359`) with the approved row and frame |
| Tag | `v1.0.71` (tag object `39f15487`) on `2ac51b1c`, pushed |
| macOS, Windows, updater | release `442144590`, Latest; DMG notarized and accepted; `latest.json` signatures VALID; installer byte-identical to the tag's CI run |
| Android (GitHub APK) | attached, SHA-256 `45c3f5c7...72ba`, signer `42a3576e...996a`; device check Partial (emulator evidence) |
| iOS TestFlight | 1.0.71.1 `22d9d6f4` VALID; waits on the user's iPhone check |
| App Store | record `c4244b1b` prepared (listing ALL SAME, screenshots ALL MATCH 21 of 21), **not submitted** |
| F-Droid | nothing sent; 1.0.71 included and this tag not yet built |
| Ledger | written for this part |

### For part three (on the user's iPhone report)

- The user's check of TestFlight 1.0.71 (1), the steps in the hand-back: launch, the widgets (FR-48, including the cold-start tap), and the new tab.
- On a pass: re-read the App Store state, run the listing read-back and `asc-screens.mjs readback` once more, then `POST /v1/reviewSubmissions`, the item, and `submitted: true`; read back again after submitting; write the submission into the 1.0.71 App Store ledger entry.

## Part three: the device check and the App Store submission (2026-11-11, 21:22 to 21:24 UTC; 13:22 to 13:24 PST)

Run by The Deployer on the Guide's relay of the user's answers. App Store Connect was driven with the metadata key through `asc-lib.mjs` from scripts in the session scratchpad; no token, key, issuer or contact value was printed or written. No device or worktree was touched, and nothing was sent to fdroiddata.

### The user's iPhone check of TestFlight 1.0.71 (1)

Performed by the user on their own iPhone on 2026-11-11, before the submission (the v1.0.31 rule), and recorded as the user reported it, not observed:

- The exact uploaded build 1.0.71 (1) was installed from TestFlight and opened.
- The More sheet and Hotspot Reports steps pass, in the user's words: "The new hotspots tab works".
- **The widget steps (2 to 4: adding a Nearby Lifers and a Media Targets widget, tapping each through, and the cold-start tap after a force-quit) were NOT checked this time**, by the user's decision at the gate ("Submit it"), with the reason that nothing in 1.0.71 touches the widgets, the vendored tao or any native iOS code. The user asked why the widgets were affected; the Guide answered that they are not, and that those steps are the routine per-build check.

### Steps

1. **Re-read before submitting** (21:22 UTC, `evidence/ship/asc-1.0.71-submit.txt`): record `c4244b1b` `PREPARE_FOR_SUBMISSION`, build 1.0.71.1 `22d9d6f4` `VALID` attached, `AFTER_APPROVAL`, no phased release, no earliest release date; 35 version records (the others `READY_FOR_SALE`); 10 review submissions, all `COMPLETE`. **`READBACK 1.0.71: ALL SAME`**, and `asc-screens.mjs readback` **ALL MATCH, 21 of 21** (`screenshots-readback-1.0.71-before-submit.txt`).
2. **Submission** (guarded by the same checks in the script): `POST /v1/reviewSubmissions` (201), `POST /v1/reviewSubmissionItems` (201), `PATCH` `submitted: true` (200). **`2c61c50a-b09a-4f79-8b5b-b94676a60a0f`, `WAITING_FOR_REVIEW`, submitted 2026-11-11 21:23:20 UTC (13:23 PST)**, its one item `READY_FOR_REVIEW`; the record reads **`WAITING_FOR_REVIEW`**, `AFTER_APPROVAL`, no phased release.
3. **After submitting** (21:23 UTC): `READBACK 1.0.71: ALL SAME`; screenshots ALL MATCH, 21 of 21 (`screenshots-readback-1.0.71-after-submit.txt`); 35 version records (1.0.71 `WAITING_FOR_REVIEW`, 34 `READY_FOR_SALE`), 11 review submissions (this one waiting, 10 `COMPLETE`), 95 trains, 103 builds, every build `VALID`; from 1.0.13 on, the same 25 trains without a record of their own that the ledger accounts for.
4. **Final read of the other legs** (21:24 UTC): release `442144590` is Latest with its seven assets (the DMG, the updater bundle and its signature, the Windows installer and its signature, `latest.json`, the Android APK); `latest.json` served from `releases/latest/download` reads 1.0.71 with `darwin-aarch64`, `darwin-x86_64` and `windows-x86_64`; https://snowraven.dtgibson.com/ answers 200 with `index.html` byte-identical to the committed file at v1.0.71; F-Droid unchanged since 19:48 UTC (no 1.0.71 entry in fdroiddata `master`, newest recipe commit `08a40a3d`; the logs for 10000711/2/4 answer 404; f-droid.org publishes 1.0.68, 1.0.61 and 1.0.60), so 1.0.71 is **included and this tag not yet built**.
5. **`RELEASE_LEDGER.md`**: the 1.0.71 App Store entry extended with the submission and the device check as recorded above, and the 1.0.71 Android entry extended with the read after submitting; append-only, ASCII, the em-dash count unchanged.

### State at the hand-back (2026-11-11, about 21:25 UTC; 13:25 PST)

| Leg | State |
|---|---|
| App Store | 1.0.71 record `c4244b1b`, build 1.0.71.1, submission `2c61c50a` `WAITING_FOR_REVIEW`, `AFTER_APPROVAL`, no phased release |
| TestFlight | 1.0.71.1 `22d9d6f4` `VALID`; the user's iPhone check passed for the app and the new tab; widgets not checked this time |
| Mac, Windows, `latest.json` | live at 1.0.71 (release `442144590`, Latest) |
| Android GitHub APK | 1.0.71 attached, signer `42a3576e...996a`; Partial (emulator) |
| F-Droid | 1.0.71 included and this tag not yet built; nothing sent |
| Website | live at 1.0.71 with the approved Hotspot Reports row and frame |
| Ledger | every entry above written |

### Still open, for the next ship

- **App Review of 1.0.71.** The next ship re-reads its state and writes the outcome into the 1.0.71 entry; a rejection stalls only the App Store leg.
- **F-Droid.** The bot has not yet added 1.0.71; 1.0.70 is in the recipe but not yet built. A keep-latest sweep may leave 1.0.70 superseded on F-Droid by 1.0.71. The next ship's three-read records it.
- **The widgets on 1.0.71 were not device-checked**; the next build that touches the widgets, the vendored tao or native iOS code owes the full widget steps.
- **For the Chronicler:** the timing-ratio rows in `lifeListsLinearity.test.ts` stay red on the shared CI runner (five rows on the run of record, up to 2.2 times their limits), as on `main` since 1.0.70 (life-list-region-filter D-12); the committed capture tools gained the key-presence mock and the Life Lists job this release, which closes the 1.0.70 note that they had none; the iPhone App Store Species Detail frame was found stale at this ship ("Splits and lumps 10 species" against the app's 11) and is replaced.
