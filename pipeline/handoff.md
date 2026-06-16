# Handoff — Mobile-responsive sweep RELEASED; v0.5.37 live on both platforms

## What We Accomplished

Released **v0.5.37**. The mobile-responsive sweep was built and Chronicled on the
VM (commit `bc13906`, tag `v0.5.37`) and pushed. This Mac session pulled, verified
the build locally, confirmed Windows CI was green on the right commit, ran
`./release.sh`, and verified the release live on both platforms.

The sweep makes every screen flow from a ~320px phone up to a large desktop with
no overlapping rows and no sideways scrolling; large screens cap to a comfortable
reading width. Built by generalizing the app's existing CSS-class responsive
system (a shared layout vocabulary + breakpoint tiers) across ~35 components, not
inline styling. Two dead leftover stylesheets (`index.css`, `App.css`) were
removed. Frontend styling only — no provider or privacy changes.

## How We Released

1. Pulled `main` to `bc13906`; confirmed tag `v0.5.37` points at it.
2. Verified locally: both version files at `0.5.37`, `createUpdaterArtifacts:
   true`, CHANGELOG 0.5.37 entry, and `tsc -b && vite build` clean (the
   0.5.35-trap check on the release machine).
3. Confirmed Windows CI run `27597414622` green with `headSha == bc13906 ==` the
   tag commit `==` `release.sh`'s most-recent-success selection (the tag-re-push
   guard). Fresh single-push tag — no re-push hazard.
4. Ran `./release.sh` via `zsh -lc` (login shell — Apple signing creds live only
   in the login profile; a bare `./release.sh` fails preflight with
   `APPLE_SIGNING_IDENTITY is not set`).

## Where We Are

Released and verified live. `main` / `origin/main` / tag `v0.5.37` all at
`bc13906`. GitHub release `v0.5.37` is published, marked Latest (not
draft/prerelease), target `main`, published 2026-06-16T06:15:06Z. All 6 assets
return HTTP 200. macOS notarization Accepted (Apple submission `ca1136f2`) +
stapled. `latest.json`: version 0.5.37, `darwin-aarch64` + `darwin-x86_64` → the
one universal updater bundle `SnowRaven-updater.app.tar.gz` (same sig),
`windows-x86_64` → `SnowRaven_0.5.37_x64-setup.exe`. Pipeline idle.

## Open / Optional

- Optional: confirm the in-app updater picks up 0.5.37 by opening the app
  (latest.json is correct, so detection is ready).
- Known limitation (accepted): Statistics still scrolls ~34px sideways only at
  200% in-app text size — see `pipeline/mobile-responsive-sweep/qa-report.md`.
- Not part of this release: origin has an unmerged `docs/snoa-3-accuracy-fixes`
  branch — left untouched.
- ROADMAP Up Next: mobile app (responsive groundwork now done); Windows code
  signing.

## Resume Prompt

Run `/weft` to start the next thing. Load `pipeline/session-state.json` first.
