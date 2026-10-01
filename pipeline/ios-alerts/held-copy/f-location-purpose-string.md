# Held proposal (f): the location purpose string (optional; default unchanged)

NOT APPLIED, and NOT REQUIRED: alerts under My location reuse the same When In Use grant with no new prompt, so App Review does not require a change (schema.md section 12). Shown in full so the user can choose.

**Current** (`NSLocationWhenInUseUsageDescription`, identical in `src-tauri/Info.ios.plist`, `src-tauri/gen/apple/snowraven_iOS/Info.plist` and `src-tauri/gen/apple/project.yml`):

> SnowRaven uses your location to center the map on your current position, and to measure distances in its home-screen widgets.

**Proposed, if the user wants alerts named:**

> SnowRaven uses your location to center the map on your current position, and to measure distances in its home-screen widgets and alerts.

Applying it touches the three files together (iosWidgetManifest.test.ts pins all three identical and names the widgets) and the privacy policy's quotation of the prompt in "Your Location", which would take the same clause.
