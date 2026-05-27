# Bug Brief: Location Permission Denied Without Prompt

## Symptom
"Use my location" returns "access was denied" on both the Tauri desktop app and the web version, without ever showing a permission dialog. No SnowRaven entry appears in System Settings → Location Services.

## Root Causes

### Desktop (Tauri macOS)

**Blocker 1 — Missing entitlement:**
The built app has no embedded entitlements (`codesign` confirms empty entitlements). Hardened runtime is enabled (`flags=0x10000`). Without `com.apple.security.personal-information.location`, macOS silently blocks all CoreLocation access before any dialog appears.

**Blocker 2 — wry missing WKUIDelegate geolocation method:**
`wry-0.55.1`'s `WryWebViewUIDelegate` implements `WKUIDelegate` for file panels and media capture, but does NOT implement `webView:requestGeolocationPermissionFor:initiatedByFrame:decisionHandler:`. On macOS 12+, this method is required to show the system location permission dialog. Without it, every `navigator.geolocation.getCurrentPosition()` call is silently denied at the WKWebView layer before the OS is even consulted.

These two blockers together mean `navigator.geolocation` cannot work in Tauri on macOS regardless of what the frontend does. Entitlements alone won't fix it; the WKUIDelegate issue is in wry's source.

**Fix required:** Native Rust Tauri command using `CLLocationManager` directly, bypassing WKWebView's geolocation entirely. Add `com.apple.security.personal-information.location` entitlement. Update `location.ts` to use `invoke('get_location')` in Tauri.

### Web (Pi / HTTP origin)

Modern browsers block `navigator.geolocation` on non-HTTPS origins. `getCurrentPosition()` returns `PERMISSION_DENIED` (code 1) immediately, without showing a dialog. The current error message says "Location access was denied" — misleading, since the user never had a chance to deny anything.

**Fix required:** Detect `!window.isSecureContext` before calling geolocation and return a new `'insecure-context'` error code. Show a clear message: "Location requires a secure connection (HTTPS). Enter coordinates manually."

## Files to Change

- `src-tauri/entitlements.plist` — NEW: `com.apple.security.personal-information.location`
- `src-tauri/tauri.conf.json` — Reference the entitlements file
- `src-tauri/Cargo.toml` — Add `objc2-core-location = "0.3"` for macOS
- `src-tauri/src/location.rs` — NEW: CLLocationManager Tauri command
- `src-tauri/src/lib.rs` — Register new command
- `frontend/src/lib/location.ts` — Use `invoke` in Tauri; detect insecure context for web
- `frontend/src/components/MapExplorer.tsx` — Handle `'insecure-context'` error code

## Out of Scope
- HTTPS for the Pi server (separate infrastructure concern)
- Fixing wry's missing WKUIDelegate method (upstream change)
