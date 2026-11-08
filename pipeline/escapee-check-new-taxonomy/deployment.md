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
