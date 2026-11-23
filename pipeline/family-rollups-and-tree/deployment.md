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

### Pictures (first pass, superseded by part one (b))

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

## Part one (b): after the first gate (D-63), 2026-11-22 PST, from 15:20

The user approved the tab copy and What's New text A, allowed the three kinds of
outside request for the retakes, and asked for the demo birds to be fixed first
(D-63). The first pass's picture results above are superseded by this section.

### The demo birds (`held/release/patches/4-demo-birds-1.0.76.patch`, the `demo` group)

- **Names, chosen from the bundled 2026 snapshot** (`ebird-taxonomy.json`, version 2029): Black-crowned Night Heron (eBird dropped the hyphen); Cooper's Hawk, Forster's Tern and Swainson's Thrush with straight apostrophes (the curly ones were the only reason they did not match); Northern House Wren, Eastern Marsh Wren and Eastern Warbling Vireo (the 2026 splits' daughters that keep the demo's scientific names, which are the eastern forms the demo's New York and New Jersey hotspots hold); American Herring Gull (*Larus smithsonianus*) and Northern Yellow Warbler (*Setophaga aestiva*), the daughters found there, with their new scientific names. Taxonomic order numbers left as the generator had them.
- **The change:** the nine table entries in `website/tools/gen-demo-data.mjs`, its header note (the curly apostrophes leave the list of escaped non-ASCII characters; the file stays pure ASCII), the reviewer copies `website/demo/snowraven-demo-ebird-backup.csv` and `snowraven-demo-ml-export.csv` regenerated from it (they were byte-identical to the generator's previous output), and one test title in `hotspotReportsDemoData.test.ts` that named the apostrophes its assertions never checked. Nothing else reads these names: the frontend hits are each test's own fixture, the capture scripts click Northern Cardinal, Wood Thrush, American Goldfinch and Jamaica Bay only, and the website's mock figures name none of them.
- **Row-by-row column diff against the previous output:** backup 7,869 rows, header equal, only `Common Name` (369 rows, exactly the nine species) and `Scientific Name` (174 rows, the two splits) moved; Macaulay export 515 rows, only the same two columns (32 and 16 rows). No other field of any row changed; 149 species, 368 checklists, every submission id (7,869) and every Macaulay checklist id (515) in the synthetic `S9` range; `metadata.json` and `map-defaults.json` unchanged. The seven suites that read demo output pass on it (227 tests).

### Pictures, re-decided frame by frame against the corrected data

Same committed tools and scratch rig, now on the corrected data (`ebird-backup.csv` SHA-256 prefix `4aee97018e944468`), outside requests through allowlisting proxies (below). A frame is replaced only for a real change (the menu entry, a corrected name) and kept when its retake is pixel-identical or differs by capture variance alone. Every replaced frame's menu entry and every changed region's marks were checked magnified, and the capture scripts' own mark check passed on every frame. Captions unchanged; no frame added.

- **Website, 11 replaced, 1 new, 2 kept.** Menu only: statistics, statistics-dark, species, calendar, named-birds; menu plus one stray pixel: hotspot-reports (its map now matches the published one), life-lists; menu plus map-label placement (153 and 121 px): map, map-dark; menu plus a corrected name: multimedia (American Herring Gull, 13 photos and 1 video, after American Goldfinch; rows below move down one) and breeding (American Herring Gull after American Goldfinch; rows below move down one; Black-capped Chickadee leaves the frame). New: family-tree.webp, which no longer ends with a not-placed line. Kept: statistics-mobile.webp (pixel-identical), weather.webp (no menu and no demo bird in frame; not retaken, see the open item).
- **App Store iPhone 6.9-inch, 1 replaced, 6 kept.** Replaced 06 Breeding Codes (American Herring Gull at the top of the visible list; rows below move down one; Black-capped Chickadee leaves the frame; the pointer-tinted row is now Baltimore Oriole). Kept 02, 04, 05, 07 (pixel-identical), 01 (the same frame panned about 2 px by its framing drag; popup and species list identical), 03 (no menu, no demo bird; not retaken).
- **App Store iPad 13-inch, 6 replaced, 1 awaiting.** 01 (rail icon; 100 px of label placement), 02 (menu; Top Species rank 6 reads American Herring Gull), 04, 05 (Wood Thrush identical), 07 (menu only), 06 (menu; American Herring Gull added and Black-crowned Night Heron without the hyphen; Canada Goose leaves the frame). 03 Weather awaits the open item.
- **App Store iPhone Duo, 6 replaced, 1 awaiting.** 01 (rail icon; one park shape gone from OpenFreeMap's current data), 02, 04, 05 (9 stray px), 07 (rail only), 06 (rail; American Herring Gull added; Belted Kingfisher leaves the frame). 03 Weather awaits.
- **F-Droid tablet, all 6 replaced** (menu; 1 with 89 px of chip-label anti-aliasing; 5 with American Herring Gull as row 3 and Barred Owl leaving the frame; 6 with American Herring Gull after American Goldfinch and Bald Eagle leaving the frame). The earlier pale strip on frame 4 was a 6 CSS px band left from choosing a bird in the species field, gone after a tab round trip, and absent from the retake.
- **F-Droid phone, 2 replaced, 4 kept.** Replaced 5 (American Herring Gull as row 3) and 6 (American Herring Gull after American Goldfinch). Kept 1 (one shape in OpenFreeMap's live data), 2 (5 px scroll difference), 3 (Large view) and 4 (pixel-identical).
- **Composed App Store frames:** 13 new; the 8 composed from unchanged raws came out byte-identical to the committed ones again. `pictures/manifest.tsv` lists the 46 files the `pictures` group copies.

### Outside requests, counted

- **Browser captures** (proxy allowlist `tiles.openfreemap.org` only; the marks are served from committed copies): **146 requests** to `tiles.openfreemap.org` (website 68, App Store 78; 125 vector tiles, 21 style, 4 font or sprite), over 21 connections, plus 1 self-test request through the proxy. Refused: 4 to `macaulaylibrary.org`.
- **Android emulators** (system proxy at `10.0.2.2:18912`; allowlist the tiles host, `ebird.org`, its static-content host and `birdsoftheworld.org`; DNS still dead, so nothing could bypass it): **13 connections** (tiles 7, the three mark hosts 2 each); requests inside them cannot be counted from outside. Refused: 151 connections, all Android's or the WebView's own Google traffic (autofill 127, connectivity and Play checks 24). The proxy was cleared on both emulators at 16:31:42.
- **Weather lookups:** **0.** Nothing reached eBird's API or OpenWeather; no key was entered or printed.

### Open item: the iPad and iPhone Duo Weather frames (03)

The lookup reads the checklist from eBird before asking OpenWeather and NOAA, and the capture setup's own key file (`backend/.env`) holds only the OpenWeather key: there is no eBird key anywhere in the capture setup or the login shell (checked by name, values never read out). So the leave D-63 gave cannot run, and the two frames still show the menu or rail without Family Tree. The choice for the user: allow the eBird key saved in SnowRaven's own app data on this Mac for these two lookups (one eBird checklist read, one OpenWeather call and one NOAA request per frame, about six requests), or keep both frames as published for this release. Recommended: the first. With leave it is the same capture command through the keyed scratch backend (`rig/launch-keyed.py`, which reads keys into its own environment and logs host and path only), compared and added to the manifest like the rest.

### Re-proof on a fresh clone of `fea69e3b` with the final held release

All five groups applied (`version`, `demo`, `copy`, `pictures` with 38 files at the time, `records`); then `npm run build` rc 0; `npx eslint .` no output; full suite **547 files passed, 5 skipped; 12,136 tests passed, 11 skipped**; `website/tools` tests 15 of 15; the whole real-engine gate **10 of 10 harnesses green** (989 s). The eight F-Droid files added afterwards only copy into `fastlane/metadata/`, and the pictures group checks all 46. **All or nothing:** on a separate fresh clone each group was handed a tree it could not fully apply to (a changed version code, a changed generator line, a changed README sentence, a missing held picture, a changed ROADMAP line) and each refused with the working tree exactly as before; a second run of a group on an applied tree refuses too.

### The review page, final state

`https://hephaestus.giraffe-chuckwalla.ts.net:9013/` now shows the approved copy marked approved, What's New text A only, the demo-bird table, every picture pair per device with a one-line note under each replaced frame and the kept frames listed with their reasons, the request counts, and the open item. Left running.

## Part two: the Phase B plan, in order (the user's hands marked **USER**)

1. **USER: the look at the finished pictures and the deploy sign-off** (the copy and What's New are approved, D-63), and the answer on the two Weather frames.
2. If the eBird key is allowed for them: retake iPad and Duo 03 through the keyed scratch backend, compare, add them to `manifest.tsv`, recompose, and update the CHANGELOG entry's pictures line.
3. Re-read `origin/main` (no new push since `d7be7653`) and confirm `origin/main` is an ancestor of local `main`.
4. Re-date `held/release/copy/changelog-entry.md` to the ship day and settle its pictures bullet to what was approved and retaken; then apply: `apply-release-1.0.76.sh version demo copy pictures records`; then `npm run build`, `npx eslint .` and the full `npx vitest run`.
5. Commit with explicit paths: the release commit (`chore(release): 1.0.76, ...`) and, separately, the approved copy and pictures; then this record.
6. Tag `v1.0.76` (annotated) and push the tag alone; write the full tag commit into the in-repo F-Droid recipe's three `commit:` lines; push `main` as a fast-forward (it carries everything since `d7be7653`).
7. CI on the tag's commit: Windows Build and Android Build green (queried pinned to the tag's commit).
8. iOS archive (stale archive moved aside; the three shims recreated; icons opaque; SDK 27.1 or later; outside the sandbox), the widget extension signed with its entitlements, manual export with `~/.tauri/snowraven-ios-export-options.plist`, `DistributionSummary.plist` read, `altool --validate-app`, then `--upload-app`. Widget extension Swift tests on a simulator. Commit and push the stamp.
9. **The Pipeline run of record** on the shipped tree (the stamp commit's, which cancels the tag commit's) **green in every job, the real-engine gate included; a red run stops the ship** (v1.0.75).
10. `zsh -lc ./release.sh` (**USER** only if the login keychain has locked since this read). Verify the downloaded DMG with `codesign`, `stapler` and `spctl`, and `latest.json`.
11. Android: `preflight.sh`, `sign.sh` with `SNOWRAVEN_ANDROID_SIGNER_SHA256=42a3576e...`, the emulator check of those exact bytes on API 36 (first screen, Family Tree, a map's still and its back gesture, crash buffer by process name, WebView version), then `attach.sh` with `ANDROID_DEVICE_CHECK=partial` (no Android device, standing decision).
12. TestFlight build 1.0.76 (1) reads `VALID`. **USER: the device check** in `held/release/device-check-request.md`, recorded as reported, before any submission.
13. App Store: new 1.0.76 record on build 1.0.76.1, release after approval, no phased release; What's New and the Description (with the new bullet) written; **every listing field read back** against `appstore/LISTING.md`; screenshot sets replaced whole and in order for each changed family (all three: the iPhone set's Breeding Codes frame changed too), then `readback` must end ALL MATCH (21 of 21); age-rating fields read; **USER: confirm the privacy label still reads "Data Not Collected"** in App Store Connect (no API for it); then submit.
14. `RELEASE_LEDGER.md`: the App Store disposition of 1.0.76 (and 1.0.75's resolution), and the Android sentence (F-Droid state from the three reads, the APK asset and signer). Then The Chronicler.
