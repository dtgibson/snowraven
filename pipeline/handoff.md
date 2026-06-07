# Handoff — weather-tides — PAUSED before deploy (ship 0.5.17 on the Mac)

## What We Accomplished

Built the Tides feature: looking up a checklist on the Weather tab now also shows
the historical tide below it, from the nearest NOAA station — observed when a
gauge reading exists, otherwise predicted (interpolated from the high/low curve
for prediction-only stations), with the surrounding high/low, rising/falling, the
station and its distance, and a "Copy Weather and Tide Together" button. Keyless,
both runtimes, two notices (too-far / outside-US) with a one-tap override. Taken
through Strategist → Auditor: built, tested (468 frontend + 102 backend, live
NOAA verified), and security-audited clean. Paused before the deploy step so it
ships from the Mac with the rest of the batch as **0.5.17**.

## What Has Been Saved

All committed and pushed to `origin/improve/performance`:

- `weather-tides` pipeline docs (strategic-brief, prd, schema, design-spec,
  design.html, qa-report, security-report)
- Frontend: `lib/tide.ts`, `lib/tideStations.ts`, `lib/tideFormatter.ts` (+ tests),
  `lib/tauri/tideService.ts`, `lib/transport.ts`, `lib/weatherFormatter.ts`,
  `App.tsx`, `assets/noaa-tide-stations.json`
- Backend: `routers/tide.py`, `services/{noaa,tide,tide_stations}.py`,
  `formatters/tide.py`, `main.py`, `staticdata/noaa_tide_stations.json`, tide tests
- `scripts/build-tide-stations.mjs`
- Docs/version: CHANGELOG (0.5.17), PRIVACY_POLICY (NOAA), HELP, README,
  package.json + tauri.conf.json (0.5.17)
- `pipeline/DEPLOY-PENDING.md` — the single ledger for the 0.5.17 batch

## Where We Are

Stage 8, The Deployer — paused by choice. Stages 1–7 complete and approved.
Three efforts (0.5.16 perf, settings-location, tides) are batched as **0.5.17**,
to deploy from the Mac next session.

## Resume Prompt

To resume: run `/weft` on the Mac.

- **Deploy (Mac):** follow `pipeline/DEPLOY-PENDING.md` — confirm version 0.5.17,
  merge to main if applicable, push the `v0.5.17` tag, wait for Windows CI, run
  `./release.sh`.
- **Then finish the feature:** `/weft` resumes `weather-tides` at Stage 8
  (Deployer, confirm live) → Stage 9 (Chronicler: PRODUCT_CONTEXT / DECISIONS /
  ROADMAP) → close out.

Local web run (any machine): `cd frontend && npm run build`, then
`cd backend && .venv/bin/uvicorn main:app --port 1620` → http://localhost:1620.

---

Project: snowraven. Feature: weather-tides (Feature lane, session 14). Last
completed stage: 7 (Auditor). Current stage: 8 (Deployer), paused. Branch
`improve/performance`, pushed. Batched as 0.5.17 with the parked 0.5.16 work.
Deploy ledger: pipeline/DEPLOY-PENDING.md.
