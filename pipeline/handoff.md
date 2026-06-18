## What We Accomplished

Shipped SnowRaven 0.5.43 — a draggable center pin on the Map Explorer's Hotspots, Nearby
Lifers, and Media Targets maps. Right-click (desktop) or long-press (touch) drops a center
pin and re-runs that view's search for the spot; dragging fine-tunes. It reuses the Predict
tab's pin pattern and the existing shared center, is session-only, and the gestures are
distinct from left-click so existing pin selection is unchanged. Built, verified, recorded,
and committed on the VM; the release finished from the Mac and is now live on both platforms.

## Where We Are

Done. 0.5.43 is published and verified live:

- macOS universal DMG signed + notarized (Apple submission `64c4dfe7-a0cd-4ffc-b08c-13c12b89e69c`, Accepted) + stapled.
- Windows installer fetched from the green `v0.5.43` CI run (`27740887216`, headSha == tag commit) and signed locally.
- `latest.json` carries all three platform keys (`darwin-aarch64` + `darwin-x86_64` → the one universal updater bundle, `windows-x86_64` → `SnowRaven_0.5.43_x64-setup.exe`), each with its signature.
- All 6 release assets return HTTP 200; GitHub `/releases/latest` confirms `v0.5.43` is Latest, target `main`.

The pipeline is idle. The only optional follow-up: open the desktop app to confirm the
in-app updater detects 0.5.43 (the `latest.json` is correct, so detection is ready).

## Resume Prompt

To resume: run `/weft` in this project. The pipeline is idle — start a new improvement,
feature, or fix whenever you're ready.
