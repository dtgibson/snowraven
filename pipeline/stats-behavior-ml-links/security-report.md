# Security Review — stats-behavior-ml-links

**Date:** 2026-06-16
**Feature:** stats-behavior-ml-links — Statistics media-behavior ML links + per-breeding-behavior links + media-coverage denominator fix
**Stack:** react-vite-tailwind frontend (the change) + python-fastapi backend (untouched)
**Checklist:** reference/checklists/security-react-vite.md (frontend). FastAPI checklist not applicable — no backend code changed.
**Outcome:** PASSED

---

## Summary

Frontend-only change. It adds outbound Macaulay Library catalog links and a pure
coverage-denominator fix — no new network calls, no new dependencies, no secrets, no
auth, no backend surface. Every link URL is built from a hardcoded `https://media.ebird.org/catalog`
host plus a trusted constant tag-slug map plus a regex-constrained,
`encodeURIComponent`-wrapped userId, and is rendered through the shared `OutboundLink`
(`target="_blank"`, `rel="noreferrer"`, no `dangerouslySetInnerHTML`). No injection or
data-egress concern, and no privacy-policy change is required. Clean pass, no findings.

---

## Findings

No security issues found in this feature.

---

## Checks Performed

| Check | Result |
|---|---|
| No secrets/keys/tokens in new source | Pass — none; no env vars added |
| `VITE_` vars client-side are non-sensitive | Pass — N/A, none added |
| `.env`/`.env.local` gitignored | Pass — unchanged |
| No credentials in committed config | Pass — only the version field changed in `tauri.conf.json`/`package.json` |
| API calls go through the backend; no key-exposing third-party calls | Pass — the change adds no API calls; the catalog URL is a user-clicked navigation, not a keyed request |
| API base URLs from env, not hardcoded | Pass — N/A; the catalog base is a public user-facing link, not an API endpoint |
| API error responses handled; no raw details shown | Pass — N/A, no new fetches |
| Auth tokens not in localStorage / auth state / protected routes / refresh | Pass — N/A, the app has no authentication |
| No `dangerouslySetInnerHTML` with unsanitized input | Pass — none introduced; links render via `OutboundLink` (React-escaped `href`) |
| URLs validated before `href`; no `javascript:` URLs | Pass — scheme+host are the hardcoded `https://media.ebird.org/catalog`; `slug` is from the trusted `BEHAVIOR_TAG_SLUG` constant; `userId` is `[A-Za-z0-9]+` (`extractUserId`) and `encodeURIComponent`-wrapped — data cannot influence the scheme/host |
| Form inputs validated | Pass — N/A, no forms |
| No known-vulnerable packages | Pass — no dependencies added or changed |
| react/vite on supported versions | Pass — unchanged |
| No unused deps added | Pass |
| Source maps not deployed to prod | Pass — build config unchanged |
| No console logs with sensitive data | Pass — no debug code added |
| No dev-only/debug code paths added | Pass |

---

## Informational Notes (not findings)

- Outbound links correctly carry `rel="noreferrer"` via the shared `OutboundLink` — no referrer leak, no reverse-tabnabbing.
- **No `PRIVACY_POLICY.md` change required.** `media.ebird.org` is the same Cornell Lab / eBird media catalog already used by the Multimedia tab (v0.5.33) and covered by the policy's Cornell-Lab disclosure. The new links are user-initiated navigations (the app itself sends nothing), so the "collects nothing / no server" posture is unchanged. The base-URL consolidation (`search.macaulaylibrary.org` → `media.ebird.org`) is the same provider.
- The `userId` in the link is the user's own public Macaulay uploader id, already present in existing links — no new PII exposure.
- The coverage fix (`isNonCountableSpecies` / `computeMediaStats`) is pure local computation using string operations (`endsWith`/`includes`, no regex on untrusted input) — no ReDoS surface.
