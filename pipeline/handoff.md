# Handoff — 0.5.28 SHIPPED & live; pipeline idle, one follow-up for the VM

## Where We Are

**Idle.** No active Weft session (`activeFeature: null`,
`lastCheckpointStatus: complete`). Released version **0.5.28** equals `main` —
nothing undeployed, nothing queued to ship. The `weather-block-raincrow-parity`
improvement (built on the VM, paused at Stage 6 for the Mac release) is now closed
out — this is the Mac's `mark 0.5.28 released` commit.

## What Shipped (live) — 0.5.28 (weather-block raincrow parity)

Night checklists' generated weather blocks now append a moon-phase emoji to the
condition emoji (unspaced, e.g. `☁️🌗`; mirrored south of the equator; phase from the
checklist's first hour; night = any sampled hour outside its sunrise–sunset window),
a hand-port of lunarphase-js@2.0.3 with a pure-UTC Julian Day, byte-identical in the
TS and Python formatters via the golden-oracle chain. Day blocks proven
byte-unchanged; the comment stripper needed zero production changes. Dew point was
established as ALREADY at parity — no change, logged in DECISIONS.md.

## Release (Mac) — verified

Built, chronicled (PARITY / CHANGE-BRIEF / QA / SECURITY artifacts +
DECISIONS / PRODUCT_CONTEXT / ROADMAP / CHANGELOG / HELP / README / website),
version-bumped, and tagged on the **VM**; released from the **Mac**:

- `v0.5.28` tag → Windows CI green (run 27315705705; `windows-build` artifact
  `SnowRaven_0.5.28_x64-setup.exe` present) → `./release.sh`.
- macOS universal DMG **notarized (Apple: Accepted) + stapled**; post-build
  `CFBundleShortVersionString` guard passed at `0.5.28`.
- Windows installer signed locally with the real minisign key.
- `latest.json` carries all three platforms: `darwin-aarch64` + `darwin-x86_64` →
  the one universal `SnowRaven-updater.app.tar.gz` (same URL + same signature),
  `windows-x86_64` → `SnowRaven_0.5.28_x64-setup.exe`.
- Every updater + DMG URL verified **HEAD 200** (latest.json, updater tar.gz,
  -setup.exe, universal DMG). Release is `draft=false, prerelease=false`.
- https://github.com/dtgibson/snowraven/releases/tag/v0.5.28

## Tests

110 backend green. 769 frontend green EXCEPT one pre-existing flake — see below.

## Follow-up for the VM (do this next, before/with the next lane)

**Flaky frontend test — `frontend/src/components/BirdingStats.test.tsx`** ("…after
the double rAF"). Fails ~11% of full-suite runs; passes 3/3 in isolation. Every
in-suite run also emits 4 unhandled `ReferenceError: cancelAnimationFrame is not
defined` from `@reduxjs/toolkit` timers (vitest warns these may cause false
positives). It is **pre-existing** — `BirdingStats.test.tsx` is not in the 0.5.28
diff, and the flake was latent under 0.5.27 too — and has **no production-build
impact** (`release.sh` runs the Vite build, not vitest; CI's Pipeline was green).
Likely fix: add a `cancelAnimationFrame` (and `requestAnimationFrame`) polyfill to
the vitest setup, and/or de-flake the double-rAF assertion. This is dev work — do it
on the **VM**, not the Mac.

## Machine boundary (standing rule)

- **Ubuntu VM — all dev work** (coding, content/assets incl. website + demo
  screenshots, pushing the `vX.Y.Z` tag). Fix the flaky test here.
- **Mac — only signing and shipping** (`./release.sh` needs Xcode + Apple creds).

> The VM keeps pushing while a Mac session is open — re-pull before editing the
> pipeline files, and treat the VM's commits as authoritative on conflict. This
> release the VM DID update `handoff.md` / `session-state.json` narrative fields;
> the Mac corrected them to the released/idle state in this closeout commit.

## Roadmap — Up Next (pick a lane, build on the VM)

- Mobile app
- Accessibility / clarity / simplification
- Windows code signing (remove the SmartScreen "unknown publisher" prompt)

On the VM: `git pull` to sync this closeout, fix the BirdingStats flake, then pick
the next lane. No pending Chronicler or deploy step here.
