# ⚠️ DEPLOY PENDING — 0.5.16 (Mac only)

The performance sweep (perf-loading-and-indicators) is **built, reviewed,
tested, and security-audited** on branch `improve/performance`, but **not yet
released**. Deployment was deferred so more work could stack on the branch and
ship together under one version.

## Status at pause
- Branch `improve/performance`, last perf-cycle commit `733ab1c` (+ checkpoint `6bbb23a`), pushed to origin.
- Version already bumped to **0.5.16** (`frontend/package.json`, `src-tauri/tauri.conf.json`, lock).
- `CHANGELOG.md`, `CLAUDE.md`, `docs/HELP.md` updated.
- Tests: 428 frontend + 93 backend. Build + lint clean.
- Reports: `qa-report.md`, `security-report.md` (this folder).

## To deploy (ON THE MAC — this Linux box cannot build/notarize macOS)
1. Re-confirm `CHANGELOG.md` + version still cover everything on the branch
   (more work may have landed after this pause — bump if it grew past 0.5.16).
2. Merge `improve/performance` to `main` if that's the release flow.
3. Push the `vX.Y.Z` tag to start the Windows CI build. Wait for CI to finish.
4. Run `./release.sh` (notarizes macOS, downloads the signed Windows installer,
   writes `latest.json` with all updater targets, publishes the GitHub release).

Do **not** use `gh release create` directly — `release.sh` is the single
assembler (see CLAUDE.md).
