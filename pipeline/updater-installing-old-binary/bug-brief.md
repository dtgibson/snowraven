# Bug Brief — updater-installing-old-binary

## What is broken

Every in-app update installs the original v0.3.7 binary regardless of what
version `latest.json` advertises. After the update completes and the app
relaunches, the About screen shows "Version 0.3.7 (0.3.7)" and the updater
immediately offers the same update again.

## Root cause (confirmed)

Tauri only regenerates `SnowRaven.app.tar.gz` when the Rust binary is
actually recompiled. All versions after 0.3.7 changed only `tauri.conf.json`
(version bump) — no Rust source changed — so Cargo produced incremental
builds with no binary output. Tauri skipped bundle regeneration, leaving the
original 0.3.7 `SnowRaven.app.tar.gz` (timestamped 11:01 AM May 26) in
`~/.snowraven-build/release/bundle/macos/`.

`release.sh` picked up this stale file, signed it, and uploaded it with the
current version in `latest.json`. The sig matched the bundle, so Tauri's
signature verification passed — and users got 0.3.7.

The `SnowRaven.app` directory IS being updated correctly with each build
(currently shows 0.3.20 in Info.plist). Only the `.app.tar.gz` is stale.

## Steps to reproduce

1. Install any version of SnowRaven newer than 0.3.7
2. Open Settings, check for updates
3. Download and install the update
4. After relaunch, open About — version shows 0.3.7

## Expected behavior

After updating, the About screen shows the version that was advertised in
`latest.json`, and checking for updates returns "up to date."

## Blast radius

Isolated to `release.sh`. The app binary and all in-app functionality are
unaffected. All users who used the in-app updater since v0.3.7 have been
downgraded to 0.3.7.

## What done looks like

1. `release.sh` deletes stale bundle artifacts and touches a Rust source
   file before building, forcing full bundle regeneration
2. Post-build check confirms `SnowRaven.app`'s `Info.plist` version matches
   the expected version before upload
3. Re-release of v0.3.20 uploads the correct binary
4. User updates from 0.3.7 → 0.3.20, About screen shows 0.3.20
