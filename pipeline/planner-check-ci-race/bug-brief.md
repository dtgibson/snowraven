# Bug Brief: Planner Check CI Race

## What is broken
`website/tools/verify/verify-plan-daylabels.mjs` presses Escape as soon as the Welcome dialog is *visible* (`openPlan`, line 317-319). `WelcomeScreen`'s passive `useEffect` focuses "Go to Settings" and attaches the Escape listener in the same task, so an Escape that arrives before that effect runs is lost and `waitFor({ state: 'detached' })` times out.
Measured here: at wide widths the effect runs 7-14 ms after the dialog appears (WebKit, 700 and 1440px). At phone widths (320 and 390px) it runs in the same task. That is why only the wide tier can lose the key.
CI: the gate ran to completion in 47 Pipeline attempts on `main` since the harness landed (2026-09-15). 7 failed on this line, every time inside the WebKit wide sweep (`:319` > `sweep :447` > `run :602`), "Welcome to SnowRaven" still visible after 5,000 ms. Runs: 35057486338, 35811799962, 36091531630, 36582838156, 36586613123, 36808166013, 36916288114. The one other gate failure was a different, already-fixed bug in `verify-plan-readout.mjs`.

## Steps to reproduce
1. Serve `frontend/dist` with the harness's stub backend. With no keys and no files, every load is a cold start, because `welcomeSeen` 404s and is never saved.
2. In WebKit, set the viewport to 700px, then `goto`, wait for the dialog to be visible and press Escape. Keep the arming gap wider than Playwright's round trip by delaying the effect's focus and listener together by 300 ms: `node /private/tmp/claude-502/-Users-developer-devwork-snowraven/3e6ea57f-c728-4839-b5a5-3c4ee24c6ce0/scratchpad/repro-welcome-escape.mjs webkit 700 10 300 head` (session scratch, outside the repo).
3. Result at HEAD's shape: Escape is lost on 10 of 10 loads in both WebKit and Chromium, the same symptom CI shows. With natural timing on this Mac it does not reproduce: 0 lost in 180 WebKit loads, 60 of them under full CPU load.

## Expected behavior
`openPlan` presses Escape only after the readiness signal the key depends on: focus is inside the Welcome dialog, on the "Go to Settings" button. The effect focuses that button and then attaches the listener in one synchronous run, and `useFocusTrap` moves no focus on mount (checked), so focus inside the dialog means the listener is armed.
No sleep, no longer timeout and no weaker assertion (`.claude/rules/testing.md`, v1.0.25 readiness rule). Do not add it to the flake roster.
Measured with the 300 ms delay: waiting for focus first dismisses the dialog on 10 of 10 loads in WebKit (320 and 700px) and in Chromium at 700px.

## Blast radius
Test-only. The change is in one harness and leaves the shipped bundle byte-identical, so it needs no version bump or changelog entry. `WelcomeScreen.tsx` is not touched: a person cannot press Escape within 14 ms of the dialog painting.
Same shape, no failures on record, so they are follow-ups: `verify-plan-readout.mjs` `openPlan` (:163-169, two loads per engine at 900px, so exposed) and `chunkLanding` (:301-306, phone widths only, so not exposed); `verify-palette.mjs` (:72-75, `count()` and then Escape at 1600px).
Keep out of scope: `parseBarChart.test.ts` linearity (11 failed attempts, all in vitest before the gate runs; handled by barchart-speed-check-ci earlier in this spin), and the one-off failures in `namedBirdTimeline`, `weatherStats*`, `Settings.icloud` and `MapExplorerLocateFab`.

## What done looks like
`openPlan` in `verify-plan-daylabels.mjs` waits for focus inside the Welcome dialog before pressing Escape. With the effect delayed in a scratch copy, HEAD's shape fails every time and the fixed shape passes every time.
The full harness passes repeatedly on this Mac in both engines. The bundle push's real-engine gate is green, and ROADMAP's daylabels Escape item is marked fixed.
At about 15% per run, one green CI run is weak evidence. The delayed-effect proof is the evidence that counts.
