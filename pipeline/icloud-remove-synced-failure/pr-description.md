## A failed Remove synced files from iCloud says so (icloud-remove-synced-failure)

### What this does

Settings' **Remove synced files from iCloud** now tells you when the removal did not finish. Before, the screen said nothing and the rejection went unhandled. The controller already reported the failure: `removeFromICloud()` rejects with the native code and leaves the shared set as it was. Settings now catches that rejection. A line appears under the button, the button's description points at that line, and the section's status region announces it once per failure, the same failure again included. The button stays, which is the retry. A success behaves exactly as before.

### How to test

1. `cd frontend && npx vitest run src/components/Settings.icloud.test.tsx src/lib/icloudSyncCss.test.ts`. 60 tests pass, and the run reports no Unhandled Rejection.
2. Red first: the change isn't committed yet, so copy the fixed file aside, then put HEAD's in with `git show HEAD:frontend/src/components/Settings.tsx > frontend/src/components/Settings.tsx` and run step 1 again. Three new tests fail, and vitest reports `Unhandled Rejection { code: 'unavailable' }` for the first of them. Put the fixed file back afterwards.
3. Controller unchanged: `npx vitest run src/lib/icloud/countySync.test.ts -t "reports the failure, never success"` stays green.
4. `npm run typecheck` and `npm run lint` are clean. The full frontend suite (`npx vitest run`) passes: 430 files, 9,148 tests, 6 skipped, no unhandled errors.

### Notes for reviewer

**The change** is in `ICloudSyncSection` in `frontend/src/components/Settings.tsx`, plus one string in `lib/icloud/icloudCopy.ts`, one CSS selector, and one HELP clause. `icloudSync.ts` and its tests are untouched (option one).

- **Wording: new copy, not `CHECK_FAILED_SUFFIX`.** "Could not reach iCloud." is not true of every way this fails. `icloud_remove_all` stops at the first item iCloud will not delete, with everything before it already gone, while iCloud was plainly reachable. Its native code is then `unavailable`, the same code as an unreachable container, so the frontend cannot tell the two apart. After the 8 s timeout (`timeout`), the work keeps running in the background and may yet finish. The new line, `REMOVE_FAILED_TEXT`, reads "Some synced files may still be in iCloud. Try again." "May still be" holds in all three cases. It names no file, because the app cannot know which remain. It follows the register of "Try again." in `removeAllPartialText`, and it has no em dash.
- **Where it shows.** It sits in the remove row, beside the button it describes, in the shape of `sr-ics-pending`. So it shows while the status row is collapsed (sync off, never checked). It sits above the key-removal pending line, in button order. It is plain text, not a second live region: the always-mounted `role="status"` region that Check now and Copy iCloud details use speaks it, with a sequence-keyed child.
- **Clearing** (stated in the code comment at `handleRemove`):
  - A new attempt clears the line at the press, before the outcome is known.
  - The same press clears the status region's copy of the failure, but only if the region still holds it. A Check now or "Copied" announcement is left alone.
  - A success writes nothing back.
  - Cancelling the dialog is not an attempt and clears nothing, because the failure is still true.
- **Two small guards beyond the brief**, both there so a stale failure never sits above a later success:
  - **Overlapping presses.** An attempt counter (`removeAttemptRef`) lets only the latest press write a failure. Without it, an earlier press failing after a later one went through would show a false failure. That's reachable: the button stays while a removal is in flight, for up to 8 s.
  - **Files gone.** Once `sharedExists` goes false, the line is cleared during render. That's the MapExplorer sidebar's bare-setState shape, never an effect, and it ends itself because the update makes its own condition false. Without it, a removal that timed out but finished in the background would bring the old line back the next time any device uploads.
- **The line's id is `${headerId}-remove-failed`, not a new `useId()`.** On a client render, React's `useId` draws from one global counter, so one more call renumbers every id rendered after the iCloud section. That broke `settingsAlertsOff.test.tsx`, the Alerts build's byte-identical "Settings unchanged at rest" fixture captured at its base commit. Deriving the id from the section's existing id is React's documented shared-prefix pattern, and it keeps the at-rest markup byte-identical, which is true of this fix: nothing renders until a removal fails. The fixture is untouched.
- **Unchanged:** Check now, Copy iCloud details, Remove synced keys (its own pending line and retry), enable and disable, the dialog and its focus return, and the success paths (with sync off the button goes, with sync on the controller's check runs).

**The tests** extend `Settings.icloud.test.tsx`. There's no new file.

- The existing Remove test now has its fake publish what the controller publishes on success with sync off. It waits for the button to go, then asserts no failure text and an empty announcer.
- New: a failure in the collapsed-status state shows the line in the remove row, wires `aria-describedby`, is not a live region, and announces. A second identical failure announces again as a new node.
- New: Cancel keeps the line. Pressing again clears the line and the announcer at the press (the outcome is held on a deferred). A sync-on success then leaves no failure text.
- New: an earlier press that fails after a later one went through says nothing.
- New: the line goes once iCloud holds no synced files, and does not come back when `sharedExists` is true again.
- The em-dash test's string list gains the new constant. `icloudSyncCss.test.ts` gains a row for `.sr-ics-remove-failed`.
- **Why the main failure test installs a plain function, not `vi.fn`.** Vitest's spy attaches its own `then(onFulfilled, onRejected)` to every promise it returns, to fill `mock.settledResults`. That marks a rejection handled, so with `vi.fn` HEAD's dropped rejection was invisible to vitest's unhandled-rejection detector. With a plain function, HEAD fails the run with `Unhandled Rejection { code: 'unavailable' }` and the fix does not.

**Red on HEAD:** 3 of the new tests fail, plus the Unhandled Rejection. The earlier-press test passes on HEAD by construction (HEAD shows nothing at all), so it was proven against a mutation instead.

**Mutations** (each applied alone to the fixed file, then restored):

| Mutation | Result |
|---|---|
| no attempt guard | the earlier-press test goes red |
| no reset when `sharedExists` goes false | the files-gone test goes red |
| no line clear at the press | the press-again test goes red |
| no announcer clear at the press | the press-again test goes red |
| no `aria-describedby` | the failure test goes red |
| no announcement on failure | the failure test goes red |
| failure announcement keeps the old `seq` | **stays green** |
| the above plus no announcer clear | the failure and press-again tests go red |

The green row is the ui.md v0.5.81 nuance. The press already empties the region, so the re-add is a new node whether it is keyed or not. The test comment says what the repeat test does and does not reject. The shared region's key itself is rejected by the existing Check now test, which goes red when the region's child is unkeyed (measured).

**Known limitation:** jsdom proves the reconciliation, not an announcement. No real-engine accessibility-tree read was made for this region. It is the same always-mounted region Check now already uses, and this change does not alter its markup, CSS or mounting.

**Copy:** the new in-app sentence and the HELP clause need no stop under the spin rule. No published surface changes. Only the two privacy pages name this button, and their claim stays true.

**Follow-up (Auditor, Informational):** once iCloud holds no synced files, the reset also clears the status region's copy of this failure, and only that sentence, so a newer Check now or Copied message stays; the files-gone test is extended and a new test covers two removals in flight with sync off (earlier empties iCloud, later fails: nothing shown or announced).
