# Handoff — Frivolous Lists expansion RELEASED; v0.5.39 live on both platforms

## What We Accomplished

Released **v0.5.39**. The Frivolous Lists expansion was built, verified, and
Chronicled on the VM (commit `da85292`, tag `v0.5.39`, session 39) on top of the
live 0.5.38, then pushed. This Mac session (40) pulled, verified the build locally,
confirmed Windows CI was green on the right commit, ran `./release.sh`, and verified
the release live on both platforms.

The change adds five new self-completing collections at the bottom of the Statistics
tab: three flat (Phoebe Phanatic, Scrub Jay All Day, Crow Pro / Raven Maven) and two
grouped with labeled sub-categories shown in the card (Heron is Carin' — 12 species;
Best of the Crest — 38 across 16 sub-groups). Each checks off from the life list with
a count and a badge. Frontend-only — no new providers, no privacy change.

## How We Released

1. Pulled `main` to `da85292`; confirmed tag `v0.5.39` points at it (HEAD == tag).
2. Verified locally: both version files at `0.5.39`, `createUpdaterArtifacts: true`,
   CHANGELOG 0.5.39 entry, website v0.5.39 (both pills), and `tsc -b && vite build`
   clean (the 0.5.35-trap check on the release machine).
3. Confirmed Windows CI run `27659828267` green with `headSha == da85292 ==` the tag
   commit `==` `release.sh`'s most-recent-success selection (the tag-re-push guard).
   Fresh single-push tag — no re-push hazard.
4. Ran `./release.sh` via `zsh -lc` (login shell — Apple signing creds live only in
   the login profile; a bare `./release.sh` fails preflight with
   `APPLE_SIGNING_IDENTITY is not set`).

## Where We Are

Released and verified live. `main` / `origin/main` / tag `v0.5.39` all at `da85292`.
GitHub release `v0.5.39` is published, marked Latest (not draft/prerelease), target
`main`, published 2026-06-17T01:57:54Z. All 6 assets return HTTP 200. macOS
notarization Accepted (Apple submission `42786efe`) + stapled. `latest.json`: version
0.5.39, `darwin-aarch64` + `darwin-x86_64` → the one universal updater bundle
`SnowRaven-updater.app.tar.gz` (same sig), `windows-x86_64` →
`SnowRaven_0.5.39_x64-setup.exe`. Pipeline idle.

## Open / Optional

- Optional: confirm the in-app updater picks up 0.5.39 by opening the app
  (latest.json is correct, so detection is ready).
- Not part of this release: origin has an unmerged `docs/snoa-3-accuracy-fixes`
  branch — left untouched.
- ROADMAP Up Next: mobile app (responsive groundwork done); Windows code signing.

## Resume Prompt

Run `/weft` to start the next thing. Load `pipeline/session-state.json` first.
