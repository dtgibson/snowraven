# Deployment record: life-list-filter-toggle-state (1.0.65)

## Part one: preparation (2026-11-07 PST, 2026-11-08 UTC), hands-off, held behind 1.0.64

Run by The Deployer (Fix lane, the ship stage) as a prep-only invocation. Nothing was pushed, tagged, released, built for a store or uploaded; App Store Connect and F-Droid were only read. The production sign-off is the next gate, and part two runs on its recorded answer.

### Preconditions

- **The Tester PASSED** (`qa-report.md`, gitignored, on disk): 7 of 8 criteria Pass; the iPhone look is Partial until the user's device check. Full suite 490 files passed, 5 skipped; 10,665 tests passed, 7 skipped, 0 failed; typecheck and build pass; the probe reads 169 of 169 on the fixed build and 97 of 169 on the pre-fix build.
- **The Auditor PASSED WITH NOTES** (`security-report.md`, gitignored, on disk): no Critical, High, Medium or Low; five Informational notes. I2 (absolute local paths on line 1 of four QA result files) was already applied before this stage: line 1 of every result file in `evidence/` reads neutrally, and a grep of the run folder for home or scratch paths finds none. I1, I3, I4 and I5 are accepted as the report records.
- `deploymentTarget` is null in `pipeline.config.json`, as at every SnowRaven ship: the target is the project's own release machinery (the `snowraven-release` skill). There is no staging environment, so the production sign-off is the one gate. The fix needs no key, environment variable, host or provider setting, so there is no external setup to offer.

### The hold (coordination with snowraven-e7)

Another session is shipping **1.0.64** from the main checkout. Agreed: this fix ships as **1.0.65**, and until that session's two reports reach the orchestrator this run does not push, tag, run `release.sh`, build or upload an iOS archive, run `altool`, change App Store Connect, attach a release asset, or send anything to fdroiddata, and does not merge `origin/main`. At the time of writing `origin/main` is still `1e24a50c` with no `v1.0.64` tag; local `main` carries one unpushed commit of that session's (`a328fd25`, the escapee check fix), which shares no file with this fix.

### Commits on this branch (`worktree-life-list-filter-toggle-state`)

Corrected in part two A: the four commits were rewritten after this record was written so that each carries the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. The hashes below are the rewritten ones; the originals are in brackets.

| Commit | What |
|---|---|
| `b7ac52a1` (was `a7f171f1`) | `fix(ui): filter pills, segment buttons and switches show their state on tap`: `globals.css`, `controlRegisters.test.ts`, `ToggleSwitch.test.tsx`, `mapFabCascade.test.ts`, the new `test/cssSpecificity.ts`, and this run's `bug-brief.md`, `pr-description.md`, `decisions.md`, `held-copy.md` and `evidence/`. The three changed guard files were re-run on the committed tree first: 3 files, 43 tests, all green. |
| `ebb9fb8e` (was `0a54fae1`) | `docs(pipeline): held copy moves to 1.0.65` |
| `347ac66b` (was `7cc7b618`) | `chore(pipeline): the 1.0.65 bump as a re-runnable script` |
| `e401732b` | `docs(pipeline): 1.0.65 deployment record, part one` |

### The held copy

`held-copy.md` now names 1.0.65: the CHANGELOG heading `## [1.0.65] - (release date)`, the F-Droid files `10000651.txt`, `10000652.txt` and `10000654.txt` (versionCode 1000065), and "the in-repo F-Droid recipe names 1.0.65". Only those numbers and the version sentence moved (word diff checked). The store text is byte-identical before and after: 372 characters, 373 bytes per file with its newline, ASCII, SHA-256 of each file `6aaeb7c4103444ce488a4b5e0729ac33a0acb4e631a5a11f1e5bbdb445d5c77e`, and the App Store "What's New" is the same text. **None of it is approved yet**: the F-Droid changelog and the App Store "What's New" are published copy and wait for the user's yes at the sign-off gate. No README, website sentence or privacy policy change is proposed.

### The bump script, `bump-1.0.65.sh`

Run from the worktree root after the merge: `bash pipeline/life-list-filter-toggle-state/bump-1.0.65.sh`. It writes the six-file set for 1.0.65 in one pass: every check runs before the first write, and each file is replaced atomically.

- `frontend/package.json` and the lockfile's two `frontend` version lines (the 1.0.63 bump `3281ba8f` changed the lockfile the same way);
- `src-tauri/tauri.conf.json`: version 1.0.65, `bundle.android.versionCode` 1000065;
- `CHANGELOG.md`: the held entry, byte for byte, above the 1.0.64 entry, dated by the local date when it runs (`RELEASE_DATE=YYYY-MM-DD` overrides);
- `website/index.html`: the pill text, its `aria-label` and the footer line only (it refuses unless 1.0.64 occurs exactly three times);
- the three Fastlane changelogs, the held text plus one newline each, and no unsplit `1000065.txt`;
- the in-repo recipe: the three entries' `versionName`/`versionCode` (10000651, 10000652, 10000654), `CurrentVersion` 1.0.65, `CurrentVersionCode` 10000654. **Its three `commit:` lines are left on the previous release's hash**, because a commit cannot carry its own hash; they move after the tag, as `9392ffc3` did at 1.0.63. In a git checkout the script also compares them with `v1.0.64^{commit}` and says whether they match.

It refuses, changing nothing, when `frontend/package.json` is 1.0.63 (no merge yet), when it is 1.0.65 (a second run, exit 3), when any file of the set is not consistently at 1.0.64 or a 1.0.65 target already exists, and when the held text fails its own stated length or SHA-256, differs from the App Store text, or is non-ASCII. It prints a diff stat, the text's facts, the commit-line state, and the guard files to run next.

**Dry run** on scratch copies of HEAD (`git archive`, with `frontend/node_modules` linked to this worktree's), in the session scratchpad. A scratch-only simulator stood in for the other session's 1.0.64 bump (the same six files, placeholder copy, recipe commit lines left on 1.0.63's `3281ba8f`).

| Leg | State | Result |
|---|---|---|
| 1 | HEAD as is (1.0.63) | Refused, "still 1.0.63, so origin/main has not been merged yet"; exit 2; tree byte-identical (3,116 files hashed before and after) |
| 2 | Simulated 1.0.64, before the script | The five version-set guards green; `lifeListsPublishedClaims.test.ts` red, 2 rows (see the finding below) |
| 3 | The script on simulated 1.0.64 | Wrote 9 files, +29 -15. The CHANGELOG entry is byte-identical to the held entry apart from the date line, and the file above it is unchanged; each Fastlane file is 373 bytes with the stated SHA-256; a diff against the simulated 1.0.64 shows exactly the version lines listed above and nothing else |
| 3b | Guards on the bumped copy | `androidVersionSource`, `icloudKeysPublishedClaims`, `fdroidRecipe`, `fastlaneMetadata`, `iosSceneManifest`: **5 files, 118 tests, all green**. `lifeListsPublishedClaims`: 1 row red |
| 4 | The script a second time | Refused, "already 1.0.65"; exit 3; tree byte-identical (3,122 files) |
| 5 | Simulated 1.0.64 with `10000642.txt` missing | Refused, "the 1.0.64 bump is incomplete"; exit 2; tree byte-identical |

The final script was re-run end to end on a fresh copy after its last edit (legs 3 and 3b again, same results). Its git-only tail (the `git diff --stat` and the tag comparison) cannot run in a non-git scratch copy, so it was syntax-checked only (`bash -n`) and first runs for real in part two. The script is pure ASCII; two escapes that the editing tool had turned into literal characters were restored at byte level and re-checked.

### Finding: a Life Lists guard turns red at any bump past 1.0.63

`frontend/src/lib/lifeListsPublishedClaims.test.ts` (added at 1.0.63) reads the F-Droid files of the CURRENT `bundle.android.versionCode` and requires them to begin "A new Life Lists tab, after Checklists, lists every species". At 1.0.64 or 1.0.65 those files hold that release's own text, so its two F-Droid rows go red. The 1.0.64 session meets this first. If the merge brings a re-scoped guard, nothing is owed here. If it does not, the repair is test-only: pin the guard to the release whose sentence it guards,

```ts
const VERSION_CODE = 1000063 // the release that shipped this sentence (1.0.63); later releases carry their own
```

replacing `const VERSION_CODE: number = JSON.parse(read('src-tauri/tauri.conf.json')).bundle.android.versionCode`. On the bumped scratch copy that one-line change made the file 8 of 8 green. It goes in its own commit before the bump, with that reason.

### Rig readiness (read-only, 2026-11-07 16:59 PST)

| Check | Result |
|---|---|
| Login keychain | `no-timeout` (unlocked) |
| Login shell | Node v24.18.0; cargo 1.96.1; Rust targets for both Mac slices, iOS device and simulator, and the three Android ABIs |
| `gh` | signed in as `dtgibson`, scopes `repo`, `workflow` |
| Release secrets (existence and mode only, nothing read) | `~/.tauri/snowraven-signing.key` 600; `~/.apple/AuthKey_BVVLBRRVL6.p8` 600; ASC key files for `BVVLBRRVL6` and `QJA25M7XHM`; `~/.tauri/snowraven-developerid.provisionprofile`; `~/.tauri/snowraven-ios-export-options.plist`; the Android keystore and its properties file, both 600 |
| Signing identities | Developer ID Application and Apple Distribution, both team `8QKC3L2FKP` |
| Xcode | 27.1 (27A9275), `xcrun --sdk iphoneos --show-sdk-version` 27.1 |
| Running builds | none: no `release.sh`, `notarytool`, `tauri ... build`, `xcodebuild`, `altool` or emulator process (two idle `xcodebuildmcp` servers only). Load average 2.4 |

`~/.snowraven-build` is shared by every checkout, so part two's `release.sh` waits until the 1.0.64 session's has finished.

### App Store Connect (read only, metadata key, GET only, about 01:00 UTC on 2026-11-08)

- **1.0.63 is approved and live**: record `e48a104b-0542-4c8c-b304-26059fa3bc61` `READY_FOR_SALE` / `READY_FOR_DISTRIBUTION` on build 1.0.63.1, and submission `690b9ad5-b152-4fe9-8508-c2694704ad5c` `COMPLETE`. This supersedes the 1.0.63 ledger entry's `WAITING_FOR_REVIEW`; the correction goes into `RELEASE_LEDGER.md` at the part-two ledger step, in the house "Corrected" form.
- 30 version records, all `READY_FOR_SALE`; every listed review submission `COMPLETE` (none open); 87 TestFlight trains; the newest build is 1.0.63.1 (`52b1e76d`), `VALID`.
- **No 1.0.64 or 1.0.65 record, build or train exists yet.**
- The 1.0.65 App Store options, decided by 1.0.64's state at part two's App Store step: if 1.0.64 is approved by then, 1.0.65 gets its own record and nothing is owed; if 1.0.64 is still `WAITING_FOR_REVIEW`, the user chooses between rolling 1.0.64 into 1.0.65 (withdraw, retarget the same record, repoint at build 1.0.65.1, What's New = 1.0.64's approved text then 1.0.65's), deferring 1.0.65 behind 1.0.64's review (1.0.65 ends with a VALID build and no record, resolved by a later version), or TestFlight-only for 1.0.65 by the user's direction. Whichever it is, it is written in `RELEASE_LEDGER.md` in that ship.

### F-Droid (public reads, about 01:00 UTC on 2026-11-08)

- fdroiddata `master`: `CurrentVersion` 1.0.63, `CurrentVersionCode` 10000634, entries for 1.0.53, 1.0.55, 1.0.56, 1.0.60, 1.0.61 and **1.0.63** (added by the bot as `69401fd9`, "bot: Update SnowRaven to 10000634", 2026-11-07 09:03 UTC, commit `3281ba8ff4348a07df3f5f3ae30f7c01912ca044`). No 1.0.62 entry.
- Build logs: 10000621, 10000622, 10000624, 10000631, 10000632 and 10000634 all answer 404 (not attempted).
- f-droid.org publishes 1.0.61, 1.0.60 and 1.0.59 (`suggestedVersionCode` 10000614).
- States for the ledger: **1.0.63 included and this tag not yet built**; **1.0.62 superseded on F-Droid by 1.0.63** (the bot took only the newest tag; corrects the 1.0.63 entry's "1.0.62 also still included and this tag not yet built"). 1.0.64 and 1.0.65 will likely land close together, so one of them may also end superseded, which costs nothing. Nothing goes to fdroiddata at 1.0.65: no toolchain pin or recipe build step changes.

### Cargo for the production gate

`git log origin/main..HEAD` on this branch, before this record's commit: `b7ac52a1` (was `a7f171f1`; this build's own: the fix, its guards and its records), `ebb9fb8e` and `347ac66b` (were `0a54fae1` and `7cc7b618`; record-keeping: the held copy and the bump script). This record's commit is record-keeping too. After the merge, the 1.0.64 session's commits are already on `origin`, so they are not cargo. No other build's app-behavior commit rides along.

### Plan for part two (ordered; after both of the other session's reports and the sign-off gate)

0. `security show-keychain-info` (unlocked); no other SnowRaven build, release or dev watcher running; `~/.snowraven-build` free (the 1.0.64 `release.sh` has finished).
1. `git fetch origin --tags`; confirm `origin/main` carries the 1.0.64 bump and `v1.0.64` exists; `git merge origin/main` on this branch. On a conflict, resolve keeping both sides and prove it (both sides' added and removed lines unchanged), as at 1.0.63.
2. If `lifeListsPublishedClaims.test.ts` still derives its version code from `tauri.conf.json`, apply the one-line pin above in its own commit.
3. On the merged tree: `npm run typecheck`, `npm run lint`, `npm run build`, and the full vitest suite; re-run a timing-ratio failure alone and at reduced parallelism before attributing it (`.claude/rules/testing.md`).
4. `bash pipeline/life-list-filter-toggle-state/bump-1.0.65.sh`.
5. The six guard files from `frontend/`: `androidVersionSource`, `icloudKeysPublishedClaims`, `fdroidRecipe`, `fastlaneMetadata`, `iosSceneManifest`, `lifeListsPublishedClaims`; then the full suite again.
6. Commit the bump: `chore(release): 1.0.65, filter controls show their state on tap` (the six-file set and this record).
7. Annotated tag `v1.0.65` ("SnowRaven 1.0.65") on the bump commit, **pushed first, alone**; confirm with `git ls-remote` and that the tag's tree has 1.0.65 / 1000065 and the three changelogs. Wait for Windows Build and Android Build green on the tag's commit (`gh run list --workflow <wf> --commit <sha>`), re-running a run that failed only on a known timing flake.
8. Push `main` (`git push origin HEAD:main`, a fast-forward; re-fetch first). The website (Pages) follows the push.
9. The recipe's three `commit:` lines set to `git rev-parse v1.0.65^{commit}`; `fdroidRecipe`, `fastlaneMetadata`, `androidVersionSource` green; commit `fix(fdroid): the recipe names v1.0.65's commit`; push.
10. `CI=true SKIP_NPM_INSTALL=1 zsh -lc ./release.sh`, alone on the machine; then check the downloaded DMG (`codesign --verify`, `stapler validate`, `spctl` primary-signature accepted, `hdiutil verify`), `latest.json` (both darwin keys and `windows-x86_64`), and the installer against the pinned CI run.
11. Android: `scripts/android/preflight.sh`; `sign.sh` with `SNOWRAVEN_ANDROID_SIGNER_SHA256=42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a`; the opening check of those exact bytes on the local API 36 emulator only (`-gpu host`, addressed by serial; Life Lists drawn if practical); the WebView version; `attach.sh` with `ANDROID_DEVICE_CHECK=partial` (standing decision: the user owns no Android device) and `ANDROID_CHECKED_SHA256` of the signed file.
12. iOS, **after the other session's second report**: move the leftover `snowraven_iOS.xcarchive` aside; recreate the three `/tmp/xcshim` shims; SDK 27.1; the widget Swift tests; `tauri ios build --export-method app-store-connect --build-number 1` outside the Bash sandbox with the three signing variables mapped; confirm the fresh archive reads 1.0.65 (1.0.65.1); ad-hoc sign the archived appex with its entitlements; manual `xcodebuild -exportArchive` with `~/.tauri/snowraven-ios-export-options.plist`; `DistributionSummary.plist` and opaque icons; `altool --validate-app`, then `--upload-app`; commit and push `chore(ios): stamp iOS 1.0.65 build 1`.
13. TestFlight read back (1.0.65.1 `VALID`), then the user's own iPhone check of that exact build, asked with exact steps: install from TestFlight, open Life Lists, tap Photo, Audio and Video on and off (each tap shows green or plain at once, never dark gray), tap Include Escapees (the frame stays plain). Record what they report.
14. The App Store record: read 1.0.64's state first and apply the option the user chose (above). Then on build 1.0.65.1: the approved What's New; every listing field read back against `appstore/LISTING.md` (the promotional text has arrived empty on thirteen new records); the review notes byte-identical to `appstore/REVIEW_NOTES.md`; the age rating checked on the editable app info; `asc-screens.mjs readback` ending `ALL MATCH` (no screenshot changes in this release); then `reviewSubmissions`, its item, `submitted: true`, read back.
15. F-Droid three-read state and `RELEASE_LEDGER.md`: the 1.0.63 corrections (App Store approved and live; 1.0.62 superseded on F-Droid), 1.0.64's disposition as that session leaves it, and the 1.0.65 App Store and Android entries.
16. Website: Pages run green; the live site shows 1.0.65 in the pill and footer.

### Notes for the gate

- The sign-off covers: the held CHANGELOG entry, the F-Droid changelog and the App Store "What's New" (one text for both stores); shipping 1.0.65 to every platform after 1.0.64; and, if 1.0.64 is still in review at the App Store step, the rollup-or-defer choice.
- The iPhone look stays Partial until the user's TestFlight check; Android stays Partial on emulator evidence by standing decision.

## Part two A: the desktop and Android legs (2026-11-07 PST, 2026-11-08 UTC), hands-off

Run by The Deployer on the user's firsthand answer at the production sign-off gate, given in the orchestrator's session: "Confirm: approve the text and ship 1.0.65", with the store text in `held-copy.md` approved verbatim. That answer authorizes every command below. Held in this invocation, as agreed with snowraven-e7: no push of `main` (the tag only), nothing built, stamped or uploaded for iOS, no `altool`, no App Store Connect write (reads only), nothing sent to fdroiddata.

**Correction to part one's commit table.** The four local commits were rewritten after part one was written so that they carry the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Their hashes are now: the fix `b7ac52a1` (was `a7f171f1`), the held copy `ebb9fb8e` (was `0a54fae1`), the bump script `347ac66b` (was `7cc7b618`), and part one's record `e401732b`. Part one's dry-run paragraph also named the session scratchpad by its full local path; it now says "the session scratchpad", the posture of the Auditor's note I2 (the earlier wording stays in `e401732b`, which the tag already carries to GitHub).

### Steps

1. **Merge.** `git fetch origin --tags`: `origin/main` at `8d1703c9` (`chore(ios): stamp iOS 1.0.64 build 1`), past the 1.0.64 release commit `84122197`, with the recipe commit `1dbf97be` between them; `v1.0.64` is an annotated tag on `8412219783fe4f217d04181b72f8379fa7038b82`. The two sides share no file (this branch: `globals.css`, `controlRegisters.test.ts`, `ToggleSwitch.test.tsx`, `mapFabCascade.test.ts`, `test/cssSpecificity.ts` and this run folder; theirs: the 1.0.64 version set, the escapee-check code and tests, `lifeListsPublishedClaims.test.ts`, `settingsRouteBudget.test.ts`, their run folder and the iOS stamp). `git merge --no-ff origin/main` applied cleanly, no conflict and nothing resolved by hand: merge commit **`375b0cce`** (`merge: origin/main at 1.0.64 into life-list-filter-toggle-state`). The merge brought `lifeListsPublishedClaims.test.ts` already pinned to `const VERSION_CODE = 1000063`, so part one's one-line repair is not owed.
2. **The merged tree.** `npm run typecheck` exit 0; `npm run build` exit 0; the full vitest suite **exit 0: 491 files passed, 5 skipped; 10,699 tests passed, 7 skipped, 0 failed** (73.9 s), with no timing re-run needed; `pipeline/baseline-failures.json` lists no failures. Backend, with the main checkout's interpreter against this worktree's code: **2,076 passed, 1 warning** (3.7 s).
3. **The bump.** `bash pipeline/life-list-filter-toggle-state/bump-1.0.65.sh` from the worktree root, with `frontend/package.json` at 1.0.64: exit 0, 9 files, +29 -15; release date 2026-11-07 (local); "recipe commit lines equal v1.0.64^{commit} (8412219783fe...), as expected before the v1.0.65 tag".
   - The six guard files (`androidVersionSource`, `icloudKeysPublishedClaims`, `fdroidRecipe`, `fastlaneMetadata`, `iosSceneManifest`, `lifeListsPublishedClaims`): **6 files, 126 tests, all green**. The full suite again on the bumped tree: **491 passed, 5 skipped; 10,699 passed, 7 skipped, 0 failed** (74.5 s).
   - `CHANGELOG.md` opens with `## [1.0.65] - 2026-11-07`, the approved entry above 1.0.64's; the website reads `aria-label="Version 1.0.65">v1.0.65` and `SnowRaven v1.0.65`; `10000651.txt`, `10000652.txt` and `10000654.txt` are 373 bytes each with SHA-256 `6aaeb7c4103444ce488a4b5e0729ac33a0acb4e631a5a11f1e5bbdb445d5c77e`, and there is no `1000065.txt`; `tauri.conf.json` 1.0.65 / 1000065; the recipe's three entries 10000651/2/4 and `CurrentVersion` 1.0.65 / `CurrentVersionCode` 10000654.
   - Em dashes: 0 in every changed file except `CHANGELOG.md`, whose 352 are all in older entries; the 11 lines this bump added hold no em dash and no non-ASCII byte.
   - **Release commit `d7444330fa4c4497511057239293419702b16cee`** (`chore(release): 1.0.65, filter buttons show their state on tap`, the nine files).
   - **Recipe commit `761fc2f3`** (`fix(fdroid): the recipe names v1.0.65's commit`): the three `commit:` lines name `d7444330fa4c4497511057239293419702b16cee`; `fdroidRecipe`, `fastlaneMetadata`, `androidVersionSource` 57 of 57 green before the commit. This follows 1.0.63 and 1.0.64: their annotated tags sit on the release commit (`3281ba8f`, `84122197`) and the recipe commit after it (`9392ffc3`, `1dbf97be`, one file, 3 lines each) names that commit.
4. **Tag.** Annotated **`v1.0.65`** (tag object `45e4b36eb6f073b4ae75dcab84c15745a21d8c5d`, "SnowRaven 1.0.65: filter buttons show their state on tap") on the release commit `d7444330`, the house form (`git cat-file -t v1.0.63` and `v1.0.64` are both `tag`). At the tag, `tauri.conf.json` reads 1.0.65 / 1000065 and the three changelogs are present. Pushed **alone** at 02:10:42 UTC (`git push origin v1.0.65`); `git ls-remote` shows `refs/tags/v1.0.65` `45e4b36e` peeled to `d7444330`, and `refs/heads/main` still `8d1703c9`. `main` was not pushed.
5. **CI on the tag**, looked up pinned to the tag's commit (`gh run list --commit d7444330fa4c4497511057239293419702b16cee`): Windows Build **`42437403549`** succeeded (finished 02:22:04 UTC) and Android Build **`42437403550`** succeeded (02:29:36 UTC; its cached tauri-cli install took six minutes this time). No re-run was needed. **No Pipeline run exists for the shipped tree yet:** `pipeline.yml` runs only on pushes and pull requests to `main`, and `main` was not pushed in this invocation, so the run of record starts when the orchestrator pushes `main` (the 1.0.64 ship saw `lifeListsLinearity.test.ts` fail twice there on timing alone).
6. **Desktop.**
   - **Build directory free**, checked at 02:25 UTC just before the start: no `release.sh`, `notarytool`, `cargo`, `rustc`, `xcodebuild`, `altool`, `tauri` or `hdiutil` process; `lsof +D ~/.snowraven-build` empty; its newest bundle was the 1.0.64 build from 17:38 PST. The one related process was another session's `log stream` watcher for altool (pid 3288), with no altool running: snowraven-e7's iOS leg had finished (1.0.64 submitted at 02:10:03 UTC, below). Keychain `no-timeout`, load 1.1, no dev watcher, tree clean (porcelain empty).
   - **`CI=true zsh -lc ./release.sh`** from the worktree root, **exit 0** (about 02:25 to 02:30 UTC). **`SKIP_NPM_INSTALL=1` was dropped** from the planned command: this worktree has no root `node_modules`, which is where the `tauri` CLI resolves from, so the warm-tree shortcut would have died with `tauri: command not found`; `release.sh` ran its own `npm ci` at the root (0 vulnerabilities) and in `frontend` ("12 vulnerabilities (10 moderate, 2 high)", the same development-tooling advisories 1.0.63 recorded). `ALLOW_DIRTY` was not needed.
   - Log: `Releasing v1.0.65: tag=d7444330 HEAD=761fc2f3`; iCloud profile OK; bundle version verified 1.0.65; iCloud entitlements and embedded profile verified; DMG styled, signed and verified; **notarization submission `6fba9921-611b-4a92-b462-ee2af7069417` `Accepted`**, stapled ("The staple and validate action worked!"); the Windows installer fetched from CI (the query is pinned to the tag's commit because the tag exists locally) and signed locally; published.
   - **Release `437986036`**, https://github.com/dtgibson/snowraven/releases/tag/v1.0.65, published 2026-11-08 02:30:16 UTC, not a draft or pre-release; `GET /repos/dtgibson/snowraven/releases/latest` answers v1.0.65 (`437986036`), so it is **Latest**.

     | Asset | Bytes | SHA-256 |
     |---|---|---|
     | `latest.json` | 1,852 | `995cbfbfb9c265966b510bfed328b54247242e27c11e8ab3e3216069fdb3bbb8` |
     | `SnowRaven-updater.app.tar.gz` | 31,283,336 | `167078273773dd7cc94bfad67095b16085a482b15354b5d7fc15d9d94f266e05` |
     | `SnowRaven-updater.app.tar.gz.sig` | 408 | `fa66ce2a173dd0efc23899b99b4dd81df9b83d7c79b76bc5abdbe7afe739206e` |
     | `SnowRaven_1.0.65_universal.dmg` | 31,618,933 | `077a42d2b7d95c0710fad18f55ce6c875c99616e039cb607d923a030acc95259` |
     | `SnowRaven_1.0.65_x64-setup.exe` | 10,250,149 | `035e57300d390aedc95b948da4876c03da6b19c7f542653ff5f09ffc1e687fb6` |
     | `SnowRaven_1.0.65_x64-setup.exe.sig` | 420 | `4c8c8570b00ea336d429f341ad7f3b6df2ff7767977182efbc1fb3adb08c6908` |
     | `SnowRaven_1.0.65_android_universal.apk` (step 7) | 79,283,842 | `7190fde1ca774a1b797c2d18f2d71e073d915c6b2e9c0130a6ddd17eb76c3d92` |

   - **The DMG, downloaded back from the release:** `codesign --verify --verbose=2` valid on disk and satisfies its Designated Requirement; `xcrun stapler validate` worked; `spctl -a -t open --context context:primary-signature -vv` **accepted, source=Notarized Developer ID**, origin `Developer ID Application: DAVID THOMAS GIBSON (8QKC3L2FKP)`; `hdiutil verify` checksum VALID.
   - **`latest.json`:** version 1.0.65, `pub_date` 2026-11-08T02:30:12Z; `darwin-aarch64` and `darwin-x86_64` identical (same URL and signature), both on `.../v1.0.65/SnowRaven-updater.app.tar.gz`; `windows-x86_64` on `.../v1.0.65/SnowRaven_1.0.65_x64-setup.exe`. **Both signatures verify** against the updater public key in `tauri.conf.json` (minisign, Ed25519 over the BLAKE2b-512 prehash, key id matching, trusted comment valid), read exactly as the in-app updater reads them from `latest.json`, and each equals its `.sig` asset. No `minisign` binary is installed here, so the check is a short Node script in the session scratchpad; it was proven first on 1.0.64's published updater bundle (VALID) and on a mismatched file (INVALID, exit 1). `releases/latest/download/latest.json` answers HTTP 200 with the same bytes, and the updater bundle, installer, DMG and APK URLs each answer 200.
   - **The updater bundle** unpacks to `SnowRaven.app` with `CFBundleShortVersionString` 1.0.65, a universal executable (`x86_64 arm64`), and passes `codesign --verify --deep --strict`.
   - **The published installer is byte-identical** to run `42437403549`'s artifact (SHA-256 `035e5730...7fb6`).
7. **Android.** Build shell: JDK 17.0.20.1, `ANDROID_HOME`, `NDK_HOME` (27.2.12479018, the only NDK), Gradle 8.14.3 first on `PATH`, `SNOWRAVEN_ANDROID_SIGNER_SHA256` set to the recorded digest.
   - `scripts/android/preflight.sh` **exit 0**, every check `ok`: JDK 17, keytool, apksigner, zipalign and aapt2 from build-tools 36.0.0, Gradle 8.14.3, cargo-tauri 2.11.2, the keystore opens (alias `snowraven`), the version pair 1.0.65 / 1000065, `v1.0.65` pushed at `d7444330fa4c` and carrying that pair, `10000651/2/4.txt` present at the tag, and run `42437403550`'s artifact `SnowRaven_1.0.65_android_universal_unsigned.apk` (`com.dtgibson.snowraven`, 1.0.65, 1000065, not debuggable). Its one warning, HEAD is not the tag's commit, is the recipe commit after the tag, as at every ship.
   - `scripts/android/sign.sh` **exit 0**: v2 and v3 (v1 off), `ok signer equals the keystore's certificate`, `ok signer equals the recorded digest`, **`Signer #1 certificate SHA-256 digest: 42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a`** (DN `CN=SnowRaven, O=Dave Gibson`). **Signed APK SHA-256 `7190fde1ca774a1b797c2d18f2d71e073d915c6b2e9c0130a6ddd17eb76c3d92`.** No password was printed or passed on a command line.
   - **Emulator check** on the local API 36 Google APIs image only (`sr-api36-phone`, port 5554, headless, `-gpu host`, `-no-snapshot-save`, booted from its saved quick-boot snapshot in about 6 s; every `adb` call addressed to `emulator-5554` by serial; no device listing taken). No SnowRaven was installed before. The exact signed bytes (hash re-read equal) installed fresh: `versionName` 1.0.65, `versionCode` 1000065, minSdk 26, targetSdk 36. Cold start `Status: ok`, `LaunchState: COLD`, `TotalTime` 137 ms, and the Welcome screen drew (`evidence/ship/api36-1.0.65-first-launch.png`).
     - **The fix itself, on Android's WebView.** The synthetic demo export from `website/tools/gen-demo-data.mjs` (a fictional birder at public hotspots: 7,869 eBird rows, 149 species, 515 Macaulay Library rows; generated into its gitignored `demo-data/` folder and moved to the scratchpad) was pushed to the emulator's Downloads and imported through Settings' two "Import file..." buttons and the system file picker; both showed as saved. Life Lists then drew **149 species** with the Include Escapees and Include Exotics switches and the Photo, Audio and Video pills (`api36-1.0.65-life-lists.png`). Each tap below was an `adb shell input tap`, a touch, and each screenshot was taken one second after it: **Photo on** showed the green selected look at once, with the list filtered to "115 species with a photo" (`api36-1.0.65-photo-on-after-tap.png`); **Photo off** showed the plain white look at once, back to 149 (`api36-1.0.65-photo-off-after-tap.png`); **Include Escapees on** showed the green switch with its frame plain (`api36-1.0.65-escapees-on-after-tap.png`). No gray after any tap.
     - One SnowRaven process throughout (pid 4489, started 18:30:56 PST, the only start this session in the events log; the older starts listed there date from the snapshot's October session), no `FATAL EXCEPTION` or ANR for the app, and no SnowRaven line in the crash buffer. The crash buffer did hold one abort, from the emulator's own Bluetooth stack (`com.google.android.bluetooth`, "Hardware Error Event with code 0x42", 18:33:13 PST), which is a system component of the virtual device and not this app. Afterwards the app was uninstalled, the two pushed files removed, and the emulator stopped (`emu kill`).
     - **WebView:** `com.google.android.webview` `versionName` 133.0.6943.137: **WebView 133, unchanged since the last measurement.**
   - **Attach:** `ANDROID_DEVICE_CHECK=partial ANDROID_CHECKED_SHA256=7190fde1...3d92 SNOWRAVEN_ANDROID_SIGNER_SHA256=42a3576e...996a scripts/android/attach.sh <signed apk>` **exit 0** at 02:34 UTC. **Decision: Partial on API 36 emulator evidence, under the standing decision (CLAUDE.md, Versioning: the user owns no Android device).** Checks: signer equals the keystore's certificate, byte-identical to the checked file, `com.dtgibson.snowraven` 1.0.65 (1000065). Uploaded to v1.0.65 as **`SnowRaven_1.0.65_android_universal.apk`** and downloaded back: `ASSET_SHA256=7190fde1ca774a1b797c2d18f2d71e073d915c6b2e9c0130a6ddd17eb76c3d92`, `SIGNER_SHA256=42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a`.
8. **F-Droid, three public reads** (2026-11-08 02:11 UTC, after the tag): fdroiddata `master` has `CurrentVersion` 1.0.63 / 10000634 and `Builds` entries for 1.0.53, 1.0.55, 1.0.56, 1.0.60, 1.0.61 and 1.0.63, none for 1.0.64 or 1.0.65; its newest recipe commit is still `69401fd9` ("bot: Update SnowRaven to 10000634", 2026-11-07 09:03 UTC). f-droid.org publishes 1.0.61, 1.0.60 and 1.0.59 (`suggestedVersionCode` 10000614). The logs for 10000631, 10000632, 10000634, 10000641, 10000642, 10000644, 10000651, 10000652 and 10000654 all answer 404 (not attempted). **Nothing was sent to fdroiddata**: this tag changes no toolchain pin (`scripts/android/toolchain.env` untouched) and no recipe build step; the in-repo recipe moved only versions, codes and commit lines.
9. **App Store Connect, read only** (metadata key, GET only, 02:15 UTC; nothing written): 31 version records; **1.0.64 is `WAITING_FOR_REVIEW`** on its own record `ab6360bc-24b3-4816-bf84-88967df06507` (`AFTER_APPROVAL`) on build 1.0.64.1 (`81d91d5e`, `VALID`), submission `740963c6-7ca7-495b-96d2-d6fd769876b3` sent 2026-11-08 02:10:03 UTC; every other record `READY_FOR_SALE`; the four newest trains are 1.0.64 to 1.0.61, every build `VALID`. **No 1.0.65 record, build or train exists.** So at the App Store step, unless 1.0.64 is approved first, the part-one plan's three options apply (roll 1.0.64 into 1.0.65, defer 1.0.65 behind 1.0.64's review, or TestFlight-only for 1.0.65 by the user's direction), and the choice is the user's.

### State at the hand-back (2026-11-08, about 02:40 UTC)

| Leg | State |
|---|---|
| Commits on this branch, not on `origin/main` | `b7ac52a1`, `ebb9fb8e`, `347ac66b`, `e401732b`, merge `375b0cce`, release `d7444330`, recipe `761fc2f3`, and this record |
| Tag | `v1.0.65` (tag object `45e4b36e`) on `d7444330`, pushed; `main` not pushed |
| `origin/main` | moved during this invocation to `771a278f` (snowraven-e7's `1d143bf5` "docs(release): 1.0.64 ledger entries" and `771a278f` "chore: context update after exotic-provenance-reuse"); this branch is 2 behind and 8 ahead. Those two commits touch only record and rule files (`RELEASE_LEDGER.md`, `CLAUDE.md`, `DECISIONS.md`, `ROADMAP.md`, `PRODUCT_CONTEXT.md`, three `.claude/rules/` files and their run folder), none of this branch's files, so a merge before pushing `main` should apply cleanly |
| Windows and Android CI | green on the tag: `42437403549`, `42437403550` |
| Mac, Windows, `latest.json` | live: release `437986036`, Latest; notarization `6fba9921` Accepted; Gatekeeper checks pass; both updater signatures verify |
| Android GitHub APK | attached, signer `42a3576e...996a`, SHA-256 `7190fde1...3d92`; device check Partial (emulator), the fix seen working on the emulator's WebView |
| F-Droid | nothing sent; 1.0.65 included and this tag not yet built |
| Website | not yet: Pages deploys on a push to `main`, so the live pill and footer still read 1.0.64 until then |
| iOS and the App Store | held behind 1.0.64 (in review since 02:10 UTC); nothing built, stamped or uploaded |

### Draft ledger sentences for 1.0.65 (for `RELEASE_LEDGER.md`, not yet written there)

The Chronicler and the App Store leg finish these. The 1.0.63 corrections the part-one plan listed (1.0.63 approved and live; 1.0.62 superseded on F-Droid by 1.0.63) are already carried by snowraven-e7's 1.0.64 entries on `origin/main` (`1d143bf5`), so nothing more is owed for them unless the 1.0.63 entries are to get in-place "Corrected" notes.

**App Store (iOS), `### 1.0.65 SHIP (2026-11-07)`:**

> **ENTRY FROM THE 1.0.65 SHIP (2026-11-07): pending.** The desktop and Android legs shipped on 2026-11-08 at 02:30 and 02:34 UTC. The TestFlight upload of 1.0.65 build 1 is held behind 1.0.64, which is `WAITING_FOR_REVIEW` on record `ab6360bc-24b3-4816-bf84-88967df06507` (submission `740963c6-7ca7-495b-96d2-d6fd769876b3`, sent 02:10:03 UTC); read at 02:15 UTC, no 1.0.65 record, build or train exists. The record decision follows the sign-off plan: if 1.0.64 is approved before the App Store step, 1.0.65 gets its own record; if it is still in review, the user chooses between rolling 1.0.64 into 1.0.65, deferring 1.0.65 behind 1.0.64's review, or TestFlight-only for 1.0.65, and this entry names that choice with both versions and the record and submission ids. The approved What's New is the text in `pipeline/life-list-filter-toggle-state/held-copy.md` (372 characters, the same as the F-Droid changelog).

**Android, `### 1.0.65 SHIP (2026-11-07)`:**

> **ENTRY FROM THE 1.0.65 SHIP (2026-11-07): APK attached; F-Droid included and this tag not yet built.** `SnowRaven_1.0.65_android_universal.apk` is on the v1.0.65 GitHub release (`437986036`; SHA-256 `7190fde1ca774a1b797c2d18f2d71e073d915c6b2e9c0130a6ddd17eb76c3d92`, downloaded back byte-identical by `attach.sh`), signed from the CI artifact of the tag's run `42437403550`; its signer certificate SHA-256 is `42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a`, the same as 1.0.53 to 1.0.64. **Its device check is Partial on API 36 emulator evidence, under the standing decision (CLAUDE.md, Versioning: the user owns no Android device), as at 1.0.53 to 1.0.64.** The exact attached bytes installed fresh on the local API 36 emulator and opened to the Welcome screen with one window and no crash; with the synthetic demo export imported, Life Lists drew 149 species, and tapping Photo on and off and Include Escapees on showed each new state at once, green or plain, with no gray look left behind, which is what this release fixes (`pipeline/life-list-filter-toggle-state/evidence/ship/`). F-Droid: **included and this tag not yet built**, read after the tag (2026-11-08 02:11 UTC): f-droid.org publishes 1.0.61, 1.0.60 and 1.0.59 (`suggestedVersionCode` 10000614), fdroiddata `master` has `CurrentVersion` 1.0.63 (newest recipe commit still `69401fd9`) and no 1.0.64 or 1.0.65 entry, and the logs for 10000631/2/4, 10000641/2/4 and 10000651/2/4 answer 404 (not attempted), so 1.0.63 and 1.0.64 are also still included and this tag not yet built; because the bot adds only the newest tag it finds, 1.0.64 is likely to end superseded on F-Droid by 1.0.65, which costs nothing. This tag changes no toolchain pin and no recipe build step, so nothing was sent to fdroiddata and the update bot is expected to add the entries on its own; the in-repo recipe names 1.0.65 (codes 10000651, 10000652 and 10000654) and the tag's full commit `d7444330fa4c4497511057239293419702b16cee` (`761fc2f3`), and the three per-processor changelogs are in the tag. WebView 133, unchanged since the last measurement.

### What remains for part two B (the orchestrator)

1. Merge `origin/main` (now `771a278f`) into this branch, then push `main` (a fast-forward from `origin/main` once merged). That starts Pipeline (the run of record for the shipped tree; a failure on a timing-ratio test alone is re-run once, as at 1.0.64) and Pages (then check the live site shows `v1.0.65` in the pill and footer).
2. iOS, per the skill: move any leftover `src-tauri/gen/apple/build/snowraven_iOS.xcarchive` aside (at 02:40 UTC this worktree had none, and no `src-tauri/target` either, so the build compiles from cold); recreate the three `/tmp/xcshim` shims (`xcodebuild`, `xcrun`, `swift`); export `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`; confirm `xcrun --sdk iphoneos --show-sdk-version` prints 27.1; run the widget Swift tests (`snowraven_widgetsTests`); `tauri ios build --export-method app-store-connect --build-number 1` outside the Bash sandbox in `zsh -lc` with `APPLE_API_KEY`, `APPLE_API_ISSUER` and `APPLE_API_KEY_PATH` mapped from the login shell and `/tmp/xcshim` first on `PATH` (this worktree's `src-tauri/target` is cold, so the swift shim matters); confirm the fresh archive reads 1.0.65 (1.0.65.1) and the swift-rs libraries report platform 2; ad-hoc sign the archived appex with `snowraven_widgets.entitlements`; `xcodebuild -exportArchive` with `~/.tauri/snowraven-ios-export-options.plist`; check `DistributionSummary.plist` (both bundle ids, the App Group, the three iCloud keys, `Production`) and opaque icons; then, with `DEVELOPER_DIR` exported in that shell, `xcrun altool --validate-app -f <ipa> -t ios --apiKey $APPLE_API_KEY_ID --apiIssuer $APPLE_API_ISSUER_ID` and, on `VERIFY SUCCEEDED`, the same with `--upload-app`; commit the two stamped Info.plist files as `chore(ios): stamp iOS 1.0.65 build 1` (with `iosSceneManifest` and `iosWidgetManifest` green first) and push.
3. TestFlight read-back (1.0.65.1 `VALID`), the user's own iPhone check of that exact build (part one, step 13), then the App Store record decision above.
4. `RELEASE_LEDGER.md`: the two 1.0.65 entries above, completed.
