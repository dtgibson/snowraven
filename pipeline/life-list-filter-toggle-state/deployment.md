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

| Commit | What |
|---|---|
| `a7f171f1` | `fix(ui): filter pills, segment buttons and switches show their state on tap`: `globals.css`, `controlRegisters.test.ts`, `ToggleSwitch.test.tsx`, `mapFabCascade.test.ts`, the new `test/cssSpecificity.ts`, and this run's `bug-brief.md`, `pr-description.md`, `decisions.md`, `held-copy.md` and `evidence/`. The three changed guard files were re-run on the committed tree first: 3 files, 43 tests, all green. |
| `0a54fae1` | `docs(pipeline): held copy moves to 1.0.65` |
| `7cc7b618` | `chore(pipeline): the 1.0.65 bump as a re-runnable script` |
| (this record) | `docs(pipeline): 1.0.65 deployment record, part one` |

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

**Dry run** on scratch copies of HEAD (`git archive`, with `frontend/node_modules` linked to this worktree's), in `/private/tmp/claude-502/-Users-developer-devwork-snowraven/b5298d98-9927-4089-a260-936164ed3379/scratchpad/`. A scratch-only simulator stood in for the other session's 1.0.64 bump (the same six files, placeholder copy, recipe commit lines left on 1.0.63's `3281ba8f`).

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

`git log origin/main..HEAD` on this branch, before this record's commit: `a7f171f1` (this build's own: the fix, its guards and its records), `0a54fae1` and `7cc7b618` (record-keeping: the held copy and the bump script). This record's commit is record-keeping too. After the merge, the 1.0.64 session's commits are already on `origin`, so they are not cargo. No other build's app-behavior commit rides along.

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
