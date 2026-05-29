# Security Review — Windows Geolocation

**Date:** 2026-05-28
**Stack:** Tauri (Rust) + react-vite-tailwind frontend
**Checklists:** security-react-vite.md (frontend) + a native-command/privacy assessment
**Outcome:** PASSED (no findings; one privacy note, by design)

## Summary
This adds a native Windows location command mirroring the existing macOS one. It accesses privacy-sensitive data (device location) but only on an explicit user click, respects the OS location permission, and keeps the result local — identical trust model to the macOS path. No secrets, no new network calls, no input handling, and the one new dependency is Microsoft's official `windows` crate.

## Findings
No security issues found.

## Privacy Note (by design, Informational)
- **Location is accessed only on explicit user action** ("Use my location") and gated by `RequestAccessAsync`, which honors the Windows OS location settings. The app cannot read location if the user hasn't enabled it.
- **The coordinates stay local** — used to recenter the map and populate the lat/lng fields that feed the user's own eBird/map queries (same flow as macOS/web). No new transmission or storage of location data.

## Checks Performed
| Check | Result |
|---|---|
| New attack surface | Pass — one Tauri command returning `{lat,lng}`; no new IPC inputs, no network |
| Permission respected (not bypassed) | Pass — `RequestAccessAsync`; not-Allowed → `permission-denied`, no fallback that evades the OS setting |
| Secrets in source | Pass — none |
| Input handling / injection | Pass — command takes no arguments; no `dangerouslySetInnerHTML` |
| New dependency provenance | Pass — `windows` crate (official Microsoft), scoped to the windows target only |
| Data flow / exfiltration | Pass — coordinates used locally, same as macOS; nothing new sent anywhere |
| Build scoping | Pass — windows crate not pulled on macOS/Linux; macOS `cargo check` clean |
| No macOS/web regression | Pass — existing location paths unchanged |

## Convention Flags
- None.
