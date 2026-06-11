# Handoff — flaky-test-and-mini-mentions (improve) — PAUSED after the GitHub push, handed off to the Mac for the release

## What We Accomplished

Built and pushed-to-GitHub the v0.5.29 improvement, the full 6-stage improve flow on
this Linux box. Two parts: (A) the pre-existing BirdingStats full-suite flake is
eliminated at the root — recharts' bundled @reduxjs/toolkit fires a 100 ms fallback
timer that outlived a jsdom test file's per-test animation-frame stubs and threw a
bare `cancelAnimationFrame` ReferenceError in a later DOM-less worker file; the fix
is baseline rAF/cAF shims in `frontend/src/test-setup.ts` wired via vitest
`setupFiles` (test-only; verified excluded from the production bundle). QA proved
cause and cure: 8/8 shim-enabled full runs clean, and a shim-disabled negative
control reproduced the error at the historical ~11% rate (2/18). (B) Three
informational SnowRaven Mini mentions, approved-verbatim copy: a quiet
footer-register line under the Weather tab card (plain no-fetch anchor), a README
"What it does" closing paragraph, and a HELP.md H3 under Weather kept out of the
sidebar TOC. The website deliberately stays silent about Mini (recorded decision).
Security: clean pass, zero findings. The release itself has NOT run — that happens
on the Mac.

## What Has Been Saved

- The release commit on `main` (test-setup.ts + vite.config.ts, the three mentions,
  both version files at 0.5.29, CHANGELOG, website pill/footer, DECISIONS /
  PRODUCT_CONTEXT / ROADMAP / CLAUDE records incl. the new setupFiles-shims testing
  convention and the corrected backend test count, this handoff + session-state).
  The `v0.5.29` tag points at it and triggers Windows CI, the test Pipeline, and the
  Pages redeploy.
- Pipeline artifacts (change-brief, qa-report, security-report) live under
  `pipeline/flaky-test-and-mini-mentions/`, intentionally untracked per the
  established pattern.

## Where We Are

Stage 6 of 6 (The Chronicler) — records done and pushed (chronicle-before-push).
Everything this Linux box owns is complete. The ONLY thing left before closeout is
the Mac release: wait for Windows CI green, run `./release.sh` (notarize macOS
universal, sign the Windows installer, write `latest.json` for all three platform
keys, publish), verify the in-app updater sees 0.5.29, and author the
`chore(pipeline): mark 0.5.29 released` closeout commit. Paused here, handed off.
(See the `release-sequence` and `dev-machines` memories.)

## Resume Prompt

To resume: run `/weft` in this project AFTER the Mac has shipped 0.5.29 and Dave
confirms it's live and the updater sees it — at which point this Linux box `git
pull`s the Mac's closeout commit and the improvement is done.

---

Project snowraven, improvement `flaky-test-and-mini-mentions` (sessionType
"maintain"). Stages 1-5 approved; the GitHub push is done — the release commit and
tag `v0.5.29` are on `main`. Paused awaiting the Mac release (`release.sh`), not run
from this box. The Mac authors the mark-released closeout commit; on resume after
Dave confirms it's live, `git pull` to sync it down — the improvement is then
shipped. Load `pipeline/session-state.json` first.
