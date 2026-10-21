# Change Brief: iOS 27.1 and iPhone Duo

## What is changing
The next iOS build moves from the iOS 27.0 SDK to Xcode 27.1 and the iOS 27.1 SDK. Linking against 27.1 is what lets the app fill the iPhone Duo's inner screen instead of stopping short of the status bar and camera. No Info.plist key is needed: the 27.1 UIKit headers and Xcode 27.1's known-key list add none, nothing in the repo pins an SDK, and the release recipe already builds with `/Applications/Xcode.app`. Around that SDK move, four repo changes:
- **Side insets on the full-width bottom surfaces.** `.sr-navbar`, `.sr-nav-sheet` and `.sr-inbox-sheet` are `position: fixed`, full width, and pad only the bottom inset, so a side camera inset would cover their end cells. They gain left and right padding in `.sr-ios-app` rules, plus `.sr-android-app` twins for the bar and the More sheet (the inbox has no Android twin by design). Pad, never move (`.claude/rules/ui.md`), and rewrite the stale "Top/left/right are not touched" comment above them.
- **Focus zoom above 640px, measured first.** The inner screen is 669x951 points, wider than the 640px phone tier, so an iPhone gets the rail layout there, and `.sr-input-16` (the 16px focus-zoom guard, which exists only in the phone tier) does not apply. If focusing a sub-16px field on the inner screen zooms the page, extend the guard. The gate is the Designer's call, because `isIOS()` cannot tell an iPhone from an iPad. If it does not zoom, record that null result.
- **A monitor-lookup guard (tao #1373).** On the Duo's inner screen, `current_monitor()` and `available_monitors()` abort, because `[window screen]` is nil and tao retains it unchecked. Today nothing reaches them: `window_geometry.rs` is `#[cfg(desktop)]`, Tauri's own lookups are desktop-only, and no frontend file calls `currentMonitor`/`availableMonitors`. A guard test keeps it that way.
- **Release skill.** The iOS section of `.claude/skills/snowraven-release/SKILL.md` states that Xcode 27.1 is required, notes the 27.1 simulator runtime, and describes the Duo check.
- **Unchanged:** the three scene-manifest plists (`src-tauri/Info.ios.plist`, `gen/apple/snowraven_iOS/Info.plist`, `gen/apple/project.yml`; never run xcodegen against it), `LaunchScreen.storyboard`, `src-tauri/vendor/tao`, `window_geometry.rs`, `tauri.conf.json`, the widget extension, `website/`, `README.md`, `appstore/`, `PRIVACY_POLICY.md`, and the version set, which is the Deployer's at ship.
- **Environment, not repo:** install the iOS 27.1 simulator runtime. Only 26.4, 26.5 and 27.0 are installed, and the `com.apple.CoreSimulator.SimDeviceType.iPhone-Duo` device type needs 27.1. Then create an iPhone Duo simulator. Build with `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` through the existing shims. `xcode-select` still points at the Command Line Tools and is left alone.
- **Out of scope:** fold or hinge awareness. The new 27.1 `UIHinge` and reserved-region APIs are native-only and would be a new capability, so the readiness run's no-fold-detection stance stands. Also out: iPhone Duo App Store screenshots (a listing change that needs the user's yes, required from April 2027, so a follow-up), iPad-band touch density, and the roadmap item for iPhone-landscape Settings below the fold (it needs the user's decision).

## Why now
The iPhone Duo ships on 2026-10-23 with iOS 27.1, two days from now, and Xcode 27.1 is installed on this Mac today. 1.0.57 was built with the 27.0 SDK, so on the Duo's inner screen it runs short of full screen. The next iOS build links 27.1 whatever else it carries, so the checks belong before that build. Measured for this brief from the simulator profile: outer display 1398x2034 at 3x (466x678 pt), inner 2007x2853 at 3x (669x951 pt). In a full-screen window the bottom bar therefore appears only on the outer screen in portrait. Neither display mask shows where the inner camera sits, so its real insets have to come from the simulator.

## User-facing impact
- **On the Duo:** the app fills the inner screen, and that comes from the SDK.
- **Everywhere else:** none on shipped iPhones, iPads, desktop or web. The new side padding reads insets that are 0 wherever the bar and sheets show today (phones in portrait), and it is gated on `.sr-ios-app` / `.sr-android-app`.
- **Could shift:** an Android phone narrow enough to show the bar in landscape (640dp or less), whose end cells would move clear of a side cutout. Also a narrow Duo window beside the camera.
- **The visible one:** if the focus-zoom guard is extended, form controls in the iOS app above 640px render at 16px instead of their desktop size. That reaches iPhone landscape and the Duo inner screen, and iPad too unless the gate can tell them apart.

## Design pass
Needed. The Designer covers four things:
- **The bottom surfaces:** the edges of the phone bar, the More sheet and the Alerts inbox sheet.
- **How the existing tiers land on the Duo:** outer portrait (bar), outer landscape 678x466 (rail, short), and inner 669x951 and 951x669 (rail or sidebar).
- **The open call:** whether to extend the focus-zoom guard above 640px, and on what gate.
- **What should feel better:** nothing sits under the camera or Dynamic Island, tapping a filter field on the inner screen does not zoom the page, and nothing changes on any other device.

The simulator look needs the 27.1 runtime installed first.

## Decisions touched
- **apple-platform-readiness (2026-09-15).** Verification item 3 called the stylesheet "per-side correct everywhere" and changed no CSS. That is true of every rule that insets a side, but the full-width bottom surfaces inset neither side, so this extends that finding. The no-fold-detection stance is kept.
- **Nav rework (v1.0.17)** and the `globals.css` note at `.sr-ios-app .sr-navbar` that top, left and right "are not touched on either": modified for left and right.
- **Safe-area overlays (v0.5.81)**, "pad, don't shrink; top/left/right only": applied, not changed.
- **Mobile-prep sweep (v0.5.55) and filter text size (v0.5.81, v1.0.33).** The focus-zoom guard is phone-tier only, with "desktop sizing untouched". This is modified only if the measurement shows zoom above 640px.
- **More sheet cap (v1.0.45)**, 528px measured at 393x852: unchanged. On the Duo's outer screen, 70dvh binds first and the sheet scrolls with Settings pinned. That is expected, not a defect.
- **tao vendoring (v1.0.31):** unchanged. #1373 is not patched because nothing calls the lookup, and the new guard keeps it so.

## What done looks like
- **Launch and fill:** an Xcode 27.1 simulator build launches on the iPhone Duo simulator and fills both displays, shown by screenshots, never a process check. That covers a cold launch on the inner display and a fold and unfold while running, if the Simulator can switch displays.
- **Insets and focus zoom:** portrait and landscape screenshots on both displays show no control under the camera. The focus-zoom question has a measured answer, `visualViewport.scale` after focusing a sub-16px field on the inner screen.
- **Tests:** the frontend suite, typecheck, lint, `androidInsetsCss.test.ts`, `safeAreaPerSide.test.ts` and the widget Swift tests pass under Xcode 27.1, and the new inset and monitor-lookup guards are seen red first.
- **Real device:** a check on a real Duo is the user's, and stays Partial until they have one.
