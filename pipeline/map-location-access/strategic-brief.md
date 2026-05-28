# Strategic Brief — Map Location Access

## What We're Building
A "Use My Location" button on the Maps tab that detects the user's current position and centers the map there, pre-filling the lat/lng fields. Works on both the Tauri desktop app and the web (Pi) version.

## Why Now
The Maps tab already exists and already has lat/lng inputs — but there's no way to populate them automatically. In the Tauri desktop app, `navigator.geolocation` is blocked by WKWebView's sandboxing; the user has to manually enter coordinates to use any of the three map modes. This makes the tab substantially less useful for anyone who wants to explore near their current location. `tauri-plugin-geolocation` wraps CoreLocation on macOS and CoreLocation/Android Location API on iOS/Android — building this now establishes the location infrastructure that the mobile app will inherit.

## The User Problem
A birder opens the Maps tab wanting to find hotspots near their current location or check for target species nearby. They have to look up their coordinates first, type them in manually, then fetch. On the Tauri desktop app, the browser geolocation API doesn't work at all. The friction is enough that most users skip the map modes entirely.

## Success Criteria
- Tapping "Use My Location" in the Tauri app triggers the macOS location permission dialog on first use
- After permission is granted, coordinates populate immediately and the active map mode fetches
- The web (Pi) version works identically using `navigator.geolocation`
- Permission denied, position unavailable, and timeout errors show actionable inline messages
- The button is disabled or shows a loading indicator while the position is being fetched

## Scope
- A location button (crosshair/locate icon) adjacent to the lat/lng fields in the Maps tab sidebar
- Tauri path: `tauri-plugin-geolocation` → `requestPermissions()` → `getCurrentPosition()`
- Web path: `navigator.geolocation.getCurrentPosition()` — already works in browsers
- Platform branching via the existing `isTauri()` seam in `platform.ts`
- Permission denied error shown inline (user can still enter coordinates manually)
- After position resolves, auto-triggers the active mode's fetch if coordinates were previously empty

## Out of Scope
- Continuous location tracking or location change listeners
- Saving current location as the default (user can do that manually with the existing Save button)
- Any UI changes outside the Maps tab sidebar
- Android or iOS support — that comes with the mobile app session

## Key Decisions
- Use `tauri-plugin-geolocation` for the desktop path, not a workaround via `navigator.geolocation` — the plugin is the right long-term answer and the mobile app will use the same plugin
- The location button populates the shared lat/lng state that all three map modes read — no mode-specific state
- One button handles both Tauri and web; platform detection happens inside the handler
