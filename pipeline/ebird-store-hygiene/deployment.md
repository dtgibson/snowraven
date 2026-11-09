# Deployment record: ebird-store-hygiene (1.0.69)

## Part one: preparation (2026-11-09, about 07:40 to 07:55 UTC; 2026-11-08, 23:40 to 23:55 PST), hands-off

Run by The Deployer (Improve lane, the ship stage) as a prep-only invocation, on `main` in the main checkout. Nothing was committed, tagged, pushed, released, built for a store or uploaded, and no held copy was written into a live file. GitHub, App Store Connect (GET only, metadata key) and F-Droid were only read. Nothing was sent to eBird, and no device or emulator was touched (no `adb` or `simctl` call). The production sign-off is the next gate, and part two runs on its recorded answer.

### Preconditions

- **The Tester PASSED** (`qa-report.md`, gitignored, on disk): Tier 2 full weave, 14 of 14 criteria after one needs-fix round (criterion 5, the TTL mutation isolation), plus a round-3 delta after the security notes. Full frontend suite 10,803 passed, 2 failed, 6 skipped; the two failures are the `fastlaneMetadata.test.ts` rows that wait for the held F-Droid changelogs, and they pass with the held patch applied in a scratch copy. Backend 2,080 passed, ruff clean; build, lint and typecheck exit 0.
- **The Auditor PASSED WITH NOTES** (`security-report.md`, gitignored, on disk): nothing above Low. L1, I1 and I3 resolved; I2's code fix and L2 in the idea inbox (`c5fa8455`, `3eb8682b`); I4 is the Chronicler's (CLAUDE.md's "not yet windowed" sentence, D-09); I5 is the user's choice of privacy wording at this gate.
- No staging environment, as at every SnowRaven ship, so the production sign-off is the one gate. No key, environment variable, host or provider setting is needed, so there is no external setup to offer.

### Repository state (`git fetch origin --tags`, 07:43:45 UTC)

- `origin/main` is `4bd29f97` (`chore: context update after escapee-check-new-taxonomy`), equal to local `main`: nothing ahead, nothing behind. Only `origin/main` exists remotely.
- Newest tag `v1.0.68` (tag object `f17124f4`, peeled to `93c10733`), locally and on origin. No `v1.0.69` anywhere. Release v1.0.68 (`438701895`) is Latest; no draft releases.
- The other worktree (`.claude/worktrees/life-list-filter-toggle-state`) was read by `git worktree list` and `git rev-list` only, never entered: at `481b9ee3`, 0 commits ahead of `main` and 20 behind. No ship is in flight there.
- Nothing of SnowRaven's running: no `release.sh`, cargo, tauri, xcodebuild, vitest, gradle or emulator; nothing holds `~/.snowraven-build`. The one dev server is another project's (`birdsim`'s Vite preview). **One leftover:** pid 41276, `/usr/bin/log stream --predicate process contains "altool" ...`, started 2026-11-08 18:46:49 PST (the 1.0.68 upload) and orphaned to launchd. It is read-only logging and blocks nothing; it was left alone.
- No 1.0.69 train or record in App Store Connect (below), so no other session has shipped this version.

### The version set (five of six written; the sixth held)

| File | Change |
|---|---|
| `frontend/package.json`, `frontend/package-lock.json` (two lines) | 1.0.68 to 1.0.69 |
| `src-tauri/tauri.conf.json` | `version` 1.0.69; `bundle.android.versionCode` 1000069 |
| `CHANGELOG.md` | `## [1.0.69] - 2026-11-08`: one Changed, two Fixed and five Internal bullets. The ship runs after midnight PST, so part two re-dates the heading to 2026-11-09 (the 1.0.67 rule: the heading carries the ship's PST date). |
| `website/index.html` | the version pill text, its `aria-label`, and the footer line; nothing else (a version stamp, no approval needed) |
| `pipeline/android-release/fdroid/com.dtgibson.snowraven.yml` | three `Builds` entries at 1.0.69 (10000691, 10000692, 10000694); `CurrentVersion` 1.0.69, `CurrentVersionCode` 10000694. The three `commit:` lines stay on 1.0.68's `93c107334316ac04228e336cdf62cda51b95244f` and move to `v1.0.69^{commit}` after the tag (D-08). |
| **Held:** the three F-Droid changelogs | in `held/held.patch`; `git apply --check` clean at this prep |

The iOS plists stay at 1.0.68 / 1.0.68.1 until `tauri ios build` stamps them (`iosSceneManifest.test.ts`'s "never leads" rule).

### CI on `main` (`evidence/ship/ci-read-1.0.69-prep.txt`)

- The last four completed Pipeline runs failed, each on the one known timing row and nothing else: `lifeListsLinearity.test.ts` "pass 1 (first sightings), every row its own species", CPU-time ratio against 20 of **23.80** (`42557718544` on `4bd29f97`), **22.46** (`42555006962` on `5f0a27b4`), **24.00** (`42552886222` on `ae9260d8`, 1.0.68's run of record) and **26.11** (`42540147018` on `a554bce9`). The latest: 1 failed, 10,772 passed, 27 skipped. Backend, lint and typecheck green in all four; build and the real-engine gate skipped after the red test step. Two runs in between were cancelled by the next push (`cancel-in-progress`).
- **1.0.69 touches nothing that row measures.** `lifeListsLinearity.test.ts` imports `../types`, `parseMLExport` (type only), `../test/cpuTiming`, `speciesUtils` and `lifeLists.ts`, which imports only `types`, `parseMLExport` and `speciesUtils`; none is in the diff (`LifeListsTab.tsx` and `lifeListsCopy.ts`, which are, are different modules).
- **Proposed handling, the rule 1.0.64 to 1.0.68 shipped under (D-17 of the 1.0.64 run):** judge the run of record, the Pipeline run on the iOS stamp commit (the stamp push cancels the tag commit's run), and continue only if its sole failure is that timing row. Any non-timing failure, or a failure in a test this release touches, stops the ship. **This release changes `backend/`, so the Backend job is a live check this time and must be green.** A re-run of the failed job is the alternative; at 1.0.67's prep no re-run of this row had ever come back green, so it costs a CI cycle for a likely-identical answer. Whether to re-run is the user's call at the gate.

### Rig readiness (read only, 07:44 to 07:50 UTC)

| Check | Result |
|---|---|
| Login keychain | `no-timeout`: unlocked (a reboot before part two would lock it again; then the user runs `security unlock-keychain ~/Library/Keychains/login.keychain-db` in their own terminal) |
| `gh` | signed in as `dtgibson` (scopes `repo`, `workflow`, `gist`, `read:org`) |
| Login shell | Node v24.18.0 (`.nvmrc` 24); cargo and rustc 1.96.1; Rust targets for both Mac slices, iOS device and simulator, and the Android ABIs; `APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID`, `APPLE_API_KEY_PATH` (file exists) and `APPLE_SIGNING_IDENTITY` (matches one identity) set. `release.sh` loads the updater key from `~/.tauri/snowraven-signing.key` itself and notarizes with the API key, so no `APPLE_ID` or `TAURI_SIGNING_PRIVATE_KEY` is needed in the environment. |
| Secrets (existence and mode only) | `~/.tauri/snowraven-signing.key` 600; ASC keys `QJA25M7XHM` and `BVVLBRRVL6` 600; Android keystore `~/.tauri/snowraven-android.p12` 600 and its properties file 600 (four keys present, alias `snowraven`, `storeFile` pointing at that keystore) |
| Signing identities | Developer ID Application, Apple Development and Apple Distribution (`1861F7A4...`), team `8QKC3L2FKP`: 3 valid |
| Profiles | Developer ID "SnowRaven Mac Developer ID 20260901" to 2044-08-27. The export plist (`~/.tauri/snowraven-ios-export-options.plist`: app-store-connect, manual, Apple Distribution, team `8QKC3L2FKP`, `iCloudContainerEnvironment` Production, `uploadSymbols` true) maps the app to "SnowRaven iOS App Store iCloud AppGroup 20260924" (`870fe004`) and the widgets to "SnowRaven Widgets App Store" (`50691228`), both installed under both profile directories, to 2027-07-05 |
| Xcode | 27.2 (27B52), iOS SDK 27.2, Swift 6.4.2 (the swift shim still applies); `xcodebuild -checkFirstLaunchStatus` exit 0. `/tmp/xcshim` holds all three shims but is recreated anyway |
| Leftover iOS archive | `src-tauri/gen/apple/build/snowraven_iOS.xcarchive` is **1.0.68 (1.0.68.1)**, from 18:44 PST: part two moves it aside first |
| Android | JDK 17.0.21.0.3; `apksigner` (0.9), `zipalign`, `aapt2` under build-tools 36.0.0; one NDK, 27.2.12479018; Gradle 8.14.3 at `~/.tauri/gradle-8.14.3`; `cargo tauri` 2.11.2; `toolchain.env` unchanged against HEAD; AVDs `sr-api24/26/30/36-phone`, `sr-api36-aosp`, `sr-api36-tablet` listed. Expected signer `42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a`, checked by `sign.sh` and `attach.sh` |
| Backend venv | rebuilt on Python 3.15.2 at 22:03 PST (`backend/.venv/pyvenv.cfg`), so backend pytest runs again (QA ran 2,080). The ROADMAP item "`backend/.venv` no longer starts on this Mac" is stale, for the Chronicler |

### App Store Connect (read only, metadata key, GET only, 07:45:45 UTC; `evidence/ship/asc-read-1.0.69-prep.txt`)

- **1.0.68 is still `WAITING_FOR_REVIEW`**: record `280db18b-3dfa-4a8b-b8af-4b8332586bd5` (`AFTER_APPROVAL`, no phased release) on build 1.0.68.1 `fcb30cde`, submission `a22d8c52-386e-46ab-9ac7-85fe40e88174` `WAITING_FOR_REVIEW` since 03:23:53 UTC, its one item `READY_FOR_REVIEW`. Not in review, not approved. Its en-US What's New (localization `e43cde44`) is the approved 571-character 1.0.67 + 1.0.68 rollup, byte-equal (SHA-256 `c885c3f1...e593b`); promotional text 137 characters.
- 32 version records: 1.0.68 waiting, 31 `READY_FOR_SALE` (1.0.66 on `ab6360bc` the live one). 11 review submissions: this one waiting, 10 `COMPLETE`.
- 92 TestFlight trains and 100 builds, every build `VALID`. No 1.0.69 train or record.
- From 1.0.13 on, 56 trains, 25 without a record of their own: the 24 accounted for through the 1.0.66 entry and 1.0.67 (rolled up into 1.0.68). **No unaccounted gap.**
- Two app infos: `8319b5dd` live and `285bfbfe` (with the 1.0.68 record, now `WAITING_FOR_REVIEW`), each age rating `FOUR_PLUS` with the declaration answered (30 fields: 16 `NONE`, 11 false, 3 null).

**The disposition for 1.0.69, proposed for the sign-off: the house rollup, 1.0.68 into 1.0.69**, decided by the state at the App Store step, which comes after the user's iPhone check of TestFlight 1.0.69 (1):
- **1.0.68 still `WAITING_FOR_REVIEW` (the case now):** withdraw it (`DELETE /v1/appStoreVersionSubmissions/280db18b...`, record to `DEVELOPER_REJECTED`), retarget the same record to `versionString` 1.0.69, repoint it at build 1.0.69.1, write the 942-character rollup What's New (`held/gate-copy-1.0.69.md` (b)), read every listing field back against `appstore/LISTING.md` and the review notes against `appstore/REVIEW_NOTES.md`, confirm the age rating on the editable app info, run `asc-screens.mjs readback` to `ALL MATCH`, then submit through `reviewSubmissions`. Ledger: 1.0.68 rolled up into 1.0.69 (VALID build 1.0.68.1, record `280db18b`, withdrawn submission `a22d8c52`, the new submission id), the precedent of 1.0.64 to 1.0.66.
- **1.0.68 approved or released first:** 1.0.69 gets a new record on build 1.0.69.1 with What's New = 1.0.69's note alone (369 characters).
- **1.0.68 in review:** leave the review undisturbed; 1.0.69 ends on TestFlight as a deferral written in the ledger (the 1.0.25 precedent), carried by the next record.

Mac, Windows and the Android APK for 1.0.68 are already live; only the App Store leg rolls up.

### F-Droid (public reads, 07:46 UTC; `evidence/ship/fdroid-read-1.0.69-prep.txt`)

- f-droid.org publishes 1.0.61, 1.0.60 and 1.0.59 (`suggestedVersionCode` 10000614).
- fdroiddata `master`: `CurrentVersion` 1.0.65 / 10000654; `Builds` for 1.0.53, 1.0.55, 1.0.56, 1.0.60, 1.0.61 and 1.0.65 (recipe SHA-256 `e85ab522...ed1d`, unchanged since the 1.0.68 ship's read). Newest recipe commit still `8970b26d` "keep latest" (2026-11-08 19:02 UTC); the bot's last run `3302f014` (09:54 UTC).
- Build logs for 10000651/2/4, 10000661/2/4, 10000671/2/4 and 10000681/2/4: all 404 (not attempted).
- **States, unchanged since 03:24 UTC:** 1.0.63 and 1.0.64 superseded on F-Droid by 1.0.65 (already in the ledger); 1.0.65, 1.0.66, 1.0.67 and 1.0.68 each included and this tag not yet built. The bot has run at about 09:00 to 10:00 UTC daily; a v1.0.69 tag pushed before its next run most likely leaves 1.0.66, 1.0.67 and 1.0.68 superseded on F-Droid by 1.0.69, which costs nothing.
- **Nothing goes to fdroiddata at 1.0.69:** `toolchain.env` is unchanged and the recipe diff moves only versions and codes.

### Cargo for the production gate

`git log origin/main..main`: none. The release carries this run's working tree and nothing else:

| Group | Files | Whose |
|---|---|---|
| App behavior | `lib/checklistProjectsCache.ts`, `checklistProjects.ts`, `hotspotActivityCache.ts`, `useHotspotActivity.ts`, `useExoticProvenance.ts`, `tauri/checklistService.ts`, `lifeListsCopy.ts`, `components/lifeLists/LifeListsTab.tsx`; `backend/services/ebird.py`, `backend/routers/checklists.py` (comment only); `docs/HELP.md` (bundled Help) | this build |
| Tests and fixture | the touched frontend suites, `checklistProvenance.fixture.json`, and three backend suites | this build |
| Rule files | `.claude/rules/security.md`, `.claude/rules/bird-names.md` | this build |
| Version set, five of six | above | this build |
| Record-keeping | `pipeline/ebird-store-hygiene/` (brief, decisions, PR description, `held/`, this record, `evidence/`); `qa-report.md` and `security-report.md` are gitignored and stay out | pre-approved cargo |
| Held, written only on the yes | the three F-Droid changelogs; the privacy sentence in `PRIVACY_POLICY.md` and `website/privacy.html` with its guard in `projectsPublishedClaims.test.ts` (the patch, or the stricter wording) | this build |

No commit from another build or from manual work rides along. After the tag: the recipe `commit:` move, the iOS stamp, and the record and ledger commits.

### Held copy for the gate (`held/gate-copy-1.0.69.md`)

- (a) F-Droid, 1.0.69's own text, 369 characters (SHA-256 of the file `ec1f42d5...7e6a`).
- (b) App Store What's New: the 942-character rollup (SHA-256 `5ac12277...a509`), or 1.0.69's note alone if 1.0.68 is approved first.
- (c) The privacy sentence: the held wording or the stricter alternative. Leaving it unchanged is not an option that stays true once 1.0.69 ships.
