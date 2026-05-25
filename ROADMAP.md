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

1. **Nemesis bird map** — Leaflet map in Other Statistics showing where each nemesis bird was most recently reported. Requires backend to return lat/lng in the nemesis API response (currently returns only commonName, recentDate, subId).
2. **Print / export view** — a clean single-column layout optimised for printing or saving as PDF, covering all three tabs.
3. **Checklist weather batch mode** — accept multiple checklist IDs at once and retrieve weather for all of them in sequence.
4. **Hotspot weather context** — look up recent weather for a hotspot by name or ID without needing a specific checklist.

---

## On the Horizon

- Localisation for non-US date/time formats
- **iOS / iPadOS / macOS App Store app** — Capacitor wrapper around the existing React codebase; all backend logic rewritten in TypeScript using native HTTP (no CORS restrictions); API keys stored in iOS Keychain via user-supplied credentials (no keys baked in); all data tabs ship unchanged; weather lookup and ML media lookup move fully client-side; Pi deployment remains the self-hosted path
