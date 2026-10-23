# Held copy: Duo Welcome and audit fixes (1.0.60)

**Status: HELD. Nothing below has been written to a published surface.**
Prepared by The Engineer, 2026-10-22. Both texts are published copy and wait
for the user's explicit yes (CLAUDE.md, published copy). On a yes, (a) is
written as three files in the version-bump commit, before the tag, because
F-Droid reads the folder at the tag; (b) goes to App Store Connect when a
record carries 1.0.60, after the user's own check of TestFlight build 1.0.60.1.

`CHANGELOG.md`, the in-app text and the version stamp are not held and are
already in the working tree.

## (a) F-Droid changelog, 1.0.60 (HELD until approved)

Three files with the same text, one per processor-type build, and none under
the unsplit code `1000060`:
`fastlane/metadata/android/en-US/changelogs/10000601.txt`, `10000602.txt` and
`10000604.txt` (`10 * 1000060 + 1`, `+ 2` and `+ 4`).

```text
The Welcome screen that greets a new user now keeps its text and buttons clear of a camera cutout at the side of the screen when the phone is turned sideways, and leaves room for the status bar at the top. Nothing else changes on Android.
```

- 238 characters (within `fastlaneMetadata.test.ts`'s 1 to 500, final newline
  not counted), ASCII only, no em dash, American spelling. Each file's whole
  content is this text and one newline: 239 bytes, SHA-256
  `1ea3ae3760bdd55c9d69f5bd9f99c9001fafe911277193dce2effab40f5b76a5`.
- Register of `changelogs/10000594.txt`: what an Android user sees, then
  "Nothing else changes on Android."
- What it rests on: the `.sr-android-app .sr-welcome-panel` twin pads the top
  and both sides by `calc(base + var(--sr-inset-X, 0px))`, and
  `MainActivity.kt` injects `systemBars() or displayCutout()` as those
  variables, so the side padding follows a landscape cutout and the top
  follows the status bar. Stated by mechanism: no Android emulator ran for
  this build. "Nothing else changes on Android" holds: the capability change
  is iOS-only (`platforms: ["iOS"]`), the toolchain move leaves the built
  stylesheet byte-identical and changes no app behavior, and the rest is tests.

## (b) App Store "What's New", 1.0.60 (HELD until approved)

```text
The Welcome screen that greets a new user now keeps its text and buttons clear of the camera on the iPhone Duo's outer screen, and leaves room for the status bar at the top of every iPhone and iPad screen.
```

- 205 characters, one sentence, ASCII only, no em dash. It names no other
  platform (App Review Guideline 2.3.10) and makes no offline or network
  claim.
- The claims are the measured ones: on the Duo simulator's outer screen the
  app's webview reports a right inset of 84 pt and the card now spans x = 24
  to 358 (it was 24 to 442); the top padding is the status-bar inset plus the
  old 32 px, on every iPhone and iPad (`decisions.md`, A).
- **If 1.0.59's record (`a0511485`) is still `WAITING_FOR_REVIEW` and the user
  picks a rollup,** the record's What's New is its current text followed by
  this paragraph, shown to the user whole before it is written. The current
  text, as approved at the 1.0.59 ship (1.0.58's paragraph, then 1.0.59's);
  re-read it from the record before writing, in case it was amended:

```text
Splits and lumps on Species Detail now covers eBird's taxonomy updates from 2019 to 2025, adding the 2019, 2021, and 2022 updates. Species eBird split or lumped in those years now appear in the list, with what each was, what it became, and how many of your reports eBird reassigned.

SnowRaven now fills the iPhone Duo's inner screen. On the Duo's outer screen, the bottom bar, the More sheet, and the Alerts inbox keep their buttons clear of the camera, and on a wide iPhone screen, such as the Duo's inner screen or an iPhone turned sideways, tapping a filter field no longer zooms the page.

The Welcome screen that greets a new user now keeps its text and buttons clear of the camera on the iPhone Duo's outer screen, and leaves room for the status bar at the top of every iPhone and iPad screen.
```

## (c) No other published surface changes

- README.md, website/ (beyond the version pill, its `aria-label` and the
  footer line), PRIVACY_POLICY.md, website/privacy.html, appstore/LISTING.md,
  appstore/REVIEW_NOTES.md and the F-Droid full description: none describes
  the Welcome screen's padding, the capability grants or the build tools. The
  build adds no request, host, permission or stored document.
- docs/HELP.md: unchanged; it does not describe the Welcome screen's layout.
- App Store screenshots: unchanged. No screenshot in `appstore/screenshots/`
  shows the Welcome screen (all twelve are tab views).
