# Handoff — linux-install-script (Complete)

**Feature:** Linux one-command installer
**Status:** Complete — both sessions finished, deployed, chronicled
**Date:** 2026-05-27

---

## What was built

A single shell script (`install.sh`) at the repo root that installs SnowRaven on
Raspberry Pi or any Debian/Ubuntu system with one command:

```bash
curl -fsSL https://raw.githubusercontent.com/dtgibson/snowraven/main/install.sh | bash
```

The installer handles all setup end-to-end: system packages, Node.js (via NodeSource if
needed), repo clone (or pull on existing installs), frontend build, Python virtualenv,
API key prompts, and optional systemd service registration. Two modes: service install
(auto-starts on boot) and local install (user runs `./start.sh` manually).

Key properties:
- Curl-pipe safe: all logic inside `main()` — partial downloads can't execute incomplete code
- Interactive prompts work in `curl | bash` mode via `/dev/tty`
- Idempotent: detects existing installs and offers update or abort
- `.env` written with `chmod 600`; existing `.env` preserved untouched
- Error trap names the failing step so users know exactly where to look

---

## All artifacts and files produced

**Session 1 artifacts:**
- `pipeline/linux-install-script/strategic-brief.md`
- `pipeline/linux-install-script/prd.md`
- `pipeline/linux-install-script/schema.md`
- `pipeline/linux-install-script/design-spec.md`
- `pipeline/linux-install-script/design.html`

**Session 2 deliverables:**
- `install.sh` — the installer (chmod +x, 373 lines)
- `frontend/package.json` — version bumped 0.3.26 → 0.3.27
- `src-tauri/tauri.conf.json` — version bumped 0.3.26 → 0.3.27
- `CHANGELOG.md` — v0.3.27 entry added
- `README.md` — Pi/Linux section rewritten to lead with one-command installer

**Context updates:**
- `PRODUCT_CONTEXT.md` — Linux Installer section added
- `ROADMAP.md` — shipped count 33 → 34, last shipped updated

---

## This feature is complete.

To start the next feature, run `/new-feature`.
