# Bug Brief — icloud-remove-synced-failure

## What is broken
When Remove synced files from iCloud fails in Settings (Mac and iPhone/iPad builds), the screen says nothing. The controller already reports the failure: `removeFromICloud()` in `lib/icloud/icloudSync.ts` rejects with the native code and leaves the shared list as it was (pinned by `countySync.test.ts`, "reports the failure, never success"). Settings then drops it: `handleRemove` in `components/Settings.tsx` calls `void icloudActions.removeFromICloud()`. That gives no message, no announcement, and an unhandled rejection. The native `icloud_remove_all` (`src-tauri/src/icloud.rs`) stops at the first item it cannot delete. That can be a data file, a county file, a day snapshot, or a placeholder folder that is still there (`remove_placeholder_dir`). Whatever came before that item is already gone. After an 8 s timeout the work keeps running in the background.

## Steps to reproduce
1. In the jsdom harness of `Settings.icloud.test.tsx`, install fake actions whose `removeFromICloud` rejects with `{ code: 'unavailable' }`. Set state to available, sharedExists true, and sync off.
2. Press Remove synced files from iCloud, then Remove from iCloud in the dialog.
3. Observed (reproduced by the Evaluator with a temporary test, now deleted): the action is called once. No "could not" text appears anywhere in the section. All 10 status and alert regions are empty. The Remove button simply stays.

## Expected behavior
A failed Remove says so on screen, using the section's existing failure sentence and inventing no new copy if it fits. The existing sentence is `CHECK_FAILED_SUFFIX`, "Could not reach iCloud.", which a failed Check now already shows and announces. The visible line must also show when the status row is collapsed (sync off and never checked), so it belongs in the remove row, beside the button. The `sr-ics-pending` line under Remove synced keys is the in-row precedent. Screen readers hear it once per failure through the always-mounted `role="status"` announcer, with a sequence-keyed child (`ui.md`, v0.5.80). It never claims what remains, because the app cannot know. The button staying is the honest retry path.

## Blast radius
- Settings iCloud section only: `handleRemove`, the remove row, and the shared announcer that Check now and Copy iCloud details also use. Those two must keep working as they do now.
- Remove synced keys already handles its own failure (pending line plus armed retry) and is unaffected. Enable and disable are out of scope.
- `docs/HELP.md` line 754 could take one clause saying a Remove that cannot finish says so and the button stays. It needs no stop.
- Published copy is unchanged. Only the two privacy pages name this button, and their claim stays true. README, the website and the App Store listing do not mention it.

## What done looks like
A Settings test where `removeFromICloud` rejects shows the existing sentence, visibly in the remove row, announces it through the status region, and announces it again on a second failure. A test where it resolves shows no failure text and keeps today's success behavior: with sync off the button goes away, and with sync on a check runs. There is no unhandled rejection, and the controller's existing rejection test stays green.
