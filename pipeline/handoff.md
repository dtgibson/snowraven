# Handoff — Current & Predict RELEASED; v0.5.34 live on both platforms

## What We Accomplished

Released v0.5.34. **Current** and **Predict** were built and Chronicled
on the VM (commit `a0cafa5`, records all updated) and the `v0.5.34`
tag pushed; this Mac session pulled, verified the version bump, ran
`./release.sh`, and verified the published release. Current and Predict
are the first forward-looking weather/tide lookups at the bottom of the
Weather tab, alongside the unchanged checklist tool — live weather and
tide for where you are in one tap, or a forecast for a place (name
search or a draggable map pin), date, and time you choose. Built
entirely on the providers already in the app, privacy posture unchanged.

## What Has Been Saved

- Feature code + records (from the VM, commit `a0cafa5`): the new
  `/weather/at` + `/tide/at` routes and services, `WeatherForecastPanel`
  / `PredictMap`, the TS↔Python forecast parity; `CHANGELOG.md`,
  `PRODUCT_CONTEXT.md`, `DECISIONS.md`, `ROADMAP.md`, `CLAUDE.md`
  (vite-proxy convention), `README.md`, `docs/HELP.md`,
  `website/index.html`, and `PRIVACY_POLICY.md` (new live/forecast
  data flow).
- Pipeline artifacts: `pipeline/weather-current-predict/`.
- This session: fast-forwarded `main` to `a0cafa5`, verified the bump,
  ran `./release.sh`, verified the release live, then marked the
  release in `pipeline/session-state.json` + this handoff.

## Where We Are

Released and verified live. `main` and `origin/main` are at `a0cafa5`
(0.5.34) = the `v0.5.34` tag. GitHub release `v0.5.34` is published,
marked Latest (not draft/prerelease), target `main`; all 6 assets
return HTTP 200; `latest.json` carries `darwin-aarch64` +
`darwin-x86_64` (the one universal updater bundle) and `windows-x86_64`
(the `-setup.exe`). macOS notarization Accepted (Apple submission
`6fc61e41`) + stapled. Pipeline idle.

## Release note — re-pushed-tag / stale-CI-run hazard (caught this session)

The `v0.5.34` tag had been re-pushed (a false-start): first at orphaned
commit `c1b7ff2`, then moved to `a0cafa5` — leaving two Windows CI runs.
`release.sh` picks the Windows artifact by most-recently-created
**successful** `windows-build.yml` run, and its only guard checks the
installer *filename* contains the version — which can't tell two runs of
the same version apart. The stale `c1b7ff2` run finished success first
and briefly topped the selection list. The fix was to wait for the
correct `a0cafa5` run to finish green (it was created later, so it sorts
above the stale one) and verify the selected run's `headSha == a0cafa5`
before running `release.sh`. Standing check for any future tag re-push:
confirm the selected CI run's commit equals the tag commit before
releasing.

## Open / Optional

- Optional: confirm the in-app updater picks up 0.5.34 by opening the app (latest.json is correct, so detection is ready).
- ROADMAP Up Next: mobile app; Windows code signing.

## Resume Prompt

Run `/weft` to start the next thing. Load `pipeline/session-state.json` first.
