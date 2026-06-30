# Security Review — efficiency-and-docs-audit (v0.5.52)

**Date:** 2026-06-30
**Feature:** efficiency-and-docs-audit (Improve lane)
**Stack:** python-fastapi (backend) + react-vite (frontend)
**Checklists:** security-fastapi, security-react-vite
**Outcome:** PASSED

---

## Summary

This is an Improve-lane sweep of output-identical efficiency tidies plus
documentation updates. The review focused on whether any change introduces new
attack surface or moves a trust boundary. It does not. The backend file writes
are merely offloaded to a worker thread with all existing validation intact; the
tide fetch issues the same requests in parallel; the frontend changes are pure
computation with no user-input handling; and the dead-dependency removal reduces
supply-chain surface. No new network calls, providers, accounts, or telemetry —
the privacy posture is unchanged.

---

## Findings

No security issues found in this change.

---

## Checks Performed

| Check | Result |
|---|---|
| Input validation unchanged (`settings.py` `.csv` + `MAX_BYTES` guards; `settingskv.py` `_KEY_RE` path-traversal guard, reserved-key block, `_MAX_BYTES`) | Pass — all guards run BEFORE the write; `run_in_threadpool` offloads only the already-validated write |
| Path traversal / arbitrary write not introduced | Pass — target paths still derived through the unchanged validated helpers; the threadpool call passes the same `Path` |
| No new concurrency/TOCTOU risk from `run_in_threadpool` | Pass — endpoints already performed unsynchronized single writes; offloading the same write to a thread changes timing, not correctness or trust |
| Tide fetch (`noaa.py` `asyncio.gather`) — no new outbound surface | Pass — identical NOAA host, params, and per-request `timeout`; `_get` still swallows exceptions to `None` |
| Secrets / keys / tokens in source | Pass — none introduced (diff scan clean); API keys still flow through the storage seam |
| New backend dependency introduced | Pass — none; `starlette.concurrency` ships with the existing `fastapi==0.115.6` |
| Frontend supply-chain (npm audit, prod deps) | Pass — 0 vulnerabilities; removed 3 unused direct deps (`clsx`/`tailwind-merge`/`class-variance-authority`), reducing surface |
| Injection / unsafe rendering (`dangerouslySetInnerHTML`, new external links, id→href) | Pass — none added; map popups, comment rendering, and link guards untouched |
| User-input handling changed | Pass — none; frontend changes are memoization + parallel data loads, no new input paths |
| Privacy posture (new network calls / providers / telemetry / accounts) | Pass — none; `PRIVACY_POLICY.md` correctly needs no change |
| CI workflow changes don't leak secrets | Pass — `pipeline.yml` concurrency + `windows-build.yml` npm cache add no secret usage; the real signing key still never reaches CI |

---

## Notes

Dependency hygiene improved (three unused direct deps removed; npm audit clean).
Documentation edits (README/HELP/ACCESSIBILITY/CLAUDE/comments) carry no security
surface. The deferred geolocation-plugin removal was deliberately NOT taken on
here (it alters the desktop binary) and carries no security implication either
way for this change.
