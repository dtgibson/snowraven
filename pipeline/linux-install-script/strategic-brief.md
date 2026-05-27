# Strategic Brief — Linux Install Script

## What We're Building
A single shell script (`install.sh`) that sets up SnowRaven on a Raspberry Pi or any Debian/Ubuntu Linux machine in one command. The user chooses between a systemd service install (auto-starts on boot) or a local install (dependencies only, user starts manually).

## Why Now
The product brief says "self-hosted first, designed to run on Raspberry Pi" — but the current setup requires seven manual steps from the README. Every new Pi user who hits that process is a potential drop-off. An installer converts a documentation problem into a solved problem, and it's the kind of thing that gets shared: one link, one command.

## The User Problem
Setting up SnowRaven on a Pi today means reading a multi-step guide, installing system dependencies manually, cloning the repo, building the frontend, creating a venv, copying a systemd unit, and reloading the daemon. That's a long path for someone who just wants their birding tool running on their home server.

## Success Criteria
- Running `curl -fsSL [url] | sh` (or `bash install.sh`) sets up a working SnowRaven instance
- The user reaches the app in a browser without any additional manual steps
- The service install auto-starts on boot and survives a reboot
- The local install leaves a clear instruction for how to start the app
- Errors at any step are caught with a clear message — no silent partial installs

## Scope
- Single script, `install.sh`, at the repo root
- Two modes: service install (systemd, auto-start) and local install (deps + build only)
- Targets Raspberry Pi OS (Debian/Ubuntu apt-based systems)
- System dependency installation (git, python3, pip, node, npm)
- Repo clone, frontend build, Python venv setup
- `.env` configuration prompt for API keys — with a clear note that keys can be skipped and entered later through the app's Settings interface
- Systemd unit file deployment (service mode)
- Success message with access URL

## Out of Scope
- Non-Debian Linux distros (RPM, Arch, Alpine) — scope to apt only for now
- Docker or container-based install
- Windows or macOS
- Uninstall script
- Auto-update on install (that's `update.sh`'s job)
- Any change to the web app or backend code

## Key Decisions
- Script wraps everything in a `main()` function — partial downloads never execute half the setup
- Two modes presented as a clear prompt at the start — no flags required
- User `pi` is not hardcoded; script detects `$USER` and uses the current user
- Node/npm installed via NodeSource if not already present (handles Raspberry Pi OS which ships an old Node)
- Script is idempotent where possible — re-running won't break an existing install
- API key prompt explicitly tells the user they can skip and configure via Settings later
