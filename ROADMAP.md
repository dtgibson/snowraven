# Roadmap

This is a living document. It reflects the current best thinking
on what to build next — not a contract. Things change as you learn
more about your users and your product. Update it freely.

---

## Shipped

35 versions shipped. Last shipped: **Responsive tab navigation** -- the tab bar stays a horizontal bar on desktop and collapses into a compact dropdown when the tabs would overflow (narrow windows, mobile browsers viewing the Pi install); reuses the saved tab order/visibility and sets the navigation pattern the planned mobile app will inherit.

Previously: **Linux installer (`install.sh`)** -- one-command installer for Raspberry Pi and Debian/Ubuntu systems; handles system packages, Node.js, repo clone/pull, frontend build, Python venv, API key setup, and optional systemd service registration.

---

## Up Next

1. **Windows desktop app** — A native Windows build of the Tauri app with full feature parity: everything the web/Pi and macOS clients do (weather lookup, all tabs, map explorer, settings, in-app updates, local data storage). The goal is parallel desktop releases — Pi/web, macOS, and Windows all available — before any mobile work begins. Build it mindful that a mobile app follows: keep platform-sensitive code behind the existing transport/storage/platform seams and avoid desktop-only assumptions so the mobile client can reuse the same shared core.

2. **Mobile app** — A native mobile app for iOS App Store distribution, with an Android release to follow. Designed for the full feature set on a phone-sized screen. Inherits the responsive navigation and the platform seams hardened during the Windows release.

3. **Accessibility, clarity, and simplification** — Make the app more accessible, cleaner, and easier to use. Audit the UI for complexity that can be removed, streamline the most common workflows, and ensure the app is usable by people who rely on assistive technology.
