# Security Review — tab-order-and-load-optimization (0.5.42)

**Date:** 2026-06-17
**Feature:** tab-order-and-load-optimization
**Stack:** react-vite frontend (python-fastapi backend — untouched by this change)
**Checklist:** security-react-vite (frontend) + supply-chain review of the dependency bump
**Outcome:** PASSED

---

## Summary

An Improve-lane change with essentially no new attack surface: a default
tab-order reorder, a code-splitting refactor (lazy-loading the per-row map and two
tabs), a vite build-config limit, a dependency lockfile refresh, version bumps, and
documentation. No new user input, route, network call, HTML rendering, or external
link was introduced in application code, and no existing security control was
removed or weakened. The one security-relevant change — `npm audit fix` — is a net
improvement: it closed two dev-only advisories while leaving the production
dependency tree byte-unchanged.

---

## Findings

No security issues found in this change.

---

## Checks Performed

| Check | Result |
|---|---|
| New attack surface (input, routes, external calls) | Pass — none introduced |
| `dangerouslySetInnerHTML` / `innerHTML` / `eval` added | Pass — none in the diff |
| New external links / `target="_blank"` in app code | Pass — none (README/`update.sh` are docs, not app surface) |
| eBird id gating (`SUBMISSION_ID_RE` / `LOCATION_ID_RE`) preserved | Pass — `NamedBirdRow` still routes through `ChecklistLink` / `HotspotLink`, unchanged |
| Comment rendering (React escaping / `CommentText`) preserved | Pass — `NamedBirdRow`'s `{s.comment}` React-escaped child is unchanged |
| Map popup / sprite injection-safety conventions | Pass — no map popup or sprite code changed |
| Trust boundaries / auth controls | Pass — none touched; code-splitting changes load timing only, not what code runs |
| Secrets in source | Pass — none added |
| Dependency supply chain — known vulnerabilities | Pass — `npm audit` reports 0 at both full and `--omit=dev` scopes |
| Dependency supply chain — production tree integrity | Pass — `npm audit fix` changed only dev/build tooling (vite 8.0.10→8.0.16 + transitive); no production dependency (react, react-dom, maplibre-gl, recharts, @tauri-apps, …) changed; `npm ci --dry-run` integrity clean |
| Storage / platform seams | Pass — not touched |

---

## Notes

- The dependency bump is a security improvement: it resolves the vite
  `server.fs.deny` Windows-path-bypass advisory (dev-server only) and a low
  `@babel/core` advisory (via `eslint-plugin-react-hooks`), neither of which ever
  shipped in the production bundle.
