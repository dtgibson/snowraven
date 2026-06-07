# ⚠️ DEPLOY PENDING — branch `improve/performance` → release **0.5.17** (Mac only)

This branch has **three completed, undeployed efforts** stacked for a single
release, now versioned **0.5.17**. Deployment was deferred on purpose so they
batch together. The macOS build/notarization/`release.sh` can only run on the
Mac — this Linux box cannot cut the desktop release.

## What's undeployed (in order landed)

1. **0.5.16 performance sweep** — `perf-loading-and-indicators`
   (Statistics progressive render, GL map markers + atlas viewport cap, network
   cache + loading indicators). Reviewed, tested, audited.
2. **Settings location detect + 5-mile default** — `settings-location-and-distance-defaults`
   ("Use my location" in Settings, default radius 25→5, privacy "Your Location").
   Reviewed, tested, audited.
3. **Tides on the Weather tab (0.5.17)** — `weather-tides`
   Historical NOAA tide below the weather lookup; nearest station, observed/
   predicted (with hi/lo interpolation for subordinate stations), two
   notices+override, "Copy Weather and Tide Together". Keyless. Built, tested
   (468 frontend + 102 backend), **security-audited (clean)**. **Stages 1–7 done;
   PAUSED before Stage 8 (Deployer).**
   Detail: `pipeline/weather-tides/`.

## State of the release artifacts

- Version: **0.5.17** in `frontend/package.json` + `src-tauri/tauri.conf.json` + lock.
- `CHANGELOG.md` has 0.5.16 (perf + settings) and 0.5.17 (tides) entries.
- `docs/HELP.md`, `CLAUDE.md`, `PRIVACY_POLICY.md` (NOAA + Your Location), `README.md` updated.
- Tests: 468 frontend + 102 backend; build + lint clean. All pushed to origin.

## To ship the release (on the Mac)

1. Confirm the final version + changelog cover the whole branch (currently 0.5.17).
2. Merge `improve/performance` to `main` if that's the release flow.
3. Push the `v0.5.17` tag → wait for Windows CI → run `./release.sh` (single
   assembler; do NOT use `gh release create` directly).
4. **Then finish the tide feature's pipeline:** run `/weft` → it resumes
   `weather-tides` at Stage 8 (Deployer) → confirm live → Stage 9 (Chronicler:
   PRODUCT_CONTEXT / DECISIONS / ROADMAP) → close out.

Delete this ledger once 0.5.17 ships and the feature is closed out.
