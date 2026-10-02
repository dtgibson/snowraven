## planner-check-ci-race: the Planner checks wait for Welcome's Escape to be armed

### What this does
Three real-engine checks no longer press Escape on the Welcome dialog before its key listener exists. One shared helper, `website/tools/verify/dismissWelcome.mjs`, now clears the dialog in three steps. It waits until `document.activeElement` is inside the dialog, presses Escape, then waits for the dialog to leave the DOM. Every Welcome dismissal in the three checks the brief names goes through it. The change is test-only: no file under `frontend/` changed, so the app bundle is identical.

- **`verify-plan-daylabels.mjs`**: `openPlan`, the line CI failed on (HEAD `:318`-`:319`).
- **`verify-plan-readout.mjs`**: `openPlan` (900px), plus `chunkLanding` in the same file. `chunkLanding` runs at phone widths and has no failures on record. It has the same shape, though, so converting only `openPlan` would have left it the one unsafe Escape in the gate. Under the delayed reproduction it would also have been that file's next failure.
- **`verify-palette.mjs`** (1600px): keeps its `count()` check for whether the dialog is up, and still records its FR-50 row. The key is still a real Escape press, so FR-50 measures what it always did.

The helper's file name does not start with `verify-`, so `run.mjs` does not count it as a check, and the gate still reports 7 of 7.

### Why it failed
`WelcomeScreen`'s passive `useEffect` focuses "Go to Settings" and attaches the document keydown listener in one synchronous run. That run comes after the commit that paints the dialog: 7 to 14 ms later at wide widths, per the brief's measurement. An Escape pressed on `visible` that lands in that gap is lost, and the 5,000 ms detach wait times out. That happened in 7 of 47 CI gate runs on `main`, every time in the WebKit wide sweep.

Focus inside the dialog is the readiness signal. The effect moves focus in and attaches the listener in the same synchronous run, so a check in any later task that finds focus inside knows the listener is armed. `useFocusTrap` is declared after that effect and moves no focus on mount. `onDismiss` is a stable `useCallback`, and the dialog is a plain conditional mount, so the effect runs once and the dialog node is never replaced. Holding its element handle for the poll is therefore safe; if that ever changed, the wait would fail loudly at 5 s, not silently.

### How to test
1. `cd frontend && npm run build`
2. `cd website/tools && CI=1 npm run verify -- ../../frontend/dist` (exactly CI's step): 7 of 7 green.
3. The delayed proof uses scratch files outside the repo (below). It needs no change to app or harness code.

### Results (this Mac, Playwright 1.62.1, Node 24.18.0)

**1. The Evaluator's reproduction, 300 ms delay, 10 loads per cell.** I used a scratch copy of `repro-welcome-escape.mjs` with a `helper` mode that imports the repo's `dismissWelcome.mjs` unchanged. The delay defers the dialog's first focus and its keydown registration together, which is the shape of a late effect. "Head" is HEAD's shape: Escape on `visible`, then the 5,000 ms detach wait.

| Width | WebKit, HEAD | WebKit, helper | Chromium, HEAD | Chromium, helper |
|---|---|---|---|---|
| 320px | 0 of 10 dismissed | 10 of 10 | 0 of 10 | 10 of 10 |
| 700px | 0 of 10 | 10 of 10 | 0 of 10 | 10 of 10 |
| 900px | 0 of 10 | 10 of 10 | 0 of 10 | 10 of 10 |
| 1600px | 0 of 10 | 10 of 10 | 0 of 10 | 10 of 10 |

In every cell the measured gap from dialog to focus was 301 to 313 ms, so the delay was applied. Escape arrived before the listener was armed on 10 of 10 HEAD loads and 0 of 10 helper loads in every cell.

**2. The real checks under the same delay.** A scratch preload (`node --import`) wraps Playwright's `launch` so that every browser context the check opens gets the delay as an init script. It counts each load on which the delay fired. HEAD's checks ran from a `git archive HEAD` copy in scratch; the fixed checks ran from the working tree.

| Check | Delay | HEAD | Fixed |
|---|---|---|---|
| `verify-plan-daylabels.mjs` | 300 ms | Exit 1 in 6 s: `locator.waitFor: Timeout 5000ms exceeded` at `openPlan :319`, via `sweep :447` and `run :600` (CI's trace) | Exit 0, ALL CHECKS PASSED, delay fired on 110 loads (55 per engine) |
| `verify-plan-readout.mjs` | 300 ms | Exit 1 in 5 s: same timeout at `openPlan :168` | Exit 0, ALL CHECKS PASSED, delay fired on 24 loads (`openPlan` and `chunkLanding`, both engines) |
| `verify-palette.mjs` | 300 ms | **Exit 0**, 24 of 24 (see note) | Exit 0, 24 of 24 |
| `verify-palette.mjs` | 1,500 ms, 3 runs each | Exit 1 on 3 of 3, timeout at `:75` (the detach wait); FR-50 never recorded | Exit 0 on 3 of 3, 24 of 24, FR-50 PASS in both engines on every run |

**3. Natural timing, as CI runs it.**
- The full gate (`CI=1 npm run verify`): 7 of 7 green in 5 min 4 s, run alone on the machine. FR-50 passed in both engines.
- `verify-plan-daylabels.mjs` five more times in sequence, each run Chromium then WebKit: 5 of 5 ALL CHECKS PASSED, 134 to 138 s each, all three WebKit wide checks PASS each run. With the gate's run that makes 6 runs: 330 WebKit dismissals, 66 of them at 700px.
- Natural timing does not reproduce the race on this Mac (the Evaluator saw 0 losses in 180 WebKit loads). So these runs show nothing regressed; they do not show the fix. Sections 1 and 2 are that evidence.

**4. Other checks.**
- `--expect-broken` still discriminates in both plan checks (both go through `openPlan`): daylabels "HARNESS DISCRIMINATES: both mutations were seen", readout "the neutered readout moved in both engines".
- `node --check` passes on all four files.
- No lint step covers `website/tools/` (the frontend ESLint config is `**/*.{ts,tsx}` in `frontend/`), and no vitest test reads these files; frontend tests mention them only in comments.
- `website/tools` `npm test` (not part of CI): 12 of 13 pass. The one failure is pre-existing and unrelated. `weather-capture.test.mjs` expects the published `website/assets/shots/weather.webp` to be 1080x2021, and it is 606 tall. This change touches neither file.

### Notes for reviewer
- **The palette check was protected by timing, not by a readiness condition.** It loads with `waitUntil: 'networkidle'` (500 ms with no network traffic) before it counts the dialog. That wait happens to outlast a short arming gap, which is why HEAD's palette passed at 300 ms and failed 3 of 3 at 1,500 ms. Its conversion is for consistency and defense; it fixes no exposure seen at natural timing. A delayed proof has to use a delay longer than any incidental wait in the path, or it reports a lucky shape as safe.
- **The helper does not replace readiness with a bigger timeout.** Each of its two waits is bounded at 5,000 ms, the detach bound every caller already used. The focus wait polls `document.activeElement` through `waitForFunction`, the literal signal. It does not rely on the `:focus` pseudo-class, whose matching depends on each engine's focus emulation.
- **What I did not change:**
  - `WelcomeScreen.tsx`.
  - The flake roster: this is a readiness defect, not a flake.
  - The palette's `count()` check for whether the dialog is up. If the dialog ever mounted after `networkidle`, FR-50 would be skipped silently. It appeared in both engines on every run here, so I left it for a separate change.
  - `ROADMAP.md` line 69, the daylabels Escape item, which I left for the closeout, as the earlier builds in this spin did.
  - The table of files in `website/tools/README.md`. It already lists only 3 of the 7 checks. Adding a row for the new module is a prose edit under `website/`, which I held under the copy-approval rule.
- **Pages.** `pages.yml` deploys on any push to `main` that touches `website/**`, and this change sits under `website/tools/verify/`. The push will republish the site with no page changed, only these tooling files.
- **No version bump, CHANGELOG entry or copy change.** The change is test-only and the app bundle is identical (CLAUDE.md, dev-only changes). Nothing is committed.

Nothing in the app changed, so there is no "how to see it" guide.

## Convention Flags
- A verify check that clears the Welcome dialog does it through `website/tools/verify/dismissWelcome.mjs`, never with a bare Escape on `visible` or after `count()`. A shared helper for the checks lives beside `serveDist.mjs`, in a file whose name does not start with `verify-`, so the runner does not count it as a check.
- A delayed reproduction must use a delay longer than every incidental wait in the path it drives (`networkidle` is 500 ms of quiet). Otherwise it certifies a shape that is only lucky: HEAD's palette check passed at 300 ms and failed at 1,500 ms.
- A delayed proof can run against the real check instead of a hand copy. A scratch `node --import` preload wraps `BrowserType.launch` so that every new context gets the delay as an init script, and it counts the loads it fired on. The repo's app and check code stay untouched, and the count shows the delay reached every load.
