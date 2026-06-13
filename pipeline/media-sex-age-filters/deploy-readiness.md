# Deployment Readiness — media-sex-age-filters (0.5.33)

**Date:** 2026-06-13
**Deployment model:** desktop app, manual release (no automated/cloud deploy; `deploymentTarget` = null)
**Outcome:** READY — actual release deferred to the manual macOS/Windows pipeline, run from the Mac.

## Readiness checks (this VM)
- ✓ `frontend/package.json` and `src-tauri/tauri.conf.json` both at **0.5.33**
- ✓ `CHANGELOG.md` has the 0.5.33 entry
- ✓ frontend 877 tests, backend 110 tests green; `lint` / `typecheck` clean; prod bundle serves (`vite preview` HTTP 200)
- ✓ Security review passed (no findings)

## Release sequencing note
0.5.33 stacks on **0.5.32**, which is committed + pushed + tagged on GitHub (Windows CI green) but whose `./release.sh` has not yet run from the Mac. The working tree holds the 0.5.33 changes on top of the in-main-but-not-shipped 0.5.32. When releasing from the Mac, choose:
- **Ship 0.5.32 first** (`./release.sh` on the existing `v0.5.32` tag), then commit / tag / release 0.5.33; or
- **Batch** — commit 0.5.33 and release once at 0.5.33 (the higher version supersedes; 0.5.32's tag and CI artifacts already exist).

This VM does not push or release. The Chronicler (next step) updates the records; then the working tree is yours to commit / push / release.

## Release sequence (maintainer, from the Mac — for reference)
1. Review the working tree; commit (code + records) and push to `main`.
2. Push the version tag (starts the Windows CI build).
3. After CI finishes, run `./release.sh` from the Mac.
