# ⚠️ DEPLOY PENDING — branch `improve/performance` (Mac only)

This branch has **multiple completed, undeployed efforts** stacked for a single
release. Deployment was deferred on purpose so more work could batch together.
The macOS build/notarization/`release.sh` can only run on the Mac — this Linux
box cannot cut the desktop release.

## What's undeployed (in order landed)

1. **0.5.16 performance sweep** — `perf-loading-and-indicators`
   - Statistics progressive render, GL map-marker rewrite + atlas viewport cap,
     short-TTL network cache + loading indicators. Reviewed, tested, audited.
   - Detail: `pipeline/perf-loading-and-indicators/` (change-brief, qa-report,
     security-report, DEPLOY-PENDING).
2. **Settings location detect + 5-mile default** — `settings-location-and-distance-defaults`
   - "Use my location" button in Settings → Default Location; default map radius
     25→5 mi; shared `describeLocationError` helper; privacy-policy "Your Location"
     section. Reviewed, tested, audited.
   - Detail: `pipeline/settings-location-and-distance-defaults/`.
3. **(planned next)** a new feature, to be built before deploying — will also
   land here and ship in the same release.

## State of the release artifacts

- Version: **0.5.16** in `frontend/package.json` + `src-tauri/tauri.conf.json` + lock.
- `CHANGELOG.md` 0.5.16 entry covers efforts 1 and 2.
- `docs/HELP.md`, `CLAUDE.md`, `PRIVACY_POLICY.md` updated for both.
- Tests: 435 frontend + 93 backend, build + lint clean.

## Before tagging the release (do on the Mac)

1. **Reconcile version + changelog** for everything on the branch. Effort 3 (the
   next feature) is NOT yet in the changelog and may warrant bumping past 0.5.16
   (a feature → at least a patch; a larger one → minor). Decide the final version
   and update BOTH `frontend/package.json` and `src-tauri/tauri.conf.json` to match.
2. Confirm `README.md` reflects the current feature set.
3. Merge `improve/performance` to `main` if that's the release flow.
4. Push the `vX.Y.Z` tag → wait for Windows CI → run `./release.sh` (single
   assembler; do NOT use `gh release create` directly).

Delete this ledger once the release containing all of the above ships.
