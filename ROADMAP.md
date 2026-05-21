# Roadmap

This is a living document. It reflects the current best thinking
on what to build next — not a contract. Things change as you learn
more about your users and your product. Update it freely.

---

## Shipped

28 versions shipped. Last shipped: **Species Detail visualizations** — Sightings Over Time line chart (per-year / cumulative toggle, monthly fallback for single-year species, ML overlay lines for photo/audio/video); map heatmap toggle (Pins / Heatmap, weighted by observation count, resets on species change).

Previously: **Tab filters** — county and date-range filters on the Breeding Codes, Media List, and Species Detail tabs; Total media column on the Media List; ML export county resolution via a 3-tier chain.

---

## Up Next

1. **Print / export view** — a clean single-column layout optimised for printing or saving as PDF, covering all three tabs.
2. **Checklist weather batch mode** — accept multiple checklist IDs at once and retrieve weather for all of them in sequence.
3. **Hotspot weather context** — look up recent weather for a hotspot by name or ID without needing a specific checklist.

---

## On the Horizon

- Localisation for non-US date/time formats
- **iOS / iPadOS / macOS App Store app** — Capacitor wrapper around the existing React codebase; all backend logic rewritten in TypeScript using native HTTP (no CORS restrictions); API keys stored in iOS Keychain via user-supplied credentials (no keys baked in); all data tabs ship unchanged; weather lookup and ML media lookup move fully client-side; Pi deployment remains the self-hosted path
