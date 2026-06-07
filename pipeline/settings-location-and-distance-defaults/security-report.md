# Security Review — settings-location-and-distance-defaults

**Date:** 2026-06-07
**Stack:** react-vite frontend (local-first; Tauri desktop) + python-fastapi (untouched)
**Checklist:** security-react-vite.md + first-principles review
**Outcome:** PASSED

## Summary

A tiny, low-surface diff: a "Use my location" button in Settings that reuses the
existing `getCurrentLocation()` geolocation seam, a default radius change (25→5),
and a refactor extracting the `LocationError`→message mapping into one shared
helper. No new attack surface, no weakened control. One Informational item (a
privacy-policy transparency line) was raised and applied.

## Findings

### Privacy policy did not explicitly mention device-location use

**Severity:** Informational
**Location:** `PRIVACY_POLICY.md`
**Description:** The app can read the device's location (via the OS on desktop or
`navigator.geolocation` on web). This capability pre-existed in Map Explorer; this
change adds a second, more prominent entry point in Settings. The policy remained
accurate (coordinates stay on-device and are only sent on a user-initiated search),
but did not name device-location use.
**Remediation:** Added a "Your Location" section stating the app asks for
coordinates with permission, keeps them on-device, sends them outward only on a
user-initiated search, and that permission can be revoked. Effective date bumped.
**Status:** Resolved.

## Checks Performed

| Check | Result |
|---|---|
| No new outbound/network calls introduced (diff grep: fetch/transport/invoke/http) | Pass |
| `describeLocationError` returns only static strings — no user data interpolated (no XSS/injection) | Pass |
| No `dangerouslySetInnerHTML`, no new `localStorage`/`sessionStorage` | Pass |
| Detected coords stored via the existing `storage` seam (`map-defaults`), same as manual entry — no new persistence path | Pass |
| Geolocation uses the existing `lib/location.ts` seam — no new permission scope or native capability | Pass |
| No new dependencies | Pass |
| No secrets touched; backend unchanged | Pass |
| Privacy policy kept true (device-location transparency line added) | Pass |

## Convention Flags

None. The change consolidates duplicated error-message logic into the existing
`lib/location.ts` seam.
