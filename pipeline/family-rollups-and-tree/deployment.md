# Deployment record: family-rollups-and-tree + map-scroll-on-phones (1.0.76)

One combined release of two builds that are both on local `main`: the Family
Tree tab (this run) and maps on phones (`pipeline/map-scroll-on-phones/`,
landed unreleased, D-49 and D-52). Run by The Deployer from the main checkout.
**Part one is Phase A, preparation only: nothing was published, pushed,
tagged, or written to App Store Connect, GitHub releases or fdroiddata.**
Phase B executes after the user's sign-off. No physical device was touched;
the Android emulators on this Mac were the only devices used. No key, token or
password was printed or written. Scratch evidence is in the session scratchpad
under `gates/`, `rig/`, `repo*/` and `release-review/`.

## Part one: Phase A (2026-11-22 PST, from 14:05)

### Reports and state

- **Tester:** PASSED, round 3 of 3 (`qa-report.md`, D-59): 96 of 102 criteria pass, 6 Partial (QA-59, QA-96, QA-97 need a real gesture; QA-71, QA-72 and half of QA-101 are this release's work).
- **Auditor:** PASSED WITH NOTES (`security-report.md`, D-60): nothing Critical, High or Medium; L-1 accepted for this ship with its fix recorded.
- **Local `main`:** `012c3b7c`, tree clean. **`origin/main`:** `d7be7653`, a mid-run commit of this build pushed at 11:15 local by something outside this session's builders (being traced by the Orchestrator); no tag, no release. Its Pipeline run `45059676698` failed in the Frontend job on exactly one row, `TabLoadErrorAlert.test.tsx` > "a failed RELOAD fills a region..." with `ResizeObserver is not defined`, the race `b2e444c8` fixes locally; Backend and Native green. No Pages run followed it (it changed nothing under `website/`), so the live site still reads 1.0.75. It **did** carry the map build's two `ACCESSIBILITY.md` sentences (`edd039be`), so GitHub's copy of that statement describes phone behavior 1.0.75 does not have until 1.0.76 ships. Nothing was done to the remote.
- **Cargo, `origin/main..main` (15 commits), classified:**
  - This build's own code and tests (covered by the gate): `b54b9414`, `a2c9f55f`, `ad3223d0`, `b2e444c8`, `534bafca`, `b46876b8`, `a4fccb3f`.
  - Record-keeping, `pipeline/` only (pre-approved cargo): `39e41dd8` and `2f3ca709` (the held harness), `827b433f`, `b98dd0f2`, `d615f8db`, `777d05bf`, `1bde6c77`, `012c3b7c`.
  - Anything else: none. The release push also carries, for the first time under a tag, everything from `v1.0.75` to `d7be7653` already on `origin` (58 commits, one author): both builds, the post-1.0.75 ship records (`ecb258be`, `9e09c5b0`, `7cf126a6`), and this build's mid-year taxonomy refresh `2822a154` (D-39, the user's choice), which is app behavior and is named in the CHANGELOG.
- **Other ships in flight:** none. Newest remote tag and release `v1.0.75` (published 2026-11-21 07:58 UTC, Latest); no Windows or Android CI since its tag; the one later Pipeline run is the failed one above.

### Local gates, Mac quiet (load 2.3 to 2.9 at the start, nothing else compiling)

On `012c3b7c`, Node 24.18.0, `SR_SKIP_LOCAL_ONLY_TIMING` unset: `npm run build` 19 s, rc 0; `npx eslint .` rc 0, no output; `npx vitest run` at default parallelism 89 s, **546 files passed, 5 skipped; 12,128 tests passed, 8 skipped**; backend `pytest` **2,085 passed**. D-45's owed quiet re-run of `lifeListsLinearity.test.ts`: its local-only CPU quotient rows ran and passed inside the full suite, and again alone, 20 of 20. `CHECK_ONLY=1 zsh -lc ./release.sh` on the clean tree: rc 0 (preflight, network, both `npm ci` runs; it reads v1.0.75 because the bump is not applied, and proves nothing about the version or the tag).

### Signing and toolchain readiness (presence and dates only)

- Login keychain: unlocked (`no-timeout`). Identities: Developer ID Application, Apple Development, Apple Distribution (team `8QKC3L2FKP`). Developer ID certificate valid to 2027-02-01; Apple Distribution to 2027-07-05.
- Xcode 27.2 (27B52), `-checkFirstLaunchStatus` rc 0, iPhoneOS SDK 27.2.
- Profiles: Mac Developer ID "SnowRaven Mac Developer ID 20260901" (2044); app "SnowRaven iOS App Store iCloud AppGroup 20260924" and extension "SnowRaven Widgets App Store", both to 2027-07-05 with `group.com.dtgibson.snowraven`, installed, and mapped in `~/.tauri/snowraven-ios-export-options.plist`.
- Android: `~/.tauri/snowraven-android.p12` and its properties file present, both mode 0600.
- `release.sh`'s secrets: the minisign key `~/.tauri/snowraven-signing.key` present (mode 0600, which `release.sh` reads itself); `APPLE_SIGNING_IDENTITY`, `APPLE_API_KEY_PATH` (its file exists), `APPLE_API_KEY_ID` and `APPLE_API_ISSUER_ID` present in the login shell; both App Store Connect `.p8` keys present.

### App Store and F-Droid state (read-only)

- **App Store Connect (GET only, metadata key):** 38 version records; **1.0.75 `READY_FOR_SALE`** (`3b2d00c7`, build 1.0.75.1 `VALID`), submission `e0608e6e` `COMPLETE`; no record other than `READY_FOR_SALE`; newest train 1.0.75, no 1.0.76 build. So 1.0.76 needs a new record of its own; nothing can roll up. Each screenshot set holds **seven** frames (not six).
- **F-Droid (22:13 UTC):** f-droid.org publishes 1.0.73, 1.0.72 and 1.0.70 (`suggestedVersionCode` 10000734). fdroiddata `master`: `CurrentVersion` 1.0.75, `CurrentVersionCode` 10000754, the bot's entries for 1.0.75 added at 08:56 UTC today (`1cdd4f95`). Build logs: 10000741/2/4 `Successfully built ... from 0a9dd9a3`; 10000751/2/4 answer 404. So **1.0.75 is included and this tag not yet built**, and 1.0.74 is included and built, not yet published.
- **Outside setup either build needs:** none. No new host, key, endpoint, portal setting or capability; the privacy label stays "Data Not Collected".

### The held release (`held/release/`)

- **Version set** (the `version` group): the nine files the 1.0.74 and 1.0.75 release commits moved (the six-file set plus `package-lock.json` and the three per-processor changelogs). `patches/1-version-set-1.0.76.patch` carries the manifests, the lockfile, the website pill and footer and the recipe; the script writes the three changelogs and inserts the `CHANGELOG.md` entry from the held text when it runs. Nothing else moves at a bump: `src-tauri/Cargo.toml` is `0.0.0` and the iOS plists move only at the iOS build's stamp. The map build's `DECISIONS.md` heading and `ROADMAP.md` line are `patches/3-records-1.0.76.patch`.
- **Published copy** (`copy/published-copy.md`): the Family Tree sentence for README, website and listing (unchanged from `held-copy.md`), the website row with its alt text, the listing's length (3,733 to 3,916 of 4,000), and What's New A (197 characters, recommended) or B (121).
- **Other statements:** no change to `PRIVACY_POLICY.md`, `ACCESSIBILITY.md`, `appstore/REVIEW_NOTES.md` or the F-Droid description (`copy/privacy-accessibility-review-notes-read.md`).
- **Proof on a fresh clone of HEAD with all four groups applied:** build rc 0; eslint no output; full suite **547 files passed, 5 skipped; 12,136 tests passed, 11 skipped**; `website/tools` tests 15 of 15; and the whole real-engine gate run as CI runs it (`npm run verify`, `run.mjs` discovering the moved harness): **10 of 10 harnesses green** in 989 s, the Family Tree harness 116 checks in 281 s under its new budget, Hotspot Reports 2,044 configurations in 387 s. The new surfaces guard leaves the built CSS byte-identical (built with and without it); deleting the new README section turns both surfaces suites red (4 rows); in its held state the new suite passes on the unapplied tree (10 passed, 2 skipped). A second run of the apply script refuses each group. After the CHANGELOG entry moved out of patch 1 into the script, the final script was re-applied to a third clone: every file byte-identical to the proven tree except the one rephrased CHANGELOG sentence, and the version, CHANGELOG, Fastlane, surfaces and figure guards (nine files) 175 passed, 4 skipped.

### Found and fixed inside the held release (none touches shipped code)

1. **The demo data on disk was stale.** `website/tools/demo-data/` (gitignored) was generated on Nov 10, before 1.0.71 taught the generator weather blocks, so the first retake of the Statistics frames lacked the Weather section chip the published ones show. Regenerated in the rig (`node gen-demo-data.mjs`: 7,869 rows, 368 checklists, 14 weather blocks, every id `S9`; `ebird-backup.csv` SHA-256 prefix `9a753177b269f537`) and every frame retaken from it. The checkout's own stale copy was not touched; Phase B's retakes use the regenerated set.
2. **`hotspotReportsSurfacesPublishedClaims.test.ts` would have gone red on the Family Tree copy.** `held-copy.md` expected it to stay green, but its applied-state row holds the files to 1.0.71's exact AFTER blocks, seven of which the insertion changes. Patch 2 adds `SUPERSEDED` entries built from the Family Tree's own held pairs (read from the held file, not restated), plus one narrower entry for the listing seam. Caught by the full suite on the applied clone.
3. **The moved harness needs a budget, and the gate's job bound moves with it.** `verify-family-tree.mjs` took 283 s (116 checks green, both engines, no outside request) against `run.mjs`'s 180 s default; it gets 1,200 s (4.2x). The gate's worst case then sums to 104 minutes against the frontend job's 90, so `pipeline.yml` goes to 110 with its arithmetic rewritten, as its own comment asks.

### Pictures

Method: the committed capture tools, run unchanged from a scratch copy (outputs land in the scratch rig by their own relative paths), against a scratch backend copy with no `.env`, empty key variables and a dead proxy (its first-load taxonomy refresh and every eBird-backed route fail before leaving the Mac; it answers the keyless 401 itself), serving this checkout's `frontend/dist`. Every Chromium was launched through a preload that adds a dead proxy with loopback bypassed and logs every non-loopback request: across all runs the log shows only OpenFreeMap tile and style requests and two Macaulay Library requests, all refused, which is also the positive control that the guard sees requests. The capture tools' own fail-closed dataset guard passed each run (368 synthetic checklists).

- **Website:** 8 retaken (statistics, statistics-dark, species, calendar, multimedia, breeding, life-lists, named-birds), each differing from the published file only inside the 220 px side menu (two stray pixels in all); 1 new (`family-tree.webp`, the tree as the tab opens in a wide window, after the escapee check settles). Kept: `statistics-mobile.webp` (retaken, pixel-identical) and `weather.webp` (no navigation in frame).
- **App Store:** iPhone 6.9-inch kept (02, 04, 05, 06, 07 retaken pixel-identical; 01 identical outside its map). iPad 13-inch: 02, 04, 05, 06 retaken, differing only in the side menu (05's Wood Thrush reproduced exactly, so the script's "not reproducible" caveat for that frame is stale). iPhone Duo: 02, 04, 05, 06, 07 retaken, differing only in the rail. Composed with the committed composer, captions and order unchanged; the composer is deterministic (all 12 frames recomposed from unchanged raws came out byte-identical to the committed ones).
- **F-Droid** (emulator leg, a fork of this stage; `held/release/pictures/fdroid/NOTES.md`): a local release build of `012c3b7c` (`build-apk.sh`, 3 min 21 s, tree fingerprint identical before and after, `dist` not rebuilt), signed with a throwaway key in the scratchpad (certificate SHA-256 `cea2defb...cc45`, not the release signer), on `sr-api36-tablet` and `sr-api36-phone` (`-gpu host`, every `adb` call by serial) started with `-dns-server 127.0.0.1`, so no name resolved while Wi-Fi read connected and the app stayed online; demo mode 9:00; seeded as root from the regenerated demo set; WebView 133.0.6943.137; crash buffers 0 lines before and after. **Tablet:** all six frames change (the side menu); `3.png` (Calendar) retaken and publishable, differing only in the menu. Frames 2, 4, 5 and 6 need the network because the app's WebView loads the eBird and Birds of the World site icons itself (the browser captures serve committed copies), and frame 1 needs tiles; frame 4 also showed an unexplained 12 px pale strip, to check on the network-on retake. **Phone:** kept as published: the bottom bar is pixel-identical in all six pairs and no frame draws an in-page map. The fork proposed its Calendar retake as replacing a stale frame; it is a different view (Compact, where the published frame and the App Store capture use Large, and the App Store iPhone Calendar frame retaken today in Large is pixel-identical to its published one), so it was set aside and the notes carry the correction.
- **Awaiting leave for outside requests** (Phase A sent none): tiles for website `map`, `map-dark`, `hotspot-reports`, App Store iPad 01 and 07, Duo 01; the Weather lookup for App Store iPad and Duo 03; the emulator's network for F-Droid tablet 1, 2, 4, 5 and 6.
- **Observation for the user:** the new Family Tree shot ends "9 species are not placed on the tree". Nine demo-dataset names are spelled as eBird did before its 2026 update (three with a curly apostrophe), which the 2026 taxonomy no longer lists; the tab is right to set them aside. A demo-data refresh is a follow-up, not part of this release.

### The review page

`https://hephaestus.giraffe-chuckwalla.ts.net:9013/` (tailnet only): a loopback server on `127.0.0.1:19013` over the scratchpad's `release-review/`, exposed with `tailscale serve --https=9013 --bg`, left running for the sign-off. It shows every copy surface before and after (the README rendered by `pandoc`, the website as the site draws it at desktop and phone width, the listing and What's New as text), every picture pair per device, and the three questions with their candidates. Built from the held files by a generator in the scratchpad, so it shows what the patches would write.

### Not done or not verified in Phase A

- No retake of any frame that needs an outside request (above).
- The user's device check, the emulator check of the signed APK and the Android back-gesture step (Phase B).
- Every App Store Connect, GitHub and fdroiddata write (Phase B).
- WebView 133.0.6943.137 was read on both API 36 images in Phase A, unchanged since the last measurement; the Android leg re-reads it on the image it checks the signed APK on.

## Part two: the Phase B plan, in order (the user's hands marked **USER**)

1. **USER: the sign-off** on the copy, What's New, the pictures and the three questions; any changed word edited into `held/release/copy/published-copy.md` first.
2. If leave was given: retake the awaiting frames with the network open, compare, add them to `manifest.tsv`, recompose; show any frame that changed beyond its menu.
3. Re-read `origin/main` (no new push since `d7be7653`) and confirm `origin/main` is an ancestor of local `main`.
4. Re-date `held/release/copy/changelog-entry.md` to the ship day and settle its pictures bullet to what was approved and retaken; then apply: `apply-release-1.0.76.sh version copy pictures records`; then `npm run build`, `npx eslint .` and the full `npx vitest run`.
5. Commit with explicit paths: the release commit (`chore(release): 1.0.76, ...`) and, separately, the approved copy and pictures; then this record.
6. Tag `v1.0.76` (annotated) and push the tag alone; write the full tag commit into the in-repo F-Droid recipe's three `commit:` lines; push `main` as a fast-forward (it carries everything since `d7be7653`).
7. CI on the tag's commit: Windows Build and Android Build green (queried pinned to the tag's commit).
8. iOS archive (stale archive moved aside; the three shims recreated; icons opaque; SDK 27.1 or later; outside the sandbox), the widget extension signed with its entitlements, manual export with `~/.tauri/snowraven-ios-export-options.plist`, `DistributionSummary.plist` read, `altool --validate-app`, then `--upload-app`. Widget extension Swift tests on a simulator. Commit and push the stamp.
9. **The Pipeline run of record** on the shipped tree (the stamp commit's, which cancels the tag commit's) **green in every job, the real-engine gate included; a red run stops the ship** (v1.0.75).
10. `zsh -lc ./release.sh` (**USER** only if the login keychain has locked since this read). Verify the downloaded DMG with `codesign`, `stapler` and `spctl`, and `latest.json`.
11. Android: `preflight.sh`, `sign.sh` with `SNOWRAVEN_ANDROID_SIGNER_SHA256=42a3576e...`, the emulator check of those exact bytes on API 36 (first screen, Family Tree, a map's still and its back gesture, crash buffer by process name, WebView version), then `attach.sh` with `ANDROID_DEVICE_CHECK=partial` (no Android device, standing decision).
12. TestFlight build 1.0.76 (1) reads `VALID`. **USER: the device check** in `held/release/device-check-request.md`, recorded as reported, before any submission.
13. App Store: new 1.0.76 record on build 1.0.76.1, release after approval, no phased release; What's New and the Description (with the new bullet) written; **every listing field read back** against `appstore/LISTING.md`; screenshot sets replaced whole and in order for each changed family, then `readback` must end ALL MATCH (21 of 21); age-rating fields read; **USER: confirm the privacy label still reads "Data Not Collected"** in App Store Connect (no API for it); then submit.
14. `RELEASE_LEDGER.md`: the App Store disposition of 1.0.76 (and 1.0.75's resolution), and the Android sentence (F-Droid state from the three reads, the APK asset and signer). Then The Chronicler.
