# Handoff — Behavior ML links + coverage fix RELEASED; v0.5.38 live on both platforms

## What We Accomplished

Released **v0.5.38**. The Statistics media-behavior links + coverage fix was built,
verified, and Chronicled on the VM (commit `679817f`, tag `v0.5.38`) and pushed.
This Mac session pulled, verified the build locally, confirmed Windows CI was green
on the right commit, ran `./release.sh`, and verified the release live on both
platforms.

On the Statistics → Media card, each behavior count now links to that behavior
filtered to your own media in the Macaulay Library, each breeding behavior is listed
and linked on its own (and dropped from the top behaviors list so it isn't shown
twice), and the tab's catalog links were unified onto `media.ebird.org/catalog`.
Folded in with approval: the "documentation coverage" denominator was corrected to
stop counting `sp.`/slash/hybrid forms against the life list. Frontend-only — no
provider or privacy changes.

## How We Released

1. Pulled `main` to `679817f`; confirmed tag `v0.5.38` points at it (HEAD == tag).
2. Verified locally: both version files at `0.5.38`, `createUpdaterArtifacts: true`,
   CHANGELOG 0.5.38 entry, website v0.5.38, and `tsc -b && vite build` clean (the
   0.5.35-trap check on the release machine).
3. Confirmed Windows CI run `27653200530` green with `headSha == 679817f ==` the tag
   commit `==` `release.sh`'s most-recent-success selection (the tag-re-push guard).
   Fresh single-push tag — no re-push hazard.
4. Ran `./release.sh` via `zsh -lc` (login shell — Apple signing creds live only in
   the login profile; a bare `./release.sh` fails preflight with
   `APPLE_SIGNING_IDENTITY is not set`).

## Where We Are

Released and verified live. `main` / `origin/main` / tag `v0.5.38` all at `679817f`.
GitHub release `v0.5.38` is published, marked Latest (not draft/prerelease), target
`main`, published 2026-06-16T23:25:09Z. All 6 assets return HTTP 200. macOS
notarization Accepted (Apple submission `547f44f5`) + stapled. `latest.json`: version
0.5.38, `darwin-aarch64` + `darwin-x86_64` → the one universal updater bundle
`SnowRaven-updater.app.tar.gz` (same sig), `windows-x86_64` →
`SnowRaven_0.5.38_x64-setup.exe`. Pipeline idle.

## Open / Optional

- Optional: confirm the in-app updater picks up 0.5.38 by opening the app
  (latest.json is correct, so detection is ready).
- Not part of this release: origin has an unmerged `docs/snoa-3-accuracy-fixes`
  branch — left untouched.
- ROADMAP Up Next: mobile app (responsive groundwork done); Windows code signing.

## Resume Prompt

Run `/weft` to start the next thing. Load `pipeline/session-state.json` first.
