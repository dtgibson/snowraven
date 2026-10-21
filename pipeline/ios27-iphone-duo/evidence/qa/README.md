# QA evidence: ios27-iphone-duo (Tester, 2026-10-21)

Everything here was produced on the developer Mac with Xcode 27.1 (27A9275) and the
iPhone Duo simulator (udid D0CBEB76-7F70-4CDC-AB71-2A1F989317B7, iOS 27.1, 24A94425).
The simulator boots folded and this Xcode has no Simulator app, so every screenshot is
of the OUTER display (1398x2034 px, 466x678 pt). The inner display stayed black.

## Toolchain and build

- `xcode-version.txt`: `xcodebuild -version` (Xcode 27.1), `xcrun --sdk iphoneos
  --show-sdk-version` (27.1), the simulator SDK (27.1), the installed runtimes, the Duo.
- `app-build-sdk.txt`: the built SnowRaven.app links the 27.1 simulator SDK
  (`vtool`: platform IOSSIMULATOR, sdk 27.1; Info.plist DTSDKName iphonesimulator27.1,
  DTXcodeBuild 27A9275).
- `duo-enumerate.txt`: `simctl io enumerate` at the boot the screenshots were taken in.
- `npm-build.txt`, `typecheck.txt`, `lint.txt`: the pre-push gate, all exit 0.

How the simulator app was built (no signing credentials needed): `npm run build`, then
`cargo build --lib --target aarch64-apple-ios-sim --features tauri/custom-protocol` with
`/tmp/xcshim` first on PATH, the library copied to `gen/apple/Externals/arm64/debug/libapp.a`
(gitignored), then `xcodebuild -scheme snowraven_iOS -sdk iphonesimulator -configuration
debug CODE_SIGN_IDENTITY=- CODE_SIGNING_ALLOWED=YES build` with a no-op `npm` first on
PATH so the Build Rust Code phase is skipped (the ios-alerts recipe).

## Screenshots (outer display, downsized to 1017 px tall)

- `duo-outer-app-launch.png`: the clean build at launch, the Welcome screen filling the display.
- `duo-outer-clean-bar.png`: the clean build after Welcome was dismissed: the Weather tab and
  the phone bar, five labelled cells, the last one ending at the right inset.
- `duo-outer-HEAD-bar-for-comparison.png`: the same view from a build of HEAD's stylesheet:
  the five cells span the full 466 pt and More sits inside the right inset column.
- `duo-outer-probe-s1-welcome.png`, `duo-outer-probe-s2-bar.png`,
  `duo-outer-probe-s3-more-sheet.png`: a build whose `dist/index.html` loaded the
  evidence-only `qa-inset-probe.js` (never in source; `dist` and the library were rebuilt
  clean afterwards and the clean app re-verified). The yellow overlay prints what the app's
  webview reports: `env(safe-area-inset-*)` top/right/bottom/left 0/84/34/0 px, viewport
  466x678, the bar padded 0/84 px left/right with its cells from 0 to 382 pt, and the More
  sheet padded 0/84 px with its foot ending at 382 pt.
- `duo-inner-dark-at-launch.png`: the inner display while the app ran (black: folded).
- `duo-outer-zoom-13px-erased.png`, `duo-outer-zoom-16px-erased.png`: the focus-zoom
  reproduction in Safari after `simctl erase`, keyboard up: scale 1.230 at 13 px, 1.000 at 16 px.
- `duo-outer-zoom-13px-no-keyboard-not-counted.png`: a reused-Safari run where no input
  session started (keyboard down, scale 1.000), not counted.

## Text evidence

- `built-css-diff.txt` (with `qa-cssdiff.py`): the built stylesheet against a HEAD build, rule
  by rule, with the determinism control and the base rules of the four surfaces.
- `named-guards.txt`: the five named guard files, 130 tests passed.
- `guard-mutations.txt` (with `qa-mutate.py`): QA's own seven mutations, an unmutated baseline
  and a restored re-run, each restore checked by sha1 against the intended content.
- `widget-swift-tests.txt`: the widget extension's Swift tests on the Duo destination,
  143 passed, 0 failed.
- `zoom-repro-readings.txt`: every reading the Safari probe sent, by run tag.
