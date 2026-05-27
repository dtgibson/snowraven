# Bug Brief — updater-not-replacing-binary

## What is broken

After the in-app updater downloads the new binary and the app exits via `exit(0)`,
the relaunched app is still running the old version. Every subsequent launch reports
the same update as available. The download appears to succeed (progress is shown),
but the bundle on disk is never actually replaced.

## Steps to reproduce

1. Launch SnowRaven (any version older than latest)
2. Open Settings, click "Check for updates"
3. When an update is found, click to download and install
4. Watch download progress complete — app exits
5. App relaunches; Settings still shows the same update as available
6. Repeat indefinitely — the update never "takes"

## Expected behavior

After the download and install completes, the relaunched app runs the new version
and the update check shows "up to date."

## Blast radius

Isolated to the update flow. No other features are affected. Manual install from
the GitHub DMG always works correctly.

## What done looks like

1. Trigger an in-app update
2. After relaunch, `getVersion()` returns the new version number
3. Checking for updates returns "up to date"

## Root cause candidates (to investigate in Stage 2)

**Candidate A — Race condition (most likely):** Tauri's updater spawns a background
shell script (`sleep 1 → replace bundle → open SnowRaven`). The user, seeing the app
disappear from the Dock, clicks the Dock icon before the 1-second sleep completes.
The Dock launches the OLD binary from the un-replaced bundle. The script later
replaces the bundle, but `open SnowRaven` focuses the already-running old instance.

**Candidate B — exit(0) vs relaunch() mismatch:** In `tauri-plugin-updater` v2.10.1,
`downloadAndInstall` may stage the update rather than spawn a replacement script.
If so, only `relaunch()` (not `exit(0)`) triggers the staged update to be applied.
`exit(0)` bypasses Tauri's process manager entirely, so the staged update is lost.

**Candidate C — Gatekeeper quarantine on extracted bundle:** macOS applies a
`com.apple.quarantine` attribute to the extracted `.app` in `/tmp`, which Tauri's
`open` call may silently fail to launch in a background (non-interactive) context.
The user never sees the new binary launch and manually relaunches the old one.
