# Deployment record: life-list-region-filter (1.0.70)

## Part one: preparation (2026-11-10, about 16:20 to 17:00 UTC; 08:20 to 09:00 PST)

Run by The Deployer (Feature lane, the ship stage), on `main` in the main checkout. Two local commits were made (the feature, then the release); nothing was pushed, tagged, released, built for a store or uploaded. GitHub, App Store Connect (GET only, metadata key) and F-Droid were only read. Nothing was sent to eBird with anyone's key, and no device or emulator was touched (no `adb` or `simctl` call). The production sign-off is the next gate, and part two runs on its recorded answer.

### Preconditions

- **The Tester PASSED** (`qa-report.md`, gitignored, on disk): Tier 2 full weave, 32 Pass, 2 Partial, 0 Fail after three attempts. QA-30 (the version bump) closes here; QA-33's axe and screen-reader run stays the user's.
- **The Auditor PASSED WITH NOTES** (`security-report.md`, gitignored, on disk): 0 Critical, 0 High, 0 Medium. L1, L2 and I3 resolved; L3 and I2 accepted as follow-ups; I1 accepted (D-08). No finding open.
- **The user's approvals, recorded firsthand at a gate on 2026-11-10 (D-11):** the live look passed ("It looks right"); `held-copy.md` sections 1 and 2 approved as written; section 3 approved, with the new frame shown to the user before it goes live.
- No staging environment, as at every SnowRaven ship, so the production sign-off is the one gate. No key, environment variable, host or provider setting is needed, so there is no external setup to offer.

### Repository state (`git fetch origin`, 16:22 UTC)

- `origin/main` is `a767ce82`, equal to local `main` before this stage's commits: nothing behind. Only `origin/main` exists remotely.
- Newest tag `v1.0.69` (tag object `74bedc61`, peeled to `bdfef6a4`), locally and on origin; no `v1.0.70` anywhere. Release v1.0.69 is Latest; no draft releases.
- The other worktree (`.claude/worktrees/life-list-filter-toggle-state`, branch at `481b9ee3`) was read by `git worktree list` and `git log` only, never entered: no commit ahead of `main`. No ship is in flight there, and no 1.0.70 train or record exists in App Store Connect (below).

### App Store Connect (GET only, metadata key, 16:23:47 UTC; `evidence/ship/asc-read-1.0.70-prep.txt`)

- **1.0.69 is still `WAITING_FOR_REVIEW`**: record `ec491213-6cf7-4dd5-9d8b-51bdcfeb420c` (`AFTER_APPROVAL`, no phased release) on build 1.0.69.1 `f9d5df4a`, submission `25b4b840-9414-4633-87b4-16f4faf4a674` `WAITING_FOR_REVIEW` since 2026-11-09 20:12:44 UTC, its one item `READY_FOR_REVIEW`. Not in review, not approved. Its en-US localization `e06ffaab` holds the 369-character What's New and the 137-character promotional text.
- 33 version records: 1.0.69 waiting, 32 `READY_FOR_SALE` (1.0.68 on `280db18b` the live one). 11 review submissions: this one waiting, 10 `COMPLETE`.
- 93 TestFlight trains and 101 builds, every build `VALID`. No 1.0.70 train or record.
- From 1.0.13 on, 57 trains, 25 without a record of their own, the same 25 the 1.0.69 entry accounts for. **No unaccounted gap.**
- Two app infos: `285bfbfe` live and `76d4c9e7` (with the 1.0.69 record), each `FOUR_PLUS`.

**The disposition for 1.0.70, decided by 1.0.69's state when re-read at the App Store step** (after the user's iPhone check of TestFlight 1.0.70 (1)), the three branches of the 1.0.69 ship:
- **1.0.69 still `WAITING_FOR_REVIEW` (the case now): the house rollup, 1.0.69 into 1.0.70.** Withdraw it (`DELETE /v1/appStoreVersionSubmissions/ec491213...`, record to `DEVELOPER_REJECTED`), retarget the same record to `versionString` 1.0.70, repoint it at build 1.0.70.1, write the 591-character rollup What's New (`held/whats-new-1.0.70-rollup.txt`: 1.0.69's approved line, a blank line, 1.0.70's approved line; SHA-256 of the text `61102942...7820`), read every listing field back against `appstore/LISTING.md` (the description now changes: it is PATCHed to the new 3,471-character block and read back) and the review notes against `appstore/REVIEW_NOTES.md`, confirm the age rating on the editable app info, run `asc-screens.mjs readback` to `ALL MATCH`, then submit through `reviewSubmissions`. Ledger: 1.0.69 rolled up into 1.0.70 (VALID build 1.0.69.1, record `ec491213`, withdrawn submission `25b4b840`, the new submission id).
- **1.0.69 approved or released first:** 1.0.70 gets its own new record on build 1.0.70.1, What's New 1.0.70's line alone (`held/whats-new-1.0.70.txt`, 220 characters, SHA-256 `97e25fe1...f6d4`), and the description PATCHed to the new block.
- **1.0.69 in review (`IN_REVIEW`):** leave the review undisturbed; 1.0.70 ends on TestFlight as a deferral written in the ledger (the 1.0.25 precedent), carried by the next record.

Mac, Windows and the Android APK for 1.0.69 are already live; only the App Store leg rolls up.

### F-Droid (public reads, 16:24 UTC; `evidence/ship/fdroid-read-1.0.70-prep.txt`)

- f-droid.org publishes 1.0.61, 1.0.60 and 1.0.59 (`suggestedVersionCode` 10000614).
- fdroiddata `master`: `CurrentVersion` 1.0.69 / 10000694, `Builds` for 1.0.53, 1.0.55, 1.0.56, 1.0.60, 1.0.61, 1.0.68 and 1.0.69. Newest recipe commit `c0ad7c8f` "bot: Update SnowRaven to 10000694" (05:25 UTC today).
- Build logs: 10000681, 10000682 and 10000684 each end `Successfully built ... from 93c10733` (1.0.68's tag commit); 10000691/2/4 answer 404 (not attempted).
- **States now:** 1.0.68 **included and built, not yet published**; 1.0.69 **included and this tag not yet built**. Both corrections belong in the ledger at part two's read. A v1.0.70 tag pushed before the bot's next run most likely leaves 1.0.69 superseded on F-Droid by 1.0.70, which costs nothing.
- **Nothing goes to fdroiddata at 1.0.70:** `scripts/android/toolchain.env` is unchanged and the recipe diff moves only versions and codes.

### CI on `main`, and the timing row (`evidence/ship/timing-probe-1.0.70-prep.txt`)

- The latest Pipeline run on `main`, `42693053650` on `a767ce82`, failed on the one known timing row and nothing else: `lifeListsLinearity.test.ts` "pass 1 (first sightings), every row its own species", 22.40 against 20. Backend green. Every release since 1.0.64 has shipped under that acceptance (DECISIONS.md v1.0.64, D-17), whose reversal is "a failure in a test the release touches, or any non-timing failure".
- **This release touches that file and that pass.** It adds the region rows to `lifeListsLinearity.test.ts` and moves pass 1's record construction into `firstSightingRecord` (`lib/lifeLists.ts`). Measured here, interleaved through the file's own quotient procedure: pass 1 at HEAD read 10.42 to 12.20, pass 1 in this tree 10.93 to 12.35, so the refactor does not move pass 1.
- **The new region rows read 10.43 to 15.03 here against limits of 20 (pass 2R and the 20-county legs) and 25.5 (pass 1R on the every-row-a-pair legs).** CI reads pass 1 at about twice this Mac (22.4 to 26.1 against about 11), so pass 2R on all four legs and pass 1R on at least two would most likely read over their limits in the run of record. That would be a new failure in rows this release adds, which is D-17's reversal condition. This is a decision for the sign-off, not one this stage can settle.

### Rig readiness (read only, 16:45 UTC)

| Check | Result |
|---|---|
| Login keychain | `no-timeout`: unlocked (a reboot before part two would lock it; then the user runs `security unlock-keychain ~/Library/Keychains/login.keychain-db` in their own terminal) |
| `gh` | signed in as `dtgibson` (`repo`, `workflow`, `gist`, `read:org`) |
| Login shell | Node v24.18.0 (`.nvmrc` 24); rustc 1.96.1; `APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID`, `APPLE_API_KEY_PATH` and `APPLE_SIGNING_IDENTITY` set |
| Secrets (existence and mode only) | `~/.tauri/snowraven-signing.key`, the Android keystore and its properties file, all 600; the export options plist and the Developer ID profile present |
| Xcode | 27.2 (27B52), iOS SDK 27.2; `xcodebuild -checkFirstLaunchStatus` exit 0 |
| Leftover iOS archive | `src-tauri/gen/apple/build/snowraven_iOS.xcarchive` is **1.0.69.1**: part two moves it aside first |
| Android | `scripts/android/toolchain.env` unchanged against HEAD |

### The version set (six files, all written)

| File | Change |
|---|---|
| `frontend/package.json`, `frontend/package-lock.json` (two lines) | 1.0.69 to 1.0.70 |
| `src-tauri/tauri.conf.json` | `version` 1.0.70; `bundle.android.versionCode` 1000070 |
| `CHANGELOG.md` | `## [1.0.70] - 2026-11-10`: one Added bullet (the held draft, which says "remembered" and not "on this device") and six Internal bullets |
| `website/index.html` | the version pill text, its `aria-label`, and the footer line |
| `fastlane/metadata/android/en-US/changelogs/10000701.txt`, `10000702.txt`, `10000704.txt` | the approved 220-character line plus a newline, 221 bytes each (SHA-256 `3963121e...85ec`); nothing under the unsplit code |
| `pipeline/android-release/fdroid/com.dtgibson.snowraven.yml` | three `Builds` entries at 1.0.70 (10000701, 10000702, 10000704); `CurrentVersion` 1.0.70, `CurrentVersionCode` 10000704. The three `commit:` lines stay on 1.0.69's `bdfef6a424014dbfe34d55120f3880e7e5bf7d3e` and move to `v1.0.70^{commit}` after the tag, as at 1.0.69 (`bc5e9a93`). |

The iOS plists stay at 1.0.69 / 1.0.69.1 until `tauri ios build` stamps them in part two (`iosSceneManifest.test.ts`'s "never leads" rule).

### The approved copy (D-11)

- `README.md` `### Life Lists`, the website's Life Lists row (wrapped as the file wraps it) and the `appstore/LISTING.md` bullet (lowercase "lists" after the colon) now read "Lists every species you have recorded along with its first checklist and place, everywhere or in one country, state, or county you have birded, and turns into a photo, audio, or video life list, or any combination of them." The listing's description heading reads 3,471 / 4,000. `lifeListsSurfacesPublishedClaims.test.ts` pins the new sentence (a `REGION_CLAUSE` constant in its `LEAD`). Nothing else on those surfaces changed.
- **The website frame.** `website/assets/shots/life-lists.webp` is recaptured from the synthetic demo data (`gen-demo-data.mjs`, byte-identical to the tracked `website/demo/` files; 368 synthetic checklists, the demo-dataset guard passed) on a backend started for this on `127.0.0.1:1622` with `SR_DATA_DIR` on a scratch copy and stopped afterwards; the 1621 preview was left running. The committed tools have no Life Lists job, so a scratch script repeated the 1.0.63 one (`pipeline/life-lists-tab/held/capture-tools.diff`) through the committed `capture-lib.mjs`: Statistics first in the same page until "Exotic status checked across", then Life Lists, 1600x900 at scale 2, `assertMarksInFrame` passing, then `process-img.mjs`'s settings (1600px, WebP quality 84). The Region control reads Everywhere and Include Exotics is on (its default since 1.0.69, so ROADMAP's 1.0.69 note that the frame shows both switches off is closed by this frame). Against the committed frame, the header and the list rows match (no pixel differs by more than 22); only the control strip and the status line changed. The eBird and Birds of the World marks were checked in a magnified crop. Requests during the capture: the backend's own routes, the stubbed checklist lookups answered in the browser, and map tiles from `tiles.openfreemap.org`; the backend has no eBird key. The alt text is section 3's offered sentence. A copy of the frame is `held/life-lists-shot-preview.webp` (SHA-256 `0cc51ebd...9051`), for the user to see before it goes live.
- `held-copy.md`'s status line now records the approval and where each section landed.

### Verification (16:28 to 16:42 UTC, nothing else compiling, load 2.0)

- `npm run typecheck` and `npm run build`: clean (the existing over-1,100 kB chunk warnings only).
- The full frontend suite: **497 files passed, 5 skipped; 10,899 tests passed, 6 skipped, 0 failed** (84.5 s). The version-set and published-claims guards run alone, 7 files, all passing: `androidVersionSource`, `fastlaneMetadata`, `fdroidRecipe`, `icloudKeysPublishedClaims` (the pill and footer row), `lifeListsSurfacesPublishedClaims`, `lifeListsPublishedClaims`, `iosSceneManifest`.
- `website/tools`: `npm test` 15 of 15; `npm run verify` 8 of 8 harnesses green.
- Backend: `pytest tests/ -q`, 2,080 passed.
- No U+2014 in any added line or in the published files; no literal control character in any changed or new text file.

### What stays out of the commits

- `qa-report.md` and `security-report.md` (gitignored by the run rules).
- `evidence/qa-probe-region.mjs` and its two readings, now gitignored (`pipeline/.gitignore`): the probe ran against a scratch copy of the user's own backup and its expectations and readings name that backup's countries, a county and per-region species counts. Kept on disk, because this repo is public.
