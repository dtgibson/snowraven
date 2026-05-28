# Security Review — Windows Desktop App

**Date:** 2026-05-28
**Stack:** react-vite-tailwind frontend / Tauri desktop / GitHub Actions CI
**Checklists:** security-react-vite.md (frontend) + a CI/release/supply-chain assessment (the real surface here)
**Outcome:** PASSED WITH NOTES (informational only — no Critical/High; deployment not blocked)

## Summary
The frontend changes (`isWindows`, the location guard, the geolocation note) add no attack surface — no inputs, secrets, HTML injection, or new dependencies. The meaningful surface is the new CI build and the local signing flow. The design deliberately keeps the real signing key off CI (the key stays on the maintainer's machine), which is the right call. Three informational notes below; none block release.

## Findings (all Informational)

### F-1 — Local signing trusts the CI-produced archive
**Severity:** Informational
**Where:** `release.sh` (signs the CI-built `*.nsis.zip` with the real key)
**Description:** `release.sh` applies the real updater signature to whatever the Windows CI run produced. If the GitHub Actions runner or workflow were compromised, a malicious archive could receive a valid signature. The archive comes from the project's own workflow on a tagged commit, so this is the standard CI trust boundary, not a specific flaw.
**Remediation:** Accept for a personal project. If hardening later: pin the third-party actions to commit SHAs (see F-2), and/or have `release.sh` re-build the `.nsis.zip` from the CI installer rather than trusting CI's archive. Optionally inspect the artifact before signing.
**Status:** Accepted

### F-2 — Third-party actions pinned to tags, not SHAs
**Severity:** Informational
**Where:** `.github/workflows/windows-build.yml` (`actions/checkout@v4`, `actions/setup-node@v4`, `dtolnay/rust-toolchain@stable`, `Swatinem/rust-cache@v2`, `actions/upload-artifact@v4`)
**Description:** Floating tags can move; a compromised upstream tag could run untrusted code in CI. Common practice, but SHA-pinning is the stricter posture — and matters more here because CI output gets a real signature downstream (F-1).
**Remediation:** Optional later hardening: pin to full commit SHAs and bump via Dependabot.
**Status:** Accepted

### F-3 — Unsigned Windows distribution (SmartScreen)
**Severity:** Informational
**Where:** Distribution (no Authenticode)
**Description:** A deliberate, approved decision (strategic brief). Users see a one-time "unknown publisher" SmartScreen prompt. The in-app updater integrity is unaffected (minisign verification).
**Remediation:** None now; Authenticode is a tracked future add-on.
**Status:** Accepted (by design)

## Checks Performed
| Check | Result |
|---|---|
| No secrets in source / workflow | Pass — no `secrets.` usage; only a runtime-generated throwaway key in CI |
| Real signing key never in CI | Pass — Option A keeps it local; CI signs with a discarded ephemeral key |
| No secrets in build logs | Pass — throwaway key written to `$RUNNER_TEMP`, not echoed |
| Updater integrity preserved | Pass — minisign pubkey unchanged; Windows updater verified by it |
| No `dangerouslySetInnerHTML` / injection (frontend) | Pass — note is static text |
| User input handling | Pass — no new inputs; `isWindows` reads userAgent only |
| New dependencies | Pass — none added (reused Lucide `Info`) |
| macOS path unchanged | Pass — no regression to the existing signed/notarized flow |
| CI workflow least privilege | Pass — uses default `GITHUB_TOKEN`; no elevated permissions requested |
| Supply chain (actions pinning) | Finding F-2 (informational) |
| Local-sign trust boundary | Finding F-1 (informational) |
| Unsigned distribution | Finding F-3 (informational, by design) |

## Convention Flags
- If/when hardening CI: SHA-pin third-party actions and consider re-building the updater archive locally instead of signing CI's artifact.
