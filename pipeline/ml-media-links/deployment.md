# Deployment plan: ml-media-links (1.0.54)

Written by The Deployer at Phase A (2026-10-08). Phase A reconciled, re-verified and prepared; it pushed, tagged, bumped and uploaded nothing. Phase B runs only after the user's live look at the built app and their answer at the production gate.

## 1. Where Phase A left things

- **Local `main` is 1 commit ahead of `origin/main`, 0 behind**: `48633448 feat(named-birds): numbered Macaulay Library links in a named bird's media section`, rebased onto `origin/main` at `cfff12a6` (1.0.53 plus the Android/F-Droid follow-ups). Not pushed.
- **Reconciliation.** One conflict, in `docs/HELP.md`'s "Media of a named bird" paragraph: `origin/main` had added "On Android every tile shows that link instead of a player, and the media opens in your browser."; this build had added two sentences about the numbered list. Both kept, word for word (the merged paragraph minus the Android sentence is byte-identical to this build's version). `.claude/rules/security.md` auto-merged (`origin/main`'s Android entries plus this build's `NamedBirdMedia*.tsx`), and the Auditor's F1 line `"frontend/src/lib/mediaEmbed*.ts"` was added beside it. `globals.css` auto-merged; `.sr-mli-link:focus-visible` (line 4314) still sits after the global `[tabindex]:focus-visible` (line 3882), and `origin/main`'s additions there are `.sr-android-app` rules with no focus rule. `website/tools/verify/run.mjs`, `NamedBirdMedia.tsx` and `mediaEmbed.ts` had no upstream change.
- **Re-verification on the combined tree** (machine load was high throughout, 19 to 87 on 8 cores, from processes outside this repo; nothing else of this repo was compiling):

| Check | Result |
|---|---|
| `npm ci` (frontend) | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 (the standing large-chunk warning) |
| `npx vitest run` (full) | 458 files passed, 5 skipped (463); 9,850 tests passed, 6 skipped (9,856); 69 s |
| Named guards, verbose (`tauriCsp`, `tauriHttpScope`, `mediaEmbed`, `NamedBirdMediaLinks`, `namedBirdMediaLinksHelpClaims`, `NamedBirdMedia`, `newTabLinkDispatch`, `tabOrderCoverage`, `entryChunk`) | 9 files, 263 tests passed |
| `pytest tests/` (backend) | 2,061 passed |
| Real-engine gate, `npm run verify -- ../../frontend/dist` | 8 of 8 harnesses green, 339 s |
| `verify-named-bird-media-links.mjs` alone | green: 48 of 48 configurations per bird per engine, all 8 focus readings per engine (1px offset, no halo, 3px accent ring, accent fill) |
| same, `--expect-broken` | HARNESS DISCRIMINATES: 855 checks red (reflow, targets and focus ring) |

## 2. Parallel ships and store state (Phase A, 2026-10-08)

- **Next version: 1.0.54** (patch), Android version code `1000054`. `origin` tags end at `v1.0.53`; the latest GitHub release is `v1.0.53` (2026-10-06). No version string or tag beyond 1.0.53 exists anywhere.
- **Other work in flight, read only:**
  - `snowraven-species-code-search` (`weft/species-code-search`): at Stage 4 (The Designer), level with `origin/main`, only its untracked `pipeline/species-code-search/`. Not shipping.
  - `.claude/worktrees/android-release` (locked): at `cfff12a6`, clean, but its Claude session (pid 5334) is still running. Its recent commits are F-Droid merge-request follow-ups. It is not mid-version-bump, but **it is actively handling MR 51451**, which Phase B also has to update (leg 9). Ask the user before touching the request, so two sessions do not push to the fork branch at once.
- **CI on `origin/main`:** the Pipeline run on `cfff12a6` is green. The run on `50b0fc68` failed once in `verify-plan-readout.mjs` (WebKit, no tide, 320px at 200%, a 1px movement), which no change in that commit touched, and passed on the next commit. Treat a repeat on the release commits as that known intermittent check (captured to the idea inbox), not as this build: re-run the job and say so in the record.
- **App Store (live ASC query, metadata key, read only):** record `ecbac251` (1.0.53) is `READY_FOR_SALE` on build 1.0.53.1 (submission `b62a9121` COMPLETE), and the public store serves 1.0.53 (released 2026-10-06). Nothing is in review and nothing is deferred. Newest records: 1.0.53, 1.0.51, 1.0.50, 1.0.47, 1.0.45, 1.0.40, 1.0.38, 1.0.36, 1.0.35, 1.0.34, all `READY_FOR_SALE`. Builds 1.0.46.1 to 1.0.53.1 are all VALID; the versions without records of their own (1.0.46, 1.0.48, 1.0.49, 1.0.52) are each written in CLAUDE.md as rollups. **No unaccounted gap between 1.0.13 and 1.0.53.** Because 1.0.53 is released, its train is closed: an iOS build of this work needs the 1.0.54 bump, and 1.0.54 gets its own new record with no rollup or deferral available.
- **F-Droid:** MR 51451 is open and mergeable, labels `New App` and `waiting-on-response`, head pipeline green (2927559505, the per-ABI split); the last note is the user's reply of 2026-10-08 20:05. `f-droid.org/packages/com.dtgibson.snowraven/` is 404 (not yet included). The GitLab token at `~/.tauri/gitlab-fdroid.token` is present and expires about 2026-10-13.

## 3. Blockers and asks before Phase B starts

1. **The login keychain reads as locked** (`security show-keychain-info` says "User interaction is not allowed"). Every signing step (`release.sh`'s codesign and notarization, the iOS export) fails until the user runs `security unlock-keychain ~/Library/Keychains/login.keychain-db` in their own terminal on this Mac. Re-check right before leg 4.
2. **The user's yes on the held copy** in `whats-new.md`: (a) the App Store What's New and (b) the F-Droid changelog. (b) has to be in the bump commit, before the tag. **Resolved 2026-10-09: both approved verbatim (D4).**
3. **The Android device check.** The user owns no Android device. 1.0.53 attached its APK on emulator evidence by their written decision (Partial). Ask whether 1.0.54 attaches on the same basis; record the answer before running `attach.sh`. **Resolved 2026-10-09: emulator only, the same basis as 1.0.53 (D4).**
4. **MR 51451 coordination** with the running android-release session (section 2). **Resolved 2026-10-09: leg 9 is not run by this build; the request is left to that session (D4).**
5. **Screenshots: no recapture needed.** No App Store shot (iPhone or iPad: Map Explorer, Statistics, Weather, Calendar, Species Detail, Breeding Codes), no F-Droid shot (Map Explorer, Statistics, Calendar, Species Detail, Breeding Codes, Multimedia) and no website shot shows a named bird's media section. The website's `named-birds.webp` shows the Named Birds list with every card closed, and Species Detail is unchanged by this build.

## 4. The cargo the push will carry

`git log origin/main..main` at Phase A: one commit, this build's own (`48633448`). Phase B adds only this release's own commits: the version bump, the post-tag recipe hash, the iOS stamp, and record commits. No other build's app-behavior commit rides along. Re-run `git log origin/main..main` immediately before the push; anything new that is not record-keeping gets named at the gate.

## 5. Phase B legs, in order

Run each from `/Users/developer/devwork/snowraven` on `main`. One action per beat.

0. **Re-check before anything moves.** `git fetch origin`; `main` still 1 ahead / 0 behind (rebase again and re-run the suites if `origin/main` moved); no new `v1.0.54` tag, release, TestFlight build or ASC record from another session; keychain unlocked; `gh auth status` green.
1. **Six-file version bump to 1.0.54, one commit** (`chore(release): 1.0.54`):
   - `frontend/package.json` and the two version fields in `frontend/package-lock.json`;
   - `src-tauri/tauri.conf.json`: `version` 1.0.54 and `bundle.android.versionCode` 1000054 (kept on one line);
   - `CHANGELOG.md`: the entry in section 6;
   - `website/index.html`: the version pill's text `v1.0.54`, its `aria-label="Version 1.0.54"`, and the footer `SnowRaven v1.0.54` (the version-stamp step; no other website change);
   - `fastlane/metadata/android/en-US/changelogs/10000541.txt`, `10000542.txt` and `10000544.txt`: the approved text (b), identical in all three, none under `1000054` (`b682bc4c`, 2026-10-09);
   - `pipeline/android-release/fdroid/com.dtgibson.snowraven.yml`: all three `versionName: 1.0.54`, codes `10000541`, `10000542`, `10000544`, `CurrentVersion: 1.0.54`, `CurrentVersionCode: 10000544`. The three `commit:` lines keep the 1.0.53 hash for now (a commit cannot carry its own hash; the guard checks shape and agreement only).
   Then `npm run build`, `npx vitest run` (full: published-claims guards live in other features' suites), and the guards `icloudKeysPublishedClaims`, `androidVersionSource`, `fdroidRecipe`, `fastlaneMetadata` verbosely.
2. **Push `main`** (`git -c credential.helper='!gh auth git-credential' push origin main` if the keychain helper fails). The Pages workflow redeploys the website for the version pill.
3. **Tag and push `v1.0.54`** on the bump commit. This starts Windows CI and Android CI, and it is the commit F-Droid builds. Then set the recipe's three `commit:` lines to the full `git rev-parse v1.0.54^{commit}` in a follow-up commit (`fix(fdroid): the recipe names v1.0.54's commit`) and push it.
4. **Wait for both tag runs green, pinned to the tag's commit:** `gh run list --workflow windows-build.yml --commit <tag sha>` and `gh run list --workflow android-build.yml --commit <tag sha>`. If the iOS stamp push cancels the tag commit's `Pipeline` run, verify the successor run instead and say so.
5. **Desktop: `CI=true zsh -lc ./release.sh`** (background it and monitor). It builds, signs and notarizes the universal macOS app, fetches and signs the Windows installer from the pinned run, publishes the `v1.0.54` GitHub release, and writes `latest.json`. Quit any `desktop:dev` watcher first (the relink touch relaunches it). Afterwards, download the DMG from the release and check `codesign --verify`, `stapler validate` and `spctl ... context:primary-signature` (accepted, Notarized Developer ID), and that `latest.json` carries `darwin-aarch64`, `darwin-x86_64` and `windows-x86_64` at 1.0.54.
6. **Android, in the build shell from the release skill** (`JAVA_HOME`, `ANDROID_HOME`, `NDK_HOME`, `PATH` exports): `scripts/android/preflight.sh` (downloads the tag-pinned artifact, prints `UNSIGNED_APK=`), then `SNOWRAVEN_ANDROID_SIGNER_SHA256=42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a scripts/android/sign.sh <unsigned>` (prints `SIGNED_APK=` and the digest, which must equal the recorded one). Install those signed bytes on the local API 36 emulator only (`adb -s emulator-5554`, `-gpu host`), open to the first usable screen with a screenshot, open a named bird with media and screenshot the new list, and read the image's WebView version (re-measure if its major is newer than 133). Then the user's device-check decision (section 3, item 3), then `ANDROID_DEVICE_CHECK=<passed|partial> ANDROID_CHECKED_SHA256=<sha of the checked file> SNOWRAVEN_ANDROID_SIGNER_SHA256=<digest> scripts/android/attach.sh <signed.apk>`.
7. **iOS TestFlight, build 1.0.54.1**, per the release skill's iOS section, outside the Bash sandbox: move any existing `src-tauri/gen/apple/build/snowraven_iOS.xcarchive` aside; recreate the three `/tmp/xcshim` shims (`xcodebuild`, `xcrun`, `swift`); export `DEVELOPER_DIR` and Tauri's three `APPLE_API_*` names; run the widget Swift tests on an iOS 17+ simulator; `tauri ios build --export-method app-store-connect --build-number 1` (its own export failing on cloud signing is expected); confirm the fresh archive's `CFBundleVersion`; ad-hoc sign the archived `snowraven_widgets.appex` with its entitlements; `xcodebuild -exportArchive` with `~/.tauri/snowraven-ios-export-options.plist`; check `DistributionSummary.plist` (both bundle ids, the App Group, the three iCloud keys); `altool --validate-app` then `--upload-app`; wait for VALID. Commit the stamp (`chore(ios): stamp iOS 1.0.54 build 1`) and push.
8. **The user's own device check of TestFlight build 1.0.54.1** (they install and open it; agents never touch a device). Iterate as 1.0.54 build N+1 if they find something, since the 1.0.54 train stays open until a record ships.
9. **F-Droid MR 51451**, after coordinating (section 3, item 4): replace the fork branch's three `Builds` entries with 1.0.54's (`versionName`, codes `10000541/2/4`, the tag's full commit hash), move `CurrentVersion` and `CurrentVersionCode`, make the branch file byte-identical to the repository's recipe, then reply asking a maintainer to trigger the pipeline. Before 2026-10-13, while the token is valid.
10. **App Store record 1.0.54**, only after the user's device check passes (not part of this sign-off; Phase B stops at TestFlight VALID, D4): create the new version record on build 1.0.54.1 (metadata key `QJA25M7XHM`), write the approved What's New (a) byte for byte and read it back, set the copyright and restore the promotional text from `appstore/LISTING.md` if it arrives empty (it has arrived empty six times), read back every listing field against `appstore/LISTING.md`, confirm the App Review notes are byte-identical to `appstore/REVIEW_NOTES.md`, confirm both screenshot sets carried over (twelve checksums against `appstore/screenshots/`, in order), answer the age-rating declaration if the new editable app info asks, then submit via `reviewSubmissions` (`AFTER_APPROVAL`, no phased release). Re-query the records and builds and write the 1.0.54 entry for CLAUDE.md's reconciliation list.
11. **Records.** The deployment record (gitignored `deployment-record.md`) with every leg's evidence, the Android record line (APK asset and signer digest, F-Droid state in one of the five words), then The Chronicler, only once every leg above is finished.

## 6. CHANGELOG entry, prepared (written at leg 1)

```markdown
## [1.0.54] - <ship date>

### Added
- **Numbered Macaulay Library links for each named bird's media.** On the Named Birds tab, each bird's "Media of {name}" section now opens with a compact list of numbered links, one for every photo, audio recording, and video of that bird, grouped Photos, Audio, Video and numbered newest first. Each number opens that item's page on the Macaulay Library, the same page as its tile's own link, in your browser (a new tab on web/Pi). The list covers every item, including the ones behind **Show more**, and stays the same whether the players are working, blocked by the Cornell Lab's bot check, turned off in Settings, or offline, so every item can still be reached while the players cannot load. On a phone-width screen each number is a full-size tap target.
- Help's Named Birds section describes the new list.

### Internal
- `mediaItemLinkGroups` in `lib/mediaEmbed.ts` groups a bird's items by format, reusing the tiles' own catalog-number gate, and the list renders through `OutboundLink`, so a click opens the system browser in the desktop and mobile apps. New component, library and Help-claims suites, and a real-engine check (`website/tools/verify/verify-named-bird-media-links.mjs`) that measures the list across widths and text sizes and its focus ring after a real Tab, in Chromium and WebKit. `.claude/rules/security.md` now loads on `NamedBirdMedia*.tsx` and `lib/mediaEmbed*.ts`.
```

No network change on any target: no third-party request, no new endpoint or host, and no request moved between components. `tauri.conf.json`'s policy, the HTTP permit and `PRIVACY_POLICY.md` are untouched.
