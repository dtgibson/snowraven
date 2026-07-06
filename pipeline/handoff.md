## What We Accomplished

Built the **universal iOS/iPadOS SnowRaven app** and got it onto TestFlight, and
shipped a desktop/web patch that came out of testing it.

- The mobile app (iPhone + iPad, one universal build reusing the existing React
  frontend via Tauri v2) is built, tested, security-reviewed, and **live on
  TestFlight as build 1**. It ran on the iPhone and iPad simulators with your real
  data throughout.
- A phone-only Calendar bug found during testing — the day-of-month dates had gone
  missing on narrow screens — was fixed and **shipped as v0.5.64 to desktop and
  web** (live now).
- We tried to make the wide "Unbounded" tables (Breeding Codes, List Comparer)
  zoomable-and-beautiful on a phone, but the zoom wouldn't render right in the iOS
  WebView, so per your call it was **reverted** — those tables are exactly as they
  were before.

## What Has Been Saved

- **Mobile app committed to `main`** (`6268e39`, plus bundle-id fix `20f8e37`):
  the iOS/iPadOS target, platform seams, native file import, and the committed
  Xcode project. Public surfaces (README/website/docs/privacy) stay silent about
  mobile until App Store launch, by your decision.
- **v0.5.64 shipped** (`378d490`, tag `v0.5.64`): the phone calendar-dates fix,
  live as a GitHub release marked *Latest* (notarized macOS DMG + updater, signed
  Windows installer, `latest.json` for all platforms). This was also the first
  green Windows CI build carrying the mobile Rust code — the cross-platform gating
  held.
- **TestFlight build 1** (v0.5.63) uploaded to App Store Connect under
  `com.dtgibson.snowraven`.
- Full pipeline record for the mobile app in `pipeline/mobile-app/` (brief, PRD,
  schema, design, QA, security, decisions, how-to-see, privacy labels, simulator
  screenshots).
- Everything green: 1469 frontend tests, typecheck, lint, build, and the Rust
  desktop check.

## Where We Are

**Paused at Stage 8 (The Deployer), feature kept open.** The mobile app hit its
TestFlight milestone; you expect more TestFlight rounds before the App Store.

Your open steps, for whenever you're ready:
- In App Store Connect → TestFlight, add yourself as an internal tester so build 1
  installs via the TestFlight app on your iPhone and iPad.
- Eventually, the App Store submission (the package is prepared; the mobile
  announcement across README/website/privacy happens at that point).
- A one-time machine fix that removes the iOS-build shim workaround:
  `sudo xcode-select -s /Applications/Xcode.app` (needs your password).

Deferred: a fresh TestFlight build 2 (would carry the v0.5.64 calendar fix), and a
future, different approach to a phone-friendly wide-table overview (CSS zoom
proved unreliable in the WebView).

## Resume Prompt

Run `/weft` in this project. It reads saved state and picks up the paused
mobile-app run at Stage 8.
