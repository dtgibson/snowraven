# Handoff — idle-flake-and-doc-rot COMPLETE; pipeline idle; no release (rides main)

## What We Accomplished

The frontend test suite is now fully deterministic, and the project records are
accurate again — shipped as a tests-and-records-only push to main (user-ratified:
no version bump, no tag, no Mac release; the next real release folds CHANGELOG's
`[Unreleased]` in).

1. **Both remaining flake classes fixed, test-only.** (A1) The "idle-callback"
   flake's true mechanism was a commit-vs-effect race: `waitFor` could resolve on
   the phase-ready DOM commit before the passive double-rAF effect queued into the
   stubbed queue — fixed with an observable stub-queue precondition in
   `renderAndLoad()`. (A2) recharts/toolkit 100 ms fallback timers from jsdom chart
   files could fire after environment teardown — fixed with 120 ms `afterAll`
   wait-outs in the two chart-mounting test files. Proof: 45/45 post-fix stress
   runs (Engineer 30 + Tester 15) vs. a pre-fix negative-control failure at run 12
   with the exact documented class.
2. **0.5.29 record overclaim narrowed** in DECISIONS / CHANGELOG / ROADMAP to the
   `cancelAnimationFrame` mechanism actually fixed.
3. **PRODUCT_CONTEXT doc-rot cleared:** 17 pre-MapLibre passages rewritten or
   annotated per the file's own conventions (plus 6 factual drifts corrected
   against the real code); every remaining "leaflet" mention is historical.
4. **New standing conventions in CLAUDE.md:** the stub-queue precondition pattern;
   the chart-file teardown wait-outs; and the boundary rule — this repo's pipeline
   and records track SnowRaven ONLY (outside projects like snowraven-mini live in
   their own repos and Weft sessions).

## Where We Are

**Idle.** No active Weft session. Released version 0.5.30 remains live and
accurate for everything user-facing; main carries the test/record improvements
ahead of it, by design.

## Follow-ups (minor)

- Stale "Leaflet panes" code comment at `TabNav.tsx:281-282` — one-line touch-up
  for a future lane (QA finding, out of this lane's no-production-code scope).

## Roadmap — Up Next

- Mobile app
- Accessibility / clarity / simplification
- Windows code signing

## Resume Prompt

Run `/weft` to start the next thing. Load `pipeline/session-state.json` first.
