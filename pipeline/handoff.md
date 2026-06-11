# Handoff — weather-block-raincrow-parity (improve) — PAUSED after the GitHub push, handed off to the Mac for the release

## What We Accomplished

Built and pushed-to-GitHub the weather-block raincrow parity improvement (v0.5.28),
the full 6-stage improve flow on this Linux box. The change: night checklists'
generated weather blocks now append a moon-phase emoji to the condition emoji
(unspaced, e.g. `☁️🌗`; mirrored south of the equator; phase from the checklist's
first hour; night = any sampled hour outside its sunrise–sunset window), a hand-port
of lunarphase-js@2.0.3 with a pure-UTC Julian Day, byte-identical in the TS and
Python formatters via the golden-oracle chain. Day blocks proven byte-unchanged; the
comment stripper needed zero production changes. The investigation also established
dew point was ALREADY at parity with raincrow — no change made, logged in
DECISIONS.md so it isn't re-investigated. QA passed clean (769 frontend + 110 backend
green; acceptance criteria independently re-derived; the moon math reproduces the
user's real RainCrow examples from 4/20 and 4/28). Security review: clean pass, one
informational finding (accepted, matches pre-existing posture). The release itself
has NOT run — that happens on the Mac.

## What Has Been Saved

- The release commit on `main` (code + tests, regenerated goldens, both version files
  at 0.5.28, CHANGELOG, HELP, README, website copy + version pill at v0.5.28,
  DECISIONS / PRODUCT_CONTEXT / ROADMAP / CLAUDE conventions, this handoff +
  session-state). The `v0.5.28` tag points at it and triggers Windows CI, the test
  Pipeline, and the Pages redeploy.
- Pipeline artifacts (parity-report, change-brief, qa-report, security-report) live
  under `pipeline/weather-block-raincrow-parity/` and are intentionally untracked,
  per the established pattern.

## Where We Are

Stage 6 of 6 (The Chronicler) — records done and pushed (chronicle-before-push).
Everything this Linux box owns is complete. The ONLY thing left before closeout is
the Mac release, which is NOT run from here: the Mac waits for Windows CI green, runs
`./release.sh` (notarize macOS universal, sign the Windows installer, write
`latest.json` for all three platform keys, publish the GitHub release), verifies the
in-app updater sees 0.5.28, and authors the `chore(pipeline): mark 0.5.28 released`
closeout commit. Paused here, handed off. (See the `release-sequence` and
`dev-machines` memories.)

## Resume Prompt

To resume: run `/weft` in this project AFTER the Mac has shipped 0.5.28 and Dave
confirms it's live and the updater sees it — at which point this Linux box `git
pull`s the Mac's closeout commit and the improvement is done.

---

Project snowraven, improvement `weather-block-raincrow-parity` (sessionType
"maintain"). Stages 1-5 approved; the GitHub push is done — the release commit and
tag `v0.5.28` are on `main`. Paused awaiting the Mac release (`release.sh`), which is
not run from this Linux box. The Mac authors the mark-released closeout commit; on
resume after Dave confirms it's live, `git pull` to sync it down — the improvement is
then shipped. Load `pipeline/session-state.json` first.
