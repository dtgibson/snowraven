# Handoff — settings-location-and-distance-defaults — PAUSED before deploy

## What We Accomplished

Added a "Use my location" button to Settings → Default Location (reusing the
Map Explorer's geolocation) and made the map's default search radius 5 miles
instead of 25. Refactored the location error-messages into one shared helper,
and added a "Your Location" transparency section to the privacy policy. Built,
tested (435 frontend), and security-audited. Deployment is intentionally
deferred: this batches with the parked 0.5.16 performance work and a feature
to be built next, all shipping together in one release from the Mac.

## What Has Been Saved

Committed on `improve/performance`:

- `frontend/src/lib/location.ts` (+ `describeLocationError` + test),
  `frontend/src/components/Settings.tsx`, `frontend/src/components/MapExplorer.tsx`
- `CHANGELOG.md`, `docs/HELP.md`, `PRIVACY_POLICY.md` (0.5.16 entries)
- `pipeline/settings-location-and-distance-defaults/` (change-brief, qa-report,
  security-report)
- `pipeline/DEPLOY-PENDING.md` — the single ledger for everything undeployed on
  this branch (perf sweep + this improvement + the upcoming feature)

## Where We Are

Stage 5, The Deployer — paused by choice. Stages 1–4 complete and approved.
Next planned action is **a new feature**, then deploy everything together from
the Mac.

## Resume Prompt

To resume: run `/weft` in this project.

- **To build the next feature:** `/weft` → set this paused work aside (it stays
  safe on the branch) → New Feature.
- **To deploy (Mac only):** follow `pipeline/DEPLOY-PENDING.md` — reconcile the
  version + changelog for the whole batch, tag, wait for Windows CI, `./release.sh`.

Local web run: `cd frontend && npm run build`, then
`cd backend && .venv/bin/uvicorn main:app --port 1620` → http://localhost:1620.

---

Project: snowraven. Feature: settings-location-and-distance-defaults (Improve
lane, session 13). Last completed stage: 4 (Auditor). Current stage: 5
(Deployer), paused. Branch `improve/performance`, pushed. Batches with the
0.5.16 perf work + a planned feature for one Mac release. Deploy ledger:
pipeline/DEPLOY-PENDING.md.
