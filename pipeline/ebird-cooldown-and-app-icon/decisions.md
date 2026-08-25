# Decisions — ebird-cooldown-and-app-icon (v0.5.93)

- **Clustered run (user-directed):** the eBird cooldown extension (the top
  v0.5.92 residual) and the new app icon shipped as one Improve run, per the
  user's explicit request at the lane fork.
- **Design pass ratified in chat (2026-08-24):** (A) macOS icns rebuilt on
  the Apple icon grid (tile 824/1024, transparent margin) rather than
  shipping the provided full-canvas icns — so the Dock icon sits at
  native-app size; (B) the website's favicon and header logo come along,
  rebuilt from the traced vector master, ending the era of the site carrying
  a different bird glyph than the app.
- **Autopilot loosening (explicit, user-stated):** after approving the
  design, the user said "build the rest on autopilot and ship when ready,
  unless you have a question along the way" — an explicit mode statement
  plus an advance production sign-off. Stages 3–7 ran hands-off; the deploy
  proceeded on that standing authorization with the stop-on-blocker clause
  honored.
- **One enforcement point per request:** /map/hotspot-activity stays out of
  the transport gate (the activity controller enforces the identical
  contract over the same shared state). The alternative — gating it twice —
  would double-space its starts.
- **Accepted cost, stated:** a transport-cache miss served by an inner cache
  (backend recent-obs single-flight; desktop raw-fetch dedupe) still waits
  for a start slot. Bounded at 150 ms spacing; conservative during a
  cooldown; documented in ebirdGate.ts.
- **Icon source artwork committed** under `icon-source/` so the repo never
  depends on a Downloads folder for a future regeneration.
- **Android icons regenerated though dormant** (no gen/android project), so
  a future Android bring-up cannot ship the old mark; adaptive background
  moved #fff → #2D8653.
