## Honest Load-Failure Handling

### What this does
Preserves the difference between an absent saved-file record and a failed status read in both web/Pi and Tauri storage. All eight stored-file tabs now route an unavailable status to their existing load-error panel instead of showing setup instructions that claim no file is saved.

### How to test
1. Run the honest-load-failure, WebStorage, and Tauri metadata test groups.
2. Confirm a successful empty status still shows each tab's setup guidance.
3. Confirm a rejected status read, a non-OK `/settings/files` response, and unreadable Tauri metadata all reach a load failure rather than an empty status.
4. Run typecheck, lint, and the production build.

### Notes for reviewer
The UI layout and copy are unchanged; this fix routes one more real failure into the error state the app already owns. A missing Tauri metadata document still resolves as two empty slots because `readJson` handles absence before parsing; malformed or unreadable metadata now rejects. No dependency, backend route, network destination, parser, upload, or persistence format changed.

## Convention Flags

- A status lookup that fails is unknown, not empty; storage seams preserve that distinction and UI consumers choose an explicit error state.
