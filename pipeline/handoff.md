# Handoff — Frivolous Lists RELEASED; v0.5.36 live on both platforms

## What We Accomplished

Released **v0.5.36**. Frivolous Lists was built and Chronicled on the VM
(commit `40eeca3`, tag `v0.5.36`) and pushed. This Mac session pulled,
verified the build locally, waited for Windows CI to go green, ran
`./release.sh`, and verified the release live on both platforms.

Frivolous Lists is a playful section at the bottom of the Statistics
page — three self-completing collections from your own life list:
**Avian American** (22), **California Dreamer** (7), and **Rainbow
Warrior** (first bird of each of seven rainbow colors). Frontend-only,
built on the eBird data the app already has; privacy posture unchanged.

## The signing hiccup (fixed this session)

The first `./release.sh` stopped at preflight with `APPLE_SIGNING_IDENTITY
is not set`. Cause: it was invoked as a bare `./release.sh`, which spawns
a non-login shell. The four Apple signing credentials are exported in the
**login** profile, so they were absent. Re-running the documented way —
`zsh -lc './release.sh'` (a login shell) — loaded the profile and the
release ran normally. Not a signing or environment regression; just the
invocation. (Standing note added to session-state.)

## How We Released

1. Pulled `main` to `40eeca3`; confirmed tag `v0.5.36` points at it.
2. Verified locally: `tsc -b && vite build` clean (the 0.5.35-trap check
   on the release machine), both version files at `0.5.36`.
3. Waited for Windows CI run `27551462193` to go green; verified its
   `headSha == 40eeca3 ==` the tag commit `==` `release.sh`'s
   most-recent-success selection (the tag-re-push guard) **before**
   releasing. Fresh single-push tag — no re-push hazard.
4. Ran `./release.sh` via `zsh -lc`.

## Where We Are

Released and verified live. `main` / `origin/main` / tag `v0.5.36` all at
`40eeca3`. GitHub release `v0.5.36` is published, marked Latest (not
draft/prerelease), target `main`, published 2026-06-15T14:55:52Z. All 6
assets return HTTP 200. macOS notarization Accepted (Apple submission
`785639ed`) + stapled. `latest.json`: version 0.5.36, `darwin-aarch64` +
`darwin-x86_64` → the one universal updater bundle (same sig),
`windows-x86_64` → `SnowRaven_0.5.36_x64-setup.exe`. Pipeline idle.

## Open / Optional

- Optional: confirm the in-app updater picks up 0.5.36 by opening the app
  (latest.json is correct, so detection is ready).
- Not part of this release: origin has an unmerged
  `docs/snoa-3-accuracy-fixes` branch — left untouched.
- ROADMAP Up Next: mobile app; Windows code signing.

## Resume Prompt

Run `/weft` to start the next thing. Load `pipeline/session-state.json` first.
