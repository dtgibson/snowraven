# Security Review — Dev Dependency Cleanup

**Date:** 2026-06-29
**Feature:** dev-dependency-cleanup
**Stack:** python-fastapi backend / react-vite-tailwind frontend (change is frontend dev-tooling only)
**Checklist:** dependency-update review (no app source changed)
**Outcome:** PASSED

---

## Summary
A single transitive dev dependency was patched (`undici` 7.27.1 → 7.28.0) via a
non-breaking `npm audit fix`. No application source changed, no trust boundary
moved, and the new version carries no known advisories. The change *reduces*
attack surface by clearing 7 high-severity advisories in dev/test tooling; it
introduces none.

---

## Findings
No security issues found.

---

## Checks Performed

| Check | Result |
|---|---|
| Known vulnerabilities in the new version (`npm audit`, dev incl) | Pass — 0 vulnerabilities (undici 7.28.0) |
| Production bundle exposure (`npm audit --omit=dev`) | Pass — 0 vulnerabilities; undici/jsdom are dev/test-only |
| New packages introduced / supply-chain expansion | Pass — 0 node_modules entries added or removed (undici bumped in place) |
| New attack surface or trust-boundary change | Pass — lock-file-only; no source, network, auth, or storage change |
| Security controls weakened/removed | Pass — none touched (no app code changed) |
| Secrets / keys introduced | Pass — no `.env`/secret/key/credential files in the change set |
| Integrity of the resolved artifact | Pass — official npm registry URL + sha512 integrity hash in the lockfile |

---

## Notes
The bump is a patch within `undici`'s 7.x major line, pulled by `jsdom` (the
vitest jsdom test environment). It does not reach production. Deployment is not
blocked.
