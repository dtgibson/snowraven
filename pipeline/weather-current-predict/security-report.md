# Security Review — Weather & Tide: Current & Predict

**Date:** 2026-06-13
**Feature:** weather-current-predict
**Stack:** python-fastapi (backend) + react-vite (frontend)
**Checklists:** security-fastapi.md, security-react-vite.md
**Outcome:** PASSED WITH NOTES

---

## Summary

A focused review of the two new routes (`/weather/at`, `/tide/at`), their services, and the new `WeatherForecastPanel` / `PredictMap` UI against the FastAPI and React-Vite checklists, plus SnowRaven's standing security conventions and the published privacy policy. The code is clean on injection, secrets, XSS, input validation, and error handling, and adds no new dependencies or third-party providers. One real finding — the privacy policy did not reflect the new live/forecast use of OpenWeather and NOAA or that "Current" sends device coordinates to them — has been resolved in this stage. No Critical or High findings; deployment is not blocked.

---

## Findings

### 1. Privacy policy did not reflect the new live/forecast data flow
**Severity:** Low (mandatory under "keep published statements true")
**Location:** `PRIVACY_POLICY.md`
**Description:** The policy described OpenWeather and NOAA as historical and checklist-bound, and the "Your Location" section listed only hotspot/sightings searches as sending device coordinates outward. Current/Predict now use OpenWeather for live + forecast weather and NOAA for live + predicted tide, for the device location or an arbitrary place — and tapping "Current" sends device coordinates to OpenWeather and NOAA. No new provider and no new category of data, but the disclosure was no longer accurate. A stale privacy policy is a liability.
**Remediation:** Broaden the OpenWeather and NOAA entries to cover current/forecast/predicted weather and tide for a chosen location and time; add the "Current" lookup to the "Your Location" section as an outbound use of device coordinates; bump the effective date.
**Status:** Resolved (done this stage; effective date → June 13, 2026).

### 2. New routes do not range-validate lat/lng server-side (defense in depth)
**Severity:** Informational
**Location:** `backend/routers/weather.py` (`/weather/at`), `backend/routers/tide.py` (`/tide/at`)
**Description:** `lat`/`lng` are typed as floats (FastAPI coerces and rejects non-numerics) but are not bounded to valid geographic ranges server-side. The frontend now validates bounds, and an out-of-range value simply yields an upstream error or a too-far/outside-us result — no injection, no data exposure (values flow only into typed provider query params and haversine math). Noted only as optional hardening; consistent with the existing checklist routes.
**Status:** Accepted (no action; not a security risk).

### 3. No rate limiting / security headers on the new endpoints (pre-existing posture)
**Severity:** Informational
**Location:** app-wide
**Description:** The new local endpoints have no rate limiting or security-header middleware — identical to the existing `/weather/{id}` and `/tide/{id}` routes. SnowRaven is a single-user, self-hosted / desktop app with no public multi-tenant exposure, so this matches its deliberate model. The Nominatim client keeps its own 1-req/sec limiter for ToS compliance. Not introduced by this feature.
**Status:** Accepted (consistent with the app's existing local-only posture).

---

## Checks Performed

| Check | Result |
|---|---|
| FastAPI — auth on protected endpoints | Pass (N/A — no accounts/auth by design; routes are local single-user) |
| FastAPI — injection (eval/exec/subprocess/os.system) | Pass — none; lat/lng are floats, dt parsed via `strptime` |
| FastAPI — SQL/string-built queries | Pass (N/A — no database) |
| FastAPI — path traversal from user input | Pass (N/A — no filesystem access in the new routes) |
| FastAPI — query/path params typed & validated | Pass — `lat: float`, `lng: float`, `dt: str \| None`; bad `dt` → 400 |
| FastAPI — request size limits | Pass (N/A — GET, no body) |
| FastAPI — unhandled exceptions → generic 5xx, no stack traces | Pass — provider failures caught → generic 502 message |
| FastAPI — new dependencies | Pass — none added (reuses httpx, timezonefinder) |
| FastAPI — secrets from env, none hardcoded | Pass — `OPENWEATHER_API_KEY` via `os.getenv`; `.env` gitignored |
| FastAPI — CORS explicit (not wildcard) | Pass — unchanged (`allow_origins` explicit) |
| FastAPI — rate limiting | Finding 3 (informational, pre-existing posture) |
| FastAPI — lat/lng range validation | Finding 2 (informational, defense-in-depth) |
| React-Vite — no API keys/secrets in source | Pass — keys via the storage seam; none in source/config |
| React-Vite — no `VITE_` secrets added | Pass — none added |
| React-Vite — `dangerouslySetInnerHTML` / XSS | Pass — all values escaped JSX; the HTML-bearing copy string shows as literal text in a `<pre>` |
| React-Vite — URLs from user/external data in href/src | Pass — none; no `javascript:` sink; Nominatim `display_name` is not rendered |
| React-Vite — error responses handled gracefully | Pass — caught → "unavailable" messaging, no raw errors shown |
| React-Vite — client-side input validation | Pass — lat/lng bounds + finite checks, date `min`, coord guards |
| React-Vite — console logs with sensitive data | Pass — none added |
| React-Vite — new dependencies | Pass — none (PredictMap uses existing react-map-gl/maplibre) |
| React-Vite — source maps in production | Pass — not emitted (vite default) |
| SnowRaven standing — map popup / marker XSS | Pass — the Predict pin is a static SVG; no HTML-string popup |
| SnowRaven standing — privacy policy reflects providers/data flow | Finding 1 (resolved this stage) |

---

## Convention Flags
- None new. (The privacy-policy-must-stay-true rule is already documented in `CLAUDE.md`; this review exercised it.)
