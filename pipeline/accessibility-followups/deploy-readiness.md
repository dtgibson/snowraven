# Deployment Readiness — accessibility-followups (0.5.32)

**Date:** 2026-06-13
**Deployment model:** desktop app, manual release (no automated/cloud deploy; `deploymentTarget` = null)
**Outcome:** READY — actual release deferred to the manual macOS/Windows pipeline, run by the maintainer after The Chronicler.

## Readiness checks (this VM)
- ✓ `frontend/package.json` and `src-tauri/tauri.conf.json` both at **0.5.32**
- ✓ `CHANGELOG.md` has the 0.5.32 entry
- ✓ frontend 869 tests, backend 110 tests green
- ✓ `tsc -b` clean; production build clean; `dist` bundle serves (HTTP 200 via `vite preview`)
- ✓ Security review passed (no findings)

## Why nothing is deployed from here
SnowRaven ships as a desktop app via a bespoke release process with local-only credentials. This VM stops at the push; the actual release runs from the Mac. Records (Step 6, The Chronicler) are updated and committed **before** the release, so the release happens after this pipeline closes.

## Release sequence (maintainer, after The Chronicler — for reference)
1. Review the working tree; commit (code + records) and push to `main`.
2. Push the `v0.5.32` tag (starts the Windows CI build).
3. After CI finishes, run `./release.sh` from the Mac (notarized macOS build + signed Windows installer + `latest.json`).
