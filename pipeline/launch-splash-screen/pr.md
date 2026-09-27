## Launch Splash Screen

### What this does

Replaces the pre-React wordmark and spinner with SnowRaven's white raven on its green field, then removes that surface as soon as the correct welcome screen or app shell commits. The iOS launch storyboard uses the same color, glyph master, and 88-point geometry so native launch can lead into the shared frame.

### How to test

The user approved the existing automated suite and local simulator/browser evidence for this TestFlight closeout. The seven broader checks described in `prd.md` and `qa-report.md` are deferred and remain Partial; the steps below document the original verification scope for a future run.

1. Open the built app from a fresh page load or cold app launch. A fast start may go directly to the destination.
2. Hold the entry bundle and check the first frame, 2-second status, and 15-second Reload fallback. Release the bundle and check that the app takes over immediately.
3. Force an entry-module failure and check that Reload appears immediately.
4. On iPhone and iPad, record cold launches in light and dark settings and inspect the native-to-webview handoff, rotation, and window resizing. Check a cold widget link and a warm widget link.
5. At 320px width and 200% text size, check status wrapping, Reload reachability, and the accessibility tree.

### Notes for reviewer

- The splash adds no minimum duration, provider call, data read, or telemetry. It waits only for existing first-run and saved-layout decisions, plus the iOS parked-link check needed to avoid a wrong-tab flash. Those checks begin in parallel.
- The bundled frontend inlines the committed SVG, so its first frame adds no image request. The native PNGs can be regenerated from that master with `pipeline/launch-splash-screen/generate-native-raven.py`.
- Frontend build, lint, full suite, Chromium/WebKit small-screen checks, and a fresh iOS simulator archive passed. Recorded iPhone and iPad simulator cold launches show the native green/raven frame through the webview handoff to welcome. The signed 1.0.37.1 build is VALID and IN_BETA_TESTING in TestFlight. The seven deferred QA rows and the signed build's launch behavior remain unverified; see `qa-report.md`.
- The approved website version pill/footer stamp, both version manifests, and changelog were updated to 1.0.37. README and App Store listing copy were not changed. No App Store submission or other platform release is part of this TestFlight closeout.
