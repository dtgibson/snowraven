## What We Accomplished

Shipped SnowRaven 0.5.44 — a dark-mode contrast fix for the Statistics tab's "Firsts &
Milestones" badges (and the matching Frivolous Lists "Complete!" badges, which share the
tokens). In dark mode they had rendered as bright near-white tiles with the bird's name
washed out to nearly invisible; the `[data-theme="dark"]` `--sr-milestone-*` block was a
verbatim copy of the light tiles. The fix re-tinted those dark-theme tokens to dark tiles
(deep green tiers 1–3, deep amber tier 4) with number/name/date/check/border all re-tuned to
WCAG AA against both gradient stops — a pure CSS token change, no component code, light mode
untouched, plus a contrast regression test that parses the real tokens so the bug can't
silently return. Built, verified, recorded, and committed on the VM (session 49); the release
finished from the Mac (session 50) and is now live on both platforms.

## Where We Are

Done. 0.5.44 is published and verified live:

- Pulled the VM's work to `6ec84b1`; HEAD == `v0.5.44` tag commit; tree clean.
- macOS universal DMG signed (Developer ID Application: DAVID THOMAS GIBSON, 8QKC3L2FKP) + notarized (Apple submission `d48eb673-374e-4cfb-af4e-22668f3807dd`, Accepted) + stapled; bundle-version guard 0.5.44.
- Windows installer fetched from the green `v0.5.44` CI run (`27765223391`, headSha == tag commit) and signed locally.
- `latest.json` carries all three platform keys (`darwin-aarch64` + `darwin-x86_64` → the one universal updater bundle, `windows-x86_64` → `SnowRaven_0.5.44_x64-setup.exe`), each with its signature.
- All 6 release assets return HTTP 200; GitHub `/releases/latest` confirms `v0.5.44` is Latest, target `main`, not draft/prerelease.
- Also bumped the website version pill + footer `0.5.43` → `0.5.44` (`website/index.html`, commit `7217d31`) — a Pages-only redeploy, not part of `release.sh`.

The pipeline is idle. The only optional follow-up: open the desktop app to confirm the
in-app updater detects 0.5.44 (the `latest.json` is correct, so detection is ready).

## Resume Prompt

To resume: run `/weft` in this project. The pipeline is idle — start a new improvement,
feature, or fix whenever you're ready.
