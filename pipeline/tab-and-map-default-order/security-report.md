# Security Review — Tab and Map Default Order

**Date:** 2026-06-17
**Feature:** tab-and-map-default-order
**Stack:** react-vite-tailwind frontend, python-fastapi backend
**Checklist:** security-react-vite.md, security-fastapi.md
**Outcome:** PASSED

---

## Summary

This change only adjusts existing UI defaults and ordering: tab layout defaults, List Comparer mode defaults, and Map Explorer mode button order. It adds no API routes, providers, secrets, persistence format, authentication path, user-input rendering path, or backend code. No security issues were found.

---

## Findings

No security issues found in this feature.

---

## Checks Performed

| Check | Result |
|---|---|
| React/Vite secrets: no API keys, tokens, or secrets in changed source | Pass |
| React/Vite secrets: no new `VITE_` variables or client-exposed env values | Pass |
| React/Vite secrets: `.env` and `.env.local` ignored | Pass |
| React/Vite config: no credentials in committed Vite/Tauri/package config | Pass |
| API communication: no new direct third-party calls added | Pass |
| API communication: no new backend base URL or hardcoded external API URL added | Pass |
| API communication: existing error handling paths unchanged | Pass |
| Authentication state: no auth token storage added or modified | Pass |
| Authentication state: no protected-route logic added or weakened | Pass |
| Input handling: no new user-generated HTML rendering added | Pass |
| Input handling: no new user/external URLs interpolated into `href` or `src` | Pass |
| Input handling: saved tab-layout IDs still pass through known-tab filtering | Pass |
| Dependencies: no dependency changes added | Pass |
| Dependencies: `npm audit --omit=dev --audit-level=high` found 0 vulnerabilities | Pass |
| Build output: no source-map setting added | Pass |
| Build output: no debug logging or `debugger` statements added in changed source | Pass |
| FastAPI auth/authorization: no backend endpoints changed | Pass |
| FastAPI injection: no backend query, file path, XML, subprocess, eval, or exec path changed | Pass |
| FastAPI dependencies: no backend dependency file changed | Pass |
| FastAPI input validation: no request body, query, path parameter, or upload validation changed | Pass |
| FastAPI error handling: no backend exception behavior changed | Pass |
| FastAPI environment variables: no committed credentials or env changes added | Pass |
| FastAPI CORS/headers: no CORS, header, or HTTPS behavior changed | Pass |
| FastAPI rate limiting: no compute-heavy or external-call backend endpoint changed | Pass |

---

## Evidence

- Default tab order remains a closed typed list and only changes sequence: `frontend/src/lib/tabLayout.ts:12`.
- Saved layout normalization still drops unknown tab IDs and appends missing known tabs through `DEFAULT_TAB_ORDER`: `frontend/src/lib/tabLayout.ts:72`.
- Map Explorer mode order is a typed constant of existing `ViewMode` values only: `frontend/src/lib/mapViewModes.ts:3`.
- List Comparer default mode changes from one existing branch to another existing branch: `frontend/src/components/ListComparer.tsx:33`.
- Map Explorer button rendering still routes to existing handlers for Hotspots, Media Targets, and Nearby Lifers: `frontend/src/components/MapExplorer.tsx:1644`.
- Static scan of changed files found no new secrets, env exposure, `javascript:` URLs, eval/exec calls, or new dynamic HTML path.
- `git diff --check` passed.
- `npm audit --omit=dev --audit-level=high` reported 0 vulnerabilities.

---

## Residual Risk

Low. This is a UI default/order change. The only persistent-data interaction is the existing tab-layout localStorage path, which already validates known tab IDs and falls back safely for malformed data.
