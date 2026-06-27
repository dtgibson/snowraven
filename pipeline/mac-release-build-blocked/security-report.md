# Security Review — mac-release-build-blocked

**Date:** 2026-06-27 · **Feature:** mac-release-build-blocked (Fix lane) ·
**Stack:** python-fastapi / react-vite (Tauri desktop) · **Reviewed surface:**
`release.sh`, `.nvmrc`, `frontend/package.json` (release tooling only — no shipped
app code touched) · **Outcome: PASSED WITH NOTES**

---

## Summary

The change is release-tooling-only: it hardens `release.sh` with strict-by-default
preflights (tooling, pinned-Node, clean-tree, gh-auth, network reachability) and a
self-healing `npm ci` install, and leaves the security-critical
build → sign → notarize → Windows-fetch → publish tail **byte-identical** to the
prior version. An independent adversarial pass found no command injection, no
credential leakage, no new third-party contact, and no weakening of any existing
control. A few low/informational opt-in escape hatches are recorded below. Nothing
blocks the release.

---

## Findings

### npm install lockfile-drift fallback
**Severity:** Low · **Location:** `release.sh` (`ALLOW_NPM_INSTALL_FALLBACK`)
**Description:** When explicitly opted in, a failed `npm ci` falls back to
`npm install`, which can resolve newer semver-compatible versions than the committed
lockfile — a mild supply-chain-drift surface. **Mitigated:** default is strict
`npm ci`; the fallback is off by default and emits a loud warning.
**Remediation:** keep it opt-in (already the case). Acceptable as-is. **Status:** Accepted.

### npm ci runs dependency lifecycle scripts on the release machine
**Severity:** Low · **Location:** `release.sh` (dependency-restore block)
**Description:** Folding the install into the script means dependency
`postinstall`/`prepare` scripts execute on the signing/notarizing machine each
release. This is inherent to npm and **pre-existing** (the operator always ran
`npm ci` manually); the change relocates it, it does not create a new trust
boundary. **Remediation:** none required (`--ignore-scripts` would break the
Tauri/native toolchain). **Status:** Accepted.

### ALLOW_DIRTY permits building from an uncommitted tree
**Severity:** Informational · **Location:** `release.sh` (clean-tree gate)
**Description:** A net-new safety control (the clean-tree gate) with an opt-out. A
dirty build could ship uncommitted source, but the preserved post-build
`CFBundleShortVersionString` gate and the Windows version-filename guard still hold
the version line. This is a strengthening, not a regression. **Status:** Accepted.

### .nvmrc parse is injection-safe by construction
**Severity:** Informational · **Location:** `release.sh` (node-version check)
**Description:** `tr -dc '0-9.' < .nvmrc | cut -d. -f1` strips everything except
digits/dots, so the value can only ever be numeric (even if the trusted repo file
were tampered) and is used only in `[[ ]]` comparisons / echoed messages, never
`eval`'d. A non-numeric `.nvmrc` yields an empty value, safely skipped by the
`[[ -n … ]]` guard. **Status:** Accepted (no action).

---

## Checks Performed

| Check | Result |
|---|---|
| Command injection / unsafe expansion (`${!var}`, `"$@"`, `.nvmrc` parse, `node -p/-e`, quoting) | Pass |
| Credential / secret handling (APPLE_*, .p8 key, minisign key — no echo/log; no `set -x`) | Pass |
| Supply-chain integrity (strict `npm ci` default; `npm install` fallback gated + warned) | Pass (Low note) |
| Network calls (fixed hosts, TLS intact, no injectable URL / SSRF) | Pass |
| Trust boundary / privacy (no new third party, no telemetry, dev-only tool) | Pass |
| Existing-control regression (`set -euo pipefail`, bundle-version + Windows guards, build/sign tail) | Pass — tail byte-identical |

---

## Convention Flags
- None new for `CLAUDE.md` beyond the release.sh self-healing note already flagged
  by The Tester for The Chronicler.
