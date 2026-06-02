# Roadmap

This is a living document. It reflects the current best thinking
on what to build next — not a contract. Things change as you learn
more about your users and your product. Update it freely.

---

## Shipped

43 versions shipped. Last shipped: **Map Explorer mobile fullscreen + ocean-tone backdrop (v0.5.4)** -- on small screens a fullscreen button next to Filters expands the map to fill the whole viewport (header, tab selector, and mode tabs hidden); and the empty area around the world map now uses an ocean tone instead of grey.

Previously: **Heatmap intensity parity + desktop clipboard auto-copy (v0.5.3)** -- the Species Detail map's Heatmap mode gained the same 1–10 intensity slider as the Map Explorer (shared `lib/heat.ts` model), and weather now auto-copies to the clipboard in the macOS/Windows desktop apps (native Tauri clipboard via a new clipboard seam), matching the web app.

Previously: **Map Explorer — shade atlas blocks by your highest breeding code (v0.5.2)** -- with the atlas overlay on, a "Shade by My Highest Breeding Code" toggle tints each block by the strongest breeding code the user has personally entered there (client-side spatial join over the loaded eBird backup), and a separate "Use Textures" toggle (off by default) adds a per-tier hatch pattern for colorblind-friendly, color-independent reading. The overlay now appears in all three map views and draws from higher zoom levels.

Previously: **Map Explorer heatmap improvement (v0.5.1)** -- the My Sightings heatmap now spreads into a readable density gradient with a Heatmap Intensity slider that scales coverage, saturation, and per-point weight so even sparse areas stand out.

Earlier: **Map Explorer — California atlas blocks + nearest unvisited hotspots (v0.5.0)** -- a toggle overlays official California Breeding Bird Atlas block boundaries (generated at runtime from a compact bundled gazetteer), and the Hotspots panel auto-lists the ten closest unvisited hotspots as eBird links.

---

## Up Next

1. **Mobile app** — A native mobile app for iOS App Store distribution, with an Android release to follow. Designed for the full feature set on a phone-sized screen. Inherits the responsive navigation and the platform seams hardened during the Windows release.

2. **Accessibility, clarity, and simplification** — Make the app more accessible, cleaner, and easier to use. Audit the UI for complexity that can be removed, streamline the most common workflows, and ensure the app is usable by people who rely on assistive technology.

3. **Windows code signing** — Add Authenticode signing to the Windows build to remove the first-launch SmartScreen "unknown publisher" warning. (Native Windows geolocation, the other half of this item, shipped in v0.4.1.)
