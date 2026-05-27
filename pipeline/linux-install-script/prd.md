# PRD — Linux Install Script
**Feature:** linux-install-script
**Session:** 001
**Date:** 2026-05-27
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

`install.sh` is a single Bash script that fully installs SnowRaven on a Raspberry Pi or Debian/Ubuntu Linux machine in one command. It prompts the user to choose between a systemd service install (runs on boot) and a local install (dependencies set up, user starts manually), then performs all setup steps automatically.

---

## User Stories

**US-01** — As a Raspberry Pi user, I want to run one command and have SnowRaven running as a background service so that it is available on my network every time the Pi boots.

**US-02** — As a Linux user who doesn't want a system service, I want to install SnowRaven's dependencies and build the app so that I can start it manually whenever I need it.

**US-03** — As a new user, I want to be told clearly if my system isn't supported before the script changes anything so that I don't end up with a half-installed state.

**US-04** — As a user who doesn't have API keys yet, I want to skip the key setup step during install and enter them later in the app's Settings so that I can finish installation without interrupting my flow.

**US-05** — As a user, I want a clear success message that tells me the URL to open so that I know exactly where to go when the install finishes.

**US-06** — As a user whose install fails partway through, I want a clear error message that names the step that failed so that I know what to fix or report.

---

## Functional Requirements

### Pre-flight

**FR-01** — The script shall detect the OS by reading `/etc/os-release`. If the OS is not Debian or Ubuntu (or a derivative), it shall print an unsupported-OS message and exit with a non-zero status before making any changes to the system.

**FR-02** — The script shall verify that `sudo` is available. If not, it shall print a clear message and exit before making any changes.

**FR-03** — The script shall wrap all logic inside a `main()` function called at the end of the file, so that a partial download via `curl | sh` cannot execute an incomplete script.

**FR-04** — The script shall use `set -e` so that any unhandled error causes immediate exit. A `trap` shall catch unexpected exits and print a failure message naming the step in progress.

### Mode Selection

**FR-05** — After pre-flight, the script shall prompt the user to choose between two install modes:
- `1) Service install` — installs as a systemd service (auto-starts on boot)
- `2) Local install` — sets up dependencies and builds; user starts manually

**FR-06** — If the user enters anything other than `1` or `2`, the script shall re-prompt once. If still invalid, it shall exit with a clear message.

### Dependency Installation

**FR-07** — The script shall install the following system packages via `apt` if not already present: `git`, `python3`, `python3-pip`, `python3-venv`.

**FR-08** — The script shall check whether Node.js 18 or later is installed. If not, it shall install Node.js 20 LTS via the official NodeSource setup script (`nodesource_setup.sh`).

**FR-09** — All `apt` operations shall run with `-y` to avoid interactive prompts.

### Repo Setup

**FR-10** — The script shall offer a default install directory of `$HOME/snowraven` and allow the user to accept it (Enter) or type a different path.

**FR-11** — If the target directory already exists and contains a `start.sh` file, the script shall print a message that SnowRaven is already installed there and offer to abort or continue (which will overwrite the build).

**FR-12** — The script shall clone `https://github.com/dtgibson/snowraven.git` into the chosen directory if it does not already exist, or run `git pull` if it does.

### Build

**FR-13** — The script shall run `npm ci` and `npm run build` in the `frontend/` subdirectory.

**FR-14** — The script shall create a Python virtual environment at `backend/.venv` and install `backend/requirements.txt` into it.

### API Key Setup

**FR-15** — After the build, the script shall prompt for an eBird API key and an OpenWeather API key. Each prompt shall include a message: "You can skip this and enter your keys later in the app's Settings."

**FR-16** — If the user presses Enter without typing a key, the script shall leave that key blank in the `.env` file rather than failing.

**FR-17** — The script shall write a `.env` file in the `backend/` directory containing `EBIRD_API_KEY` and `OPENWEATHER_API_KEY`, whether or not values were entered. If a `.env` file already exists, the script shall not overwrite it — instead, it shall print a message that the existing `.env` was left in place.

### Service Install (mode 1 only)

**FR-18** — The script shall copy `deploy/snowraven.service` to `/etc/systemd/system/snowraven.service`, replacing the hardcoded `User=pi` and `WorkingDirectory` with the current user (`$USER`) and the chosen install directory.

**FR-19** — The script shall run `sudo systemctl daemon-reload`, `sudo systemctl enable snowraven`, and `sudo systemctl start snowraven`.

**FR-20** — If `systemctl start` fails, the script shall print the last 20 lines of `journalctl -u snowraven` and suggest the user check their API keys in Settings.

### Success Message

**FR-21** — On completion, the script shall print a success block including:
- The install mode chosen
- The URL to access the app: both `http://$(hostname).local:1620` and the LAN IP (`http://$(hostname -I | awk '{print $1}'):1620`)
- For local mode: the exact command to start the app (`cd [install-dir] && ./start.sh`)
- A reminder that API keys and data files are configured in the Settings tab

---

## Non-Functional Requirements

**NFR-01 — Compatibility:** The script shall run correctly on Raspberry Pi OS (Bookworm and Bullseye), Ubuntu 22.04, and Ubuntu 24.04.

**NFR-02 — Idempotency:** Re-running the script on an existing installation shall not corrupt it. An existing `.env` shall be preserved (FR-17). An existing repo shall be updated via `git pull` (FR-12).

**NFR-03 — Privilege scope:** The script shall use `sudo` only for `apt` operations and systemd steps. Repo clone, npm build, and venv setup shall run as the current user.

**NFR-04 — No root assumption:** The script shall not assume the user is `pi`. It shall use `$USER` and `$HOME` throughout.

**NFR-05 — Curl-pipe safe:** The entire script body shall be inside `main()` (FR-03), making it safe to run as `curl -fsSL [url] | bash`.

**NFR-06 — Progress feedback:** Each major step (installing deps, cloning repo, building frontend, setting up Python, configuring service) shall print a short status line before starting, so the user knows the script hasn't stalled.

---

## Out of Scope

- Non-apt distros (Fedora, Arch, Alpine, etc.)
- Docker or container-based install
- Windows or macOS
- Uninstall or removal script
- Auto-update logic (handled by `update.sh`)
- Any changes to backend, frontend, or `update.sh`
- HTTPS / TLS setup

---

## Open Questions

**OQ-01 — NodeSource GPG key method:** NodeSource's setup script adds a GPG key and apt repository. If it changes its URL or signing key, FR-08 breaks. *Default assumption:* use the current NodeSource `setup_20.x` script; document the NodeSource URL in a comment in the script so future maintainers know where to update it.

**OQ-02 — Hostname URL reliability:** `hostname.local` requires mDNS (Avahi/Bonjour) to be running on the network. *Default assumption:* print both `http://$(hostname).local:1620` and the LAN IP in the success message so users have a fallback.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | OS check rejects unsupported systems | Running on an unsupported OS prints error and exits without modifying the system |
| QA-02 | Mode prompt works | Entering `1` selects service mode; entering `2` selects local mode; invalid input re-prompts once then exits |
| QA-03 | System deps installed | After running, `git`, `python3`, `node` (≥18), and `npm` are all present |
| QA-04 | Repo cloned | Install directory exists and contains `start.sh` |
| QA-05 | Frontend built | `frontend/dist/index.html` exists after install |
| QA-06 | Python venv set up | `backend/.venv/bin/python` exists and `uvicorn` is importable |
| QA-07 | `.env` written | `backend/.env` exists containing `EBIRD_API_KEY` and `OPENWEATHER_API_KEY` keys |
| QA-08 | `.env` not overwritten | If `.env` exists before install, its contents are unchanged after install |
| QA-09 | Service mode: service running | `systemctl is-active snowraven` returns `active` after service install |
| QA-10 | Service mode: survives reboot | After `sudo reboot`, `systemctl is-active snowraven` returns `active` |
| QA-11 | Local mode: start command printed | Success message includes exact command to start the app |
| QA-12 | Success message contains URL | Both hostname.local and LAN IP URLs appear in the success output |
| QA-13 | Partial download safety | Truncating the script at the 50% mark and running it via `bash` produces no system changes |
| QA-14 | API key skip works | Pressing Enter at both key prompts completes install without error |
| QA-15 | Idempotency | Re-running on an existing install completes without error and leaves `.env` intact |
