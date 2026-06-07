# Security Review — perf-loading-and-indicators

**Date:** 2026-06-07
**Feature:** perf-loading-and-indicators (performance sweep, batches E/G/H + wrap-up)
**Stack:** python-fastapi backend + react-vite frontend (local-first; Tauri desktop with TS services)
**Checklists:** security-react-vite.md, security-fastapi.md (cross-check), + first-principles trust-boundary review
**Outcome:** PASSED

---

## Summary

Audited the sweep diff (`1564cd6..HEAD` on `improve/performance`) with three parallel
auditors: the React+Vite checklist, the FastAPI checklist as a boundary cross-check
(the diff contains no Python), and a first-principles pass over the new modules
(`networkCache.ts`, `regionInfo.ts`) and the GL marker rewrite. No security findings.
The diff is on net slightly security-positive: the GL marker rewrite **removed** a
`dangerouslySetInnerHTML` site (the per-marker teardrop div is now a canvas-sprite
symbol layer). One Informational note (a cache-staleness nicety, not a vulnerability)
was raised and has been fixed.

---

## Findings

### eBird key change did not evict the short-TTL network cache

**Severity:** Informational
**Location:** `frontend/src/lib/networkCache.ts`, `frontend/src/components/Settings.tsx`
**Description:** The network cache keys entries on path + non-sensitive params (and
`region-info:{locId}`) — the eBird key is correctly excluded from cache keys and never
logged, and cached payloads are public bird/region data with no secret. The only
consequence was staleness: changing the eBird key in Settings did not clear the cache,
so data fetched under the old key could be served for up to the 90 s TTL. Not a
security issue — the old key already succeeded in fetching that exact public data, and
failures (e.g. a transient 401 from a bad key) are never cached.
**Remediation:** Wired `clearNetworkCache()` into the eBird key save and delete paths
in `Settings.tsx`, alongside the existing `clearEbirdObservationsCache` /
`clearMLExportCache` calls, so a key change invalidates live eBird responses immediately.
**Status:** Resolved.

---

## Checks Performed

| Check | Result |
|---|---|
| No secrets in source; keys from env / AppLocalData, never in code | Pass |
| API key never enters a cache key or log (networkCache, regionInfo) | Pass |
| Errors never cached (no cached 401/403; key fix takes effect next call) | Pass |
| Cache-key normalization does not reach the backend (raw params sent; backend bounds intact) | Pass |
| No new external origin fetched (PRIVACY_POLICY obligation) | Pass |
| Map popups remain escaped JSX; atlas URL `encodeURIComponent`-wrapped | Pass |
| No new `dangerouslySetInnerHTML` on dynamic text (one site removed) | Pass |
| No `localStorage`/`sessionStorage` for secrets introduced | Pass |
| No new dependencies (lockfile is version-field only) | Pass |
| No console logging of sensitive data | Pass |
| FastAPI backend unchanged (no Python in diff); no control bypass via frontend | Pass |
| Status chips / indicators are static literals or ARIA-only | Pass |

---

## Convention Flags

None. The existing standing checks (escaped-JSX popups, keys-in-headers-only,
cache invalidation wired from Settings) all held; the network cache now follows
the same Settings-invalidation pattern as the CSV caches.
