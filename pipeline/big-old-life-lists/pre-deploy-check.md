# big-old-life-lists: pre-deploy check (Deployer, Step 1)

**Date:** 2026-10-19. **Tree:** local `main` at `6a3cd607`, 13 commits ahead of
`origin/main` (`5bc136d2`, this run's base). Read-only check: nothing was signed,
pushed, tagged, bumped or written outside this note. No staging environment exists,
so the production sign-off is the one deploy decision.

## Pre-deploy checks

| Check | Result |
|---|---|
| The Tester passed | Pass. `qa-report.md`: PASSED, Tier 2, re-verified on `36c65908`; criteria 4 and 5 Partial by recorded decisions |
| The Auditor passed | Pass. `security-report.md`: PASSED WITH NOTES, no Critical, High or Medium; L1, L2 and I5 resolved; L3 and L4 open for the user |
| Commit after the verified tree | Pass. `6a3cd607` (after QA's `36c65908`) is test-only: `backend/tests/test_settingskv_router.py` plus a decisions entry, closing the Auditor's I6. Its file was run on HEAD: 33 passed |
| Branch merged to the deployment branch | N/A. Work is on `main`; no worktree branch |
| Parallel ship in flight | Pass. `origin/main` equals the base; no commit on origin is missing locally; no `v1.0.57` tag, release or TestFlight build exists; only one worktree (this checkout) |
| CI on the latest commit | Pending, by design. HEAD is unpushed, so CI has not run on it. The last `Pipeline` run on `origin/main` (`5bc136d2`, run `39185326251`) is green, and the v1.0.56 Windows (`39167410645`) and Android (`39167410688`) builds are green. The tag push starts all three for 1.0.57 |
| Conflicts | Pass. Working tree clean before this note; `main` is a fast-forward of `origin/main` |
| Environment variables for this feature | N/A. The diff adds no environment read in `frontend/src`, `backend` or `src-tauri` |
| External setup (service, webhook, DNS, key) | N/A. The build needs nothing outside the repository |
| Release toolchain | Pass (below) |
| Login keychain | Pass. Unlocked: `security show-keychain-info` answered (`no-timeout`), no "User interaction is not allowed" |

## Parallel-ship reconciliation

- `git fetch origin`: `main...origin/main [ahead 13]`, nothing behind.
- Tags: newest is `v1.0.56` (`41caabf9`), on origin at the same commit. No `v1.0.57`.
- GitHub releases: `v1.0.56` Latest (2026-10-18), then 1.0.55, 1.0.54, 1.0.53, 1.0.52.
- CI: the last eight runs are all from the 1.0.56 ship and its closeout; none is running.
  The two cancelled `Pipeline` runs are the expected successor cancellations
  (`cancel-in-progress`), each followed by a green run.
- `git worktree list`: only `/Users/developer/devwork/snowraven` on `main`. No other
  worktree exists, so none was entered.
- App Store Connect (read-only GETs, metadata key `QJA25M7XHM`, app `6787719977`):

| Version | appStoreState | Record | Build | Submission |
|---|---|---|---|---|
| 1.0.56 | WAITING_FOR_REVIEW | `f0e1fb0f-cb23-43e2-8218-9a1a684e3f4c` | 1.0.56.1 VALID | `c0508d3a` WAITING_FOR_REVIEW, submitted 2026-10-19 00:40 UTC |
| 1.0.55 | READY_FOR_SALE | `e4affc7f-0522-4f0c-be2e-403bf15572e5` | 1.0.55.1 VALID | `a0db8a72` COMPLETE |
| 1.0.53 | READY_FOR_SALE | `ecbac251` | 1.0.53.1 VALID | `b62a9121` COMPLETE |
| 1.0.51, 1.0.50, 1.0.47, 1.0.45, 1.0.40 | READY_FOR_SALE | as in CLAUDE.md | VALID | COMPLETE |

  TestFlight builds, newest first: 1.0.56.1, 1.0.55.1, 1.0.54.1, 1.0.53.1, 1.0.52.1,
  1.0.51.1, 1.0.50.1, 1.0.49.1, 1.0.48.1, 1.0.47.1, all VALID. Read against CLAUDE.md's
  list, the versions without a record of their own in that window (1.0.54, 1.0.52,
  1.0.49, 1.0.48, 1.0.46) are each written down as rollups, so there is no unaccounted
  gap through 1.0.56.

- F-Droid (public reads): f-droid.org publishes 1.0.55 and 1.0.53; fdroiddata `master`
  has entries for 1.0.53 and 1.0.55 only (`CurrentVersion: 1.0.55`). So 1.0.56 is
  **included and this tag not yet built**. If 1.0.57 is tagged before the update bot
  adds 1.0.56, the bot will most likely add only the newest tag, as it did when it
  skipped 1.0.54. That costs nothing. The cargo changes no `toolchain.env` pin and no
  recipe build step, so nothing goes to fdroiddata (and the expired GitLab token is not
  needed).

## The record choice for 1.0.57

1.0.55 is READY_FOR_SALE. 1.0.56 is WAITING_FOR_REVIEW, not yet IN_REVIEW. While a
version is in review, a new record of its own is not available (the CLAUDE.md
precedents: "nothing was in review, so neither a deferral nor a rollup was available").
So the gate choice is one of two:

- **Rollup:** withdraw record `f0e1fb0f` from submission `c0508d3a` while it is still
  WAITING_FOR_REVIEW (it goes to DEVELOPER_REJECTED), retarget it to 1.0.57, repoint it
  at build 1.0.57.1, and resubmit. Its What's New is 1.0.56's approved text (a)
  (`pipeline/code-search-and-a11y-polish/whats-new.md`) followed by 1.0.57's approved
  sentence. This is only cheap before review starts.
- **Deferral:** leave 1.0.56's review undisturbed. 1.0.57 holds VALID build 1.0.57.1 and
  gets its own record once `f0e1fb0f` is READY_FOR_SALE.

Either way, the state is re-queried live at the iOS leg: if 1.0.56 is already
READY_FOR_SALE then, 1.0.57 simply gets its own record; if it has moved to IN_REVIEW, the
rollup is no longer cheap. Whatever ends without a record is written into CLAUDE.md's
list in the same ship.

**This choice interacts with the Auditor's L3 (iCloud version skew).** The Mac's
updater delivers the 64 MB cap on release day, while iPhones and iPads stay on 1.0.56's
50 MB-measured parse until the App Store build reaches them. A deferral lengthens that
window; a rollup shortens it but does not close it. The Auditor's two remedies are to
write the skew down as an accepted residual, or to hold the Mac at 50 MB for one release.

## Cargo (`git log origin/main..main`)

Every commit is this build's own. None is another build's or manual app-behavior
change, so the gate names no foreign cargo. None touches `website/`, `README.md`,
`appstore/`, `fastlane/`, `PRIVACY_POLICY.md`, `src-tauri/`, `scripts/android/` or any
dependency file.

| Commit | Kind |
|---|---|
| `5bb6e06d` docs: measure large exports on every engine | this build, record-keeping (`pipeline/big-old-life-lists/` only) |
| `179acc8d` feat(stats): milestones to 10,000 | this build, app behavior (`birdingStats.ts`, `docs/HELP.md`) |
| `84ed0fc4` feat(upload): refuse on reported size, cap per platform | this build, app behavior (Settings, upload guard, bar-chart import, backend `settings.py` and `barcharts.py`, `docs/HELP.md`) |
| `4eb4a33a` feat(observations): packed form | this build, app behavior (parser, workers, `.claude/rules/security.md`) |
| `65c4dbfe` fix(taxonomy-history): generator | this build, build-time tooling only (`scripts/`; the shipped asset is unchanged) |
| `900ada1b` feat(caches): raise checklist-keyed caps | this build, app behavior |
| `7ea28392` refactor(observations): parse budget module | this build, app behavior (no output change) |
| `6acb0201` docs: caps, milestone re-measure, eras, verification | this build, record-keeping |
| `ea1d0c07` fix(caches): bound caps by the web/Pi route | this build, app behavior (backend `settingskv.py` is a comment only) |
| `8b443359` fix(observations): bound the capacity hint | this build, app behavior |
| `d2accc78` refactor(observations): field-table validator | this build, app behavior |
| `36c65908` docs: the three security fixes | this build, record-keeping |
| `6a3cd607` test(settingskv): pin the route's body limit | this build, test-only plus a decisions entry |

## Environment (release toolchain on this Mac)

- **Node:** `zsh -lc` resolves v24.18.0 (nvm), matching `.nvmrc` = 24. `gh` is logged in
  as `dtgibson` with `repo` and `workflow` scopes.
- **Rust:** cargo and rustc 1.96.1; targets `aarch64-apple-darwin` and
  `x86_64-apple-darwin` (universal Mac), the three iOS targets, and the three Android
  pins plus `i686-linux-android`.
- **Signing identities** (`security find-identity -v -p codesigning`): Developer ID
  Application (`17118E87...`, expires 2027-02-01), Apple Distribution (`1861F7A4...`,
  expires 2027-07-05), Apple Development. All valid.
- **APPLE_* env** in the login shell: `APPLE_SIGNING_IDENTITY` (Developer ID),
  `APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID`, `APPLE_API_KEY_PATH`; the `.p8` exists at
  0600. Both ASC keys are under `~/.appstoreconnect/private_keys/`.
- **Minisign key:** `~/.tauri/snowraven-signing.key` present at 0600 (not exercised).
- **Profiles:** Mac Developer ID "SnowRaven Mac Developer ID 20260901" for
  `8QKC3L2FKP.com.snowraven` (expires 2044); iOS "SnowRaven iOS App Store iCloud
  AppGroup 20260924" and "SnowRaven Widgets App Store" (both 2027-07-05), which the
  export options plist `~/.tauri/snowraven-ios-export-options.plist` names, with
  `iCloudContainerEnvironment` Production and manual signing.
- **Xcode:** 27.0 (27A266a), Swift 6.4, `altool` resolves. `xcode-select -p` now points
  at Xcode.app. The `/tmp/xcshim` shims are recreated at the iOS build regardless, per
  the skill.
- **Android:** JDK 17.0.20.1; build-tools 36.0.0 with `apksigner`, `zipalign`, `aapt2`;
  exactly one NDK (27.2.12479018); platform `android-36`; Gradle 8.14.3 (equal to
  `gradle-wrapper.properties`); `cargo tauri` 2.11.2. Keystore
  `~/.tauri/snowraven-android.p12` and properties file, both 0600, `keyAlias=snowraven`
  (not opened). Signer digest to pass at sign and attach:
  `42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a`. Local AVDs include
  `sr-api36-phone`, `sr-api36-tablet`, `sr-api30-phone`, `sr-api26-phone`.
- **A slip, recorded:** the AVD listing ran a bare `adb devices` rather than an
  emulator-addressed command. It listed nothing attached, so no device was seen. The
  ship's `adb` calls go to the emulator by serial.

## Version plan: 1.0.57

Patch bump from `frontend/package.json` 1.0.56. `bundle.android.versionCode` 1000057;
F-Droid per-processor codes 10000571 (armeabi-v7a), 10000572 (arm64-v8a), 10000574
(x86_64), `CurrentVersionCode` 10000574.

| File | Change | Guard | Published copy? |
|---|---|---|---|
| `frontend/package.json` (+ `frontend/package-lock.json`'s two version lines, as at 1.0.56) | `1.0.57` | the source every guard below compares to | No |
| `src-tauri/tauri.conf.json` | `version` 1.0.57 and `bundle.android.versionCode` 1000057 | `androidVersionSource.test.ts` (agrees with package.json, code on the formula), `fdroidRecipe.test.ts` ("tauri.conf.json is the app version"), `icloudKeysPublishedClaims.test.ts`, and `release.sh`'s post-build `CFBundleShortVersionString` check | No |
| `CHANGELOG.md` | `## [1.0.57] - <date>`, from `held-copy.md` (a) | `icloudKeysPublishedClaims.test.ts` (`it('the website version pill and footer follow the app version')`) | No (not on the published list) |
| `website/index.html` | the `version-pill` text and its `aria-label`, and the `footer-version` line | the same row, a substring check: one correct string anywhere passes it, so all three sites are moved by hand | Version stamp only, no new language: CLAUDE.md's version-stamp step moves only the pill and footer, as at every release |
| `fastlane/metadata/android/en-US/changelogs/10000571.txt`, `10000572.txt`, `10000574.txt` | the same text in all three, at most 500 characters, none under 1000057 | `fastlaneMetadata.test.ts` | **Yes.** F-Droid listing copy, the user's yes before the tag |
| `pipeline/android-release/fdroid/com.dtgibson.snowraven.yml` | `CurrentVersion` 1.0.57, `CurrentVersionCode` 10000574, the three `Builds` entries' `versionName`/`versionCode`; then, after the tag, a follow-up commit setting each entry's `commit:` to `git rev-parse v1.0.57^{commit}` (precedent `66af35f6`) | `fdroidRecipe.test.ts` | No (its `NonFreeNet` sentence is unchanged) |

Also not in the bump but moving at the iOS leg: `gen/apple/snowraven_iOS/Info.plist` is
stamped 1.0.57 build 1 by `tauri ios build` and committed before `release.sh`;
`iosSceneManifest.test.ts` (`it('the stamped iOS version never LEADS the app version')`)
holds it behind or equal.

**Copy needing the user's yes before it is written:**
- The App Store What's New for 1.0.57. `held-copy.md` (b) proposes one sentence. Under a
  rollup it follows 1.0.56's approved text (a), and the combined text is shown whole.
- The three Fastlane changelog files. `held-copy.md` (c) leaves them to the Deployer,
  "written from (a)". The proposed What's New names iPhone and iPad's 64 MB, so it cannot
  be reused as is; the Android text needs its own wording (Android's cap is 80 MB),
  prepared for the gate. Not drafted here, by this step's brief.

Not published, no stop: `CHANGELOG.md`, the version files, the recipe mirror, and
`docs/HELP.md` (already changed by the build).

## Flags

Nothing blocks the deploy. For the gate:

1. **Record choice:** rollup into 1.0.56's in-review record, or deferral behind it (above).
   1.0.56 has been WAITING_FOR_REVIEW since 2026-10-19 00:40 UTC; a rollup is only cheap
   until review starts.
2. **L3, iCloud version skew:** accept as a written residual, or hold the Mac at 50 MB for
   one release. It interacts with item 1.
3. **L4, the List Comparer's unchecked file read:** fix in a later run, or record in
   ROADMAP beside Android item (6).
4. **Criterion 5 Partial:** the projects cap stays 65,536 (bounded by the web/Pi route);
   only an iCloud arrival over about 139 MB, or an export of unusually short checklists,
   reaches it, and then the at-capacity state is permanent.
5. **Criterion 4 Partial:** splits and lumps stay 2023 to 2025 until the user supplies
   Cornell's per-year files and tallies.
6. **iPhone and iPad 64 MB:** memory-neutral on the simulator's mean, with one reading 7%
   above the highest shipped one; a real iPhone's margin is unmeasured (simulator has no
   memory limit). The user's own device check of build 1.0.57.1 precedes any App Store
   submission, as at every release.
7. **Android device check:** the user owns no Android device. Emulator-only (Partial) has
   been the user's written decision at each production gate since 1.0.53, and needs
   restating for 1.0.57.
8. **Clean tree for `release.sh`:** this note is a new file under a tracked folder, so it
   is committed with the run's records (or the bump) before `release.sh`'s clean-tree
   preflight.

Nothing is needed from the user outside the gate: the keychain is unlocked and every
credential is in place.
