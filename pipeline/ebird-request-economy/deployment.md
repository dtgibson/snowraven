# Deployment record: ebird-request-economy (1.0.66)

## Part one: preparation (2026-11-08, about 10:40 to 11:00 UTC, 02:40 to 03:00 PST), hands-off

Run by The Deployer (Improve lane, the ship stage) as a prep-only invocation, on `main` in the main checkout. Nothing was committed, tagged, pushed, released, built for a store or uploaded, and no held copy was written into a live file. GitHub, App Store Connect and F-Droid were only read. Nothing was sent to eBird. The production sign-off is the next gate, and part two runs on its recorded answer.

### Preconditions

- **The Tester PASSED** (`qa-report.md`, gitignored, on disk): 8 of 8 criteria; full frontend suite 10,743 passed, 2 failed, 6 skipped, the two failures being the expected-red `fastlaneMetadata.test.ts` rows that wait for the held F-Droid changelogs; backend 2,079 passed; typecheck and build pass. Its two findings were resolved before the delta run (L1 by D-18, L2 by the composed-seam suite).
- **The Auditor PASSED WITH NOTES** (`security-report.md`, gitignored, on disk): nothing above Informational. I4 was fixed as a comment in `frontend/src/lib/ttlWindow.ts`; I1 and I3 (idea `132ee3ce`), I2 (`7908928e`) and I5 (ROADMAP) are deferred or tracked (decisions.md D-19). Its truth check of the held copy: items 1 and 2 true of the code as changed; item 3 true in normal use, sharing an edge after a clock fault with today's wording.
- **Typecheck re-run on the current tree** after the I4 comment was reworded: `npm run typecheck` exit 0 (15.3 s). The header now says the comparison is between finite doubles far below 2^53, as D-19 records; the file's code holds no non-ASCII character and the file no em dash.
- **No tracked file changed after the QA report** (02:28:30 PST): the only later edit is `ttlWindow.ts` (02:42:43, the I4 comment, untracked). The tracked diff hashes to `62b04ea8...` by `git diff | shasum -a 256`; QA's `3a9838f0...` was taken by a different command in its scratch copy, so the two are not comparable, and the file times are the evidence.
- `pipeline.config.json`: `deploymentTarget` null and no staging environment, as at every SnowRaven ship. The target is the project's own release machinery (the `snowraven-release` skill), so the production sign-off is the one gate. This release needs no key, environment variable, host or provider setting, so there is no external setup to offer.

### Repository state (`git fetch origin`, about 10:43 UTC)

- `origin/main` is `481b9ee3` (`chore: context update after life-list-filter-toggle-state`), equal to local `main`: nothing ahead, nothing behind. Only one remote branch exists, `origin/main`.
- **No `v1.0.66` tag** on origin or locally; the newest tag is `v1.0.65` (tag object `45e4b36e`, on `d7444330`). **No 1.0.66 GitHub release**: `gh release list` shows v1.0.65 as Latest (2026-11-08 02:30:16 UTC).
- **The other worktree** (`.claude/worktrees/life-list-filter-toggle-state`), read by `git log` on its branch only, never entered: `worktree-life-list-filter-toggle-state` is at `481b9ee3`, 0 commits ahead of `main`. Its 1.0.65 ship is complete at HEAD, so no in-flight ship there could take 1.0.66.

### Cargo for the production gate

`git log origin/main..main`: none. The release will carry this run's working tree and nothing else:

| Group | Files | Whose |
|---|---|---|
| App behavior | `useExoticProvenance.ts`, `exoticProvenanceCache.ts`, `ChecklistComparer.tsx`, `lib/tauri/checklistService.ts`, `hotspotRegionCache.ts`, `countyCompletenessCache.ts`, `useCountyCompleteness.ts`, `targets/useTargetsPool.ts`, `transport.ts` and `ebirdGate.ts` (comments), new `lib/ttlWindow.ts`; `backend/services/ebird.py`, `backend/routers/checklists.py` | this build |
| Tests | the touched suites, `checklistProvenance.fixture.json`, new `ttlWindow.test.ts` and `checklistProvenance.composedSeam.test.tsx`, `backend/tests/test_checklist_provenance_parity.py` | this build |
| In-app help | `docs/HELP.md` (the escapee sentence, D-15; no review stop) | this build |
| Version set, five of six | `frontend/package.json` and the lockfile's two version lines, `src-tauri/tauri.conf.json` (1.0.66 / 1000066), `CHANGELOG.md` (the 1.0.66 entry only), `website/index.html` (pill text, its `aria-label`, footer line; nothing else, diff read), the in-repo F-Droid recipe (versions and codes only, diff read) | this build |
| Record-keeping | `pipeline/ebird-request-economy/` (brief, decisions, held copy, `held/`, PR description, bump script, this record, `evidence/ship/`); `qa-report.md` and `security-report.md` are gitignored and stay out | pre-approved cargo |
| Held, written only on the yes by `bump-1.0.66.sh held` | `PRIVACY_POLICY.md`, `website/privacy.html`, the revised `hotspotSharePublishedClaims.test.ts`, new `escapeeRetentionPublishedClaims.test.ts`, `fastlane/.../changelogs/10000661.txt`, `10000662.txt`, `10000664.txt`; with `--offered`, also `hotspotActivityRetentionPublishedClaims.test.ts` | this build |

**No commit from another build or from manual work rides along**, so there is no app-behavior cargo to name at the gate.

### The bump script and the held patch, checked without writing

- `bash pipeline/ebird-request-economy/bump-1.0.66.sh` (check mode; it writes nothing) exit 0: the stamped set is consistently at 1.0.66 (package, lockfile, `tauri.conf.json` with versionCode 1000066, website pill and footer, CHANGELOG dated 2026-11-08, recipe); every held item reads "not applied"; the recipe's three `commit:` lines are on 1.0.65's `d7444330` and move to `v1.0.66^{commit}` after the tag. The CHANGELOG date equals today's local date, so no `RELEASE_DATE` is needed unless the ship slips past midnight PST.
- `git apply --check` of `held/privacy-required.patch` against the live tree: clean, both files. The required patch, and the offered one on top of it, applied cleanly to scratch copies of `PRIVACY_POLICY.md` and `website/privacy.html` in the session scratchpad, and all four patched files are byte-equal to the script's own Before-to-After replacement read from `held-copy.md`. The live privacy files were never touched (both equal HEAD after).

### Rig readiness (read only, about 10:45 to 10:55 UTC)

| Check | Result |
|---|---|
| Login keychain | `no-timeout`: unlocked. The Mac rebooted at about 00:48 PST, two hours before this read, and the keychain is unlocked anyway |
| `gh` | signed in as `dtgibson` (https) |
| Login shell | Node v24.18.0; cargo 1.96.1; Rust targets for both Mac slices, iOS device and simulator, and the three Android ABIs; `APPLE_API_KEY_ID` and `APPLE_API_ISSUER_ID` set |
| Release secrets (existence and mode only, nothing read) | `~/.tauri/snowraven-signing.key` 600; ASC keys `QJA25M7XHM` and `BVVLBRRVL6` 600; `~/.apple/AuthKey_BVVLBRRVL6.p8` 600; the Android keystore and its properties file 600; `~/.tauri/snowraven-developerid.provisionprofile`, `snowraven-ios-export-options.plist` present |
| Signing identities | Developer ID Application and Apple Distribution, team `8QKC3L2FKP` (and Apple Development) |
| Profiles | Developer ID "SnowRaven Mac Developer ID 20260901" to 2044; the export plist maps the app to "SnowRaven iOS App Store iCloud AppGroup 20260924" and the widgets to "SnowRaven Widgets App Store", both installed under both profile directories, both to 2027-07-05; `iCloudContainerEnvironment` Production, manual signing |
| **Xcode** | **27.2 (27B52), iOS SDK 27.2: changed since the 1.0.65 ship**, which recorded 27.1 (27A9275). `Xcode.app` was modified 2026-11-07 23:26 PST, after the 1.0.65 iOS upload (18:55 PST). Swift is still 6.4.2, so the `/tmp/xcshim/swift` shim still applies; the SDK floor of 27.1 (the iPhone Duo inner screen) is met. `Simulator.app` is still absent. `xcode-select` unchanged |
| **Xcode first launch** | **`xcodebuild -checkFirstLaunchStatus` exits 69: Xcode 27.2's first-launch install has not run.** See the note below |
| Simulator runtimes on disk | volumes `iOS_23E254a`, `iOS_23F77`, `iOS_24A434` (listed from the filesystem; `simctl` itself now triggers the first-launch install) |
| Android | JDK 17.0.20.1; `apksigner`, `zipalign`, `aapt2` under build-tools 36.0.0; exactly one NDK, 27.2.12479018; Gradle 8.14.3 at `~/.tauri/gradle-8.14.3` (not on the login `PATH`; the build shell puts it first, as before); `cargo tauri` 2.11.2; `scripts/android/toolchain.env` unchanged against HEAD |
| Emulator images | `sr-api24-phone`, `sr-api26-phone`, `sr-api30-phone`, `sr-api36-aosp`, `sr-api36-phone`, `sr-api36-tablet` (`emulator -list-avds`; no `adb` call was made) |
| Running builds | none: no `release.sh`, `notarytool`, `xcodebuild` build, `altool`, `tauri ... build`, `cargo` or emulator; `~/.snowraven-build` has no open file. Load 2.2 |
| Tailscale | CLI 1.104.5 (app bundle); this machine's tailnet name is now `hephaestus` (earlier records name `hephaestus-developer`); one standing mapping, 8444 to loopback 8377, left untouched |

**Note on the Xcode first launch.** A `simctl list runtimes` read at about 10:46 UTC started `xcodebuild -runFirstLaunch`, which raised the macOS administrator password prompt (SecurityAgent) on the Mac's screen. The chained `simctl list devices` started it a second time. Both were stopped within about three minutes (each `simctl` and each first-launch process killed; the prompt closed on its own once its requester was gone). The install waits on that authorization, so **nothing was installed**. The first-launch install is still owed, and it needs an administrator password, so it is the user's step, like a keychain unlock: in their own terminal on the Mac, `sudo xcodebuild -runFirstLaunch` (or open Xcode once at the Mac). Until then the iOS leg (the archive build and the widget Swift tests, which need a simulator) is expected to stop; nothing else in the ship needs Xcode. If the user saw a password dialog appear and disappear at about 02:46 PST, that was this.

**Xcode 27.2 is new to this ship.** 1.0.66 build 1 would be the first SnowRaven iOS build on it. `altool --validate-app` is the check that App Store Connect accepts its toolchain (27B52 carries no beta suffix), and the release skill's "Xcode 27.1 is required" bullet should say "27.1 or later" once a 27.2 build has gone through (the Chronicler's).

### CI on `main`

The Pipeline run for HEAD `481b9ee3` (`42446552232`) **failed**: Backend green, Frontend red on one row only, `lifeListsLinearity.test.ts` "pass 1 (first sightings)", CPU-time ratio 24.50 against 20 (10,678 passed). Every completed Pipeline run on `main` since `1e24a50c` has failed the same way: `lifeListsLinearity` read 20.01 to 25.11 against 20, and one run (`42438324780`) also read 16.53 against 15.625 on `alphaCodes.test.ts`'s linearity quotient, each time the only failures. This is the timing-only red that 1.0.64 (D-17) and 1.0.65 (D-8) shipped under, with the reversal "a failure in a test the release touches, or any non-timing failure" and the headroom question in idea `f79a03a9`. **1.0.66 touches nothing either ratio measures**: `lifeLists.ts` imports only `types`, `parseMLExport` and `speciesUtils`, none of which changed, and no changed file is under `alphaCodes`. So the run of record for 1.0.66 is likely to be red on the same row. Under the same rule it does not hold the ship, provided the build and the real-engine gate that CI skips after the failed test step (`npm run build`, then `npm run verify -- ../../frontend/dist` in `website/tools`) pass locally on the shipped tree.

### App Store Connect (read only, metadata key, GET only, 10:44:58 UTC)

The reader is a GET-only script in the session scratchpad that imports only `get` from `pipeline/app-store-listing-polish/asc/asc-lib.mjs`; its output is `evidence/ship/asc-read-1.0.66-prep.txt`.

- **1.0.65 is `WAITING_FOR_REVIEW`**: record `ab6360bc-24b3-4816-bf84-88967df06507` (`WAITING_FOR_REVIEW`/`WAITING_FOR_REVIEW`, `AFTER_APPROVAL`) on build 1.0.65.1 (`e1f3f6f9`, `VALID`), submission `33624506-edfa-4d5c-9cc7-806b0d3a7866` `WAITING_FOR_REVIEW`, submitted 2026-11-08 04:01:55 UTC (about 6 h 43 m before this read).
- The record's en-US localization `114f46ce-b4e1-4d51-9870-cf10561f7fbf`: What's New 591 characters, byte-equal to 1.0.64's text (217, from `10000644.txt`), a blank line, then 1.0.65's (372, from `10000654.txt`); promotional text 137 characters.
- 31 version records: 1 `WAITING_FOR_REVIEW` (1.0.65), 30 `READY_FOR_SALE`; **no 1.0.66 record**. 11 review submissions: this one waiting, 10 `COMPLETE`. 89 TestFlight trains and 97 builds, every build `VALID`; the newest trains are 1.0.65 to 1.0.58, each with its build 1; **no 1.0.66 train**.
- From 1.0.13 on, 53 trains, of which 23 have no record of their own: the 21 the 1.0.59 ship accounted for, 1.0.62 (rolled up at 1.0.63) and 1.0.64 (rolled up at 1.0.65). **No unaccounted gap.**

**The two plans for 1.0.66, decided by 1.0.65's state at the App Store step (after the user's iPhone check of 1.0.66.1):**

- **(a) 1.0.65 still `WAITING_FOR_REVIEW`: roll it up into 1.0.66** (the house form, as at 1.0.65). Withdraw (`DELETE /v1/appStoreVersionSubmissions/ab6360bc...`, record to `DEVELOPER_REJECTED`), retarget `versionString` to 1.0.66, repoint the build to 1.0.66.1, write What's New as **the record's own 591-character text first (1.0.64's and 1.0.65's notes, which store users on 1.0.63 have seen neither of), a blank line, then 1.0.66's 289 characters: 882 characters**, read back byte for byte; then the listing read-back, review notes, age rating, screenshot `readback` ending `ALL MATCH`, and resubmit through `reviewSubmissions`. 1.0.65 then ends with VALID build 1.0.65.1 and no record of its own, by rollup: added to `RELEASE_LEDGER.md`'s rollup list and corrected in place in its entry. (A record that went `REJECTED` by Apple is editable the same way.)
- **(b) 1.0.65 `IN_REVIEW` or approved:** 1.0.66 gets its own record with 1.0.66's 289-character note alone. While 1.0.65 is in review, 1.0.66 waits on TestFlight (build 1.0.66.1 VALID, no record yet), and its record is created once 1.0.65 is `READY_FOR_SALE` (`AFTER_APPROVAL` releases it on approval). If it is approved by the App Store step, the record is created then. A new record arrives with the promotional text empty (fourteen times so far), restored from `appstore/LISTING.md`.

**The current state points to plan (a).** It is read again immediately before the App Store step, because it can move into review at any time.

### F-Droid (public reads, 10:49:43 UTC; `evidence/ship/fdroid-read-1.0.66-prep.txt`)

- fdroiddata `master`: **`CurrentVersion` 1.0.65, `CurrentVersionCode` 10000654**, newest recipe commit **`3302f014` "bot: Update SnowRaven to 10000654", 2026-11-08 09:54 UTC**; `Builds` entries for 1.0.53, 1.0.55, 1.0.56, 1.0.60, 1.0.61, 1.0.63 and **1.0.65, none for 1.0.64**. The three 1.0.65 entries are identical, line for line, to the in-repo recipe at HEAD.
- f-droid.org publishes 1.0.61, 1.0.60 and 1.0.59 (`suggestedVersionCode` 10000614).
- Build logs for 10000631/2/4, 10000641/2/4 and 10000651/2/4: all 404 (not attempted).
- **States:** 1.0.63 included and this tag not yet built; **1.0.64 superseded on F-Droid by 1.0.65** (the bot took the newest tag and skipped it; this corrects the 1.0.64 Android ledger entry's "included and this tag not yet built", in place at the ledger step); **1.0.65 included and this tag not yet built** (its entries now exist, which the 1.0.65 entry could not yet say). 1.0.66 is not tagged.
- **Nothing goes to fdroiddata at 1.0.66**: `toolchain.env` is unchanged and the recipe diff moves only `versionName`, `versionCode`, `CurrentVersion` and `CurrentVersionCode`.

### The held copy, for the gate

`pipeline/ebird-request-economy/held-copy.md` is the one source; nothing in it has been written into a live file.

- **Privacy item 1 (required)**, the escapee retention sentence; **item 2 (required)**, its neighbor, reworded from the brief (D-14); **item 3 (offered)**, the Recent activity clause. Each goes into `PRIVACY_POLICY.md` and `website/privacy.html` identically, with its guard.
- **The 1.0.66 note**, one text for both stores, 289 characters: the three F-Droid files (290 bytes each, SHA-256 `b7b34859...509e`) and the App Store What's New (alone under plan (b), after the record's 591 characters under plan (a)).
- **The preview page** (built from `held-copy.md` by a generator in the session scratchpad, served on loopback and exposed on the tailnet on HTTPS port 8466 only; the URL is in the hand-back, not here, because this repository is public) shows each item's Before and After with the changed words marked, both App Store compositions in full, and the live `website/privacy.html` rendered with items 1 and 2, and with 1 to 3, applied to scratch copies and highlighted. Checked at 390 px (light) and 1200 px (dark): no horizontal scroll, no em dash.

### Plan for part two (ordered; after the production sign-off)

0. **Before anything:** `security show-keychain-info` (unlocked); `git fetch origin --tags`: `origin/main` still `481b9ee3` (or anything new merges cleanly; a conflict stops the ship), no `v1.0.66` tag or release; no other release, build or dev watcher running and `~/.snowraven-build` free (re-check the other worktree's branch by `git log` only); for the iOS leg, the user's Xcode first launch done (`xcodebuild -checkFirstLaunchStatus` exit 0).
1. **The held copy, on the yes:** `bash pipeline/ebird-request-economy/bump-1.0.66.sh held` (with `--offered` only if item 3 is approved; `RELEASE_DATE=YYYY-MM-DD` if the date has moved). A wording changed at the gate is edited into `held-copy.md`'s quoted line, with its stated facts and the guard lead it names, before the run, or the script refuses.
2. **Verify the tree:** the guard files the script names (`hotspotSharePublishedClaims`, `escapeeRetentionPublishedClaims`, `privacyPageParity`, `fastlaneMetadata`, `fdroidRecipe`, `androidVersionSource`, `icloudKeysPublishedClaims`, `iosSceneManifest`, plus `hotspotActivityRetentionPublishedClaims` with `--offered`); then the full vitest suite (now expected 0 failed: the two `fastlaneMetadata` rows turn green), `npm run lint`, `npm run typecheck`, `npm run build`; backend pytest; `npm run verify -- ../../frontend/dist` in `website/tools`; the em-dash and non-ASCII sweep over every changed file. A timing-ratio failure is re-run alone and at reduced parallelism before it is attributed.
3. **Commits, the 1.0.64 shape:** (i) the change in its own commit, everything but the version set and the held copy, e.g. `fix(ebird): the escapee check and the List Comparer share the eBird pace`; (ii) the release commit `chore(release): 1.0.66, eBird lookups share one pace` (the five stamped files, the held privacy text and guards, the three F-Droid files); this record rides with either.
4. **Tag** annotated `v1.0.66` ("SnowRaven 1.0.66: ...") on the release commit, pushed first and alone; `git ls-remote` confirms it, and the tag's tree carries 1.0.66 / 1000066 and the three changelogs. Windows Build and Android Build green on the tag's commit (`gh run list --workflow <wf> --commit <sha>`).
5. **The F-Droid recipe commit:** the three `commit:` lines set to `git rev-parse v1.0.66^{commit}`; `fdroidRecipe`, `fastlaneMetadata`, `androidVersionSource` green; commit `fix(fdroid): the recipe names v1.0.66's commit`.
6. **Push `main`** (`git push origin HEAD:main`, fast-forward, re-fetch first). Pages deploys the website (the pill and footer, and the privacy page on the yes). The Pipeline run of record follows; a red `lifeListsLinearity` or `alphaCodes` ratio alone is handled as above, anything else stops the ship.
7. **Desktop:** `CI=true SKIP_NPM_INSTALL=1 zsh -lc ./release.sh` from the main checkout (its root `node_modules/.bin/tauri` exists), alone on the machine; then the downloaded DMG (`codesign --verify`, `stapler validate`, `spctl` primary-signature accepted, `hdiutil verify`), `latest.json` (both darwin keys and `windows-x86_64`, both signatures verified against the updater key), and the installer byte-identical to the pinned CI run's artifact.
8. **Android:** `scripts/android/preflight.sh`; `sign.sh` with `SNOWRAVEN_ANDROID_SIGNER_SHA256=42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a`; the opening check of those exact bytes on the local API 36 emulator only (`-gpu host`, addressed by serial, never a bare `adb`): first launch, then with the synthetic demo export imported, Statistics and the List Comparer draw (no eBird key on the emulator, so nothing is sent); the WebView version; `attach.sh` with `ANDROID_DEVICE_CHECK=partial` (standing decision: the user owns no Android device) and `ANDROID_CHECKED_SHA256` of the signed file.
9. **iOS** (after the user's Xcode first-launch step): move any `snowraven_iOS.xcarchive` aside; recreate the three `/tmp/xcshim` shims; `xcrun --sdk iphoneos --show-sdk-version` (27.2, at least 27.1); the widget Swift tests on a simulator; `tauri ios build --export-method app-store-connect --build-number 1` outside the Bash sandbox with the three signing variables mapped; the fresh archive reads 1.0.66 (1); ad-hoc sign the archived appex with its entitlements; manual `xcodebuild -exportArchive` with `~/.tauri/snowraven-ios-export-options.plist`; `DistributionSummary.plist` (both bundle ids, the App Group, the three iCloud keys) and opaque icons; `altool --validate-app` (also the check on Xcode 27.2), then `--upload-app`; commit and push `chore(ios): stamp iOS 1.0.66 build 1`.
10. **TestFlight:** 1.0.66.1 `VALID`, then the user's own iPhone check of that exact build, asked with exact steps: install from TestFlight and open SnowRaven; open Statistics and let the escapee check's status sentence settle; open the List Comparer and compare two of their checklists (both columns fill). Record what they report.
11. **App Store:** read 1.0.65's state, then plan (a) or (b) as the user approved; the listing fields read back against `appstore/LISTING.md` (promotional text included); review notes byte-identical to `appstore/REVIEW_NOTES.md`; the age rating on the editable app info; `asc-screens.mjs readback` ending `ALL MATCH` (no screenshot changes in this release); submit and read back.
12. **F-Droid** three-read state, and **`RELEASE_LEDGER.md`**: the 1.0.66 App Store and Android entries; the 1.0.64 Android correction (superseded on F-Droid by 1.0.65); under plan (a), the 1.0.65 App Store correction and the rollup list entry naming both versions, the record and both submission ids.
13. **Website** live with the 1.0.66 pill and footer (and the privacy page on the yes). Then `tailscale serve --https=8466 off` and stop the preview server (its pid is in the hand-back).

### Notes for the gate

- The sign-off covers: privacy items 1 and 2 (required) and, separately, item 3 (offered); the 1.0.66 note for F-Droid and the App Store; shipping 1.0.66 to every platform; and the App Store plan: if 1.0.65 is still waiting for review at that step, its record moves to 1.0.66 on build 1.0.66.1 with the 882-character combined note (one review carries 1.0.65 and 1.0.66); if it is already in review or approved, 1.0.66 gets its own record when 1.0.65 is out of review.
- Before the iOS leg the user owes one step on the Mac: Xcode 27.2's first-launch install (`sudo xcodebuild -runFirstLaunch`), which needs their password.
- The iPhone check stays Partial until the user's TestFlight check; Android stays Partial on emulator evidence by standing decision.
- CI on `main` is red on the known timing row; 1.0.66 does not touch what it measures.
