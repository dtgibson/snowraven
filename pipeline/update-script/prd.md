# PRD — Update Script + In-App Update Check
**Feature:** update-script
**Session:** 001
**Date:** 2026-05-08
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

A `update.sh` shell script at the repo root handles the full update process in one command. A small "Check for updates" link in the app footer calls a backend endpoint — only when clicked — that compares the running version against the latest GitHub release and returns the result. No network request is made until the user explicitly clicks.

---

## User Stories

**US-01** — As a birder running SnowRaven on a Raspberry Pi, I want to update the app by running one command, so I don't have to remember a sequence of steps.

**US-02** — As a birder using SnowRaven, I want to check whether a newer version is available from within the app, so I know when it's worth updating.

**US-03** — As a privacy-conscious user, I want the app to make no outbound network requests unless I explicitly ask it to, so nothing is sent without my knowledge.

**US-04** — As a user on a local install without systemd, I want the update script to work without errors even though there's no service to restart.

---

## Functional Requirements

### Update Script

**FR-01** — A script `update.sh` shall exist at the repo root, executable (`chmod +x`), that performs the following steps in order:
1. `git pull`
2. `cd frontend && npm ci && npm run build && cd ..`
3. `cd backend && .venv/bin/pip install -r requirements.txt && cd ..`
4. Restart the systemd service if it exists: `sudo systemctl restart snowraven`

**FR-02** — The script shall print a clear one-line status message before each step (e.g. `→ Pulling latest changes...`, `→ Rebuilding frontend...`).

**FR-03** — If any step fails, the script shall exit immediately with a non-zero status and print a plain-English error message indicating which step failed.

**FR-04** — If the systemd service `snowraven` does not exist, the script shall skip the restart step silently and print a note that the user should restart manually.

**FR-05** — The script shall print a success message on completion (e.g. `✓ SnowRaven updated successfully.`).

### Backend Version Endpoint

**FR-06** — The backend shall expose a `GET /version/check` endpoint. This endpoint shall only be called in response to an explicit user action — never on startup, never on a schedule.

**FR-07** — When called, `/version/check` shall:
- Read the current version from `frontend/package.json`
- Fetch the latest release tag from the GitHub API (`https://api.github.com/repos/dtgibson/snowraven/releases/latest`)
- Return a JSON response: `{ "current": "0.0.4", "latest": "0.0.5", "up_to_date": false }` (or `true` if versions match)

**FR-08** — If the GitHub API is unreachable or returns an error, `/version/check` shall return a JSON error response with a human-readable `detail` field rather than a 5xx crash. The frontend shall handle this gracefully.

**FR-09** — `/version/check` shall use a 5-second timeout on the GitHub API call to avoid hanging indefinitely.

### Frontend Footer UI

**FR-10** — The footer shall include a small "Check for updates" link, displayed inline with the existing footer text, separated by a `·` divider.

**FR-11** — Clicking the link shall call `GET /version/check` and replace the link text with a loading indicator for the duration of the request.

**FR-12** — On a successful response where `up_to_date` is `true`, the footer shall display: `SnowRaven is up to date (v{current})` in place of the link, reverting to the original link after 4 seconds.

**FR-13** — On a successful response where `up_to_date` is `false`, the footer shall display: `Update available: v{latest} — run ./update.sh` in place of the link, reverting after 8 seconds.

**FR-14** — On an error response or network failure, the footer shall display: `Could not check for updates` and revert to the original link after 4 seconds.

**FR-15** — While a check is in progress, the link shall be non-interactive (clicking again has no effect).

### README

**FR-16** — The "Updating to a new version" section of `README.md` shall be replaced with a single instruction: run `./update.sh` from the SnowRaven directory.

---

## Non-Functional Requirements

**NFR-01 — Privacy:** No outbound request shall be made by the backend or frontend on behalf of this feature at any time other than in direct response to a user clicking "Check for updates." The Vite proxy config must not proxy `/version` on the dev server without an explicit call.

**NFR-02 — Visual consistency:** The footer UI elements shall use SnowRaven's existing muted color token (`#71717A`) and match the existing footer font size (12px). No new design patterns.

**NFR-03 — Graceful degradation:** The update check is non-essential. A failure to reach GitHub must never produce an error state that affects any other part of the app.

---

## Out of Scope

- Automatic or scheduled update checks
- One-click in-app update
- Rollback on failure
- Windows support for `update.sh`
- Updating system dependencies (Node, Python, OS packages)

---

## Open Questions

None — all decisions are resolved in this document.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | `update.sh` exists and is executable | `ls -l update.sh` shows `-rwxr-xr-x`; running it prints step messages |
| QA-02 | Script exits on step failure | Introducing a bad command causes the script to stop and print an error |
| QA-03 | Script skips systemd gracefully | Running on a machine without the snowraven service prints the manual restart note, exits 0 |
| QA-04 | `/version/check` returns correct fields | Response JSON contains `current`, `latest`, and `up_to_date` keys |
| QA-05 | Current version matches `package.json` | `current` in the response matches the version in `frontend/package.json` |
| QA-06 | No request on page load | Browser network tab shows zero calls to `/version/check` on initial load and tab switches |
| QA-07 | Request fires on click | Clicking "Check for updates" triggers exactly one call to `/version/check` |
| QA-08 | Up-to-date message shown | With matching versions mocked, footer shows the up-to-date message then reverts |
| QA-09 | Update-available message shown | With mismatched versions mocked, footer shows update message with correct version numbers |
| QA-10 | Error handled gracefully | With GitHub API mocked to fail, footer shows error message and reverts; rest of app unaffected |
| QA-11 | README updated | Multi-step update instructions replaced with `./update.sh` reference |
