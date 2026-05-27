# Roadmap

This is a living document. It reflects the current best thinking
on what to build next — not a contract. Things change as you learn
more about your users and your product. Update it freely.

---

## Shipped

34 versions shipped. Last shipped: **Linux installer (`install.sh`)** -- one-command installer for Raspberry Pi and Debian/Ubuntu systems; handles system packages, Node.js, repo clone/pull, frontend build, Python venv, API key setup, and optional systemd service registration.

Previously: **Desktop app foundation (Phase 1)** -- pure TypeScript port of the Python weather formatter with a 61-test golden suite proving byte-for-byte equivalence; first milestone toward a fully standalone Tauri app.

---

## Up Next

1. **Mobile app** — A native mobile app for iOS App Store distribution, with an Android release to follow. Designed for the full feature set on a phone-sized screen.

2. **Accessibility, clarity, and simplification** — Make the app more accessible, cleaner, and easier to use. Audit the UI for complexity that can be removed, streamline the most common workflows, and ensure the app is usable by people who rely on assistive technology.
