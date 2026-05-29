# Strategic Brief — Windows Geolocation

## What We're Building
Native location detection on Windows so "Use my location" in the Map Explorer works there, bringing Windows to full parity with the macOS and Pi/web clients. Replaces the v0.4.0 "coming later" note.

## Why Now
It closes the one parity gap Windows shipped with at v0.4.0, and the blocker that deferred it — no way to test — is gone now that Dave has a Windows 11 machine to verify against.

## The User Problem
A Windows birder can't one-click center the map on where they are; they're stuck typing coordinates or searching an address every time, while Mac and web users just tap a button.

## Success Criteria
- On Windows, "Use my location" returns the user's coordinates and recenters the map, with the same UX as macOS.
- When Windows location is off or denied, the app shows a clear, specific message (pointing the user to Windows location settings) — no crash, no silent failure.
- macOS and web/Pi location behavior is unchanged.
- The "coming later" note is gone on Windows; the button is back.
- Verified on the Windows 11 machine: permission allowed → real coordinates; permission off/denied → graceful guidance.

## Scope
- A native Windows `get_location` command using the official `windows` crate's `Geolocation.Geolocator`, gated to Windows (parallel to the macOS CoreLocation module), registered in the invoke handler for Windows.
- Frontend: `location.ts` calls `invoke('get_location')` on Windows too; remove the `unsupported-platform` degrade and the Map Explorer note; the button shows on Windows.
- Windows-tailored messaging for the "location off/denied" case.
- Update README/HELP to reflect that Windows now supports location.

## Out of Scope
- Mobile (iOS/Android) geolocation — that's the mobile app.
- Windows code signing — separate roadmap item.
- Any change to the macOS or web/Pi location paths.

## Key Decisions
- Use the native `windows` crate `Geolocator`, gated `#[cfg(target_os = "windows")]` — not `tauri-plugin-geolocation`, whose desktop support is unreliable. Mirrors the macOS code structure.
- Reuse the existing `LocationError` codes and UI; remove the `unsupported-platform` path added in v0.4.0.
- Windows uses a global OS location setting (no per-app prompt for an unpackaged `.exe`), so the "denied" guidance points to Windows Settings → Privacy → Location.
- Real-hardware verification on the Windows 11 machine is part of this feature's definition of done.
