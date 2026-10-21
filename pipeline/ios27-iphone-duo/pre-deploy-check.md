# ios27-iphone-duo: pre-deploy check (Deployer, Step 1)

**Date:** 2026-10-21. **Tree:** worktree branch `weft/ios27-iphone-duo` at
`753ea893`, the reconcile merge of `origin/main` (`10d3cf65`, 1.0.58 stamped)
into this build's four commits. Preparation only: nothing was bumped, pushed,
tagged, signed, uploaded or written to App Store Connect. No staging
environment exists (`stack.environments.staging` is null), so the production
sign-off is the one deploy decision. `deploymentTarget` is null in
`pipeline.config.json`, as at every earlier ship: the deploy target is the
release skill's all-platforms rhythm, so there is no Cloud Architect step.

**Version:** this build ships as **1.0.59**. 1.0.58 belongs to the parallel ship
(taxonomy-history-2019), which is still under way (below). No release step for
1.0.59 starts until 1.0.58's legs are clear.

## Pre-deploy checks

| Check | Result |
|---|---|
| The Tester passed | Pass. `qa-report.md`: PASSED, Tier 2. Four criteria Partial by the device boundary and this Mac's tools (inner display, outer landscape and inner insets, the inner-screen zoom reading, the real-Duo check) |
| The Auditor passed | Pass. `security-report.md`: PASSED WITH NOTES, no Critical, High or Medium. L1 deferred as a follow-up (idea inbox), I1 and I2 accepted, with reasons in `decisions.md` D1 |
| Reconcile | `~/.weft/bin/weft-worktree reconcile`: `RECONCILED clean`. The merge brought 1.0.58's three commits (`507eb48e` bump, `7de62264` recipe hash, `10d3cf65` iOS stamp); none touches a file this build changed |
| Merged-tree checks (from `frontend/`) | `npm run typecheck` exit 0; `npm run lint` exit 0; `npx vitest run --maxWorkers=2` exit 0: 480 files (475 passed, 5 skipped), 10,364 tests (10,357 passed, 7 skipped, 0 failed), 208.8 s; `npm run build` exit 0 (the one "chunks larger than 1100 kB" notice is pre-existing, also in QA's build log). The 26 more passing tests than QA's 10,331 arrive with the 1.0.58 merge, whose only test changes are its three taxonomy-history files |
| Commits on the branch | `519a79a1`, `acf78e28`, `82536ea5`, `096e01c8`, then the merge `753ea893`, then the commit carrying this note and `held-copy.md` |
| Branch merged to the deployment branch | Not yet, by design. The execution invocation reconciles again after 1.0.58's closeout commits land, then pushes this branch to `main` as a fast-forward |
| CI on the latest commit | Pending, by design. The branch is unpushed. On `origin/main`, `Pipeline` run `39685933259` (`10d3cf65`) is in progress; the two cancelled runs before it are the expected `cancel-in-progress` successors |
| Conflicts | None. Working tree clean apart from this note and `held-copy.md`, committed with it |
| Environment variables for this feature | N/A. The diff adds no environment read in `frontend/src`, `backend` or `src-tauri` |
| External setup (service, webhook, DNS, key) | N/A. Nothing outside the repository is needed for the feature itself. Xcode 27.1 is the one environment requirement, and it is installed |
| Login keychain | Pass. `security show-keychain-info` answers `no-timeout`, so it is unlocked |
| Xcode | Xcode 27.1 (27A9275) at `/Applications/Xcode.app`; `xcrun --sdk iphoneos --show-sdk-version` prints `27.1` (SDK build `24A94232`) with `DEVELOPER_DIR` exported. No Simulator app (`Contents/Developer/Applications` absent) |
| Android toolchain (spot check) | JDK 17.0.20.1; exactly one NDK (27.2.12479018); build-tools 36.0.0 present. `scripts/android/preflight.sh` checks the rest at the ship |

## Parallel-ship state, read fresh at the end of this stage (2026-10-21 15:32 PDT)

The coordinator's report from the 1.0.58 session agrees with these reads: tag
pushed and CI running, `release.sh` not yet done, no v1.0.58 GitHub release, no
1.0.58 App Store record, and 1.0.57's record READY_FOR_SALE with nothing in
review. Since that report, the 1.0.58 TestFlight build has been uploaded and
`release.sh` has started.

- **origin/main:** `10d3cf65` chore(ios): stamp iOS 1.0.58 build 1.
- **Tags:** newest `v1.0.58` (on `507eb48e`), then `v1.0.57`. No `v1.0.59`.
- **GitHub releases:** newest `v1.0.57` (Latest, 2026-10-19). **No `v1.0.58`
  release yet.**
- **CI for v1.0.58:** `Windows Build` `39685230527` success; `Android Build`
  `39685230598` success (it was in progress at the first read); `Deploy website`
  `39685219667` success; `Pipeline` `39685933259` on the stamp commit in
  progress.
- **Running processes:** **`release.sh` is running for 1.0.58** (`bash
  ./release.sh`, PID 12688, from the main checkout, with `tauri build --target
  universal-apple-darwin` and `rustc` under it). That is the shared
  `~/.snowraven-build`, so no 1.0.59 desktop step may start until it exits. No
  `notarytool`, `altool` upload or iOS archive is running. (Several
  `xcodebuildmcp` tool servers and a `log stream` filtered on `altool` belong
  to other sessions and are not release steps.)
- **Worktrees:** the main checkout on `main` at `10d3cf65` (the 1.0.58
  session) and this one. The other was not
  entered.
- **App Store Connect** (read-only GETs, metadata key `QJA25M7XHM`, app
  `6787719977`):

| Version | appStoreState | Record | Build | Submission |
|---|---|---|---|---|
| 1.0.58 | **no record** | none | **1.0.58.1 VALID**, uploaded 2026-10-21 15:25 PDT (`ba21125d`) | none |
| 1.0.57 | READY_FOR_SALE | `d5b968b4-22ed-4ed9-9663-7d897b2df7ff` | 1.0.57.1 VALID | `79869197` COMPLETE |
| 1.0.56 | READY_FOR_SALE | `f0e1fb0f` | 1.0.56.1 VALID | `c0508d3a` COMPLETE |
| 1.0.55, 1.0.53, 1.0.51, 1.0.50 | READY_FOR_SALE | as in CLAUDE.md | VALID | COMPLETE |

  No review submission is open (the newest three are COMPLETE).

- **1.0.58.1 already links the iOS 27.1 SDK.** Its build bundle reports
  `sdkBuild` `24A94232`, the installed 27.1 SDK's build; 1.0.57.1 reports
  `24A430` (27.0). So 1.0.58 is the first ship built with Xcode 27.1, not
  1.0.59, and its upload already validated. What that means for the Duo is under
  "The App Store record for 1.0.59" below.
- **F-Droid** (public reads): f-droid.org publishes 1.0.55 and 1.0.53;
  fdroiddata `master` has entries for 1.0.53, 1.0.55, 1.0.56 and 1.0.57
  (`CurrentVersion: 1.0.57`) and none for 1.0.58. This build changes no
  `toolchain.env` pin and no recipe build step, so nothing goes to fdroiddata
  (and the expired GitLab token is not needed).

## Cargo for the push (`git log origin/main..HEAD`)

Every non-merge commit is this build's own. The merge carries only commits
already on `origin/main`. No other build's or manual app-behavior change rides
along, so the gate names no foreign cargo.

| Commit | Kind |
|---|---|
| `519a79a1` fix(ios): keep the bottom bar and sheets clear of a side camera, and stop filter-field zoom on wide iPhone screens | this build, app behavior (`globals.css`) plus its guards |
| `acf78e28` test(ios): keep monitor lookups off iOS (tao 1373) | this build, test plus comment-only Rust (`lib.rs`, `window_geometry.rs`) |
| `82536ea5` docs(release): Xcode 27.1 is required from the next iOS build, and the iPhone Duo checks | this build, record-keeping (release skill) |
| `096e01c8` docs(ios27-iphone-duo): brief, design, build, verification and security records | this build, record-keeping (`pipeline/ios27-iphone-duo/` only) |
| `753ea893` Merge remote-tracking branch 'origin/main' | reconcile merge, no content of its own |
| (next) docs(ios27-iphone-duo): held copy and pre-deploy check | this build, record-keeping |

The release adds the six-file bump commit, the recipe-hash commit after the tag,
and the iOS stamp commit, all from `held-copy.md` (d).

## The platform legs, in order

Before the first one, the execution invocation re-reads everything above
(origin/main, tags, `gh release list`, `gh run list`, running `release.sh`,
`notarytool` and `xcodebuild` processes, TestFlight builds and the ASC version
records) and starts only when 1.0.58's `release.sh` has finished and published
its release, and the other session has made its App Store decision or handed it
over. Then `weft-worktree reconcile` again, so 1.0.58's closeout commits are in.

1. **Version bump** from `held-copy.md` (d), with (c) as approved. The four named
   guards, then the full vitest suite and `npm run build`; commit
   `chore(release): bump to 1.0.59`.
2. **Push `main`** (fast-forward from this branch) and **push tag `v1.0.59`**,
   which starts Windows Build, Android Build, Pages and Pipeline.
3. **Recipe hash:** a follow-up commit setting the three `commit:` lines to
   `git rev-parse v1.0.59^{commit}`.
4. **iOS archive during the CI wait** (release skill): recreate all three
   `/tmp/xcshim` shims (the `swift` one is required: this worktree's
   `src-tauri/target` has no iOS release build, so swift-rs builds from cold);
   `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`; confirm
   `xcrun --sdk iphoneos --show-sdk-version` prints `27.1`; run the widget
   Swift tests; move any stale `snowraven_iOS.xcarchive` aside; run the build
   outside the Bash sandbox with the three `APPLE_API_*` names mapped;
   `tauri ios build --export-method app-store-connect --build-number 1`; confirm
   the archive's `CFBundleVersion`, the `platform 2` / `platform IOS` checks and
   SDK 27.1; ad-hoc sign the appex with its entitlements; manual
   `xcodebuild -exportArchive` with `~/.tauri/snowraven-ios-export-options.plist`;
   check `DistributionSummary.plist` (both bundle ids, the App Group, the three
   iCloud keys); `altool --validate-app`, then `--upload-app`; commit
   `chore(ios): stamp iOS 1.0.59 build 1`.
5. **Mac and Windows:** with the tag's Windows run green (queried with
   `--commit <tag sha>`), `zsh -lc ./release.sh` from this worktree, alone on the
   machine; then download the DMG back and run the three Gatekeeper checks.
6. **Android:** `scripts/android/preflight.sh`, `sign.sh` (with
   `SNOWRAVEN_ANDROID_SIGNER_SHA256=42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a`),
   the API 36 emulator check of the exact signed bytes (opened to the Welcome
   screen, by screenshot, `-gpu host`, addressed by serial), the WebView version
   read, then `attach.sh` with `ANDROID_DEVICE_CHECK=partial` on the user's
   restated emulator-only decision.
7. **F-Droid:** nothing is sent; record the state from the two public reads.
8. **iOS TestFlight to App Store:** once 1.0.59.1 is VALID, ask the user for
   their iPhone check of that exact build; then the App Store record per the
   logic below, with every listing field read back, the review notes compared
   with `appstore/REVIEW_NOTES.md`, both screenshot sets left as they are (all
   twelve md5s checked against `appstore/screenshots/`), and the age-rating
   declaration checked.
9. **Records:** CLAUDE.md's App Store list entry and Android record line for
   1.0.59 (and for 1.0.58 if this ship rolls it up), in the same ship.

## The App Store record for 1.0.59

Now: 1.0.57's record `d5b968b4` is READY_FOR_SALE; 1.0.58 has VALID build
1.0.58.1 and no record; nothing is in review. 1.0.59's record is decided from a
live query at step 8, never from this note:

- **1.0.58 has no record yet.** 1.0.59 does not take one until the 1.0.58
  session has made its decision (the coordinator's direction): creating a
  1.0.59 record first would leave 1.0.58 with a VALID build and no record,
  which is a skip unless it is written down as a rollup. If that session hands
  the decision over and the user chooses to fold 1.0.58 into 1.0.59, 1.0.59's
  own record carries both, its What's New being the combined text in
  `held-copy.md` (b), and 1.0.58 is listed in CLAUDE.md as rolled up "decided
  before any 1.0.58 record existed, so nothing was withdrawn".
- **1.0.58's record is `WAITING_FOR_REVIEW`.** The gate offers two choices.
  **Rollup:** withdraw it from its submission (it goes to
  `DEVELOPER_REJECTED`), retarget its `versionString` to 1.0.59, repoint it at
  build 1.0.59.1, write the combined What's New (shown whole first), and
  resubmit; cheap only before review starts. **Defer:** leave 1.0.58's review
  undisturbed; 1.0.59 holds VALID build 1.0.59.1 and gets its own record once
  1.0.58 is READY_FOR_SALE.
- **1.0.58's record is `IN_REVIEW`.** The rollup is no longer cheap, so defer is
  the default; the other choice remains a stated decision with its cost.
- **1.0.58 is `READY_FOR_SALE`.** 1.0.59 gets its own new record, What's New
  (b) alone; the promotional text is expected to arrive empty and is restored
  from `appstore/LISTING.md`; the copyright is set from it.

**A fact for that choice: what a Duo owner gets from each build.** The iPhone
Duo goes on sale on 2026-10-23. Because 1.0.58.1 links the 27.1 SDK, it already
fills the Duo's screens, but it carries neither of this build's CSS changes. On
the Duo's outer screen it lays the bottom bar across the full 466 pt, so the
More cell sits inside the 84 pt camera column on the right, as QA's A/B build
from the 1.0.57 tree with the same 27.1 SDK shows
(`evidence/qa/duo-outer-HEAD-bar-for-comparison.png`). And on the inner screen
or an iPhone turned sideways, tapping a sub-16px filter field zooms the page. So
if 1.0.58 alone reaches the store before 1.0.59, Duo owners meet those two
things until 1.0.59 is approved. That weighs toward a rollup or folding 1.0.58
into 1.0.59, but it is the user's call, and the 1.0.58 session should hear it
before it creates its record.

## The user-performed device checks this ship needs

- **The iPhone check of TestFlight build 1.0.59.1, before the App Store record
  is created or submitted** (CLAUDE.md, device boundary; the v1.0.31
  precondition). Steps to give the user: install 1.0.59.1 from TestFlight on
  their iPhone; open it; on a tab with filters, tap a filter field and confirm
  the page does not zoom and the bar's five labels show; open More and close it;
  turn the phone sideways and tap a filter field once more. Record only what
  they report.
- **The real iPhone Duo check, Partial until they have one.** Install the exact
  uploaded build on the Duo; folded and unfolded, and in both orientations on
  the inner screen, confirm the app fills the screen, nothing sits under the
  camera or the Dynamic Island, tapping a filter field does not zoom the page,
  and a fold and an unfold while the app runs land on the same tab. The Duo is
  on sale from 2026-10-23, so this cannot be done before then.
- **Android, emulator only, Partial.** The user owns no Android device; emulator
  evidence has been the user's written decision at each production gate since
  1.0.53, and it needs restating for 1.0.59.

## Blockers and flags

1. **The 1.0.58 wait (blocks starting, not the plan).** `release.sh` for 1.0.58
   is running now in the main checkout, and the v1.0.58 GitHub release, its
   Android attach and its App Store decision are still ahead. 1.0.59's first
   step waits for them.
2. **Xcode 27.1 is not new risk at 1.0.59.** 1.0.58.1 was built and validated
   with it. What is new at 1.0.59 is a cold `src-tauri/target` in this worktree,
   so the `swift` shim is mandatory, and its `platform 2` / `platform IOS`
   checks are the evidence, along with SDK 27.1 in the archive.
3. **The Duo-timing fact above** goes to the gate and to the 1.0.58 session.
4. **Partial criteria:** the inner display, landscape, the inner-screen zoom
   reading and the real Duo stay Partial; the simulator boots folded and this
   Xcode has no Simulator app.
5. **Android landscape is unmeasured.** The F-Droid text states the side padding
   by mechanism. The API 36 emulator check can add a landscape screenshot of
   the bar only if that image is 640 dp or narrower sideways.
6. **Held copy:** the What's New (b) and the F-Droid text (c) need the user's
   express yes at the gate; under a rollup, the combined What's New is shown
   whole.

Nothing else blocks. The keychain is unlocked, the credentials read cleanly,
and no other worktree was touched.
