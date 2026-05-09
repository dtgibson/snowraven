# Strategic Brief — Update Script + In-App Update Check

## What We're Building
Two things that work together: a single `update.sh` script that handles the full update process in one command, and a small "Check for updates" element in the app footer that — only when clicked — checks whether a newer version of SnowRaven is available and tells the user what to do.

## Why Now
SnowRaven is now at v0.0.4 with real, useful features. Users running it on a Raspberry Pi need a frictionless way to keep it current, and a way to know when there's something worth updating to — without the app ever phoning home on its own.

## The User Problem
Updating currently requires five commands across three directories. Most users won't bother until something breaks. And there's no way to know a new version exists without checking GitHub manually. Both of these make the tool feel harder to maintain than it needs to be.

## Success Criteria
- Running `./update.sh` from the SnowRaven root completes a full update in one step with clear progress output
- A small, unobtrusive element in the app footer lets the user check for updates on demand
- No network request is made until the user explicitly clicks — no passive polling, no background checks, no data sent on page load
- If an update is available, the user sees the current version, the latest version, and is told to run `./update.sh`
- If already up to date, a simple confirmation is shown
- The check fails gracefully if GitHub is unreachable

## Scope
- `update.sh` at the repo root: `git pull` → frontend rebuild → backend dependency refresh → systemd restart (skipped gracefully if no service)
- Backend `/version/check` endpoint: returns current running version + fetches latest release from the GitHub API only when called (server-side check keeps the client's IP off GitHub)
- Footer UI: small "Check for updates" link next to the existing footer text; on click calls `/version/check` and shows an inline result
- README update: replace multi-step update instructions with `./update.sh`

## Out of Scope
- Any automatic or scheduled update checks
- Automatic installation of updates (always manual via `./update.sh`)
- Update notifications on page load
- One-click in-app update (deliberately excluded — adds security risk and self-restart complexity not worth the convenience gain)
- Rollback on failure
- Windows support

## Key Decisions
- The version check is server-side: the backend fetches from GitHub, not the browser — this avoids the client's IP being sent to GitHub
- No request of any kind is made until the user clicks
- The update itself is always manual — the app tells you what to run, it doesn't run it for you
- One-click in-app update was considered and deliberately excluded in favour of simplicity and security
