# Strategic Brief — Windows Desktop App

## What We're Building
A native Windows build of the SnowRaven Tauri app with full feature parity to the web/Pi and macOS clients — produced and released automatically via GitHub Actions, distributed unsigned with working in-app updates, and with "Use my location" gracefully degraded on Windows (clearly marked as coming later).

## Why Now
It completes the desktop client set — Pi/web, macOS, and Windows all available in parallel — before any mobile work begins (roadmap #1). The app is already ~90% portable thanks to the existing seams, so the cost is closing Windows-specific gaps, not rebuilding. Doing it now also hardens those seams for the mobile client that follows.

## The User Problem
Windows-using birders (Dave, and the small circle who'd use this) currently can't run the standalone desktop app — they're stuck on the web/Pi path, which needs the Python backend running somewhere. A native Windows app gives them the same self-contained, no-server experience Mac users already have.

## Success Criteria
- A Windows user downloads an installer from the GitHub release and runs SnowRaven standalone — no Python backend.
- Every tab/feature works: weather lookup, species detail, statistics, map explorer, breeding codes, life list comparer, settings, in-app help.
- API keys, settings, and data files persist in the Windows app-data directory and survive relaunch.
- The in-app update check works on Windows (the release's `latest.json` includes a Windows entry; the updater installs the new version).
- "Use my location" on Windows shows a clear "not available on Windows yet" note; address search, manual lat/lng, and saved default location all work.
- Windows artifacts are built automatically by GitHub Actions and attached to the same GitHub release as the macOS build.

## Scope
- A GitHub Actions workflow (`windows-latest`) that builds the Tauri Windows app, generates the updater artifacts, and uploads the installer + updater files to the GitHub release.
- Windows updater wiring so `latest.json` carries the Windows platform entry (minisign-signed updater bundle).
- Graceful degradation of "Use my location" on Windows (platform-detected, hidden/disabled with a short note).
- Unsigned distribution; document the one-time SmartScreen click-through for users.

## Out of Scope
- Windows code signing / Authenticode (a later add-on; updater works without it).
- Native Windows geolocation — deferred until it's worth the hands-on Windows testing.
- The mobile app (separate roadmap item; only "kept in mind" here via the seams).
- Any new user-facing features beyond parity.

## Key Decisions
- **Windows builds run in GitHub Actions** (`windows-latest`) — Dave can't readily build Windows on his Mac, and macOS can't cross-build it.
- **Unsigned for now** — the in-app updater is unaffected (Tauri verifies updates with its minisign key, not Authenticode). A first-launch SmartScreen "unknown publisher" warning is the accepted tradeoff.
- **"Use my location" degraded on Windows** with a "coming later" indication; existing fallbacks (address search, manual lat/lng, saved default location) cover location-setting.
- **Everything platform-sensitive stays behind the existing transport/storage/platform seams**, mobile-forward — no scattered OS checks; Windows branches use the existing platform detection.
- **The release becomes multi-platform** — macOS still built locally via `release.sh`, Windows via CI. Coordination point for the Architect/Engineer: both platforms' entries must end up in **one** `latest.json` on a single GitHub release, so the macOS (local) and Windows (CI) artifacts must be merged rather than overwrite each other.
- **A Windows 11 test machine is available but cumbersome** — reserve it for verification that can't be done any other way (a real-hardware smoke test of the installer and in-app updater). Everything else relies on CI builds and shared cross-platform logic/tests.
