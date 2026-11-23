# F-Droid listing pictures for 1.0.76 (Phase A, held): final state

Retaken 2026-11-22 on the local emulators, network on through the Deployer's allowlisting proxy, with the corrected demo data. Nothing here is published or applied; the committed sets under `fastlane/metadata/android/en-US/images/` are untouched. The earlier DNS-blocked structural captures are superseded and were moved out of this folder into the session scratchpad (`android/superseded/`).

**Capture window: 16:07:57 to 16:31:42 local (PST).** Every picture in this folder was taken inside it, except `phoneScreenshots/3-different-view-not-for-publication.png` (from the earlier leg, kept under the Deployer's name for it).

## File names

- `N.png`: a replacement, publishable.
- `N-keep-published-retake-for-comparison.png`: the published frame stays; this retake is the evidence that it is still right. Not for publication.
- `3-different-view-not-for-publication.png` (phone): the Calendar's Compact view from the earlier leg; the published frame is the Large view (the Deployer's correction). Not for publication.

## Verdicts

Measured with a pixel diff (any channel more than 24 apart) against the committed frame; for phone frames scrolled by swipes, also with the vertical offset compensated (`shiftdiff.mjs`: the best shift, then the residual).

| Set | Frame | Verdict | What differs beyond the Family Tree menu entry |
|---|---|---|---|
| tablet | 1 Map Explorer | **replace** | Nothing else of substance: 89 px of anti-aliasing on the view-chip labels (capture variance). Tiles, pins, layer switcher, credits all present. |
| tablet | 2 Statistics | **replace** | Nothing: content and status bar 0 px. |
| tablet | 3 Calendar (2025, Compact) | **replace** | Nothing: content and status bar 0 px. Byte-identical to the earlier leg's capture. |
| tablet | 4 Species Detail (American Goldfinch) | **replace** | Nothing: content and status bar 0 px (see the strip below). |
| tablet | 5 Breeding Codes | **replace** | **American Herring Gull** (*Larus smithsonianus*; formerly Herring Gull, under H) is now the third row, between American Goldfinch and American Oystercatcher, so every row below moves down one and **Barred Owl leaves the frame** (Barn Swallow is now the last visible row). Still 87 species. |
| tablet | 6 Multimedia | **replace** | **American Herring Gull** (13 photos, 1 video, total 14) now follows American Goldfinch; every row below moves down one and **Bald Eagle leaves the frame**. Still 149 species. |
| phone | 1 Map Explorer | **keep** (capture variance) | 254 px in one small map patch: a pale landuse polygon in OpenFreeMap's live tile data that was not there when the published frame was taken. The app's chips, controls, credits and bottom bar are identical. |
| phone | 2 Statistics | **keep** (capture variance) | Best shift 5 px; residual 8,575 px, all sub-pixel rendering: the chart's step line and five Top Species rows. Same names, counts and marks, checked side by side. Bottom bar 0 px. |
| phone | 3 Calendar (2025, **Large**) | **keep** (pixel-identical) | Best shift 28 px before nudging, 2 px after; residual **0 px**. |
| phone | 4 Species Detail (Scarlet Tanager) | **keep** (pixel-identical) | Best shift 1 px; residual **0 px**. |
| phone | 5 Breeding Codes | **replace** | **American Herring Gull** is the third row (name, then the marks on the next line, then *Larus smithsonianus*), so the rows below move down one and the last visible row changes. Position within 2 px of the published one. |
| phone | 6 Multimedia | **replace** | **American Herring Gull** (wrapping to two lines, 13 photos) replaces **American Kestrel** as the last visible row. Everything above it is identical. |

All four replaced tablet menus and both replaced phone frames were magnified 3x (nearest-neighbor): the Family Tree row with its icon sits between Breeding Codes and Hotspot Reports; every species name in the replaced frames carries the real eBird "e" and the Birds of the World woodpecker icon (no fallback glyph). The other corrected names (Black-crowned Night Heron, Cooper's Hawk, Forster's Tern, Swainson's Thrush, Northern House Wren, Eastern Marsh Wren, Eastern Warbling Vireo, Northern Yellow Warbler) do not appear in any of the twelve frames.

## The tablet frame 4 strip, explained

With the network on, the pale strip came back: a solid `#e0ece6` band, 12 device px (6 CSS px) tall, across the content area at y 36-47, just above the page, with everything below it pixel-identical to the published frame. It survived 40 s. It **vanished on a tab round trip** (Calendar, then back to Species Detail, the bird still chosen), and the frame then matched the published one in every band but the menu. So it is a leftover of choosing a bird in the species field (the field's open-list state), cleared by the next render, and not a network effect. The published frame was evidently taken after such a render, and so is the replacement. Not investigated further; it may be worth a look by The Designer as a minor Android tablet artifact.

## Other things seen

- **Touch hover sticks on Android.** A swipe that ends on a table row leaves that row's hover background (`#fafafa`) until something else is touched; it appeared on Baltimore Oriole in phone frame 5 and was cleared by a tap on the empty page margin before the capture. Swipes for scrolling were then made in the margin. This is the touch `:hover` behavior the UI rules already name.
- **Phone Multimedia's wrapped name** puts its two marks to the right of the two-line "American Herring / Gull" block, while Breeding Codes puts a wrapped name's marks on the line below. That is the app's layout, as built; flagged only because this frame is the first published picture to show a wrapped name there.
- **The phone Map Explorer pans on a swipe:** the first phone retake was spoiled by a scroll swipe landing on the map; the app was force-stopped and relaunched, and the frame retaken without touching the map.

## Network during the window (from `rig/counts/emulator.log`)

Proxy set on both guests at 16:07:57 (`settings put global http_proxy 10.0.2.2:18912`), the guests' own DNS still dead (`-dns-server 127.0.0.1`). Allowed tunnels: `tiles.openfreemap.org` 7, `ebird.org` 2, `is-ebird-web-static-content-prod.s3.amazonaws.com` 2, `birdsoftheworld.org` 2. Refused: `content-autofill.googleapis.com:443` 127 (the WebView's autofill query, the known one), `www.google.com:443` 8, `http connectivitycheck.gstatic.com` 8, `http play.googleapis.com` 5, `http www.google.com` 3 (Android's own connectivity and Play checks, which also follow the global proxy). Nothing reached eBird's API or OpenWeather, and no key was entered. **Proxy cleared on both at 16:31:42 (`http_proxy` reads `:0`).**

## Method

- **Build:** `sh scripts/android/build-apk.sh` from the main checkout at `012c3b7c`, with the frontend `dist` built at 14:09 by the Deployer's gates (not rebuilt). 14:22:37 to 14:25:58 (3 min 21 s); Gradle 8.14.3, tauri-cli 2.11.2. Unsigned universal APK 79,918,067 bytes. Version 1.0.75 / 1000075 (the bump is not applied; no version number is in frame).
- **Tree fingerprint, before and after the build, identical:** HEAD `012c3b7c5c9d3cb9e81304caf7f221a50d0a7f27`, `git status --porcelain=v1 -uall` empty, `git ls-files -s | shasum -a 256` = `897f6328d1f85047e9a36ef083c4d3b12baa82c6a8ad28d87b4a0c07f245a365`, hash of every tracked file's SHA-256 = `c7f6aafda500fa1de324ccbf2e622c95a7867ccf3a0dfc9f2c6b61e040f8a885`.
- **Throwaway key** (scratchpad only, `android/key/`): alias `throwaway-emulator`, RSA 2048, 30 days to 2026-12-22, `CN=THROWAWAY emulator verification only, O=not for release`, certificate SHA-256 `cea2defbe78497139bd0bfdea3a9e5b5c404d61c5cc0bb73ee439ca94f98cc45` (not the release signer `42a3576e...`). Signed by `scripts/android/sign.sh` (v2 and v3, verifies); signed APK SHA-256 `e453abbb657d52e8ad04cd147c1cd21a779a6b6347d8448edb76d350b5791a7f`. Nothing it signed is distributed.
- **Emulators:** `sr-api36-tablet` (emulator-5556, Pixel Tablet image, 2560x1600 landscape) and `sr-api36-phone` (emulator-5554, 1080x2400), both API 36 Google APIs arm64, cold boot, `-gpu host`, `-dns-server 127.0.0.1`. Every `adb` call named its serial. Status-bar demo mode: 9:00, full Wi-Fi, full battery, mobile and notifications hidden. Light theme (`cmd uimode night no` and the app's `theme` setting), rotation fixed. Old installs removed first (1.0.73 on the tablet, 1.0.75 on the phone).
- **WebView:** 133.0.6943.137 on both images, unchanged since the last measurement.
- **Data:** installed, launched once, force-stopped, then seeded as root into `/data/user/0/com.dtgibson.snowraven/data/` with the data directory's own owner and SELinux context, mode 0600 (files) and 0700 (folder). `settings.json` = `{"welcomeSeen":true,"map-defaults":{"lat":40.73,"lng":-73.95,"dist":5},"theme":"light"}`. No key entered. **Final seed, at 16:07, on both, force-stopped first:** the corrected set from the session scratchpad `rig/website/tools/demo-data/`: `ebird-backup.csv` SHA-256 `4aee97018e9444688bf497673c44ad2abfcabc2a0d9e94e29a66700df6087299` (1,450,209 bytes; 7,869 rows, 368 checklists, 0 submission ids outside the synthetic S9 range; the nine corrected names present), `ml-export.csv` `f5dd5fce96b1948b60e8328efc5dcbc7004a61f886d7108f17564bc84db17eee` (128,492 bytes), `metadata.json` `e8f4c8086bf8b830…`. Earlier seeds (the stale `website/tools/demo-data/` set, then `9a753177…`) were replaced and nothing from them is in this folder.
- **Navigation and positions:** taps by `adb input`, coordinates from `uiautomator dump` (the WebView exposes its nodes) or from a screenshot; scroll positions matched to the published frame by measuring rows of dark pixels and nudging with pairs of slow swipes of known length difference.
- **Crash buffer:** 0 lines on both emulators before the install and after the last capture; no `FATAL EXCEPTION`, ANR or SnowRaven `AndroidRuntime` line in the main log; the app was alive on both at the end.
- **Helpers** (scratchpad `android/`): `demo.sh`, `seed.sh`, `reseed.sh`, `shot.sh`, `dump.sh`, `scrollto.sh`, `rows.mjs`, `pairdiff.mjs`, `banddiff.mjs`, `shiftdiff.mjs`, `crops.mjs`.

## State left

Both emulators running with the throwaway-signed 1.0.75 build and the corrected demo data, proxy cleared, DNS still dead. The throwaway key stays in the scratchpad.
