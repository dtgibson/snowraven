# Held copy: iOS 27.1 and iPhone Duo (1.0.59)

**Status: HELD. Nothing below has been written to a published surface or to the
version files.** Prepared by The Deployer, 2026-10-21, after the reconcile
merge brought 1.0.58's version set into this branch. This build ships as
1.0.59, after the parallel 1.0.58 ship (taxonomy-history-2019) is clear.

(a) and (d) go in with the version-bump commit. (b) and (c) are published copy
and need the user's express yes at the production sign-off (CLAUDE.md,
published copy): on a yes, (c) is written in the bump commit, before the tag,
because F-Droid reads the folder at the tag, and (b) goes to App Store Connect
when a record carries 1.0.59, after the user's own check of TestFlight build
1.0.59.1.

## (a) CHANGELOG.md entry (not published copy; goes in with the bump)

Inserted above `## [1.0.58] - 2026-10-21`, with the ship date in the heading.

```markdown
## [1.0.59] - <ship date>

### Changed
- **SnowRaven fills the iPhone Duo's inner screen.** The iPhone and iPad app is built with Xcode 27.1 and the iOS 27.1 SDK, as it has been since 1.0.58's iPhone and iPad build, which is what lets it fill the Duo's inner screen instead of stopping short of the status bar and camera.
- **No button sits under a camera at the side of the screen.** On a screen with the camera at its side, such as the iPhone Duo's outer screen, the bottom bar, the More sheet, and the Alerts inbox now pad their sides so their buttons stay clear of it. On an Android phone small enough to show the bottom bar when turned sideways, the bar and the More sheet keep clear of a camera cutout the same way. Where no camera sits at the side, as on every other iPhone held upright, nothing moves.
- **Tapping a filter field on a wide iPhone screen no longer zooms the page.** On an iPhone screen wider than 640 points, such as the Duo's inner screen or an iPhone turned sideways, filter fields and their labels now show at 16 points, as they already did on a narrower iPhone screen, so tapping one no longer zooms in. Some filter rows wrap onto one more line there, and Map Explorer's date range stacks its two dates so the year shows in full. iPad, the Mac, Windows, and the web are unchanged.

### Internal
- `.sr-navbar`, `.sr-nav-sheet` and `.sr-inbox-sheet` pad `env(safe-area-inset-left)` and `env(safe-area-inset-right)` in `.sr-ios-app` rules, with `.sr-android-app` twins reading `--sr-inset-left` and `--sr-inset-right` for the bar and the More sheet (the inbox has no Android twin). `bottomSurfaceSideInsets.test.ts` pins them, including the resolved cascade.
- The 16px focus-zoom floor gains an iPhone-only block above 640px, gated on `.sr-ios-app` and the shortest screen side (`max-device-width` or `max-device-height` 700px), so an iPad never matches. It carries the phone tier's two Map Explorer date-pair stacking rules. `filterControlSizeCss.test.ts` pins the gate and its threshold table.
- `iosMonitorLookups.test.ts` keeps tao's monitor lookups off iOS (tao issue 1373: on the Duo's inner screen `current_monitor()` and `available_monitors()` abort), deriving the desktop-only modules from `lib.rs`'s cfg attributes. Comments at `mod window_geometry;` and in that module's doc name the hazard; no code changed.
- iOS builds need Xcode 27.1 from this release on, and the release skill describes the iPhone Duo simulator check and the user's real-device check.
- The F-Droid changelog for this release is three identical files, one per processor-type build (`10000591.txt`, `10000592.txt`, `10000594.txt`), and the in-repo F-Droid recipe names 1.0.59.
```

- ASCII only, no em dash, American spelling, serial commas ("the bottom bar,
  the More sheet, and the Alerts inbox"; "iPad, the Mac, Windows, and the
  web"), in the file's register: a bold lead per item, then what a user gets.
- **1.0.58 already links the 27.1 SDK.** App Store Connect reports build
  1.0.58.1's `sdkBuild` as `24A94232`, the installed iOS 27.1 SDK's build
  (`xcrun --sdk iphoneos --show-sdk-build-version`), against `24A430` for
  1.0.57.1. So the fill comes with 1.0.58, and the first item says so rather
  than claiming the SDK move for 1.0.59. If 1.0.58's CHANGELOG is amended
  before 1.0.59 ships, re-read this item against it.
- The claims are held to what was measured. The outer screen's 84 pt right
  inset and the bar and sheet clearing it are QA's in-app readings; the inner
  screen is said to fill because of the SDK, which is the brief's basis, and
  its own insets are not claimed. "Nothing moves" is the all-zero-inset
  identity the guard pins. "Some filter rows wrap" is the Engineer's E2 cost
  (the Calendar strip gains a row at 669 and 951 pt and two at 874 by 402).
  Android landscape is stated by mechanism (the injected insets include the
  display cutout); no Android emulator ran for this build.

## (b) App Store "What's New", 1.0.59 (HELD for the user's yes)

```text
SnowRaven now fills the iPhone Duo's inner screen. On the Duo's outer screen, the bottom bar, the More sheet, and the Alerts inbox keep their buttons clear of the camera, and on a wide iPhone screen, such as the Duo's inner screen or an iPhone turned sideways, tapping a filter field no longer zooms the page.
```

- 309 characters, two sentences, ASCII only, no em dash, serial commas.
- It names no other platform (App Review Guideline 2.3.10) and makes no
  offline or network claim. It does not say "nothing changes elsewhere",
  because an iPhone turned sideways does change (16 pt filter fields).
- Its first sentence stays true whichever record reaches the store first: the
  iPhone Duo goes on sale on 2026-10-23, so no Duo owner has run an earlier
  SnowRaven. 1.0.58's approved What's New does not mention the Duo.
- **Under a rollup** (if 1.0.58's record is `WAITING_FOR_REVIEW` when 1.0.59
  ships and the user picks rollup), the record's What's New is 1.0.58's
  approved text followed by this one, as one text shown to the user whole
  before it is written:

```text
Splits and lumps on Species Detail now covers eBird's taxonomy updates from 2019 to 2025, adding the 2019, 2021, and 2022 updates. Species eBird split or lumped in those years now appear in the list, with what each was, what it became, and how many of your reports eBird reassigned.

SnowRaven now fills the iPhone Duo's inner screen. On the Duo's outer screen, the bottom bar, the More sheet, and the Alerts inbox keep their buttons clear of the camera, and on a wide iPhone screen, such as the Duo's inner screen or an iPhone turned sideways, tapping a filter field no longer zooms the page.
```

  The 1.0.58 paragraph is quoted from `pipeline/taxonomy-history-2019/held-copy.md`
  (a) as prepared; re-read it from 1.0.58's record if one exists by then,
  since the user may have amended it at their own gate.

## (c) F-Droid changelog (HELD for the user's yes)

Three files with the same text, one per processor-type build, and none under
the unsplit code `1000059`:
`fastlane/metadata/android/en-US/changelogs/10000591.txt`, `10000592.txt` and
`10000594.txt` (`10 * 1000059 + 1`, `+ 2` and `+ 4`).

```text
On a phone small enough to show the bottom bar when turned sideways, the bar and the More sheet now keep their buttons clear of a camera cutout at the side of the screen. Nothing else changes on Android.
```

- 203 characters (within `fastlaneMetadata.test.ts`'s 1 to 500, final newline
  not counted), ASCII only, no em dash. Each file's whole content is this text
  and one newline: 204 bytes, SHA-256
  `b9b0a93b51bcac9272b36897b6777497204f0c6f8123117a0fcc025c687097fc`.
- It is not (b) with Apple-only lines dropped, because every line of (b) is
  Apple-only. The one change an Android user can see is the bar and More
  sheet's side padding, and only in landscape on a phone narrow enough
  (640 dp or less) to show the bar there. "Nothing else changes on Android"
  holds: every other rule in the diff is gated on `.sr-ios-app`, and the rest
  is tests, comments and the release skill.
- Stated by mechanism, not by measurement: `MainActivity.kt` injects
  `systemBars() or displayCutout()` as `--sr-inset-*`, and the twins read the
  left and right ones. No Android emulator ran for this build. The ship's
  API 36 emulator check of the signed APK can add one landscape screenshot of
  the bar if that image's landscape width is 640 dp or less; if it is wider,
  the bar does not show there and the claim stays a mechanism.

## (d) The six-file version bump, 1.0.58 to 1.0.59

Values: version `1.0.59`; `bundle.android.versionCode` `1000059`
(`1 * 1000000 + 0 * 1000 + 59`); F-Droid per-processor codes `10000591`
(armeabi-v7a), `10000592` (arm64-v8a) and `10000594` (x86_64);
`CurrentVersionCode` `10000594`. Shapes read from the merged tree at 1.0.58.

| # | File | Exact change | Guard |
|---|---|---|---|
| 1 | `frontend/package.json` | `"version": "1.0.58"` to `"version": "1.0.59"` (line 3) | the source every guard below compares to |
| 1b | `frontend/package-lock.json` | the two `"version": "1.0.58"` lines (3 and 9, the root package) to `1.0.59`, as every bump since 1.0.56 | none; keeps `npm ci` honest |
| 2 | `src-tauri/tauri.conf.json` | `"version": "1.0.58"` (line 4) to `"1.0.59"`, and `"versionCode": 1000058` (line 80, kept on one line) to `1000059` | `androidVersionSource.test.ts` (agrees with package.json, code on the formula), `fdroidRecipe.test.ts`, `icloudKeysPublishedClaims.test.ts`, `release.sh`'s post-build `CFBundleShortVersionString` check |
| 3 | `CHANGELOG.md` | insert (a) above `## [1.0.58] - 2026-10-21` | `icloudKeysPublishedClaims.test.ts`, `it('the website version pill and footer follow the app version')` (`## [1.0.59]`), and its no-em-dash rows |
| 4 | `website/index.html` | line 48: `aria-label="Version 1.0.58">v1.0.58</span>` to `aria-label="Version 1.0.59">v1.0.59</span>`; line 526: `SnowRaven v1.0.58 ` to `SnowRaven v1.0.59 ` in the `footer-version` paragraph, the rest of that line untouched. Nothing else | the same row, a substring check that one correct string anywhere passes, so all three sites are moved by hand and read back |
| 5 | `fastlane/metadata/android/en-US/changelogs/10000591.txt`, `10000592.txt`, `10000594.txt` | three new files, (c) plus one newline each; none under `1000059` | `fastlaneMetadata.test.ts` |
| 6 | `pipeline/android-release/fdroid/com.dtgibson.snowraven.yml` | the three `Builds` entries' `versionName: 1.0.58` to `1.0.59` and `versionCode` `10000581` / `10000582` / `10000584` to `10000591` / `10000592` / `10000594`; `CurrentVersion: 1.0.59`; `CurrentVersionCode: 10000594`. Then, after the tag is pushed, a follow-up commit setting each entry's `commit:` from `507eb48e7d68662fb43b886a2c2d50441a40a841` to the full `git rev-parse v1.0.59^{commit}` (precedent `7de62264` at 1.0.58) | `fdroidRecipe.test.ts` |

Not in the bump, moving at the iOS leg: `src-tauri/gen/apple/snowraven_iOS/Info.plist`
and `snowraven_widgets/Info.plist` are stamped 1.0.59 build 1 by `tauri ios build`
and committed as `chore(ios): stamp iOS 1.0.59 build 1` before `release.sh`;
`iosSceneManifest.test.ts` (`it('the stamped iOS version never LEADS the app version')`)
holds the stamp behind or equal.

After the bump, before the commit: run the four named guards, then the FULL
vitest suite (CLAUDE.md: edits to text other guards pin), and `npm run build`.

## (e) No other published surface changes

- **README.md, website/ (beyond the version stamp), PRIVACY_POLICY.md,
  website/privacy.html, appstore/LISTING.md, appstore/REVIEW_NOTES.md, the
  F-Droid full description**: none describes the bottom bar's padding, filter
  field sizes, an SDK or the iPhone Duo. The build adds no request, host,
  permission or stored document, so the privacy policy is unaffected.
- **docs/HELP.md**: unchanged by the build and needs nothing.
- **App Store screenshots**: unchanged. Both sets are iPhone 6.9-inch and iPad
  13-inch in portrait. On those, the side insets are 0 (the identity the guard
  pins), the iPhone's portrait width is under 641 pt so the new floor does not
  match, and iPad never matches it. Both 05 Species Detail shots were
  recaptured by 1.0.58 and are already in the merged tree. iPhone Duo App Store
  screenshots are a separate follow-up (required from April 2027, and a
  listing change that needs the user's yes).
