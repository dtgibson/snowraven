// Shared APPARATUS for the real-engine verification gate: dismissing the
// first-run Welcome dialog with Escape, without losing the key.
//
// WHY IT EXISTS. A harness that serves the build with no keys and no files
// meets a COLD START, so `WelcomeScreen` is up and must be cleared before the
// scenario runs. Escape clears it, but its listener is NOT armed when the
// dialog first paints. The screen's passive `useEffect` focuses "Go to
// Settings" and attaches the document keydown listener in ONE synchronous run,
// after the commit that put the dialog on screen. At wide viewports that effect
// was measured landing 7-14 ms after the dialog appeared (WebKit, 700 and
// 1440px); at phone widths it ran in the same task. A harness that pressed
// Escape as soon as the dialog was `visible` therefore lost the key whenever
// Playwright's round trip beat the effect, and its `detached` wait timed out
// with the dialog still up: 7 of 47 CI gate runs on `main`, every one in the
// WebKit wide sweep of `verify-plan-daylabels.mjs` (planner-check-ci-race).
//
// THE READINESS SIGNAL IS FOCUS INSIDE THE DIALOG. Because the effect moves
// focus in and arms the listener in the same synchronous run, and
// `useFocusTrap` moves no focus on mount, a check that runs in any later task
// and sees `document.activeElement` inside the dialog is guaranteed the
// listener is attached. That is the exact observable the key depends on, per
// CLAUDE.md's v1.0.25 async-test rule (a key pressed into a dialog waits for
// focus to be inside it; `.claude/rules/testing.md` carries the rest). Never a
// sleep, a longer timeout or a weaker assertion in its place. If `WelcomeScreen` ever arms its Escape
// somewhere other than the effect that moves focus in, this signal stops being
// sufficient and this helper has to change with it.
//
// WHAT STAYS WITH THE CALLER. Whether this is a cold start at all is each
// harness's own scenario (one waits for the dialog to become visible, another
// counts it), so this takes the dialog the caller already found and does only
// the dismissal. The key is still a real Escape press, so a harness that reads
// "Escape reaches a shipped layer" from it (the palette harness's FR-50) is
// measuring the same thing it always did.

/**
 * Press Escape on the Welcome dialog once its listener is armed, and wait for
 * the dialog to leave the DOM.
 *
 * @param {import('playwright').Locator} welcome  the Welcome dialog, already on
 *        screen (the caller has established that this is a cold start)
 * @param {{ timeout?: number }} [opts]  bound on each wait; 5000 ms is the
 *        detach bound every caller used before this helper existed
 */
export async function dismissWelcome(welcome, { timeout = 5000 } = {}) {
  const page = welcome.page()
  const dialog = await welcome.elementHandle({ timeout })
  try {
    await page.waitForFunction(el => el.contains(document.activeElement), dialog, { timeout })
  } finally {
    await dialog.dispose()
  }
  await page.keyboard.press('Escape')
  await welcome.waitFor({ state: 'detached', timeout })
}
