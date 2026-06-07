# Security Review — weather-tides

**Date:** 2026-06-07
**Stack:** react-vite frontend (+ Tauri desktop) + python-fastapi backend
**Checklists:** security-react-vite.md, security-fastapi.md + first-principles
trust-boundary/privacy review (3 lenses, each finding adversarially verified by 3)
**Outcome:** PASSED

## Summary

A new external integration (NOAA CO-OPS, keyless) keyed off an eBird checklist,
dual-runtime. The audit found **no confirmed security or privacy defects**. The
route mirrors the weather path's hardening; the one Informational note was
proactively addressed.

## Findings

### TS formatTide built a RegExp from a string constant (latent fragility)

**Severity:** Informational (refuted as exploitable — safe today)
**Location:** `frontend/src/lib/tideFormatter.ts`
**Description:** `formatTide` used `body.replace(new RegExp(`${NOAA_CREDIT}$`), …)`.
`NOAA_CREDIT` ("Tide data from NOAA CO-OPS") contains no regex metacharacters, so
it was safe — but treating a constant as a pattern is fragile if the constant ever
changes. Not user-controlled, so not exploitable.
**Remediation:** Replaced with a plain `endsWith` + `slice` (matching the Python
formatter). No RegExp.
**Status:** Resolved.

## Checks Performed

| Check | Result |
|---|---|
| XSS — tide block rendered as `<pre>` text, notice station name as escaped JSX child; no `dangerouslySetInnerHTML` | Pass |
| NOAA URL build — `encodeURIComponent` (TS) / httpx params dict (Python); host constant; station id from bundle; no injection/SSRF | Pass |
| No secrets in the tide path; NOAA keyless; eBird key reuse unchanged; no key in URL/log | Pass |
| No coordinates sent to NOAA — queried by station id only; lat/lng used locally to pick the station | Pass |
| Input validation — `/tide/{id}` S-regex (mirrors weather); `force` is a typed bool | Pass |
| Error handling — 400/500/502 mirror weather; NOAA error bodies parsed, never trusted by status; no internal leakage | Pass |
| Parsing — bounded regexes (no ReDoS) over short NOAA bodies; malformed bodies → [] | Pass |
| Station bundle — constant file path (lru_cache), trusted asset, no traversal | Pass |
| No new third-party origin beyond NOAA; PRIVACY_POLICY updated; no new logging | Pass |
| No new `localStorage`/secret persistence | Pass |

## Convention Flags

None. The feature reuses the transport/tauriFetch seams and the weather route's
validation + error shape.
