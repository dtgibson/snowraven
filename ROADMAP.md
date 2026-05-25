# Roadmap

This is a living document. It reflects the current best thinking
on what to build next — not a contract. Things change as you learn
more about your users and your product. Update it freely.

---

## Shipped

31 versions shipped. Last shipped: **In-app help documentation** -- full-screen overlay accessible from the top of Settings; `docs/HELP.md` bundled at build time via Vite `?raw` import; always available offline; covers all tabs, API key setup, and file instructions.

Previously: **Media card on the Statistics tab** -- four-series chart (Photo / Audio / Video / Total) with weekly/monthly/yearly/total interval controls and a per-period/cumulative toggle; Most Photographed, Most Recorded, and Most Filmed rankings moved from Other Statistics into the new card.

---

## Up Next

1. **Mac and Windows standalone app** — A signed and notarized desktop app for Mac and Windows. Users install it like any native app, no terminal or server setup required. All existing features intact; self-contained distribution outside the browser.

2. **Mobile app** — A native mobile app for iOS App Store distribution, with an Android release to follow. Designed for the full feature set on a phone-sized screen.

3. **Accessibility, clarity, and simplification** — Make the app more accessible, cleaner, and easier to use. Audit the UI for complexity that can be removed, streamline the most common workflows, and ensure the app is usable by people who rely on assistive technology.
