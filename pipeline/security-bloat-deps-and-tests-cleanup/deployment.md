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
