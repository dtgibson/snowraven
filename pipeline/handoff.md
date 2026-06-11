# Handoff — 0.5.29 SHIPPED & live; pipeline idle, one follow-up for the VM

## What We Accomplished

The flaky-test fix plus the three small SnowRaven Mini mentions are built, shipped,
and live as 0.5.29. The release is done and the in-app updater has been verified, so
this improvement is now closed out — nothing is left pending and nothing is queued to
ship. Released version equals what's on `main`.

## What Shipped (live) — 0.5.29

- **Flake fix.** The recurring ~11% BirdingStats test-suite failure is gone at the
  root: recharts' bundled @reduxjs/toolkit fires a 100ms fallback timer that outlived
  a test file's per-test animation-frame stubs and threw a bare `cancelAnimationFrame`
  error in a later worker file. Fixed with baseline rAF/cAF shims in
  `frontend/src/test-setup.ts` (wired via vitest `setupFiles`, test-only, verified
  absent from the production bundle).
- **SnowRaven Mini mentions.** Three informational, approved-verbatim: a quiet footer
  line under the Weather tab card (a plain no-fetch anchor), a README "What it does"
  paragraph, and a HELP.md H3 under Weather (kept out of the sidebar TOC). The website
  deliberately stays silent about Mini.

## Release (Mac) — verified

`v0.5.29` tag → Windows CI green (run 27324903403; `windows-build` artifact
`SnowRaven_0.5.29_x64-setup.exe` present) → `./release.sh`:

- macOS universal DMG **notarized (Apple: Accepted) + stapled**; bundle-version guard
  passed at `0.5.29`.
- Windows installer signed locally with the real minisign key.
- `latest.json` carries all three platforms: `darwin-aarch64` + `darwin-x86_64` →
  the one universal `SnowRaven-updater.app.tar.gz` (same URL + same signature),
  `windows-x86_64` → `SnowRaven_0.5.29_x64-setup.exe`.
- Every updater + DMG URL verified **HEAD 200**. Release `draft=false, prerelease=false`.
- https://github.com/dtgibson/snowraven/releases/tag/v0.5.29

## Tests

110 backend green. The targeted `cancelAnimationFrame` flake is proven dead — **0
failures across 18 full-suite Mac runs**. But see the follow-up below.

## Follow-up for the VM (do this next)

**A SECOND, separate BirdingStats flake remains.** An 18-run Mac sweep (done to verify
the 0.5.29 fix) caught a different intermittent failure:
`frontend/src/components/BirdingStats.test.tsx > "mounts the SnowMap only after the
idle callback fires"` — ~5.5% (1/18), a `requestIdleCallback` timing-assertion race
around BirdingStats.test.tsx ~lines 180-195. It passes in isolation. It is **not** the
`cancelAnimationFrame` ReferenceError 0.5.29 fixed, and `BirdingStats.test.tsx` was not
touched by 0.5.29, so it is pre-existing — it was simply masked by the louder cAF flake
until that was silenced. The VM's small "8/8 clean" sample (~63% odds of missing a 5.5%
flake) didn't surface it.

Two things for the VM:
1. **Fix the idle-callback flake** (likely: make the `requestIdleCallback`/idle stub
   deterministic, or de-flake the "after the idle callback" assertion).
2. **Narrow the record.** DECISIONS.md / CHANGELOG say "BirdingStats flake FIXED in
   0.5.29" — correct it to "cancelAnimationFrame flake fixed; idle-callback timing
   flake remains," so the file isn't assumed fully deterministic.

(Also still open, separate repo: snowraven-mini's formatter lacks the 0.5.28 moon-phase
emoji — fix lives in that repo.)

## Machine boundary (standing rule)

- **Ubuntu VM — all dev work** (coding, content/assets incl. website + demo
  screenshots, pushing the `vX.Y.Z` tag). Fix the idle-callback flake here.
- **Mac — only signing and shipping** (`./release.sh` needs Xcode + Apple creds).

> The VM keeps pushing while a Mac session is open — re-pull before editing the
> pipeline files, and treat the VM's commits as authoritative on conflict.

## Roadmap — Up Next (pick a lane, build on the VM)

- Mobile app
- Accessibility / clarity / simplification
- Windows code signing (remove the SmartScreen "unknown publisher" prompt)

On the VM: `git pull` to sync this closeout, fix the idle-callback flake, then pick the
next lane.
