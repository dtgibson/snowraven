# F-Droid listing pictures, retaken for 1.0.76 (Phase A, held)

Taken 2026-11-22, 14:22 to 15:05 PST, by the Deployer's fork. Nothing here is published or applied; the committed sets under `fastlane/metadata/android/en-US/images/` are untouched.

## File names say what each file is for

- `N.png`: publishable. It needed no outside request, and it differs from the published frame only where this release (or an earlier one) changed the app.
- `N-structural-not-for-publication.png`: NOT for publication. Taken with every outside host unreachable, so a part of the frame that needs one (map tiles, or the eBird and Birds of the World marks) is wrong. It shows the layout and the menu as built; a publishable copy needs a retake with leave for those requests.

| Set | File | Verdict |
|---|---|---|
| tablet | `1-structural-not-for-publication.png` | Structural only: map area reads "Loading map..." (later "Map couldn't load. Check your connection." with Retry); awaiting leave for OpenFreeMap tile requests |
| tablet | `2-structural-not-for-publication.png` | Structural only: marks show fallback glyphs; awaiting leave for the two mark requests |
| tablet | `3.png` | **Retaken and differs: publishable** (side menu only) |
| tablet | `4-structural-not-for-publication.png` | Structural only: fallback marks, plus an unexplained pale strip (below) |
| tablet | `5-structural-not-for-publication.png` | Structural only: fallback marks |
| tablet | `6-structural-not-for-publication.png` | Structural only: fallback marks |
| phone | `1-structural-not-for-publication.png` | Structural only: blank map area, awaiting tiles; everything else equal to published |
| phone | `2-`, `4-`, `5-`, `6-structural-not-for-publication.png` | Structural only; apart from the marks, the same as published within capture variance (published frames can stay) |
| phone | `3.png` | **Retaken and differs: publishable** (the published frame is stale, see below) |

## What differs, frame by frame (beyond the Family Tree entry)

Measured with a pixel diff (any channel more than 24 apart) against the committed frame.

**Tablet** (side menu = x 0-432; content = x 432-2560 below the status bar; status bar = y 0-48):

- Every frame: the side menu now lists Family Tree between Breeding Codes and Hotspot Reports, so Hotspot Reports to Named Birds and Settings sit one row lower (16,434 to 16,578 px differ in the menu band). Nothing else in the menu differs.
- 1 Map Explorer: no base map, pins, layer switcher or share button (DNS blocked). Filter panel, view chips, counts (10 locations, 149 species, 7.9k obs) and footer as published.
- 2 Statistics: content differs in 925 px, the two mark slots beside Black Vulture (fallback glyphs). The Weather section chip is present.
- 3 Calendar (2025, Compact): **0 px differ in the content area and status bar**; only the menu differs.
- 4 Species Detail (American Goldfinch): 924 px in content, the mark slots beside *Spinus tristis*. Also a pale green strip, 12 px tall, across the content area at y 36-47, still there after 40 s, absent from the published frame. Cause not determined (most likely a request left pending by the DNS block); check it on the network-on retake.
- 5 Breeding Codes: 8,316 px, the mark slots on each row.
- 6 Multimedia: 9,240 px, the mark slots on each row.

**Phone** (bottom bar = y 2178-2400):

- The bottom bar band is **pixel-identical in all six pairs** (0 of 239,760 px each). The map build's Android bar and inset changes do not change these frames, and the new tab does not reach the bar (it lists Weather, Statistics, Map Explorer, Species Detail, More). The More sheet lists Family Tree, but no frame shows the sheet.
- 1 Map Explorer: only y 507-2009 (the map area) differs, because the map cannot load. Chips, header, Filters button and fullscreen button are at the same places. The live map is kept at this size (no still).
- 2 Statistics, 4 Species Detail, 5 Breeding Codes: the mark slots, plus 1 to 2 px of scroll-position variance (scrolled to the published position by measured swipes).
- 6 Multimedia: only the five mark slots in view differ (7,995 px); otherwise identical.
- 3 Calendar: **the published frame is stale, independent of this release.** It shows the older month grid (the day of the month in each cell, no weekday row). The current app, like the 1.0.74 tablet frame, shows each day's species count under an S-to-S weekday row. Same days shaded, same 2025 data; heading within 2 px of the published position.

## Recommendation the parent can use

- Tablet: all six change (the menu). `3.png` is ready. 1, 2, 4, 5 and 6 need a retake with network on: OpenFreeMap tiles for 1; the two mark images (`ebird.org/favicon.ico`, `birdsoftheworld.org/favicon.ico`, fetched by the app's WebView) for 2, 4, 5 and 6. No key is involved in any of them.
- Phone: frames 1, 2, 4, 5 and 6 need no change; `3.png` replaces a frame that has been stale since a Calendar change after 1.0.53.

## How they were made

- **Build:** `sh scripts/android/build-apk.sh` from the main checkout at `012c3b7c`, with the frontend `dist` built at 14:09 by the parent's gates (not rebuilt). 14:22:37 to 14:25:58 (3 min 21 s); Gradle 8.14.3, tauri-cli 2.11.2. Unsigned universal APK 79,918,067 bytes. Version 1.0.75 / 1000075 (the bump is not applied; no version number is in frame).
- **Tree fingerprint, before and after the build, identical:** HEAD `012c3b7c5c9d3cb9e81304caf7f221a50d0a7f27`, `git status --porcelain=v1 -uall` empty, `git ls-files -s | shasum -a 256` = `897f6328d1f85047e9a36ef083c4d3b12baa82c6a8ad28d87b4a0c07f245a365`, hash of every tracked file's SHA-256 = `c7f6aafda500fa1de324ccbf2e622c95a7867ccf3a0dfc9f2c6b61e040f8a885`.
- **Throwaway key** (scratchpad only, `android/key/`): alias `throwaway-emulator`, RSA 2048, 30 days to 2026-12-22, `CN=THROWAWAY emulator verification only, O=not for release`, certificate SHA-256 `cea2defbe78497139bd0bfdea3a9e5b5c404d61c5cc0bb73ee439ca94f98cc45` (not the release signer `42a3576e...`). Signed by `scripts/android/sign.sh` (v2 and v3, verifies); signed APK SHA-256 `e453abbb657d52e8ad04cd147c1cd21a779a6b6347d8448edb76d350b5791a7f`. Nothing it signed is distributed.
- **Emulators:** `sr-api36-tablet` (emulator-5556, Pixel Tablet image, 2560x1600 landscape) and `sr-api36-phone` (emulator-5554, 1080x2400), both API 36 Google APIs arm64, cold boot, `-gpu host`, `-dns-server 127.0.0.1`. Every `adb` call named its serial. Inside each guest `ping` read `unknown host` for `tiles.openfreemap.org` and `api.ebird.org`, while `cmd wifi status` read "Wifi is connected" and the default network was WIFI CONNECTED, so `navigator.onLine` stayed true. Status-bar demo mode: 9:00, full Wi-Fi, full battery, mobile and notifications hidden. Light theme (`cmd uimode night no` and the app's `theme` setting), rotation fixed.
- **WebView:** 133.0.6943.137 on both images, unchanged since the last measurement.
- **Old installs removed first:** 1.0.73 on the tablet, 1.0.75 on the phone.
- **Data:** installed, launched once, force-stopped, then seeded as root into `/data/user/0/com.dtgibson.snowraven/data/` with the data directory's own owner and SELinux context, mode 0600 (files) and 0700 (folder). `settings.json` = `{"welcomeSeen":true,"map-defaults":{"lat":40.73,"lng":-73.95,"dist":5},"theme":"light"}`. No key entered.
  - First seeded from `website/tools/demo-data/` (`ebird-backup.csv` SHA-256 prefix `afbaf8e24dfa8335`), which turned out to be stale (generated 2026-11-10, before 1.0.71 added weather blocks): Statistics lost its Weather chip.
  - **Re-seeded at 14:30 on both emulators** from the regenerated set in the session scratchpad `rig/website/tools/demo-data/`: `ebird-backup.csv` SHA-256 `9a753177b269f5373005ba0063958ed6c57e22f91d0f6d86ee143149e7238f73` (7,869 rows, 368 checklists, 14 with weather blocks, 0 submission ids outside the synthetic S9 range), `ml-export.csv` `7eecd052...`, `metadata.json` `e8f4c808...` (both byte-identical to the stale folder's). Every file in this folder was taken after the re-seed.
- **Crash buffer:** 0 lines on both emulators before the install and after the captures; no `FATAL EXCEPTION`, ANR or SnowRaven `AndroidRuntime` line in the main log; the app was alive on both at the end.

## Gaps

- Tablet 1, 2, 4, 5, 6 and phone 1, 2, 4, 5, 6 are structural only, by the no-outside-request rule. With leave, the retake is: start the same two emulators without `-dns-server`, keep everything else, and repeat the taps (helpers in the scratchpad `android/`: `demo.sh`, `seed.sh`, `reseed.sh`, `shot.sh`, `dump.sh`, `scrollto.sh`, `rows.mjs`, `pairdiff.mjs`).
- The tablet frame 4 strip is unexplained.
- Both emulators are left running with the throwaway-signed 1.0.75 build installed and the demo data in place.

## Deployer's correction (2026-11-22, after the fork reported)

**The phone `3.png` is a different view, not a newer one, and is renamed
`3-different-view-not-for-publication.png`.** The published phone frame 3 shows
the Calendar's **Large** view (the day of the month in each cell), the view
`capture-appstore.mjs` selects for the store frames; the retake shows the
default **Compact** view (weekday row, each day's count). Evidence: the App
Store iPhone 6.9-inch `04-calendar.png`, captured today in the Large view from
the same build, is pixel-identical to its published frame and draws the month
grid the way the published F-Droid phone frame does. So the published phone
frame is not stale, and with the bottom bar pixel-identical in all six pairs
and no in-page map in any phone frame, **the whole published phone set stays
as it is.** Only `tenInchScreenshots/3.png` is in `../manifest.tsv`.
