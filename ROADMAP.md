# Roadmap

This is a living document. It reflects the current best thinking
on what to build next — not a contract. Things change as you learn
more about your users and your product. Update it freely.

---

## Shipped

32 versions shipped. Last shipped: **Desktop app foundation (Phase 0)** -- Tauri v2 project structure, transport and storage seams, platform detection; architectural foundation for the Mac and Windows standalone app; no user-visible change to the web app in Phase 0.

Previously: **In-app help documentation** -- full-screen overlay accessible from the top of Settings; `docs/HELP.md` bundled at build time via Vite `?raw` import; always available offline; covers all tabs, API key setup, and file instructions.

---

## Up Next

1. **Mobile app** — A native mobile app for iOS App Store distribution, with an Android release to follow. Designed for the full feature set on a phone-sized screen.

2. **Accessibility, clarity, and simplification** — Make the app more accessible, cleaner, and easier to use. Audit the UI for complexity that can be removed, streamline the most common workflows, and ensure the app is usable by people who rely on assistive technology.
